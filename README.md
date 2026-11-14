# Space Intruders

An original offline fixed shooter for macOS, built with Tauri 2, Vite, TypeScript, and Canvas. Move your cannon, fire through the alien formation, protect four shields, and survive as long as you can.

## Install and launch

Verify the release zip against `release/SHA256SUMS`, expand it, and open **Space Intruders.app** from Finder. The app runs offline without a terminal or development server. This local release has no Developer ID signature or Apple notarization, so macOS may require **Control-click → Open** on first launch. Do not disable Gatekeeper globally.

This release targets **macOS 13 or newer on Apple Silicon (ARM64)**. It was played and verified on Apple M5 Pro. Intel Macs and older macOS versions have not been verified for this final package.

## Controls and rules

| Action | Control |
| --- | --- |
| Move | Left/Right arrows or A/D |
| Fire | Space (hold to keep firing) |
| Pause/resume | Escape or P |
| Mute | M or the audio button |
| Volume/fullscreen | Header controls |

You start with three lives and earn one extra at 1,500 points. Clear a formation to advance. Alien shots and your own shots erode shields. The run ends when lives are exhausted or aliens invade. High score and audio preferences are stored locally.

## Build from source

Use macOS with Node 24, npm 11, Rust/Cargo 1.100, the `aarch64-apple-darwin` Rust target, and Xcode 27.2. The final package was built on Apple Silicon macOS 27.2.1. The build used Node 24.14.0 for the frontend and Rust/Cargo 1.100.0 for the ARM64 host.

```sh
npm ci --offline                    # or npm ci if dependencies are not cached
npm test
npm run build
cd src-tauri && cargo build --release --locked --target aarch64-apple-darwin && cd ..
npm run desktop:build -- --ci --target aarch64-apple-darwin
```

The app bundle is produced at `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Space Intruders.app`. Copy it to `release/` and use `ditto -c -k --sequesterRsrc --keepParent` to make `release/Space-Intruders-macOS-arm64.zip`. Reproducible means locked dependencies and repeatable build commands; bundle bytes are not guaranteed identical.

For development, run `npm run desktop:dev`.

The app icon is original code-generated art. To recreate it, run `python3 scripts/make-icon.py` and `iconutil -c icns src-tauri/icons/SpaceIntruders.iconset -o src-tauri/icons/icon.icns`.

See [release details](docs/RELEASE.md), [test evidence](docs/TESTING.md), and [the PM plan](docs/PLAN.md).
