import { FIELD_HEIGHT, FIELD_WIDTH, type GameEvent, type GameState } from '../game/types';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
const COLORS = ['#69e5e8', '#c699ff', '#f6bb74', '#86efc4', '#f06f99'];
const STARS = Array.from({ length: 88 }, (_, i) => ({
  x: ((i * 193 + 61) % 787) + 6,
  y: ((i * 337 + 137) % 610) + 28,
  r: i % 11 === 0 ? 1.6 : i % 3 === 0 ? 1 : 0.6,
  a: 0.15 + (i % 7) * 0.055,
}));

function polygon(ctx: CanvasRenderingContext2D, points: number[], fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private reducedMotion = false;
  private lastFrame = 0;
  private observer: ResizeObserver | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is required');
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    query.addEventListener?.('change', event => { this.reducedMotion = event.matches; this.particles = []; });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const box = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(box.width * dpr));
    const height = Math.max(1, Math.round(box.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  event(event: GameEvent): void {
    if (this.reducedMotion || event.type !== 'explosion') return;
    const color = event.target === 'player' ? '#7be8ef' : event.target === 'saucer' ? '#f19bc2' : '#f5bb80';
    for (let i = 0; i < 11; i++) {
      const angle = i * Math.PI * 2 / 11;
      const speed = 28 + (i % 4) * 18;
      this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45, maxLife: 0.45, color, size: i % 3 === 0 ? 3 : 2 });
    }
  }

  draw(state: GameState, time: number): void {
    this.resize();
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / FIELD_WIDTH, 0, 0, this.canvas.height / FIELD_HEIGHT, 0, 0);
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    gradient.addColorStop(0, '#0b1726');
    gradient.addColorStop(0.58, '#08101e');
    gradient.addColorStop(1, '#111727');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    this.drawBackground(time);
    this.drawBunkers(state);
    this.drawAliens(state, time);
    this.drawSaucer(state);
    this.drawProjectiles(state);
    this.drawPlayer(state);
    this.drawParticles(time);
    ctx.strokeStyle = 'rgba(110,224,228,.27)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(28, 672); ctx.lineTo(772, 672); ctx.stroke();
    ctx.fillStyle = 'rgba(171,233,239,.42)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SECTOR ${String(state.wave).padStart(2, '0')}`, 34, 692);
    ctx.textAlign = 'right';
    ctx.fillText('SPACE INTRUDERS // DEFENSE GRID', 766, 692);
  }

  private drawBackground(time: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(83,126,149,.09)';
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD_WIDTH; x += 80) { ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, 626); ctx.stroke(); }
    for (let y = 74; y < 626; y += 70) { ctx.beginPath(); ctx.moveTo(26, y); ctx.lineTo(774, y); ctx.stroke(); }
    for (const star of STARS) {
      const alpha = this.reducedMotion ? star.a : star.a * (0.8 + 0.2 * Math.sin(time * 0.0015 + star.x));
      ctx.fillStyle = `rgba(190,233,246,${alpha})`;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.fillStyle = 'rgba(98,227,231,.07)';
    ctx.fillRect(22, 22, 756, 604);
    ctx.strokeStyle = 'rgba(112,226,230,.18)';
    ctx.strokeRect(22.5, 22.5, 755, 603);
  }

  private drawAliens(state: GameState, time: number): void {
    const ctx = this.ctx;
    for (const alien of state.aliens) {
      if (!alien.alive) continue;
      const color = COLORS[alien.row] ?? COLORS[0];
      const x = alien.x, y = alien.y, w = alien.width, h = alien.height;
      ctx.save();
      ctx.shadowBlur = 13; ctx.shadowColor = color;
      ctx.fillStyle = color;
      const bob = this.reducedMotion ? 0 : ((Math.floor(time / 420) + alien.col) % 2) * 2;
      if (alien.row === 0) {
        polygon(ctx, [x+w*.5,y, x+w*.83,y+h*.32, x+w,y+h*.72, x+w*.75,y+h*.72, x+w*.65,y+h, x+w*.35,y+h, x+w*.25,y+h*.72, x,y+h*.72, x+w*.17,y+h*.32], color);
        ctx.fillStyle = '#122236'; ctx.fillRect(x+w*.35,y+h*.43,w*.1,h*.11); ctx.fillRect(x+w*.57,y+h*.43,w*.1,h*.11);
      } else if (alien.row < 3) {
        polygon(ctx, [x+w*.18,y+h*.2, x+w*.35,y, x+w*.65,y, x+w*.82,y+h*.2, x+w,y+h*.7, x+w*.84,y+h*.86, x+w*.68,y+h*.62, x+w*.32,y+h*.62, x+w*.16,y+h*.86, x,y+h*.7], color);
        ctx.fillStyle = '#122236'; ctx.fillRect(x+w*.26,y+h*.32,w*.13,h*.13); ctx.fillRect(x+w*.61,y+h*.32,w*.13,h*.13);
      } else {
        polygon(ctx, [x+w*.22,y, x+w*.78,y, x+w,y+h*.42, x+w*.85,y+h*.8+bob, x+w*.68,y+h*.62, x+w*.5,y+h, x+w*.32,y+h*.62, x+w*.15,y+h*.8+bob, x,y+h*.42], color);
        ctx.fillStyle = '#122236'; ctx.fillRect(x+w*.27,y+h*.32,w*.13,h*.13); ctx.fillRect(x+w*.6,y+h*.32,w*.13,h*.13);
      }
      ctx.restore();
    }
  }

  private drawBunkers(state: GameState): void {
    const ctx = this.ctx;
    ctx.save(); ctx.fillStyle = '#6dd9b2'; ctx.shadowBlur = 7; ctx.shadowColor = '#61e1af';
    for (const bunker of state.bunkers) for (const cell of bunker.cells) {
      if (cell.alive) ctx.fillRect(cell.x + 0.7, cell.y + 0.7, Math.max(1, cell.width - 1.4), Math.max(1, cell.height - 1.4));
    }
    ctx.restore();
  }

  private drawPlayer(state: GameState): void {
    if (state.phase === 'title') return;
    const ctx = this.ctx, p = state.player;
    if (p.invulnerableFor > 0 && !this.reducedMotion && state.tick % 10 < 5) return;
    ctx.save(); ctx.shadowColor = '#74e5ee'; ctx.shadowBlur = 18;
    polygon(ctx, [p.x, p.y+p.height, p.x+p.width*.17,p.y+p.height*.35, p.x+p.width*.38,p.y+p.height*.35, p.x+p.width*.5,p.y, p.x+p.width*.62,p.y+p.height*.35, p.x+p.width*.83,p.y+p.height*.35, p.x+p.width,p.y+p.height], '#76e6ed');
    ctx.fillStyle = '#d9fcff'; ctx.fillRect(p.x+p.width*.43,p.y+p.height*.25,p.width*.14,p.height*.44);
    ctx.restore();
  }

  private drawSaucer(state: GameState): void {
    const s = state.saucer; if (!s.active) return;
    const ctx = this.ctx;
    ctx.save(); ctx.shadowColor = '#f386ae'; ctx.shadowBlur = 18;
    polygon(ctx, [s.x,s.y+s.height*.65, s.x+s.width*.17,s.y+s.height*.35, s.x+s.width*.35,s.y+s.height*.35, s.x+s.width*.42,s.y, s.x+s.width*.58,s.y, s.x+s.width*.65,s.y+s.height*.35, s.x+s.width*.83,s.y+s.height*.35, s.x+s.width,s.y+s.height*.65, s.x+s.width*.82,s.y+s.height, s.x+s.width*.18,s.y+s.height], '#ef8eaf');
    ctx.fillStyle = '#fff0d9'; ctx.fillRect(s.x+s.width*.24,s.y+s.height*.68,s.width*.12,2); ctx.fillRect(s.x+s.width*.64,s.y+s.height*.68,s.width*.12,2);
    ctx.restore();
  }

  private drawProjectiles(state: GameState): void {
    const ctx = this.ctx;
    for (const shot of state.projectiles) {
      const color = shot.owner === 'player' ? '#c9fbff' : '#ffc48f';
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color;
      ctx.fillRect(shot.x, shot.y, shot.width, shot.height);
      ctx.restore();
    }
  }

  private drawParticles(time: number): void {
    if (!this.lastFrame) this.lastFrame = time;
    const dt = Math.min(0.05, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    const ctx = this.ctx;
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
