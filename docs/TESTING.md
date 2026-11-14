# Verification log

## Foundation (Task A, 2026-11-13)

Host: macOS x86_64, Node 24.14.0, npm 11.9.0, Cargo 1.94.0, Xcode 27.2.

| Command | Result |
| --- | --- |
| `npm install --offline` | Passed; 16 packages installed, lockfile written, 0 reported vulnerabilities |
| `npm run build` | Passed; TypeScript strict check and Vite 7.3.6 production build |
| `cargo check --offline` in `src-tauri` | Passed; Tauri 2.11.5 shell compiled, Rust lockfile written |
| `cargo check --locked --offline` in `src-tauri` | Passed; 0.58 seconds after warm build |
| `iconutil -c icns ...` and `file` | Passed; original 57 KB macOS icns and PNG assets |
| Plan comparison against ATC project context | Exact text match, except the file's trailing newline |

This gate verifies the foundation only. Engine behavior, UI interaction, packaged application launch, signing, and notarization remain later tasks.

## Integration acceptance (Task D, 2026-11-13)

Host: macOS x86_64. Tested the running game with installed Google Chrome through Playwright 1.58. The Tauri development shell was launched separately. Packaged offline `.app` acceptance belongs to Task E.

| Action | Observed result |
| --- | --- |
| `npm test` | Passed 16/16 engine and storage tests. |
| `npm run build` | Passed TypeScript and Vite production build after the favicon edit. |
| `python3 tests/ui/live-play.py` with local Vite at 1420 | Passed at 1000×840 and 640×600. Title, help, playing and pause panels fit without body scroll or clipping. Pixel checks confirmed cannon movement and projectile rendering. Buttons, pause/resume, restart/menu, blur, settings persistence, corrupt storage and fullscreen fallback passed. Screenshots in `docs/evidence/`. |
| `python3 tests/ui/integration-play.py` with local Vite at 1420 | Held Space and alternated actual arrow-key movement through real elapsed game time. Scored 700, then reached a natural game over from invasion, with the game-over overlay visible. `PLAY AGAIN` reset score to zero. Blur paused and held score stayed frozen for 1.5 seconds; resume worked. High score survived reload. No page errors, console errors or requests outside the local origin. Screenshots: `integration-scored-play.png`, `integration-natural-gameover.png`, `integration-blur-resume.png`. |
| Console defect found and fixed | Chrome requested `/favicon.ico` twice and logged 404 errors on first long playthrough. Added a local inline SVG icon in `index.html`; final long playthrough had no console errors. |
| `npm run desktop:dev` | Tauri 2 development binary compiled and ran as `src-tauri/target/debug/space-intruders`. CoreGraphics listed an onscreen `Space Intruders` window (PID 42936, window 9241) at 1000×840, position 256,59. A window-only `screencapture -x -l 9241` returned `could not create image from window`; no native pixels or native UI interaction are claimed. macOS automation access through System Events also did not return. Task E must complete packaged native visual/gameplay acceptance. |

The long playthrough is unmodified runtime gameplay, not a state fixture. Existing engine tests separately cover late-wave speed and wave transition with constructed state; this task did not claim a late-wave browser visual. Headless Chrome checks cannot establish audible sound output. Reduced-motion browser context was enabled during the existing UI harness, and renderer code branches on the media query. Fullscreen fallback was exercised; native macOS fullscreen pixels were not verified.

## Final packaged ARM64 release (Task E recovery, 2026-11-14 UTC)

The final host was independently identified as Apple M5 Pro running macOS 27.2.1 with Xcode 27.2. The active Rust/Cargo toolchain was 1.100.0 with the `aarch64-apple-darwin` target. The frontend build selected the existing x86_64 Node 24.14.0 binary at `/Users/Madison/.volta/tools/image/node/24.14.0/bin/node` because the installed `node_modules` contains x86_64 Tauri CLI optional binaries; `/opt/homebrew/bin/node` was ARM64 and could not load those x86_64 optional dependencies. `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` selected Xcode locally after the default xcrun path failed to load an x86_64 compatible CommandLineTools dylib. These environment choices did not change system settings.

| Check | Final evidence |
| --- | --- |
| `npm test` with Node 24.14.0 selected in `PATH` | Passed 16/16 engine and storage tests. |
| `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer cargo build --release --locked --target aarch64-apple-darwin` from `src-tauri` | Passed optimized locked Rust build. |
| `PATH=/Users/Madison/.volta/tools/image/node/24.14.0/bin:$PATH DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm run desktop:build -- --ci --target aarch64-apple-darwin` | Passed TypeScript/Vite production build and Tauri app bundle. The output bundle was copied into `release/Space Intruders.app`. |
| `lsof -nP -iTCP:1420 -sTCP:LISTEN` | No listener; packaged game ran with the development server stopped. |
| `open -n --env SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT=/private/tmp/space_intruders_release_bounded.json release/Space\ Intruders.app` | The copied release app loaded `tauri://localhost` and produced [native-smoke-report.json](evidence/native-smoke-report.json), `passed: true`, 590,136 bytes. Synthetic WKWebView button and keyboard events started the game, scored 80, paused at score 80, and resumed. Animation-frame counters advanced from 29 at title to 793 after resume. |
| Canvas PNG review | [Title](evidence/native-title.png), [played](evidence/native-played.png), and [paused](evidence/native-paused.png) images were extracted from the packaged WKWebView's canvas and visually reviewed. The played image shows aliens removed, a projectile, shields, and the cannon. Pause overlay state was checked from the DOM report; the canvas PNG alone does not include the HTML overlay. |
| `/usr/bin/open -n release/Space\ Intruders.app` without the smoke flag | Normal Launch Services open returned successfully; `ps` showed a running copied release executable (PID 48272). |
| Package inspection | `file` reported an ARM64 Mach-O executable; `LSMinimumSystemVersion` was 13.0; `codesign -dv --verbose=2` reported an ad-hoc signature with no Team ID. `shasum -a 256 -c SHA256SUMS` in `release/` passed for `Space-Intruders-macOS-arm64.zip`; archive CRC and executable identity were independently checked by the Leader. |

Early native attempts produced no gameplay report, and an early report stayed at the title with a black canvas. Their exact cause was not established. The final bounded capture hook writes three 400×350 PNGs and keeps the report below the Rust command's 2 MB payload limit; its error path removes images before reporting an error. The successful report comes from the final copied release app. Native input in this test was **synthetic JavaScript events**, not physical macOS keyboard input. The native canvas was inspected through its own PNG export because OS window screenshots were unavailable. Audible speaker output, native fullscreen pixels, Intel compatibility, signing with Developer ID, and notarization were not verified.

## v0.1.0 disk image packaging

The compressed read-only `Space-Intruders-macOS-arm64.dmg` was made from the same verified `release/Space Intruders.app`, with a fresh staging directory and an Applications symlink. `hdiutil verify` reported a valid image checksum. The image was attached read-only, its `Applications` link resolved to `/Applications`, and `cmp` confirmed that its embedded executable matches the verified release app byte for byte (SHA-256 `585fe3d5fb0aeb56aaaf8184a1134e26a2698a39b3f18034351b818ac48d2f31`). `codesign -dv --verbose=2` reported an ad-hoc signature and no Team ID; `file` reported ARM64 Mach-O and Info.plist specified macOS 13.0 minimum. The image detached cleanly. The DMG SHA-256 is `07087979812e5551dce7b6bab8ce3808918d71740e2af6659268b953dc1e0d31`; both DMG and ZIP hashes are recorded in the distributed `release/SHA256SUMS`. A separate mounted-image gameplay test was not run; the unchanged source bundle had already passed packaged native gameplay smoke testing described above.
