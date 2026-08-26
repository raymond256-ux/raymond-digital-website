# ============================================================
# Raymond Digital - Logo Preparation Tool
# ------------------------------------------------------------
# Reads the master logo (assets/images/raymond-digital-logo.png),
# then produces a web-ready derivative:
#   assets/images/raymond-digital-logo-mark.png
#   - white/near-white background made transparent (if needed)
#   - excess whitespace trimmed (auto-crop to the artwork)
#
# USAGE (from project root):
#   powershell -ExecutionPolicy Bypass -File _tools\prepare-logo.ps1
# Optional custom source:
#   powershell -ExecutionPolicy Bypass -File _tools\prepare-logo.ps1 -Source "path\to\logo.png"
# ============================================================
param(
    [string]$Source = "assets\images\raymond-digital-logo.png"
)

Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Source)) {
    Write-Error "Master logo not found: $Source"
    exit 1
}

$src = New-Object System.Drawing.Bitmap ((Resolve-Path $Source).Path)

# Normalise to 32bpp ARGB so we always have an alpha channel
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose()
$src.Dispose()
Write-Output ("Source: {0}x{1}px" -f $bmp.Width, $bmp.Height)

$rect  = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
$data  = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes  = New-Object byte[] ([Math]::Abs($stride) * $bmp.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

# --- Pass 1: measure how much of the image is already transparent ---
$total = 0; $clear = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $i = $row + $x * 4
        if ($bytes[$i + 3] -lt 200) { $clear++ }
        $total++
    }
}
$alreadyTransparent = ($clear / $total) -gt 0.05
Write-Output ("Transparent pixels: {0:P1} -> treatment: {1}" -f ($clear / $total), $(if ($alreadyTransparent) { 'crop only' } else { 'remove white matte + crop' }))

# --- Pass 2: knock out near-white background (only when opaque) + find bounding box ---
$minX = $bmp.Width;  $minY = $bmp.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $i = $row + $x * 4
        $a = $bytes[$i + 3]
        if (-not $alreadyTransparent -and $a -gt 0) {
            $min = [Math]::Min($bytes[$i], [Math]::Min($bytes[$i + 1], $bytes[$i + 2]))
            if     ($min -ge 244) { $bytes[$i + 3] = 0 }                      # pure background -> gone
            elseif ($min -ge 228) { $bytes[$i + 3] = [int]($a * ($min - 228) / 16) }  # soft edge feather
            $a = $bytes[$i + 3]
        }
        if ($a -gt 16) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

if ($maxX -le $minX -or $maxY -le $minY) { Write-Error "No visible artwork detected."; exit 1 }

# --- Crop with a small breathing margin ---
$marg = [Math]::Max(8, [int]([Math]::Max($maxX - $minX, $maxY - $minY) * 0.03))
$cx = [Math]::Max(0, $minX - $marg)
$cy = [Math]::Max(0, $minY - $marg)
$cw = [Math]::Min($bmp.Width  - $cx, ($maxX - $minX) + $marg * 2)
$ch = [Math]::Min($bmp.Height - $cy, ($maxY - $minY) + $marg * 2)
$cropRect = New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch
$out = $bmp.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$outPath = Join-Path (Get-Location) 'assets\images\raymond-digital-logo-mark.png'
$out.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("Saved: assets\images\raymond-digital-logo-mark.png ({0}x{1}px)" -f $out.Width, $out.Height)
$out.Dispose(); $bmp.Dispose()
Write-Output "Done."
