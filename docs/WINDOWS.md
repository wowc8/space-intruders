# Windows x64 release

The manual [Windows installer validation workflow](../.github/workflows/windows-release.yml) uses a native `windows-latest` runner, Node 24.14.0, Rust 1.94.0, locked npm/Cargo dependencies, and Tauri NSIS packaging. It runs the frontend tests and production build, checks Cargo, installs the NSIS package into a temporary directory, launches that installed executable with the opt-in native smoke hook, checks real elapsed gameplay and pause/resume, checks valid installer PE and x64 installed executable headers, hashes the installer and executable, then uninstalls. Its Actions artifact contains the installer, Windows SHA256SUMS, and validation report. The workflow does not modify a GitHub Release.

For a local Windows build: `npm ci`, `npm test`, `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml --locked`, and `npm run tauri -- build --bundles nsis --target x86_64-pc-windows-msvc --ci -- --locked`. The macOS `desktop:build` script deliberately builds an `.app` and is not the Windows command.

The app itself is offline. This small unsigned installer uses Tauri's default WebView2 downloaded bootstrapper if WebView2 is missing, so first-time installation may require internet. Windows 10/11 usually include WebView2. No signing certificate is configured; Windows may show a publisher warning. The native smoke exercises synthetic input in the packaged WebView2. It does not verify physical keyboard input or audible output.

## Install and check the release

Download `Space Intruders_0.1.0_x64-setup.exe` and `SHA256SUMS-windows-x64.txt` from the [v0.1.0 release](https://github.com/wowc8/space-intruders/releases/tag/v0.1.0). In PowerShell, run `Get-FileHash 'Space Intruders_0.1.0_x64-setup.exe' -Algorithm SHA256` and compare the result to the checksum file. If it differs, do not run the installer. Launch setup to install for the current Windows user. This build is unsigned. After checking source and hash, if **Windows protected your PC** appears for an unrecognized app, choose **More info**, then **Run anyway** when offered. A managed policy or Smart App Control may block that option; in that case, installation may remain blocked. Keep Defender enabled.

## Validated v0.1.0 artifact

- Source commit: `cb80eb6933d825200d996a5a00f13cdfd48e11dd`; the v0.1.0 tag remains at the earlier macOS source commit.
- [GitHub Actions run 43621162898](https://github.com/wowc8/space-intruders/actions/runs/43621162898): all steps passed on `windows-latest`, including 16 frontend tests, production build, locked Cargo check/build, NSIS install, packaged WebView2 smoke, and silent uninstall.
- Installer: `Space Intruders_0.1.0_x64-setup.exe`, 1,839,239 bytes, SHA-256 `42de6931c694aa6e9816986c08ce70d5dc220befcd259c9a85fa57a36e34d66f`. The independently downloaded Actions artifact matched its Windows checksum file. The NSIS setup stub is x86 PE; the installed game executable was validated as x64 PE.
- Native smoke origin: `http://tauri.localhost/`. Real animation frames advanced 52 to 801 during play. Score rose 0 to 80. Pause held score at 80; resume returned to playing. This is synthetic input inside the installed packaged app. [Smoke report](evidence/windows-native-smoke.json) and [played canvas screenshot](evidence/windows-native-played.png) are retained in the repository.
