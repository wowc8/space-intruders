# Space Intruders macOS release

## Target and contents

The standalone bundle is `release/Space Intruders.app`. The primary distributable is `release/Space-Intruders-macOS-arm64.dmg`; the existing zip is also available. SHA-256 values are in `release/SHA256SUMS`. The app embeds the production Vite assets and original icon. It uses no remote assets or backend.

The final build host is Apple M5 Pro, macOS 27.2.1, Xcode 27.2, Node 24.14.0 for the frontend, and Rust/Cargo 1.100.0 targeting `aarch64-apple-darwin`. Tauri 2.11.5 is pinned in Cargo.lock. `LSMinimumSystemVersion` is macOS 13.0. This package is ARM64 only; Intel Macs and older macOS versions were not tested for the final artifact. An earlier Intel package was superseded by this tested ARM64 package.

## Rebuild

From the repository root:

```sh
npm ci --offline
npm test
npm run build
cd src-tauri && cargo build --release --locked --target aarch64-apple-darwin && cd ..
npm run desktop:build -- --ci --target aarch64-apple-darwin
```

The `strip = "none"` profile settings remain from the earlier Intel Rust 1.94 build, where they avoided malformed proc-macro dylibs rejected by dyld; see [the Rust compiler issue](https://github.com/rust-lang/rust/issues/157750). The final ARM64 build uses Rust 1.100.0. Reproducible refers to source and dependency locks plus commands, not bit-for-bit identical binaries.

## Install and trust

Verify the DMG checksum, open the disk image, and drag **Space Intruders.app** to **Applications**. This local release has no Developer ID signature and has not been notarized. If macOS blocks the first launch, use Finder's Control-click **Open** flow. No global security setting needs changing. See `docs/TESTING.md` for the exact local signing inspection and native launch evidence.

## Package the verified bundle

From the repository root, after building and validating the ARM64 app:

```sh
stage=$(mktemp -d /private/tmp/space-intruders-dmg-stage.XXXXXX)
ditto 'release/Space Intruders.app' "$stage/Space Intruders.app"
test ! -e "$stage/Applications" && test ! -L "$stage/Applications"
ln -s /Applications "$stage/Applications"
hdiutil create -volname 'Space Intruders' -srcfolder "$stage" -format UDZO -o release/Space-Intruders-macOS-arm64.dmg
hdiutil verify release/Space-Intruders-macOS-arm64.dmg
shasum -a 256 release/Space-Intruders-macOS-arm64.dmg
```

Use a fresh staging directory on every run. The DMG is compressed and read-only and contains the app and an Applications shortcut. The published image was built from the already verified app without rebuilding the game. Its SHA-256 is `07087979812e5551dce7b6bab8ce3808918d71740e2af6659268b953dc1e0d31`. Packaging is repeatable but DMG bytes need not be identical across runs.
