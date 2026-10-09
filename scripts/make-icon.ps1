$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = [System.Drawing.Image]::FromFile((Join-Path $repoRoot 'assets/branding/wpost-icon.png'))
$frames = @()
try {
    foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $stream = New-Object System.IO.MemoryStream
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($source, 0, 0, $size, $size)
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames += @{ Size = $size; Bytes = $stream.ToArray() }
        } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    $output = [System.IO.File]::Create((Join-Path $repoRoot 'assets/wpost.ico'))
    $writer = New-Object System.IO.BinaryWriter($output)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
        $offset = 6 + 16 * $frames.Count
        foreach ($frame in $frames) {
            $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
            $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
            $offset += $frame.Bytes.Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
    } finally { $writer.Dispose(); $output.Dispose() }
} finally { $source.Dispose() }

# Keep every application and documentation consumer on the same master image.
$iconPath = Join-Path $repoRoot 'assets/branding/wpost-icon.png'
Copy-Item -LiteralPath $iconPath -Destination (Join-Path $repoRoot 'build/icon.png')
Copy-Item -LiteralPath (Join-Path $repoRoot 'assets/wpost.ico') -Destination (Join-Path $repoRoot 'build/icon.ico')
$encodedIcon = [Convert]::ToBase64String([IO.File]::ReadAllBytes($iconPath))
$svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,' + $encodedIcon + '"/></svg>'
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $repoRoot 'build/icon.svg'), $svg + "`n", $utf8)
$logoPath = Join-Path $repoRoot 'assets/branding/wpost-logo.svg'
$logo = [regex]::Replace([IO.File]::ReadAllText($logoPath), 'data:image/png;base64,[^"]+', 'data:image/png;base64,' + $encodedIcon)
[IO.File]::WriteAllText($logoPath, $logo, $utf8)
Write-Output 'Generated seven ICO sizes and synchronized the application icons and wordmark.'
