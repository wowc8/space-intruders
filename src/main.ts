import './style.css';
import { createGame, stepGame } from './game/engine';
import { FIXED_DT, type GameCommand, type GameInput, type GamePhase, type GameState } from './game/types';
import { ArcadeAudio } from './ui/audio';
import { GameRenderer } from './ui/renderer';
import { loadSave, writeSave } from './ui/storage';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('App root missing');
host.innerHTML = `<main class="cabinet" aria-label="Space Intruders game">
  <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><div><div class="eyebrow">ARCADE / 001</div><h1>SPACE <span>INTRUDERS</span></h1></div></div><div class="top-actions"><button id="mute" class="icon-button" type="button" aria-label="Mute audio" aria-pressed="false">♪</button><label class="volume-label" for="volume">VOL</label><input id="volume" type="range" min="0" max="100" value="45" aria-label="Volume"><button id="fullscreen" class="icon-button" type="button" aria-label="Toggle fullscreen">⛶</button></div></header>
  <section class="dashboard" aria-label="Game scores"><div class="stat"><span class="stat-label">SCORE</span><strong id="score">000000</strong></div><div class="stat"><span class="stat-label">HIGH SCORE</span><strong id="high-score">000000</strong></div><div class="stat"><span class="stat-label">WAVE</span><strong id="wave">01</strong></div><div class="stat lives"><span class="stat-label">LIVES</span><strong id="lives">◆ ◆ ◆</strong></div></section>
  <section class="screen-wrap" aria-label="Arcade playfield"><canvas id="game" width="800" height="700" role="img" aria-label="Space Intruders playfield"></canvas><div class="scanlines" aria-hidden="true"></div><div id="overlay" class="overlay"></div><div id="toast" class="toast" role="status" aria-live="polite"></div></section>
  <footer class="footbar"><span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> MOVE <span class="foot-sep">•</span> <kbd>SPACE</kbd> FIRE</span><span><kbd>ESC</kbd> PAUSE <span class="foot-sep">•</span> <kbd>M</kbd> MUTE</span></footer>
</main>`;

function required<T extends Element>(selector: string): T {
  const element = host!.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}
const canvas = required<HTMLCanvasElement>('#game');
const overlay = required<HTMLDivElement>('#overlay');
const scoreEl = required<HTMLElement>('#score');
const highEl = required<HTMLElement>('#high-score');
const waveEl = required<HTMLElement>('#wave');
const livesEl = required<HTMLElement>('#lives');
const toastEl = required<HTMLElement>('#toast');
const muteButton = required<HTMLButtonElement>('#mute');
const volumeInput = required<HTMLInputElement>('#volume');
const fullscreenButton = required<HTMLButtonElement>('#fullscreen');
const renderer = new GameRenderer(canvas);
const save = loadSave();
const audio = new ArcadeAudio(save.preferences);
let state: GameState = createGame();
let helpOpen = false;
let priorView = '';
let pendingCommand: GameCommand = 'none';
let heldFire = false;
let movementOrder: string[] = [];
let lastTime = 0;
let accumulator = 0;
let toastTimeout = 0;

const formatScore = (score: number) => String(score).padStart(6, '0');
function announce(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toastEl.classList.remove('visible'), 2400);
}
function syncAudio(): void {
  muteButton.textContent = save.preferences.muted ? '♪̸' : '♪';
  muteButton.setAttribute('aria-label', save.preferences.muted ? 'Unmute audio' : 'Mute audio');
  muteButton.setAttribute('aria-pressed', String(save.preferences.muted));
  volumeInput.value = String(Math.round(save.preferences.volume * 100));
  audio.setPreferences(save.preferences);
}
syncAudio();
function clearHeld(): void { heldFire = false; movementOrder = []; }
function command(value: GameCommand): void {
  audio.unlock(); audio.ui(); pendingCommand = value; helpOpen = false;
  if (value === 'pause' || value === 'menu' || value === 'restart') clearHeld();
}
function currentMove(): -1 | 0 | 1 {
  const key = movementOrder[movementOrder.length - 1];
  return key === 'ArrowLeft' || key === 'KeyA' ? -1 : key === 'ArrowRight' || key === 'KeyD' ? 1 : 0;
}
function step(commandValue: GameCommand = 'none', dt = FIXED_DT): void {
  const input: GameInput = { move: currentMove(), fire: heldFire, command: commandValue };
  state = stepGame(state, input, dt);
  for (const event of state.events) {
    audio.play(event); renderer.event(event);
    if (event.type === 'extra-life') announce('EXTRA LIFE AWARDED');
    if (event.type === 'wave-clear') announce(`WAVE ${event.wave} CLEARED`);
  }
  if (state.score > save.highScore) { save.highScore = state.score; writeSave(save); }
}
function viewMarkup(phase: GamePhase, help: boolean): string {
  if (help) return `<div class="panel help-panel"><div class="eyebrow">FIELD MANUAL / 01</div><h2>DEFEND THE LINE</h2><p>Move your cannon, break through the formation and protect the ground line. Your shields absorb shots from both sides.</p><div class="help-grid"><span>MOVE</span><strong>← → or A D</strong><span>FIRE</span><strong>SPACE</strong><span>PAUSE</span><strong>ESC or P</strong><span>AUDIO</span><strong>M</strong></div><p class="small">Three lives. Earn one extra at 1,500 points. Clear a wave to advance.</p><button class="primary" data-action="back" type="button">BACK</button></div>`;
  if (phase === 'title') return `<div class="panel title-panel"><div class="panel-emblem" aria-hidden="true">✦</div><div class="eyebrow">EARTH DEFENSE / SYSTEM READY</div><h2>SPACE<br><span>INTRUDERS</span></h2><p>One ship. Four shields. An endless sky.</p><div class="button-stack"><button class="primary" data-action="start" type="button">START GAME <span aria-hidden="true">↗</span></button><button class="secondary" data-action="help" type="button">HOW TO PLAY</button></div><div class="panel-note">PRESS ENTER TO LAUNCH</div></div>`;
  if (phase === 'paused') return `<div class="panel small-panel"><div class="eyebrow">SYSTEM HOLD</div><h2>PAUSED</h2><p>Your sector is secure for now.</p><div class="button-stack"><button class="primary" data-action="resume" type="button">RESUME</button><button class="secondary" data-action="restart" type="button">RESTART</button><button class="secondary" data-action="menu" type="button">MAIN MENU</button></div></div>`;
  if (phase === 'game-over') return `<div class="panel small-panel"><div class="eyebrow">SIGNAL LOST</div><h2>GAME OVER</h2><p class="result-score">${formatScore(state.score)}</p><p>High score ${formatScore(save.highScore)}</p><div class="button-stack"><button class="primary" data-action="restart" type="button">PLAY AGAIN</button><button class="secondary" data-action="menu" type="button">MAIN MENU</button></div></div>`;
  if (phase === 'wave-clear') return `<div class="wave-banner" aria-live="polite"><span class="eyebrow">SECTOR SECURED</span><strong>WAVE ${state.wave} CLEARED</strong></div>`;
  return '';
}
function syncView(): void {
  scoreEl.textContent = formatScore(state.score);
  highEl.textContent = formatScore(save.highScore);
  waveEl.textContent = String(state.wave).padStart(2, '0');
  livesEl.textContent = state.lives > 0 ? Array.from({ length: state.lives }, () => '◆').join(' ') : '—';
  livesEl.setAttribute('aria-label', `${state.lives} lives`);
  const view = `${state.phase}:${helpOpen}`;
  if (view !== priorView) {
    priorView = view; overlay.innerHTML = viewMarkup(state.phase, helpOpen);
    overlay.classList.toggle('inactive', !overlay.innerHTML);
    if (state.phase === 'paused' || state.phase === 'game-over') overlay.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
}
overlay.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLButtonElement>('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'help') { audio.unlock(); audio.ui(); helpOpen = true; syncView(); }
  else if (action === 'back') { audio.ui(); helpOpen = false; syncView(); }
  else if (action === 'start' || action === 'resume' || action === 'restart' || action === 'menu') command(action);
});
muteButton.addEventListener('click', () => { audio.unlock(); save.preferences.muted = !save.preferences.muted; syncAudio(); writeSave(save); if (!save.preferences.muted) audio.ui(); });
volumeInput.addEventListener('input', () => { audio.unlock(); save.preferences.volume = Number(volumeInput.value) / 100; syncAudio(); writeSave(save); });
let fallbackFullscreen = false;
async function toggleFullscreen(): Promise<void> {
  const cabinet = required<HTMLElement>('.cabinet');
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    fullscreenButton.setAttribute('aria-label', 'Toggle fullscreen');
    renderer.resize();
    return;
  }
  if (fallbackFullscreen) {
    fallbackFullscreen = false; cabinet.classList.remove('fullscreen-fallback');
    fullscreenButton.setAttribute('aria-label', 'Toggle fullscreen');
    renderer.resize();
    return;
  }
  try { if (!cabinet.requestFullscreen) throw new Error('Fullscreen unavailable'); await cabinet.requestFullscreen(); }
  catch { fallbackFullscreen = true; cabinet.classList.add('fullscreen-fallback'); announce('FULL WINDOW MODE'); }
  fullscreenButton.setAttribute('aria-label', 'Exit fullscreen');
  renderer.resize();
}
fullscreenButton.addEventListener('click', () => { audio.unlock(); void toggleFullscreen(); });
document.addEventListener('fullscreenchange', () => { fullscreenButton.setAttribute('aria-label', document.fullscreenElement || fallbackFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen'); renderer.resize(); });
window.addEventListener('keydown', event => {
  const code = event.code;
  const interactive = event.target instanceof HTMLElement && !!event.target.closest('button, input');
  if (code === 'KeyM' && !event.repeat && !interactive) { save.preferences.muted = !save.preferences.muted; syncAudio(); writeSave(save); if (!save.preferences.muted) { audio.unlock(); audio.ui(); } return; }
  if (code === 'Escape') {
    event.preventDefault();
    if (helpOpen) { helpOpen = false; syncView(); }
    else if (!event.repeat && (state.phase === 'playing' || state.phase === 'wave-clear')) command('pause');
    else if (!event.repeat && state.phase === 'paused') command('resume');
    return;
  }
  if (interactive) return;
  if (code === 'KeyP' && !event.repeat) {
    if (state.phase === 'playing' || state.phase === 'wave-clear') command('pause');
    else if (state.phase === 'paused') command('resume');
  }
  if (code === 'Enter' && !event.repeat && state.phase === 'title' && !helpOpen) command('start');
  if (code === 'Space') { event.preventDefault(); if (state.phase === 'playing') { heldFire = true; audio.unlock(); } }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
    if (code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat && !movementOrder.includes(code)) movementOrder.push(code);
  }
});
window.addEventListener('keyup', event => { if (event.code === 'Space') { heldFire = false; event.preventDefault(); } movementOrder = movementOrder.filter(key => key !== event.code); });
function pauseForFocusLoss(): void {
  clearHeld();
  if (state.phase === 'playing' || state.phase === 'wave-clear') { pendingCommand = 'none'; step('pause', 0); accumulator = 0; syncView(); }
}
window.addEventListener('blur', pauseForFocusLoss);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForFocusLoss(); });
function frame(time: number): void {
  if (!lastTime) lastTime = time;
  const elapsed = Math.min(0.1, (time - lastTime) / 1000); lastTime = time;
  if (pendingCommand !== 'none') { const next = pendingCommand; pendingCommand = 'none'; step(next, 0); accumulator = 0; }
  if (state.phase === 'playing' || state.phase === 'wave-clear') {
    accumulator = Math.min(accumulator + elapsed, FIXED_DT * 5);
    let count = 0;
    while (accumulator >= FIXED_DT && count++ < 5) {
      step(); accumulator -= FIXED_DT;
      if (state.phase !== 'playing' && state.phase !== 'wave-clear') { accumulator = 0; break; }
    }
  } else accumulator = 0;
  renderer.draw(state, time); syncView(); requestAnimationFrame(frame);
}
syncView(); requestAnimationFrame(frame);
