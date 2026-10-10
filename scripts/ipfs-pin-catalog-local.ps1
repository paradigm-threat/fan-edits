# Pin / audit catalog CIDs from assets.manifest.json against local Kubo (Windows).
# Usage:
#   .\scripts\ipfs-pin-catalog-local.ps1
#   .\scripts\ipfs-pin-catalog-local.ps1 -Report
#   .\scripts\ipfs-pin-catalog-local.ps1 -DryRun
param(
  [switch]$Report,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Manifest = if ($env:FAN_EDITS_MANIFEST) { $env:FAN_EDITS_MANIFEST } else { Join-Path $RepoRoot "assets.manifest.json" }
$Ipfs = if ($env:IPFS_BIN) { $env:IPFS_BIN } else { "ipfs" }
if (-not $env:IPFS_PATH) {
  $env:IPFS_PATH = Join-Path $env:USERPROFILE ".ipfs"
}

if (-not (Test-Path $Manifest)) { throw "Missing manifest: $Manifest" }

& $Ipfs id | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Kubo API unreachable (IPFS_PATH=$($env:IPFS_PATH))" }

$json = Get-Content -Raw -Path $Manifest | ConvertFrom-Json
$rows = New-Object System.Collections.Generic.List[object]
if ($json.mediaRoot) {
  $rows.Add([pscustomobject]@{ Path = "mediaRoot"; Cid = [string]$json.mediaRoot })
}
foreach ($a in @($json.assets)) {
  if (-not $a.ipfs) { continue }
  $p = if ($a.path) { [string]$a.path } elseif ($a.id) { [string]$a.id } else { [string]$a.ipfs }
  $rows.Add([pscustomobject]@{ Path = $p; Cid = [string]$a.ipfs })
}

$pinnedOk = 0; $pinnedMissing = 0; $blockOk = 0; $blockMissing = 0; $pinFailed = 0
"{0,-8} {1,-8} {2,-8}  {3}" -f "PINNED","BLOCKS","ACTION","PATH / CID"
"-------- -------- --------  ----------------------------------------"

foreach ($row in $rows) {
  $cid = $row.Cid
  $path = $row.Path
  $isPinned = $false
  $hasBlock = $false
  $action = "ok"

  & $Ipfs pin ls --type=recursive "/ipfs/$cid" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $isPinned = $true }

  & $Ipfs block stat "/ipfs/$cid" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $hasBlock = $true }

  if (-not $isPinned) {
    if ($Report) {
      $action = "need-pin"
    } elseif ($DryRun) {
      $action = "would-pin"
    } else {
      $action = "pinning"
      & $Ipfs pin add --recursive "/ipfs/$cid" 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $isPinned = $true
        $action = "pinned"
        & $Ipfs block stat "/ipfs/$cid" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $hasBlock = $true }
      } else {
        $action = "pin-fail"
        $pinFailed++
      }
    }
  }

  if ($isPinned) { $pinnedOk++ } else { $pinnedMissing++ }
  if ($hasBlock) { $blockOk++ } else { $blockMissing++ }

  "{0,-8} {1,-8} {2,-8}  {3}" -f ($(if ($isPinned) {"yes"} else {"no"}), $(if ($hasBlock) {"yes"} else {"no"}), $action, $path)
  "{0,-8} {1,-8} {2,-8}  {3}" -f "","","",$cid
}

""
"Summary: pinned=$pinnedOk missing_pin=$pinnedMissing blocks=$blockOk missing_blocks=$blockMissing pin_fail=$pinFailed"
"Manifest: $Manifest"
"IPFS_PATH: $($env:IPFS_PATH)"

if ($pinFailed -gt 0) { exit 1 }
if ($Report -and $pinnedMissing -gt 0) { exit 1 }
if (-not $Report -and $pinnedMissing -gt 0) { exit 1 }
exit 0
