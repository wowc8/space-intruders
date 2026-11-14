import './style.css';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('App root missing');
host.innerHTML = `<main class="shell" aria-label="Space Intruders">
  <h1>SPACE INTRUDERS</h1>
  <canvas id="game" width="800" height="700" aria-label="Game playfield"></canvas>
  <p>Desktop foundation ready. Gameplay and presentation follow in the next tasks.</p>
</main>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
if (ctx) {
  ctx.fillStyle = '#090d1a';
  ctx.fillRect(0, 0, 800, 700);
  ctx.fillStyle = '#60e9e5';
  ctx.font = 'bold 44px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('SPACE INTRUDERS', 400, 330);
}
