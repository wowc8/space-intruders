/** Frozen simulation contracts. See docs/INTERFACES.md before changing. */
export const FIELD_WIDTH = 800;
export const FIELD_HEIGHT = 700;
export const FIXED_DT = 1 / 60;

export type GamePhase = 'title' | 'playing' | 'paused' | 'wave-clear' | 'game-over';
export type GameCommand = 'none' | 'start' | 'pause' | 'resume' | 'restart' | 'menu';
export type ProjectileOwner = 'player' | 'alien';

/** Coordinates are logical pixels, with origin at the top left. */
export interface Vec2 { x: number; y: number }
export interface Player extends Vec2 {
  width: number;
  height: number;
  speed: number;
  invulnerableFor: number;
  fireCooldown: number;
}
export interface Alien extends Vec2 {
  id: number;
  row: number;
  col: number;
  width: number;
  height: number;
  alive: boolean;
}
export interface Projectile extends Vec2 {
  id: number;
  owner: ProjectileOwner;
  vx: number;
  vy: number;
  width: number;
  height: number;
}
export interface BunkerCell extends Vec2 {
  alive: boolean;
  width: number;
  height: number;
}
export interface Bunker {
  id: number;
  cells: BunkerCell[];
}
export interface Saucer extends Vec2 {
  active: boolean;
  direction: -1 | 1;
  speed: number;
  width: number;
  height: number;
}
export interface Formation {
  direction: -1 | 1;
  speed: number;
  stepDown: number;
}

/** One-shot events produced by the latest step only; presentation may read each once. */
export type GameEvent =
  | { type: 'shot'; owner: ProjectileOwner; x: number; y: number }
  | { type: 'explosion'; target: 'alien' | 'player' | 'saucer' | 'bunker'; x: number; y: number }
  | { type: 'score'; points: number; total: number; x: number; y: number }
  | { type: 'life-lost'; lives: number }
  | { type: 'extra-life'; lives: number }
  | { type: 'wave-clear'; wave: number }
  | { type: 'game-over'; reason: 'lives' | 'invasion' };

/** Persisted by the engine's seeded PRNG; no Math.random in simulation. */
export interface GameState {
  phase: GamePhase;
  phaseBeforePause: 'playing' | 'wave-clear';
  wave: number;
  score: number;
  lives: number;
  extraLifeAwarded: boolean;
  seed: number;
  rngState: number;
  tick: number;
  player: Player;
  aliens: Alien[];
  projectiles: Projectile[];
  bunkers: Bunker[];
  saucer: Saucer;
  formation: Formation;
  enemyFireTimer: number;
  saucerTimer: number;
  waveClearTimer: number;
  nextProjectileId: number;
  events: GameEvent[];
}

/** Level trigger booleans. Buttons held between frames remain true. */
export interface GameInput {
  move: -1 | 0 | 1;
  fire: boolean;
  command: GameCommand;
}
