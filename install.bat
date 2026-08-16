@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo        Next-Videos Windows Installer
echo ===================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VERSION=%%i"
echo [OK] Node.js %NODE_VERSION% detected.

:: 2. Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in PATH.
    pause
    exit /b 1
)

:: 3. Install Root, Backend and Frontend NPM Dependencies
echo.
echo [*] Installing Root Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] Root npm install encountered an issue, proceeding...
)

echo.
echo [*] Installing Backend Dependencies...
cd /d "%SCRIPT_DIR%backend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed!
    pause
    exit /b 1
)

echo.
echo [*] Installing Frontend Dependencies...
cd /d "%SCRIPT_DIR%app"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed!
    pause
    exit /b 1
)

cd /d "%SCRIPT_DIR%"

:: 4. Check & Setup yt-dlp
echo.
echo [*] Checking yt-dlp...
where yt-dlp >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] yt-dlp found in system PATH.
) else (
    :: Check if Python is installed to create venv
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        echo [*] Python detected. Setting up yt-dlp in backend/venv...
        if not exist "backend\venv\Scripts\pip.exe" (
            python -m venv backend\venv
        )
        call backend\venv\Scripts\pip install -U yt-dlp
        if %errorlevel% equ 0 (
            echo [OK] yt-dlp successfully installed in backend virtual environment.
        )
    ) else (
        echo [!] yt-dlp not found in PATH and Python is not installed.
        echo [*] Downloading standalone yt-dlp.exe to backend\bin...
        if not exist "backend\bin" mkdir "backend\bin"
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'backend\bin\yt-dlp.exe'"
        if exist "backend\bin\yt-dlp.exe" (
            echo [OK] Standalone yt-dlp.exe downloaded successfully.
        ) else (
            echo [WARNING] Could not auto-download yt-dlp.exe. Please install via: winget install yt-dlp
        )
    )
)

:: 5. Check FFmpeg
echo.
echo [*] Checking FFmpeg...
where ffmpeg >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] FFmpeg found in system PATH.
) else (
    echo [!] FFmpeg is not found in PATH.
    echo     You can install FFmpeg using:
    echo       winget install Gyan.FFmpeg
    echo     or download from https://ffmpeg.org/download.html and add to PATH.
)

echo.
echo ===================================================
echo   [OK] Installation Completed Successfully!
echo   To start Next-Videos, run: start.bat
echo ===================================================
pause
