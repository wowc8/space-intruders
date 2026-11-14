import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../../src/game/engine.ts';
import { FIXED_DT, type GameInput, type GameState, type Projectile } from '../../src/game/types.ts';

const idle: GameInput = { move: 0, fire: false, command: 'none' };
const step = (s: GameState, input: GameInput = idle, dt = FIXED_DT) => stepGame(s, input, dt);
const start = (seed = 7) => step(createGame(seed), { ...idle, command: 'start' });
const shot = (id: number, owner: 'player' | 'alien', x: number, y: number, vy: number): Projectile =>
  ({ id, owner, x, y, vx: 0, vy, width: 4, height: 13 });
const emptyBunkers = (s: GameState) => { for (const b of s.bunkers) for (const c of b.cells) c.alive = false; };

test('same seed and inputs replay exactly; input and previous state remain untouched', () => {
  let a = start(0), b = start(0);
  assert.equal(a.seed, 0);
  for (let i = 0; i < 500; i++) {
    const input: GameInput = { move: i % 75 < 25 ? -1 : i % 75 < 50 ? 1 : 0,
      fire: i % 3 !== 0, command: 'none' };
    const previous = a, before = structuredClone(a), inputBefore = structuredClone(input);
    a = step(a, input); b = step(b, input);
    assert.deepEqual(a, b);
    assert.deepEqual(previous, before);
    assert.deepEqual(input, inputBefore);
  }
  assert.notEqual(a.rngState, a.seed);
});

test('movement clamps and held fire allows only one player shot', () => {
  let s = start();
  s = step(s, { ...idle, move: -1 }, 10);
  assert.equal(s.player.x, 20);
  s = step(s, { ...idle, move: 1 }, 10);
  assert.equal(s.player.x, 748);
  for (let i = 0; i < 20; i++) s = step(s, { ...idle, fire: true });
  assert.equal(s.projectiles.filter(p => p.owner === 'player').length, 1);
  assert.equal(s.events.filter(e => e.type === 'shot' && e.owner === 'player').length, 0);
});

test('swept shot hits alien and awards row score even across a large step', () => {
  const s = start(); emptyBunkers(s);
  const a = s.aliens[0];
  s.aliens.forEach((alien, i) => { alien.alive = i === 0 || i === 1; });
  s.projectiles = [shot(99, 'player', a.x + 10, a.y + 100, -2000)];
  const n = step(s, idle, 0.1);
  assert.equal(n.aliens[0].alive, false);
  assert.equal(n.score, 30);
  assert.deepEqual(n.events.filter(e => e.type === 'score').map(e => e.points), [30]);
  assert.equal(s.aliens[0].alive, true);
  assert.equal(s.projectiles.length, 1);
});

test('all alien row values are awarded and score events are replaced next step', () => {
  for (const [row, points] of [[0, 30], [1, 20], [2, 20], [3, 10], [4, 10]]) {
    const s = start(); emptyBunkers(s);
    const target = s.aliens.find(a => a.row === row && a.col === 0)!;
    s.aliens.forEach(a => { a.alive = a.id === target.id || a.id === 10; });
    s.projectiles = [shot(200, 'player', target.x + 8, target.y + 45, -1000)];
    const hit = step(s, idle, 0.07);
    assert.equal(hit.score, points);
    assert.equal(step(hit).events.length, 0);
  }
});

test('bunkers absorb shots from below and above, one cell per shot', () => {
  for (const [owner, vy, offset] of [['player', -1000, 80], ['alien', 1000, -80]] as const) {
    const s = start();
    emptyBunkers(s);
    const c = s.bunkers[0].cells[0]; c.alive = true;
    s.projectiles = [shot(50, owner, c.x + 2, c.y + offset, vy)];
    const n = step(s, idle, 0.16);
    assert.equal(n.bunkers[0].cells.find(x => x.x === c.x && x.y === c.y)!.alive, false);
    assert.equal(n.projectiles.some(p => p.id === 50), false);
    assert.equal(n.events.some(e => e.type === 'explosion' && e.target === 'bunker'), true);
    assert.equal(s.bunkers[0].cells.find(x => x.x === c.x && x.y === c.y)!.alive, true);
  }
});

test('saucer scores from seeded award set; crossing 1500 grants one extra life', () => {
  const s = start(42); emptyBunkers(s);
  s.score = 1490;
  s.aliens = s.aliens.map(a => ({ ...a, alive: a.id === 0 || a.id === 1 }));
  s.saucer = { ...s.saucer, active: true, x: 200, speed: 0 };
  s.projectiles = [shot(100, 'player', 210, 180, -1000)];
  const n = step(s, idle, 0.15);
  assert.equal([50, 100, 150, 300].includes(n.score - 1490), true);
  assert.equal(n.lives, 4);
  assert.equal(n.events.filter(e => e.type === 'extra-life').length, 1);
  n.projectiles = [shot(101, 'player', n.aliens[0].x + 10, 180, -1000)];
  const m = step(n, idle, 0.15);
  assert.equal(m.lives, 4);
  assert.equal(m.events.some(e => e.type === 'extra-life'), false);
});

test('multiple enemy shots in one step cost one life, then invulnerability guards follow-up', () => {
  const s = start(); emptyBunkers(s);
  s.projectiles = [shot(1, 'alien', s.player.x + 6, s.player.y - 80, 1000),
    shot(2, 'alien', s.player.x + 14, s.player.y - 70, 1000)];
  const n = step(s, idle, 0.1);
  assert.equal(n.lives, 2);
  assert.equal(n.events.filter(e => e.type === 'life-lost').length, 1);
  assert.equal(n.projectiles.filter(p => p.owner === 'alien').length, 0);
  const m = step(n, idle, 0.1);
  assert.equal(m.lives, 2);
  assert.ok(m.player.invulnerableFor > 0);
});

test('last life ends run; alien reaching player area ends invasion', () => {
  const s = start(); emptyBunkers(s); s.lives = 1;
  s.projectiles = [shot(1, 'alien', s.player.x + 8, s.player.y - 50, 1000)];
  const dead = step(s, idle, 0.1);
  assert.equal(dead.phase, 'game-over');
  assert.equal(dead.events.find(e => e.type === 'game-over')?.reason, 'lives');
  const inv = start(); inv.aliens[0].y = 600;
  const invaded = step(inv);
  assert.equal(invaded.phase, 'game-over');
  assert.equal(invaded.events.find(e => e.type === 'game-over')?.reason, 'invasion');
});

test('formation reverses, descends, and accelerates as aliens die and waves rise', () => {
  const s = start(); s.aliens[10].x = 765;
  const n = step(s);
  assert.equal(n.formation.direction, -1);
  assert.equal(n.aliens[10].y, s.aliens[10].y + 18);
  const sparse = start(); sparse.aliens.forEach((a, i) => { a.alive = i < 3; });
  sparse.wave = 4;
  const fast = step(sparse);
  assert.ok(fast.formation.speed > n.formation.speed);
  assert.ok(fast.formation.speed <= 155);
});

test('enemy fire comes from a lowest living alien and respects projectile cap', () => {
  const s = start(33);
  s.enemyFireTimer = 0;
  const fired = step(s);
  const bullet = fired.projectiles.find(p => p.owner === 'alien')!;
  assert.ok(bullet);
  const column = fired.aliens.find(a => a.alive && Math.abs(a.x + a.width / 2 - 2 - bullet.x) < 1)!;
  const lowest = Math.max(...fired.aliens.filter(a => a.alive && a.col === column.col).map(a => a.row));
  assert.equal(column.row, 0); // first matching entry is top of the selected column
  assert.equal(bullet.y, fired.aliens.find(a => a.col === column.col && a.row === lowest)!.y + 25 + bullet.vy * FIXED_DT);
  const capped = start(); capped.enemyFireTimer = 0;
  capped.projectiles = [shot(1, 'alien', 10, 300, 0), shot(2, 'alien', 20, 300, 0), shot(3, 'alien', 30, 300, 0)];
  assert.equal(step(capped).projectiles.filter(p => p.owner === 'alien').length, 3);
});

test('alien contact erodes bunker cells', () => {
  const s = start(); emptyBunkers(s);
  const c = s.bunkers[0].cells[0]; c.alive = true;
  s.aliens[0].x = c.x; s.aliens[0].y = c.y;
  assert.equal(step(s).bunkers[0].cells[0].alive, false);
});

test('wave clear transition freezes combat and refreshes bunkers while retaining score/lives', () => {
  const s = start(); emptyBunkers(s);
  s.aliens.forEach((a, i) => { a.alive = i === 0; });
  s.score = 400; s.lives = 2;
  s.projectiles = [shot(1, 'player', s.aliens[0].x + 8, s.aliens[0].y + 60, -1000)];
  const cleared = step(s, idle, 0.1);
  assert.equal(cleared.phase, 'wave-clear');
  assert.deepEqual(cleared.events.filter(e => e.type === 'wave-clear').map(e => e.wave), [1]);
  const next = step(cleared, idle, 2);
  assert.equal(next.phase, 'playing');
  assert.equal(next.wave, 2);
  assert.equal(next.aliens.filter(a => a.alive).length, 55);
  assert.ok(next.bunkers[0].cells.some(c => c.alive));
  assert.equal(next.score, 430); assert.equal(next.lives, 2);
});

test('pause freezes, resume restores phase, restart resets run, menu returns title', () => {
  const s = start(123);
  const paused = step(s, { ...idle, command: 'pause' });
  const frozen = step(paused, { ...idle, fire: true, move: 1 }, 20);
  assert.equal(frozen.tick, paused.tick);
  assert.equal(frozen.player.x, paused.player.x);
  assert.deepEqual(frozen.events, []);
  const resumed = step(frozen, { ...idle, command: 'resume' });
  assert.equal(resumed.phase, 'playing');
  const restarted = step(resumed, { ...idle, command: 'restart' });
  assert.deepEqual(restarted, start(123));
  assert.equal(step(restarted, { ...idle, command: 'menu' }).phase, 'title');
  const transition = { ...restarted, phase: 'wave-clear' as const, waveClearTimer: 0.5 };
  const p = step(transition, { ...idle, command: 'pause' });
  assert.equal(step(p, { ...idle, command: 'resume' }).phase, 'wave-clear');
});
