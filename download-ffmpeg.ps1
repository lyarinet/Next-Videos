$ErrorActionPreference = "Stop"

$binDir = Join-Path $PSScriptRoot "backend\bin"
$zipPath = Join-Path $binDir "ffmpeg.zip"
$tempDir = Join-Path $binDir "ffmpeg_temp"

Write-Host "Extracting FFmpeg binaries..." -ForegroundColor Cyan
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

Get-ChildItem -Path $tempDir -Recurse -Filter "*.exe" | ForEach-Object {
    Write-Host "Installing $($_.Name) to backend\bin..." -ForegroundColor Green
    Move-Item $_.FullName $binDir -Force
}

Remove-Item $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "FFmpeg setup complete!" -ForegroundColor Green
Get-ChildItem $binDir | Select-Object Name, Length
