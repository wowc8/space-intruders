# Space Intruders

An original offline fixed shooter for macOS, built with Tauri 2, Vite, TypeScript, and Canvas. This repository currently contains the desktop foundation and frozen game interfaces; gameplay and presentation are subsequent tasks.

## Requirements

- macOS with Xcode command line tools
- Node 24 and npm 11
- Rust 1.94 / Cargo

## Develop

```sh
npm ci
npm run desktop:dev
```

## Build

```sh
npm run build
cd src-tauri && cargo check --locked
cd .. && npm run desktop:build
```

The last command produces a native `.app` under `src-tauri/target/release/bundle/macos`. It is a local unsigned build. Packaging and independent launch verification are later delivery tasks.

The app icon is original code-generated art. To recreate it, run `python3 scripts/make-icon.py` and `iconutil -c icns src-tauri/icons/SpaceIntruders.iconset -o src-tauri/icons/icon.icns`.

See [the PM plan](docs/PLAN.md) and [frozen interfaces](docs/INTERFACES.md).
