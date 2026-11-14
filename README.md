# Space Intruders

An original offline fixed shooter for macOS and Windows, built with Tauri 2, Vite, TypeScript, and Canvas. Move your cannon, fire through the alien formation, protect four shields, and survive as long as you can.

## Install and launch

1. Sign in to GitHub if prompted (the repository may be private), then download `Space-Intruders-macOS-arm64.dmg` and `SHA256SUMS` from the [official v0.1.0 release](https://github.com/wowc8/space-intruders/releases/tag/v0.1.0). Run `shasum -a 256 Space-Intruders-macOS-arm64.dmg` in the download folder and compare its output with the DMG entry in `SHA256SUMS`. If they differ, do not open the download.
2. Open the DMG and drag **Space Intruders.app** to **Applications**. Open the app from Applications once. If macOS blocks it because the developer cannot be verified, dismiss the alert.
3. Choose **Apple menu → System Settings → Privacy & Security**, scroll to **Security**, and click **Open Anyway** for Space Intruders. Confirm **Open** in the next prompt and authenticate if macOS asks. Subsequent launches work normally from Applications.

The app runs offline without a terminal or development server. This release is ad-hoc signed, but has no Developer ID signature or Apple notarization. Only override a developer verification warning after checking the source and checksum; treat a malware or damaged-app warning separately. Keep Gatekeeper enabled. See [Apple's first-open guidance](https://support.apple.com/en-us/102445). A ZIP is also available in the release.

This release targets **macOS 13 or newer on Apple Silicon (ARM64)**. It was played and verified on Apple M5 Pro. Intel Macs and older macOS versions have not been verified for this final package.

### Windows x64

Download `Space Intruders_0.1.0_x64-setup.exe` and `SHA256SUMS-windows-x64.txt` from the same [v0.1.0 release](https://github.com/wowc8/space-intruders/releases/tag/v0.1.0). In PowerShell, run `Get-FileHash 'Space Intruders_0.1.0_x64-setup.exe' -Algorithm SHA256` and compare the hash to the Windows checksum file before running the installer. The validated SHA-256 is `42de6931c694aa6e9816986c08ce70d5dc220befcd259c9a85fa57a36e34d66f`.

Run the setup executable to install for your Windows user. The installer is unsigned. After checking the source and hash, if Windows shows **Windows protected your PC** for an unrecognized app, choose **More info**, then **Run anyway** when offered. A managed policy or Smart App Control may block this option; in that case, the installer may remain blocked. Keep Defender enabled. The game runs offline; if WebView2 is missing, setup downloads its bootstrapper and requires internet for that installation. A native Windows x64 runner installed and launched this build and verified gameplay, score, pause, and resume through synthetic input. Physical keyboard and sound were not verified on Windows. See [Windows validation details](docs/WINDOWS.md).

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

The app bundle is produced at `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Space Intruders.app`. Copy it to `release/`; see [release details](docs/RELEASE.md) for the DMG packaging command. The ZIP uses `ditto -c -k --sequesterRsrc --keepParent`. Reproducible means locked dependencies and repeatable build commands; package bytes are not guaranteed identical.

For development, run `npm run desktop:dev`.

The app icon is original code-generated art. To recreate it, run `python3 scripts/make-icon.py` and `iconutil -c icns src-tauri/icons/SpaceIntruders.iconset -o src-tauri/icons/icon.icns`.

See [release details](docs/RELEASE.md), [test evidence](docs/TESTING.md), and [the PM plan](docs/PLAN.md).
