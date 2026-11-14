# Engine implementation and test evidence

`src/game/engine.ts` exports the frozen `createGame(seed?)` and `stepGame(state, input, dt)` contract. The default seed is `0x51a7e`; supplied finite seeds are converted to uint32, including zero. The simulation uses a 32-bit linear congruential generator. All timers, projectile IDs, and random state live in `GameState`; each step copies nested state and emits only that step's events.

## Tuning and rules

- Field: 800 × 700 logical pixels. Player moves at 310 px/s and fires a 590 px/s upward shot, with one on screen and a 0.17 s minimum cooldown.
- Formation: 11 × 5 aliens, top row 30 points, next two 20, bottom two 10. Base speed is 34 px/s; it gains 1.55 px/s per defeated alien and 7 px/s per wave, capped at 155 px/s. Living bounds trigger a direction reversal and 18 px descent. Reaching y=612 ends the run.
- Four 9 × 4 cell bunkers have central lower openings. Player and alien shots each remove one first-contact cell; alien contact erodes cells.
- Alien fire uses a seeded selection among the lowest living alien in each occupied column. At most three enemy shots are active. A saucer enters after 13 s, then at seeded 16–24 s intervals; its seeded score is 50, 100, 150, or 300.
- Three starting lives. Crossing 1500 points awards one extra life once. Damage grants 1.6 s invulnerability and removes nearby shots. Wave clear lasts 1.15 s, then resets aliens and bunkers while keeping score and lives.
- Projectile collision sweeps each shot across its full step and selects the first hit, preventing a shot from skipping a target when a frame is long. The controller is still expected to call 60 Hz fixed steps and cap catch-up as documented in `INTERFACES.md`.

## Verification

Run `npm test` from the repository root. It uses Node 24's built-in TypeScript stripping and test runner, with no extra test dependency. `allowImportingTsExtensions` in `tsconfig.json` allows the same explicit `.ts` imports in Node tests and the Vite app. The tests cover seeded replay and immutability, movement limits, one-shot fire, swept alien and saucer hits, all row scores, both directions of bunker erosion, extra life, guarded life loss, both game-over causes, formation reversal and acceleration, lowest-alien fire with cap, alien-bunker contact, wave reset, pause/resume, menu, and restart.

Run `npm run build` for TypeScript and Vite integration. Task C owns any diagnostics in `src/ui` while its presentation work is in progress.

Task B check on 2026-11-13: `npm test` passed 13/13; `git diff --check` passed. `npm run build` stopped at `src/ui/renderer.ts(1,42): TS6133`, an unused `Alien` import in Task C's concurrent work. Engine code produced no TypeScript diagnostic. No remote Git repository was configured, so a PR could not be created from this workspace.
