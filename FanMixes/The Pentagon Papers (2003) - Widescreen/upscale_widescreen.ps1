# Requires: ffmpeg, ffprobe, and Video2X or realesrgan-ncnn-vulkan.
# Run on Windows + NVIDIA. Copy the 4:3 library MKV to local disk first.
param(
    [string] $Video = "C:\Videos\FanEditRender\The Pentagon Papers (2003)\The Pentagon Papers (2003).mkv",
    [string] $OutDir = "C:\Videos\FanEditRender\The Pentagon Papers (2003) - Widescreen",
    [int] $TestSeconds = 0,
    [ValidateSet(2, 4)] [int] $Scale = 2,
    [string] $Model = "realesr-general-x4v3"
)

$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Srt = Join-Path $Project "The Pentagon Papers (2003) - Widescreen.english.srt"
$FinalName = "The Pentagon Papers (2003) - Widescreen.mkv"

function Find-Cmd([string[]] $names) {
    foreach ($n in $names) {
        $c = Get-Command $n -ErrorAction SilentlyContinue
        if ($c) { return $c.Source }
        $here = Join-Path $Project "tools\$n"
        if (Test-Path $here) { return $here }
        $here2 = Join-Path $Project "tools\$n.exe"
        if (Test-Path $here2) { return $here2 }
    }
    return $null
}

$ffmpeg = Find-Cmd @("ffmpeg")
$ffprobe = Find-Cmd @("ffprobe")
$video2x = Find-Cmd @("video2x", "video2x.exe")
$realesr = Find-Cmd @("realesrgan-ncnn-vulkan", "realesrgan-ncnn-vulkan.exe")

if (-not $ffmpeg -or -not $ffprobe) { throw "ffmpeg/ffprobe not on PATH" }
if (-not (Test-Path -LiteralPath $Video)) { throw "missing source (copy off NAS first): $Video" }

$dur = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -- $Video
if (-not $dur) { throw "ffprobe failed — rip incomplete or still copying" }
Write-Host "Source duration $dur s"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$work = Join-Path $OutDir "work"
New-Item -ItemType Directory -Force -Path $work | Out-Null

$square = Join-Path $work "square.mkv"
$up = Join-Path $work "upscaled.mkv"
$cropped = Join-Path $work "cropped.mkv"
$final = Join-Path $OutDir $FinalName

$extractArgs = @(
    "-hide_banner", "-y", "-i", $Video,
    "-vf", "scale=iw*sar:ih:flags=lanczos,format=yuv420p",
    "-c:v", "libx264", "-crf", "12", "-preset", "veryfast",
    "-c:a", "copy", "-sn"
)
if ($TestSeconds -gt 0) { $extractArgs = @("-t", "$TestSeconds") + $extractArgs }
$extractArgs += $square
Write-Host "+ ffmpeg square-pixel restore"
& $ffmpeg @extractArgs
if ($LASTEXITCODE -ne 0) { throw "ffmpeg square-pixel pass failed" }

if ($video2x) {
    Write-Host "+ video2x scale $Scale model $Model"
    & $video2x -i $square -o $up -p realesrgan -s $Scale
    if ($LASTEXITCODE -ne 0) { throw "video2x failed" }
} elseif ($realesr) {
    $inFrames = Join-Path $work "in_frames"
    $outFrames = Join-Path $work "out_frames"
    New-Item -ItemType Directory -Force -Path $inFrames, $outFrames | Out-Null
    Write-Host "+ ffmpeg extract jpeg frames (large; use Video2X if this fills the disk)"
    & $ffmpeg -hide_banner -y -i $square -q:v 2 (Join-Path $inFrames "%08d.jpg")
    if ($LASTEXITCODE -ne 0) { throw "frame extract failed" }
    & $realesr -i $inFrames -o $outFrames -n $Model -s $Scale
    if ($LASTEXITCODE -ne 0) { throw "realesrgan-ncnn-vulkan failed" }
    $fps = & $ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 -- $square
    & $ffmpeg -hide_banner -y -framerate $fps -i (Join-Path $outFrames "%08d.png") -i $square `
        -map 0:v:0 -map 1:a -c:v libx264 -crf 12 -preset veryfast -c:a copy $up
    if ($LASTEXITCODE -ne 0) { throw "rebuild after realesrgan failed" }
} else {
    throw "Install Video2X or realesrgan-ncnn-vulkan (NVIDIA). See PLAN.md."
}

# 16:9 center crop; if 2x from 768x576 this is 1536x864. Then even 1080p.
Write-Host "+ 16:9 crop + 10-bit HEVC"
& $ffmpeg -hide_banner -y -i $up `
    -vf "crop=iw:iw*9/16,scale=1920:1080:flags=lanczos,format=yuv420p10le" `
    -c:v libx265 -preset slow -crf 16 -pix_fmt yuv420p10le `
    -c:a copy -sn $cropped
if ($LASTEXITCODE -ne 0) { throw "crop/encode failed" }

$mux = @(
    "-hide_banner", "-y",
    "-i", $cropped,
    "-i", $Srt,
    "-map", "0:v:0", "-map", "0:a", "-map", "1:0",
    "-c", "copy", "-c:s", "srt",
    "-metadata", "title=The Pentagon Papers (Widescreen)",
    "-metadata:s:s:0", "language=eng",
    "-metadata:s:s:0", "title=English",
    "-disposition:s:0", "default",
    $final
)
Write-Host "+ remux English SRT"
& $ffmpeg @mux
if ($LASTEXITCODE -ne 0) { throw "remux failed" }

Write-Host "Wrote $final"
& $ffprobe -hide_banner $final
