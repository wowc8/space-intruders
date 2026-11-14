# Task C presentation and interaction evidence

Presentation modules: `src/main.ts`, `src/style.css`, `src/ui/renderer.ts`, `audio.ts`, `storage.ts`. Original sprites are canvas geometry; audio is synthesized with WebAudio after a user gesture. No remote assets.

## Checks

- `npm run build`: passed, TypeScript and Vite production build.
- `npm test`: passed, 16 tests including three UI storage tests.
- `python3 tests/ui/live-play.py` against local Vite server with Playwright 1.58 and installed Google Chrome: passed at **1000×840** and **640×600**. The script asserted no page scroll, visible footer, exact 800:700 canvas aspect ratio, and title/help/pause panels entirely inside the playfield at both sizes. It started the game, confirmed the cannon moved right from canvas pixels, confirmed a fired projectile from canvas pixels, and exercised help/back, pause/resume, blur auto pause, restart, main menu, mute and volume persistence, corrupt storage recovery, and forced fullscreen fallback with immediate accessible button label changes. No page errors. Screenshots for title, help, live gameplay and pause at both sizes are in [docs/evidence](evidence). Gameplay and help screenshots were visually inspected.
- Packaged WKWebView and live audio output remain for Task D/E; headless Chrome cannot establish those native behaviors.

## Interaction cases to exercise

Start by button and Enter; help/back by button and Escape; left/right and A/D with both keys held; Space fire without scrolling; P/Escape pause and resume; pause then restart/menu; game over replay/menu; M and mute button; volume slider and persistence after reload; corrupt or disabled local storage; blur/hidden auto pause and held key release; resize and DPR scaling; native fullscreen and full window fallback; reduced motion preference.
