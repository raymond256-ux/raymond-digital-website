# ============================================================
# Raymond Digital - Favicon Generator
# ------------------------------------------------------------
# Regenerates the site favicons from the official logo.
#
# USAGE (from the project root, after placing your logo at
# assets/images/raymond-digital-logo.png):
#   powershell -ExecutionPolicy Bypass -File _tools\generate-favicons.ps1
#
# Optional custom source path:
#   powershell -ExecutionPolicy Bypass -File _tools\generate-favicons.ps1 -Source "path\to\logo.png"
# ============================================================
param(
    [string]$Source
)

Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

# Default: use the prepared mark if present, otherwise the master logo
if (-not $Source) {
    if     (Test-Path "assets\images\raymond-digital-logo-mark.png") { $Source = "assets\images\raymond-digital-logo-mark.png" }
    elseif (Test-Path "assets\images\raymond-digital-logo.png")      { $Source = "assets\images\raymond-digital-logo.png" }
}
if (-not $Source -or -not (Test-Path $Source)) {
    Write-Error "Logo file not found. Add assets\images\raymond-digital-logo.png first."
    exit 1
}

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
Write-Output ("Source logo: {0} ({1}x{2}px)" -f $Source, $src.Width, $src.Height)

function New-Favicon {
    param(
        [int]$Size,
        [string]$OutPath,
        [bool]$WhiteBackground   # Apple touch icons need an opaque background
    )
    $b = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode     = 'AntiAlias'
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($WhiteBackground) { $g.Clear([System.Drawing.Color]::White) }
    else                  { $g.Clear([System.Drawing.Color]::Transparent) }

    # Fit the whole logo inside a padded square, preserving aspect ratio
    $pad   = [Math]::Max(2, [int]($Size * 0.07))
    $inner = $Size - ($pad * 2)
    $scale = [Math]::Min($inner / $src.Width, $inner / $src.Height)
    $w = [Math]::Max(1, [int]($src.Width  * $scale))
    $h = [Math]::Max(1, [int]($src.Height * $scale))
    $x = [int](($Size - $w) / 2)
    $y = [int](($Size - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)

    $full = Join-Path (Get-Location) $OutPath
    New-Item -ItemType Directory -Force -Path (Split-Path $full) | Out-Null
    $b.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $b.Dispose()
    Write-Output ("Saved: " + $OutPath + "  (" + $Size + "x" + $Size + ")")
}

New-Favicon -Size 32  -OutPath "assets\icons\favicon-32.png"       -WhiteBackground $false
New-Favicon -Size 180 -OutPath "assets\icons\apple-touch-icon.png" -WhiteBackground $true

$src.Dispose()
Write-Output ""
Write-Output "Done. Hard-refresh the browser (Ctrl+F5) to see the new favicon."
