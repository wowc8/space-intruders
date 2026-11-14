import { FIELD_WIDTH, type Alien, type Bunker, type GameInput, type GameState, type Projectile } from './types.ts';
const DEFAULT_SEED = 0x51a7e;
const PLAYER_Y = 641;
const ALIEN_BOTTOM = 612;
const SHOT_LIMIT = 3;
const SCORE = [30, 20, 20, 10, 10];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const random = (s: GameState): number => {
  s.rngState = (Math.imul(s.rngState, 1664525) + 1013904223) >>> 0;
  return s.rngState / 0x100000000;
};

function aliensForWave(): Alien[] {
  return Array.from({ length: 55 }, (_, id) => ({
    id, row: Math.floor(id / 11), col: id % 11,
    x: 93 + (id % 11) * 55, y: 105 + Math.floor(id / 11) * 42,
    width: 32, height: 25, alive: true,
  }));
}

function bunkersForWave(): Bunker[] {
  return Array.from({ length: 4 }, (_, id) => ({
    id,
    cells: Array.from({ length: 36 }, (_, i) => {
      const row = Math.floor(i / 9), col = i % 9;
      return { x: 96 + id * 170 + col * 9, y: 531 + row * 9,
        width: 9, height: 9, alive: !(row >= 2 && col >= 3 && col <= 5) };
    }),
  }));
}

export function createGame(seed = DEFAULT_SEED): GameState {
  const normalized = Number.isFinite(seed) ? seed >>> 0 : DEFAULT_SEED;
  return {
    phase: 'title', phaseBeforePause: 'playing', wave: 1, score: 0, lives: 3,
    extraLifeAwarded: false, seed: normalized, rngState: normalized, tick: 0,
    player: { x: 384, y: PLAYER_Y, width: 32, height: 22, speed: 310,
      invulnerableFor: 0, fireCooldown: 0 },
    aliens: aliensForWave(), projectiles: [], bunkers: bunkersForWave(),
    saucer: { x: -52, y: 55, width: 43, height: 19, active: false,
      direction: 1, speed: 105 },
    formation: { direction: 1, speed: 34, stepDown: 18 },
    enemyFireTimer: 1.35, saucerTimer: 13, waveClearTimer: 0,
    nextProjectileId: 1, events: [],
  };
}

function copy(s: GameState): GameState {
  return { ...s, player: { ...s.player }, aliens: s.aliens.map(a => ({ ...a })),
    projectiles: s.projectiles.map(p => ({ ...p })),
    bunkers: s.bunkers.map(b => ({ ...b, cells: b.cells.map(c => ({ ...c })) })),
    saucer: { ...s.saucer }, formation: { ...s.formation }, events: [] };
}

function newRun(seed: number): GameState {
  const s = createGame(seed);
  s.phase = 'playing';
  return s;
}

function score(s: GameState, points: number, x: number, y: number): void {
  s.score += points;
  s.events.push({ type: 'score', points, total: s.score, x, y });
  if (!s.extraLifeAwarded && s.score >= 1500) {
    s.extraLifeAwarded = true;
    s.lives++;
    s.events.push({ type: 'extra-life', lives: s.lives });
  }
}

/** First intersection fraction of a moving projectile with a stationary rectangle. */
function hitTime(p: Projectile, dx: number, dy: number,
  box: { x: number; y: number; width: number; height: number }): number | null {
  let enter = 0, leave = 1;
  for (const [pos, delta, min, max] of [
    [p.x, dx, box.x - p.width, box.x + box.width],
    [p.y, dy, box.y - p.height, box.y + box.height],
  ]) {
    if (delta === 0) { if (pos < min || pos > max) return null; }
    else {
      const a = (min - pos) / delta, b = (max - pos) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return null;
    }
  }
  return enter;
}

function moveFormation(s: GameState, dt: number): void {
  const living = s.aliens.filter(a => a.alive);
  if (!living.length) return;
  const speed = Math.min(155, 34 + (55 - living.length) * 1.55 + (s.wave - 1) * 7);
  s.formation.speed = speed;
  const dx = s.formation.direction * speed * dt;
  const edge = s.formation.direction === 1
    ? Math.max(...living.map(a => a.x + a.width)) + dx
    : Math.min(...living.map(a => a.x)) + dx;
  const reverse = s.formation.direction === 1 ? edge >= FIELD_WIDTH - 28 : edge <= 28;
  for (const a of s.aliens) {
    a.x += dx;
    if (reverse) a.y += s.formation.stepDown;
  }
  if (reverse) s.formation.direction = s.formation.direction === 1 ? -1 : 1;
  for (const a of living) {
    if (a.y + a.height >= ALIEN_BOTTOM) {
      s.phase = 'game-over';
      s.events.push({ type: 'game-over', reason: 'invasion' });
      return;
    }
    for (const b of s.bunkers) for (const c of b.cells) {
      if (c.alive && a.x < c.x + c.width && a.x + a.width > c.x &&
          a.y < c.y + c.height && a.y + a.height > c.y) c.alive = false;
    }
  }
}

function spawnShot(s: GameState, owner: 'player' | 'alien', x: number, y: number): void {
  s.projectiles.push({ id: s.nextProjectileId++, owner, x, y, vx: 0,
    vy: owner === 'player' ? -590 : 225 + Math.min(100, (s.wave - 1) * 12),
    width: 4, height: 13 });
  s.events.push({ type: 'shot', owner, x, y });
}

function updateProjectiles(s: GameState, dt: number): void {
  const kept: Projectile[] = [];
  for (const p of s.projectiles) {
    const dx = p.vx * dt, dy = p.vy * dt;
    let earliest = Infinity;
    let target: { kind: 'cell' | 'alien' | 'player' | 'saucer'; index: number; cell?: number } | null = null;
    const consider = (kind: 'cell' | 'alien' | 'player' | 'saucer', index: number,
      box: { x: number; y: number; width: number; height: number }, cell?: number) => {
      const t = hitTime(p, dx, dy, box);
      if (t !== null && t < earliest) { earliest = t; target = { kind, index, cell }; }
    };
    for (let bi = 0; bi < s.bunkers.length; bi++)
      for (let ci = 0; ci < s.bunkers[bi].cells.length; ci++) {
        const c = s.bunkers[bi].cells[ci];
        if (c.alive) consider('cell', bi, c, ci);
      }
    if (p.owner === 'player') {
      for (let i = 0; i < s.aliens.length; i++) if (s.aliens[i].alive)
        consider('alien', i, s.aliens[i]);
      if (s.saucer.active) consider('saucer', 0, s.saucer);
    } else if (s.player.invulnerableFor <= 0) consider('player', 0, s.player);
    if (target) {
      const t: { kind: 'cell' | 'alien' | 'player' | 'saucer'; index: number; cell?: number } = target;
      const x = p.x + dx * earliest, y = p.y + dy * earliest;
      if (t.kind === 'cell') {
        s.bunkers[t.index].cells[t.cell!].alive = false;
        s.events.push({ type: 'explosion', target: 'bunker', x, y });
      } else if (t.kind === 'alien') {
        const a = s.aliens[t.index]; a.alive = false;
        s.events.push({ type: 'explosion', target: 'alien', x: a.x, y: a.y });
        score(s, SCORE[a.row], a.x, a.y);
      } else if (t.kind === 'saucer') {
        s.saucer.active = false;
        s.events.push({ type: 'explosion', target: 'saucer', x, y });
        score(s, [50, 100, 150, 300][Math.floor(random(s) * 4)], x, y);
      } else {
        s.lives--;
        s.player.invulnerableFor = 1.6;
        s.events.push({ type: 'explosion', target: 'player', x, y },
          { type: 'life-lost', lives: s.lives });
        if (s.lives <= 0) {
          s.phase = 'game-over';
          s.events.push({ type: 'game-over', reason: 'lives' });
        }
      }
    } else {
      p.x += dx; p.y += dy;
      if (p.y + p.height >= 0 && p.y <= 700) kept.push(p);
    }
  }
  s.projectiles = kept.filter(p => p.owner === 'player' ||
    Math.abs(p.x - s.player.x) > 48 || Math.abs(p.y - s.player.y) > 75 ||
    s.player.invulnerableFor <= 0);
}

export function stepGame(state: GameState, input: GameInput, dt: number): GameState {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
  const s = copy(state);
  switch (input.command) {
    case 'restart': return newRun(s.seed);
    case 'menu': s.phase = 'title'; return s;
    case 'start': return s.phase === 'title' ? newRun(s.seed) : s;
    case 'pause':
      if (s.phase === 'playing' || s.phase === 'wave-clear') {
        s.phaseBeforePause = s.phase; s.phase = 'paused';
      }
      return s;
    case 'resume':
      if (s.phase === 'paused') s.phase = s.phaseBeforePause;
      return s;
  }
  if (s.phase !== 'playing' && s.phase !== 'wave-clear') return s;
  s.tick++;
  if (s.phase === 'wave-clear') {
    s.waveClearTimer -= dt;
    if (s.waveClearTimer <= 0) {
      s.wave++;
      s.aliens = aliensForWave(); s.bunkers = bunkersForWave();
      s.projectiles = []; s.formation = { direction: 1, speed: 34, stepDown: 18 };
      s.enemyFireTimer = 1.35; s.saucerTimer = 13;
      s.saucer.active = false; s.phase = 'playing';
    }
    return s;
  }
  s.player.x = clamp(s.player.x + input.move * s.player.speed * dt, 20, FIELD_WIDTH - 20 - s.player.width);
  s.player.invulnerableFor = Math.max(0, s.player.invulnerableFor - dt);
  s.player.fireCooldown = Math.max(0, s.player.fireCooldown - dt);
  if (input.fire && s.player.fireCooldown <= 0 && !s.projectiles.some(p => p.owner === 'player')) {
    spawnShot(s, 'player', s.player.x + s.player.width / 2 - 2, s.player.y - 14);
    s.player.fireCooldown = 0.17;
  }
  moveFormation(s, dt);
  if (s.events.some(e => e.type === 'game-over')) return s;
  s.enemyFireTimer -= dt;
  if (s.enemyFireTimer <= 0) {
    const bottom = new Map<number, Alien>();
    for (const a of s.aliens) if (a.alive && (!bottom.has(a.col) || a.row > bottom.get(a.col)!.row)) bottom.set(a.col, a);
    if (bottom.size && s.projectiles.filter(p => p.owner === 'alien').length < SHOT_LIMIT) {
      const choices = [...bottom.values()].sort((a, b) => a.col - b.col);
      const a = choices[Math.floor(random(s) * choices.length)];
      spawnShot(s, 'alien', a.x + a.width / 2 - 2, a.y + a.height);
    }
    s.enemyFireTimer = Math.max(0.45, 1.4 - s.wave * 0.055) + random(s) * 0.65;
  }
  s.saucerTimer -= dt;
  if (!s.saucer.active && s.saucerTimer <= 0) {
    s.saucer.active = true;
    s.saucer.direction = random(s) < 0.5 ? 1 : -1;
    s.saucer.x = s.saucer.direction === 1 ? -s.saucer.width : FIELD_WIDTH;
    s.saucerTimer = 16 + random(s) * 8;
  }
  if (s.saucer.active) {
    s.saucer.x += s.saucer.direction * s.saucer.speed * dt;
    if (s.saucer.x < -s.saucer.width - 2 || s.saucer.x > FIELD_WIDTH + 2) s.saucer.active = false;
  }
  updateProjectiles(s, dt);
  if (s.phase === 'playing' && s.aliens.every(a => !a.alive)) {
    s.phase = 'wave-clear'; s.waveClearTimer = 1.15;
    s.projectiles = [];
    s.events.push({ type: 'wave-clear', wave: s.wave });
  }
  return s;
}
