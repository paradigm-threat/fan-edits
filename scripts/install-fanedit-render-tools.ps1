# Install Python 3 and FFmpeg (ffprobe included) for FanMix render pipelines.
# Run: powershell -ExecutionPolicy Bypass -File scripts/install-fanedit-render-tools.ps1
$ErrorActionPreference = 'Stop'
$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
    Write-Error 'winget not found. Install App Installer from Microsoft Store or use Windows 10 1809+.'
}

function Have-Exe($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Have-Exe 'python')) {
    Write-Host 'Installing Python 3.12...'
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
}
else {
    Write-Host 'Python already on PATH.'
}

if (-not (Have-Exe 'ffmpeg')) {
    Write-Host 'Installing FFmpeg (Gyan full build, includes libx265)...'
    winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
}
else {
    Write-Host 'ffmpeg already on PATH.'
}

# Refresh PATH in this session (winget often installs under Program Files)
$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machine;$user"

Write-Host '---'
python --version
ffmpeg -version 2>&1 | Select-Object -First 2
ffprobe -version 2>&1 | Select-Object -First 2
Write-Host 'Done.'
