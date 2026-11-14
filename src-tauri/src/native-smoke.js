// Runs only when SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT is set on this app process.
// Synthetic events exercise the packaged desktop webview without automation privileges.
(() => {
  if (window.__spaceIntrudersNativeSmokeStarted) return;
  window.__spaceIntrudersNativeSmokeStarted = true;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  const phase = () => document.querySelector('#overlay')?.textContent?.trim() || 'playing';
  const score = () => Number(document.querySelector('#score')?.textContent || 0);
  const report = { mode: 'opt-in synthetic desktop webview input', location: location.href, checkpoints: [] };
  report.environment = { visibility: document.visibilityState, hidden: document.hidden, width: innerWidth, height: innerHeight };
  let animationFrameCount = 0;
  const countFrame = () => { animationFrameCount++; requestAnimationFrame(countFrame); };
  requestAnimationFrame(countFrame);
  const canvasPng = () => {
    const source = document.querySelector('#game');
    if (!source) return undefined;
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 400; thumbnail.height = 350;
    thumbnail.getContext('2d')?.drawImage(source, 0, 0, 400, 350);
    return thumbnail.toDataURL('image/png');
  };
  const capture = name => report.checkpoints.push({
    name, phase: phase(), score: score(), animationFrameCount,
    lives: document.querySelector('#lives')?.textContent,
    image: ['title', 'played', 'paused'].includes(name) ? canvasPng() : undefined
  });
  const run = async () => {
    await delay(500);
    capture('title');
    document.querySelector('[data-action="help"]')?.click();
    await delay(100); capture('help');
    document.querySelector('[data-action="back"]')?.click();
    document.querySelector('[data-action="start"]')?.click();
    await delay(200); capture('started');
    key('keydown', 'Space');
    key('keydown', 'ArrowLeft');
    await delay(4000);
    key('keyup', 'ArrowLeft');
    key('keydown', 'ArrowRight');
    await delay(4000);
    key('keyup', 'ArrowRight');
    await delay(4000);
    key('keyup', 'Space');
    capture('played');
    key('keydown', 'Escape');
    await delay(200); capture('paused');
    document.querySelector('[data-action="resume"]')?.click();
    await delay(200); capture('resumed');
    report.passed = ['tauri://localhost', 'tauri://localhost/', 'http://tauri.localhost', 'http://tauri.localhost/'].includes(report.location)
      && report.checkpoints[2].phase === 'playing'
      && report.checkpoints[3].score > 0
      && report.checkpoints[4].phase.includes('PAUSED')
      && report.checkpoints[4].score === report.checkpoints[3].score
      && report.checkpoints[5].phase === 'playing';
    await window.__TAURI_INTERNALS__.invoke('native_smoke_report', { payload: JSON.stringify(report) });
  };
  run().catch(async error => {
    report.error = String(error);
    for (const checkpoint of report.checkpoints) delete checkpoint.image;
    await window.__TAURI_INTERNALS__.invoke('native_smoke_report', { payload: JSON.stringify(report) });
  });
})();
