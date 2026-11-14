# Frozen engine and presentation contract

This document and `src/game/types.ts` are Task A's interface baseline for Tasks B and C. Changes require coordination with both owners.

## Module boundary

Task B exports `createGame(seed?: number): GameState` and `stepGame(state: GameState, input: GameInput, dt: number): GameState` from `src/game/engine.ts`. It may export helpers, but those two names are the stable public API. Task C imports them and the types/constants from `src/game/types.ts`. The engine handles gameplay, scores, wave progression, collision, and phase transitions. Presentation handles keys, UI buttons, audio, storage, and drawing. No DOM, storage, clocks, audio, or ambient randomness belong in the engine.

## Time, state, and input

The logical field is 800 by 700 pixels with top-left origin. `dt` is elapsed **seconds**, normally `FIXED_DT = 1/60`. The controller calls one fixed step per simulation tick and limits catch-up after long frames. `stepGame` returns a **new state**; it must not mutate its state or input arguments, including nested arrays or objects. State includes all simulation timers and PRNG state so replay with the same seed/input sequence is deterministic. `createGame()` uses a fixed documented default seed; a supplied seed is normalized to uint32, including zero. Tick counts advance only while playing and during wave-clear transitions.

`GameInput.move` is -1, 0, or 1; `fire` is a held level, so the engine may fire again after its cooldown when the previous player projectile is gone. `command` is a one-step pulse, emitted once on key/button activation; UI must not repeat it while held. A held left/right key pair resolves to the most recently pressed key (or zero if the controller deliberately clears held keys). UI must prevent Space scrolling while controlling the game.

Commands and valid transitions:

| Command | From | Result |
| --- | --- | --- |
| start | title | New run, wave 1, 3 lives, score 0, phase playing |
| pause | playing or wave-clear | paused, simulation frozen |
| resume | paused | Restores the pre-pause phase, without elapsed catch-up |
| restart | any phase | New run from initial seed, wave 1, 3 lives, score 0 |
| menu | any phase | title; gameplay no longer advances |
| none | any phase | Ordinary step, or no change when title/paused/game-over |

The frozen `phaseBeforePause` field restores the prior phase after pause. Commands that do not apply to the current phase have no effect. `game-over` waits for restart/menu. The UI issues one pause pulse on window blur or document hidden and clears held movement/fire. On return it remains paused until explicit resume.

## State and events

`GameState` is the sole source of gameplay truth. All positions and dimensions are logical pixels. `aliens` retains dead entries with `alive=false` for stable identity. `bunkers` contains four bunkers of individually destructible `cells`. `projectiles` contains at most one owner=player shot, and a bounded number of alien shots. `formation` controls lateral travel. `saucer.active` gates saucer collision/drawing. `seed` records the run seed and `rngState` records current generator state. `nextProjectileId` ensures stable identity. Timers are in seconds. B may add internal fields only after coordinating with C; the declared fields must stay available.

`events` contains only events from the **latest** `stepGame` call, in occurrence order. Every call replaces the previous event array even when idle/paused. Presentation reads that array once after each step and may synthesize sounds and particles from it; it does not clear or mutate it. Events contain all needed coordinates and values, and contain no browser objects. `score` events report the awarded points and resulting total; `wave-clear` reports the cleared wave; `game-over` states lives or invasion reason. A single hit cannot create two life-loss events in one tick. Restart/menu produce no events unless the engine deliberately documents a UI-only event separately.

## Initial gameplay tuning owned by B

Formation has 11 columns and 5 rows. Top row is 30 points, next two rows 20, bottom two rows 10. Three initial lives; one extra life once after crossing 1500 points. Four bunkers erode from either side. Aliens reverse and descend at living bounds, accelerate as population falls and wave rises, and reaching the player area ends the run. One player shot at a time; enemy fire chooses a living lowest alien in a seeded column and has a concurrency cap. A saucer crosses periodically for seeded 50/100/150/300 points. Wave clear has a short transition, then refreshes aliens/bunkers and retains score/lives. Player damage gives brief invulnerability and clears nearby shots. Collision must prevent projectile tunneling. B chooses numeric speeds/cooldowns and tests late-wave playability.

## Ownership and integration

Task A owns manifests, Rust shell, icon, this document, and types. B owns `src/game` implementation and tests; C owns `src/ui`, `src/main.ts`, `src/style.css` and presentation tests. C replaces the temporary placeholder in main. B and C may add dev dependencies only through a coordinated package edit to avoid lockfile races. D handles cross-module integration. No backend calls or remote assets.
