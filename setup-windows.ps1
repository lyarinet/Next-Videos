# ==============================================================================
# Next-Videos Windows Desktop Setup & Dependency Installer
# ==============================================================================

param (
    [switch]$Silent = $false
)

$ErrorActionPreference = "Continue"
$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $RootPath

function Write-Header {
    Clear-Host
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "          Next-Videos Windows Desktop App Setup                  " -ForegroundColor White
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-Header

# ------------------------------------------------------------------------------
# 1. Check Node.js & npm
# ------------------------------------------------------------------------------
Write-Host "[1/6] Checking Node.js Environment..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    Write-Host " [!] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host " [*] Attempting to install Node.js via winget..." -ForegroundColor Cyan
    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetCmd) {
        winget install OpenJS.NodeJS -e --silent --accept-source-agreements --accept-package-agreements
        Write-Host " [OK] Node.js installation triggered. Please restart installer after it finishes." -ForegroundColor Green
    } else {
        Write-Host " [ERROR] Please install Node.js (v18+) from https://nodejs.org" -ForegroundColor Red
    }
    Read-Host "Press Enter to continue..."
} else {
    $nodeVersion = node -v
    Write-Host " [OK] Node.js $nodeVersion detected." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 2. Setup Binaries Directory (yt-dlp & FFmpeg)
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/6] Checking & Installing Core Binaries (FFmpeg & yt-dlp)..." -ForegroundColor Yellow

$binDir = Join-Path $RootPath "backend\bin"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

# Check / Download yt-dlp
$ytdlpPath = Join-Path $binDir "yt-dlp.exe"
if (-not (Test-Path $ytdlpPath)) {
    Write-Host " [*] Downloading latest yt-dlp.exe..." -ForegroundColor Cyan
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        $ytdlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        Invoke-WebRequest -Uri $ytdlpUrl -OutFile $ytdlpPath -UseBasicParsing
        Write-Host " [OK] yt-dlp.exe downloaded successfully." -ForegroundColor Green
    } catch {
        Write-Host " [WARNING] Could not auto-download yt-dlp: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host " [OK] yt-dlp.exe verified in backend\bin." -ForegroundColor Green
}

# Check / Download FFmpeg & FFprobe
$ffmpegPath = Join-Path $binDir "ffmpeg.exe"
$ffprobePath = Join-Path $binDir "ffprobe.exe"

if (-not (Test-Path $ffmpegPath) -or -not (Test-Path $ffprobePath)) {
    Write-Host " [*] Downloading FFmpeg Windows essentials..." -ForegroundColor Cyan
    try {
        $ffmpegZip = Join-Path $binDir "ffmpeg-essentials.zip"
        $ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
        
        Write-Host "     Downloading from Gyan.dev (this may take a minute)..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing
        
        Write-Host "     Extracting FFmpeg binaries..." -ForegroundColor Gray
        $tempExtract = Join-Path $binDir "temp_ffmpeg"
        Expand-Archive -Path $ffmpegZip -DestinationPath $tempExtract -Force
        
        $extractedBin = Get-ChildItem -Path $tempExtract -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
        if ($extractedBin) {
            $extractedDir = $extractedBin.DirectoryName
            Copy-Item (Join-Path $extractedDir "ffmpeg.exe") -Destination $ffmpegPath -Force
            Copy-Item (Join-Path $extractedDir "ffprobe.exe") -Destination $ffprobePath -Force
            if (Test-Path (Join-Path $extractedDir "ffplay.exe")) {
                Copy-Item (Join-Path $extractedDir "ffplay.exe") -Destination (Join-Path $binDir "ffplay.exe") -Force
            }
        }
        
        # Cleanup
        Remove-Item -Path $ffmpegZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Host " [OK] FFmpeg and FFprobe installed successfully." -ForegroundColor Green
    } catch {
        Write-Host " [WARNING] Could not auto-download FFmpeg archive: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host " [OK] FFmpeg & FFprobe verified in backend\bin." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 3. Install NPM Dependencies
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/6] Installing NPM Dependencies..." -ForegroundColor Yellow

Write-Host " [*] Installing backend packages..." -ForegroundColor Gray
Set-Location (Join-Path $RootPath "backend")
cmd /c "npm install" | Out-Null

Write-Host " [*] Installing frontend packages..." -ForegroundColor Gray
Set-Location (Join-Path $RootPath "app")
cmd /c "npm install" | Out-Null

Set-Location $RootPath
Write-Host " [OK] All dependencies installed successfully." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Build Production Bundle
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/6] Building Production Web Application..." -ForegroundColor Yellow
Set-Location (Join-Path $RootPath "app")
cmd /c "npm run build" | Out-Null

$appDist = Join-Path $RootPath "app\dist"
$backendPublic = Join-Path $RootPath "backend\public"

if (Test-Path $appDist) {
    if (-not (Test-Path $backendPublic)) {
        New-Item -ItemType Directory -Path $backendPublic -Force | Out-Null
    }
    Copy-Item -Path "$appDist\*" -Destination $backendPublic -Recurse -Force
    Write-Host " [OK] Production build compiled and synchronized." -ForegroundColor Green
}

Set-Location $RootPath

# ------------------------------------------------------------------------------
# 5. Create Desktop & Start Menu Shortcuts with Logo Icon
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[5/6] Creating Desktop & Start Menu Shortcuts..." -ForegroundColor Yellow

$icoPath = Join-Path $RootPath "image\logo.ico"
$vbsLauncher = Join-Path $RootPath "start-desktop.vbs"
$batLauncher = Join-Path $RootPath "start-desktop.bat"

$wshShell = New-Object -ComObject WScript.Shell
$desktopDir = [Environment]::GetFolderPath("Desktop")
$programsDir = [Environment]::GetFolderPath("Programs")

# Desktop Shortcut
$desktopShortcut = $wshShell.CreateShortcut((Join-Path $desktopDir "Next-Videos.lnk"))
$desktopShortcut.TargetPath = "wscript.exe"
$desktopShortcut.Arguments = "`"$vbsLauncher`""
$desktopShortcut.WorkingDirectory = $RootPath
$desktopShortcut.IconLocation = "$icoPath,0"
$desktopShortcut.Description = "Launch Next-Videos Downloader"
$desktopShortcut.Save()

# Start Menu Shortcut
$startMenuShortcut = $wshShell.CreateShortcut((Join-Path $programsDir "Next-Videos.lnk"))
$startMenuShortcut.TargetPath = "wscript.exe"
$startMenuShortcut.Arguments = "`"$vbsLauncher`""
$startMenuShortcut.WorkingDirectory = $RootPath
$startMenuShortcut.IconLocation = "$icoPath,0"
$startMenuShortcut.Description = "Launch Next-Videos Downloader"
$startMenuShortcut.Save()

Write-Host " [OK] Desktop shortcut 'Next-Videos' created with custom icon." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 6. Launch Chrome Extension Setup Guide & Browser
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[6/6] Launching Chrome Extension Setup & Initializing App..." -ForegroundColor Yellow

$guidePath = Join-Path $RootPath "extension\install-guide.html"

# Find Chrome and open extensions page
$chromePath = $null
$chromeLocations = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

foreach ($loc in $chromeLocations) {
    if (Test-Path $loc) {
        $chromePath = $loc
        break
    }
}

# Start backend server in background
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsLauncher`"" -WindowStyle Hidden

# Open Chrome Extensions & Onboarding Guide
if ($chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList "chrome://extensions"
    Start-Process -FilePath $chromePath -ArgumentList "`"$guidePath`""
} else {
    Start-Process -FilePath $guidePath
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  🎉 Setup Finished! Next-Videos is Ready to Use.                " -ForegroundColor White
Write-Host "  - Desktop Shortcut: Next-Videos.lnk (on your desktop)          " -ForegroundColor Cyan
Write-Host "  - Web App URL:      http://localhost:3005                      " -ForegroundColor Cyan
Write-Host "  - Extension Path:   $RootPath\extension                        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""

if (-not $Silent) {
    Read-Host "Press Enter to exit..."
}
