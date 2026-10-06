# Remove Flashback vlc:// registration for the current user.
$ErrorActionPreference = "SilentlyContinue"
Remove-Item -Recurse -Force "HKCU:\Software\Classes\vlc"
$DestDir = Join-Path $env:LOCALAPPDATA "FlashbackVlcProtocol"
Remove-Item -Recurse -Force $DestDir
Write-Host "Removed Flashback vlc:// handler."
