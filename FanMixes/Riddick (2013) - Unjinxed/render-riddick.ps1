# Copy Riddick source to local scratch and run two-pass render.
# Usage: powershell -ExecutionPolicy Bypass -File render-riddick.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$srcNas = "N:\Videos\Horror and SciFi\Riddick Movies\Riddick (2013) [1080p]\Riddick.2013.1080p.BluRay.x264.YIFY.mp4"
$localDir = "C:\Videos\FanEditRender"
$localSrc = Join-Path $localDir "Riddick.2013.1080p.BluRay.x264.YIFY.mp4"
$out = Join-Path $localDir "Riddick (2013) - Unjinxed.mkv"
$log = Join-Path $localDir "riddick_unjinxed_render.log"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

if (-not (Test-Path -LiteralPath $srcNas)) {
    throw "Source not found: $srcNas"
}

$srcSize = (Get-Item -LiteralPath $srcNas).Length
$needCopy = $true
if (Test-Path -LiteralPath $localSrc) {
    $locSize = (Get-Item -LiteralPath $localSrc).Length
    if ($locSize -eq $srcSize) { $needCopy = $false }
}

if ($needCopy) {
    Write-Host "Copying source to $localSrc ..."
    Copy-Item -LiteralPath $srcNas -Destination $localSrc -Force
}

Write-Host "Verifying local copy with ffprobe..."
$durNas = ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $srcNas
$durLoc = ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $localSrc
if ($durNas -ne $durLoc) {
    throw "Duration mismatch NAS=$durNas local=$durLoc"
}
Write-Host "Duration OK: $durLoc s"

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { throw "python not found" }

Write-Host "Starting render -> $out (log: $log)"
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $py.Source (Join-Path $here "render_final_mkv.py") `
    --video $localSrc `
    --out $out `
    --kdenlive (Join-Path $here "Riddick (2013) - Unjinxed.kdenlive") *>&1 | Tee-Object -FilePath $log -Append
$renderExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($renderExit -ne 0) { exit $renderExit }
Write-Host "Done: $out"
