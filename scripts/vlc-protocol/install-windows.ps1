# Flashback Repository — register vlc:// for the current Windows user (no admin).
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File install-windows.ps1
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DestDir = Join-Path $env:LOCALAPPDATA "FlashbackVlcProtocol"
$Handler = Join-Path $DestDir "flashback-vlc-open.ps1"

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

@'
param([Parameter(Mandatory=$true)][string]$RawUrl)
$ErrorActionPreference = "Stop"
$url = $RawUrl
if ($url.StartsWith("vlc://")) { $url = $url.Substring(6) }

if ($url -match '^weblink/?\?url=') {
  $url = $url -replace '^weblink/?\?url=', ''
  $url = [System.Uri]::UnescapeDataString($url)
} elseif ($url -match '^(https?)//') {
  # Chrome 130+ quirk: vlc://https//host/...
  $url = $Matches[1] + ":" + $url.Substring($Matches[1].Length)
}

$url = $url -replace ' ', '%20'
if ($url -notmatch '^https?://') {
  Write-Error "Only http(s) URLs allowed: $url"
  exit 1
}

function Find-Vlc {
  $candidates = @(
    (Join-Path ${env:ProgramFiles} "VideoLAN\VLC\vlc.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "VideoLAN\VLC\vlc.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\VideoLAN\VLC\vlc.exe")
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  $cmd = Get-Command vlc.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$vlc = Find-Vlc
if (-not $vlc) {
  Write-Error "VLC not found. Install from https://www.videolan.org/vlc/"
  exit 1
}
Start-Process -FilePath $vlc -ArgumentList @("--open", $url)
'@ | Set-Content -Path $Handler -Encoding UTF8

$ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$cmd = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -File `"$Handler`" `"%1`""

$cls = "HKCU:\Software\Classes\vlc"
New-Item -Path $cls -Force | Out-Null
Set-ItemProperty -Path $cls -Name "(default)" -Value "URL:VLC Protocol"
Set-ItemProperty -Path $cls -Name "URL Protocol" -Value ""
New-Item -Path "$cls\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$cls\shell\open\command" -Name "(default)" -Value $cmd

Write-Host "Installed Flashback vlc:// handler for this user."
Write-Host "  handler: $Handler"
Write-Host ""
Write-Host "Test in PowerShell:"
Write-Host '  start vlc://https://www.videolan.org/vlc/video-dummy.mp4'
Write-Host ""
Write-Host "Then open a Flashback title and use Open in VLC."
if (-not (Find-Vlc)) {
  Write-Host ""
  Write-Host "Note: Install VLC from https://www.videolan.org/vlc/ first."
}
