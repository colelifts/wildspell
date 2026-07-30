$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$typeSource = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class WildSpellAssetTrimmer
{
    public static void Trim(string inputPath, string outputPath, int padding)
    {
        using (var source = new Bitmap(inputPath))
        {
        var left = source.Width;
        var top = source.Height;
        var right = -1;
        var bottom = -1;

        for (var y = 0; y < source.Height; y++)
        {
            for (var x = 0; x < source.Width; x++)
            {
                if (source.GetPixel(x, y).A <= 8) continue;
                left = Math.Min(left, x);
                right = Math.Max(right, x);
                top = Math.Min(top, y);
                bottom = Math.Max(bottom, y);
            }
        }

        if (right < left || bottom < top) throw new InvalidOperationException("Asset has no visible pixels: " + inputPath);
        left = Math.Max(0, left - padding);
        top = Math.Max(0, top - padding);
        right = Math.Min(source.Width - 1, right + padding);
        bottom = Math.Min(source.Height - 1, bottom + padding);

        using (var output = new Bitmap(right - left + 1, bottom - top + 1, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                graphics.DrawImage(source, new Rectangle(0, 0, output.Width, output.Height), new Rectangle(left, top, output.Width, output.Height), GraphicsUnit.Pixel);
            }
            output.Save(outputPath, ImageFormat.Png);
        }
        }
    }
}
"@

Add-Type -TypeDefinition $typeSource -ReferencedAssemblies System.Drawing

$uiDirectory = Join-Path $PSScriptRoot "..\assets\ui"
$sourceDirectory = Join-Path $PSScriptRoot "..\art-source\ui"
New-Item -ItemType Directory -Force -Path $sourceDirectory | Out-Null

Get-ChildItem -LiteralPath $uiDirectory -Filter "*.png" | ForEach-Object {
    $sourceCopy = Join-Path $sourceDirectory $_.Name
    if (-not (Test-Path -LiteralPath $sourceCopy)) {
        Copy-Item -LiteralPath $_.FullName -Destination $sourceCopy
    }
    $temporary = Join-Path $uiDirectory ("." + $_.BaseName + ".trim.png")
    [WildSpellAssetTrimmer]::Trim($sourceCopy, $temporary, 12)
    Move-Item -LiteralPath $temporary -Destination $_.FullName -Force
}

Write-Output "Normalized UI alpha bounds."
