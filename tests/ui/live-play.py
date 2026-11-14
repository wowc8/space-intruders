"""Optional live Chrome check: python3 tests/ui/live-play.py (requires Playwright and Chrome)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:1420/'
EVIDENCE = Path(__file__).resolve().parents[2] / 'docs' / 'evidence'
EVIDENCE.mkdir(parents=True, exist_ok=True)


def geometry(page):
    return page.evaluate("""() => {
      const rect = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return {top: box.top, bottom: box.bottom, left: box.left,
          right: box.right, width: box.width, height: box.height};
      };
      return {scrollWidth: document.body.scrollWidth,
        scrollHeight: document.body.scrollHeight,
        screen: rect('.screen-wrap'), panel: rect('.panel'),
        footer: rect('.footbar'), canvas: rect('canvas')};
    }""")


def fits(page, label):
    box = geometry(page)
    assert box['scrollWidth'] <= page.viewport_size['width'] + 1, (label, box)
    assert box['scrollHeight'] <= page.viewport_size['height'] + 1, (label, box)
    assert box['footer']['bottom'] <= page.viewport_size['height'], (label, box)
    assert abs(box['canvas']['width'] / box['canvas']['height'] - 800 / 700) < .002, (label, box)
    if box['panel']:
        assert box['panel']['top'] >= box['screen']['top'], (label, box)
        assert box['panel']['bottom'] <= box['screen']['bottom'], (label, box)
    print(label, 'fits', box['screen']['width'], 'x', box['screen']['height'])


def player_x(page):
    return page.evaluate("""() => {
      const canvas = document.querySelector('canvas');
      const context = canvas.getContext('2d');
      const xScale = canvas.width / 800, yScale = canvas.height / 700;
      let positions = [];
      for (let y = Math.floor(643*yScale); y < Math.floor(663*yScale); y++)
        for (let x = 0; x < canvas.width; x++) {
          const pixel = context.getImageData(x, y, 1, 1).data;
          if (pixel[0] > 90 && pixel[1] > 190 && pixel[2] > 190)
            positions.push(x / xScale);
        }
      return positions.length ? positions.reduce((a,b) => a+b, 0) / positions.length : -1;
    }""")


def shot_pixels(page, ship_x):
    return page.evaluate("""shipX => {
      const canvas = document.querySelector('canvas');
      const context = canvas.getContext('2d');
      const xs = canvas.width / 800, ys = canvas.height / 700;
      let count = 0;
      for (let y = Math.floor(530*ys); y < Math.floor(635*ys); y++)
        for (let x = Math.floor((shipX-8)*xs); x < Math.floor((shipX+25)*xs); x++) {
          const p = context.getImageData(x, y, 1, 1).data;
          if (p[0] > 180 && p[1] > 225 && p[2] > 230) count++;
        }
      return count;
    }""", ship_x)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    for width, height in [(1000, 840), (640, 600)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1,
            reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='networkidle')
        fits(page, f'{width}x{height} title')
        page.screenshot(path=str(EVIDENCE / f'{width}x{height}-title.png'))
        page.get_by_role('button', name='HOW TO PLAY').click()
        fits(page, f'{width}x{height} help')
        page.screenshot(path=str(EVIDENCE / f'{width}x{height}-help.png'))
        page.keyboard.press('Escape')
        page.get_by_role('button', name='START GAME').click()
        page.wait_for_timeout(100)
        before = player_x(page)
        assert before > 0, ('player absent', width, height)
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(280)
        page.keyboard.up('ArrowRight')
        after = player_x(page)
        assert after > before + 35, ('player did not move', before, after)
        page.keyboard.down('Space')
        visible_shot = 0
        for _ in range(10):
            page.wait_for_timeout(30)
            visible_shot = shot_pixels(page, after)
            if visible_shot >= 4:
                break
        page.screenshot(path=str(EVIDENCE / f'{width}x{height}-playing.png'))
        print('play pixels', width, height, before, after, visible_shot)
        assert visible_shot >= 4, ('projectile not visible', visible_shot)
        page.keyboard.up('Space')
        fits(page, f'{width}x{height} playing')
        page.keyboard.press('Escape')
        page.get_by_role('button', name='RESUME').wait_for(state='visible')
        fits(page, f'{width}x{height} pause')
        page.screenshot(path=str(EVIDENCE / f'{width}x{height}-pause.png'))
        page.get_by_role('button', name='RESUME').click()
        page.get_by_role('button', name='RESUME').wait_for(state='hidden')
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.get_by_role('button', name='RESUME').wait_for(state='visible')
        page.get_by_role('button', name='RESTART').click()
        page.get_by_role('button', name='RESTART').wait_for(state='hidden')
        page.keyboard.press('Escape')
        page.get_by_role('button', name='MAIN MENU').click()
        page.get_by_role('button', name='START GAME').wait_for(state='visible')
        page.get_by_role('button', name='Mute audio').click()
        assert page.get_by_role('button', name='Unmute audio').get_attribute('aria-pressed') == 'true'
        page.get_by_role('slider', name='Volume').fill('20')
        page.reload()
        assert page.get_by_role('slider', name='Volume').input_value() == '20'
        assert page.get_by_role('button', name='Unmute audio').get_attribute('aria-pressed') == 'true'
        page.evaluate("localStorage.setItem('space-intruders.save.v1', '{broken')")
        page.reload()
        assert page.get_by_role('button', name='Mute audio').get_attribute('aria-pressed') == 'false'
        page.evaluate("() => { HTMLElement.prototype.requestFullscreen = () => Promise.reject(Error('denied')); return true; }")
        page.get_by_role('button', name='Toggle fullscreen').click()
        assert page.locator('.fullscreen-fallback').count() == 1
        assert page.get_by_role('button', name='Exit fullscreen').count() == 1
        page.get_by_role('button', name='Exit fullscreen').click()
        assert page.locator('.fullscreen-fallback').count() == 0
        assert page.get_by_role('button', name='Toggle fullscreen').count() == 1
        assert not errors, errors
        page.close()
    browser.close()
print('Live play and interaction checks passed; screenshots saved in docs/evidence.')
