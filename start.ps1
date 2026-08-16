# Next-Videos - PowerShell Universal Launcher
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$host.UI.RawUI.WindowTitle = "Next-Videos"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "              Next-Videos Launcher                 " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVer = node -v
    Write-Host "[✓] Node.js $nodeVer detected." -ForegroundColor Green
} catch {
    Write-Host "[✗] Node.js is not found! Install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check dependencies
if (-not (Test-Path "$ScriptDir\node_modules") -or -not (Test-Path "$ScriptDir\backend\node_modules") -or -not (Test-Path "$ScriptDir\app\node_modules")) {
    Write-Host "[*] Dependencies missing. Running installer..." -ForegroundColor Yellow
    & "$ScriptDir\install.ps1"
}

Write-Host "`n[*] Starting Next-Videos (Backend: 3005, Frontend: 5173)..." -ForegroundColor Yellow
Write-Host "[*] Press Ctrl+C to gracefully stop all services.`n" -ForegroundColor DarkGray

npm run dev
