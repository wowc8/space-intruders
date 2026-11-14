"""Live Chrome integration acceptance. Run with Vite on http://127.0.0.1:1420."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs' / 'evidence'
EVIDENCE.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1000, 'height': 840}, reduced_motion='reduce')
    errors, requests, failed_responses = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append((message.text, message.location)) if message.type == 'error' else None)
    page.on('request', lambda request: requests.append(request.url))
    page.on('response', lambda response: failed_responses.append((response.status, response.url)) if response.status >= 400 else None)
    page.goto('http://127.0.0.1:1420/', wait_until='networkidle')
    page.keyboard.press('Enter')
    page.get_by_role('button', name='START GAME').wait_for(state='hidden')
    page.keyboard.down('Space')
    # Real elapsed-time play with held fire and movement. No engine state injection.
    high = 0
    for turn in range(48):
        direction = 'ArrowRight' if turn % 2 == 0 else 'ArrowLeft'
        page.keyboard.down(direction)
        page.wait_for_timeout(1800)
        page.keyboard.up(direction)
        score = int(page.locator('#score').inner_text())
        high = max(high, score)
        if page.get_by_role('heading', name='GAME OVER').count():
            break
    page.keyboard.up('Space')
    assert high > 0, 'No alien defeated during real keyboard play'
    page.screenshot(path=str(EVIDENCE / 'integration-scored-play.png'))
    print('real play high score', high, 'lives', page.locator('#lives').inner_text(),
          'wave', page.locator('#wave').inner_text())
    if page.get_by_role('heading', name='GAME OVER').count():
        page.screenshot(path=str(EVIDENCE / 'integration-natural-gameover.png'))
        page.get_by_role('button', name='PLAY AGAIN').click()
        page.get_by_role('button', name='PLAY AGAIN').wait_for(state='hidden')
        assert page.locator('#score').inner_text() == '000000'
        print('natural game over and replay passed')
    else:
        print('natural game over not reached within 86 seconds')
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    page.get_by_role('button', name='RESUME').wait_for(state='visible')
    score_at_pause = page.locator('#score').inner_text()
    page.wait_for_timeout(1500)
    assert page.locator('#score').inner_text() == score_at_pause
    page.keyboard.up('ArrowRight')
    page.get_by_role('button', name='RESUME').click()
    page.wait_for_timeout(250)
    page.screenshot(path=str(EVIDENCE / 'integration-blur-resume.png'))
    page.reload()
    assert int(page.locator('#high-score').inner_text()) >= high
    assert not errors, (errors, failed_responses)
    assert all(url.startswith('http://127.0.0.1:1420/') for url in requests), requests
    print('reload high score, pause freeze, offline request audit and runtime errors passed')
    browser.close()
