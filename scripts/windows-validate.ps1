$ErrorActionPreference = 'Stop'
$out = Join-Path (Get-Location) 'windows-validation'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$installDir = Join-Path $env:RUNNER_TEMP 'SpaceIntrudersValidation'
$installer = @(Get-ChildItem 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe')
if ($installer.Count -ne 1) { throw "Expected exactly one NSIS installer, found $($installer.Count)" }

function Get-PeMachine($path) {
  $stream = [IO.File]::OpenRead($path)
  try {
    $reader = [IO.BinaryReader]::new($stream)
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    $stream.Position = $peOffset
    if ($reader.ReadUInt32() -ne 0x00004550) { throw "Invalid PE signature: $path" }
    return $reader.ReadUInt16()
  } finally { $stream.Dispose() }
}

$installerMachine = Get-PeMachine $installer[0].FullName
if ($installerMachine -notin @(0x014c, 0x8664)) { throw "Unexpected installer PE machine: $installerMachine" }
$hash = (Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $($installer[0].Name)" | Set-Content (Join-Path $out 'SHA256SUMS-windows-x64.txt') -Encoding ascii
$source = (git rev-parse HEAD).Trim()
$process = Start-Process $installer[0].FullName -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer exited $($process.ExitCode)" }
$app = Join-Path $installDir 'space-intruders.exe'
if (-not (Test-Path $app)) { throw "Installed executable missing: $app" }
if ((Get-PeMachine $app) -ne 0x8664) { throw "Installed app is not x64: $app" }
$report = Join-Path $out 'native-smoke-windows.json'
$env:SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT = $report
$game = Start-Process $app -PassThru
try {
  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Seconds 1
    if (Test-Path $report) {
      try { $data = Get-Content $report -Raw | ConvertFrom-Json } catch { $data = $null }
      if ($data -and $null -ne $data.passed) { break }
    }
    if ($game.HasExited) { throw "Installed app exited early: $($game.ExitCode)" }
  } while ((Get-Date) -lt $deadline)
  if (-not $data -or $data.passed -ne $true) { throw "Native smoke did not pass; report: $(Get-Content $report -Raw -ErrorAction SilentlyContinue)" }
  if ($data.location -notin @('http://tauri.localhost', 'http://tauri.localhost/')) { throw "Unexpected Windows origin: $($data.location)" }
  if ($data.checkpoints[3].animationFrameCount -le $data.checkpoints[2].animationFrameCount) { throw 'Animation frames did not advance' }
  @{ sourceSha = $source; installer = $installer[0].Name; installerSha256 = $hash; appSha256 = (Get-FileHash $app -Algorithm SHA256).Hash.ToLowerInvariant(); runtime = 'installed NSIS app'; result = 'pass' } | ConvertTo-Json | Set-Content (Join-Path $out 'validation.json')
} finally {
  if (-not $game.HasExited) { Stop-Process -Id $game.Id -Force }
  Remove-Item Env:SPACE_INTRUDERS_NATIVE_SMOKE_OUTPUT -ErrorAction SilentlyContinue
  $uninstaller = Join-Path $installDir 'uninstall.exe'
  if (Test-Path $uninstaller) {
    $uninstall = Start-Process $uninstaller -ArgumentList @('/S') -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exited $($uninstall.ExitCode)" }
  }
}
