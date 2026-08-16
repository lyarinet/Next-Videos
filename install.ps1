# Next-Videos - Windows PowerShell Installation Script
# Installs dependencies, sets up yt-dlp, and verifies FFmpeg

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "       Next-Videos PowerShell Installer            " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
try {
    $nodeVer = node -v
    Write-Host "[✓] Node.js $nodeVer detected." -ForegroundColor Green
} catch {
    Write-Host "[✗] Node.js is not installed! Please install Node.js (v18+) from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Install NPM Dependencies
Write-Host "`n[*] Installing Root dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n[*] Installing Backend dependencies..." -ForegroundColor Yellow
Set-Location "$ScriptDir\backend"
npm install

Write-Host "`n[*] Installing Frontend dependencies..." -ForegroundColor Yellow
Set-Location "$ScriptDir\app"
npm install

Set-Location $ScriptDir

# 3. Check yt-dlp
Write-Host "`n[*] Checking yt-dlp..." -ForegroundColor Yellow
$ytDlpInstalled = $false
try {
    $null = Get-Command yt-dlp -ErrorAction Stop
    Write-Host "[✓] yt-dlp found in system PATH." -ForegroundColor Green
    $ytDlpInstalled = $true
} catch {
    # Check python
    try {
        $null = Get-Command python -ErrorAction Stop
        Write-Host "[*] Python detected. Setting up backend virtual environment..." -ForegroundColor Yellow
        if (-not (Test-Path "$ScriptDir\backend\venv\Scripts\pip.exe")) {
            python -m venv "$ScriptDir\backend\venv"
        }
        & "$ScriptDir\backend\venv\Scripts\pip.exe" install -U yt-dlp
        Write-Host "[✓] yt-dlp installed in backend virtual environment." -ForegroundColor Green
        $ytDlpInstalled = $true
    } catch {
        Write-Host "[!] Python not found. Downloading standalone yt-dlp.exe to backend\bin..." -ForegroundColor Yellow
        $binDir = "$ScriptDir\backend\bin"
        if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
        $ytDlpExe = "$binDir\yt-dlp.exe"
        Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $ytDlpExe
        if (Test-Path $ytDlpExe) {
            Write-Host "[✓] Standalone yt-dlp.exe downloaded successfully." -ForegroundColor Green
            $ytDlpInstalled = $true
        }
    }
}

# 4. Check FFmpeg
Write-Host "`n[*] Checking FFmpeg..." -ForegroundColor Yellow
try {
    $null = Get-Command ffmpeg -ErrorAction Stop
    Write-Host "[✓] FFmpeg found in system PATH." -ForegroundColor Green
} catch {
    Write-Host "[!] FFmpeg not found in PATH." -ForegroundColor DarkYellow
    Write-Host "    Install using: winget install Gyan.FFmpeg" -ForegroundColor DarkYellow
    Write-Host "    or download from https://ffmpeg.org/download.html" -ForegroundColor DarkYellow
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "  [✓] Installation Finished Successfully!" -ForegroundColor Green
Write-Host "  Run 'start.bat' or 'powershell ./start.ps1' to launch" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
