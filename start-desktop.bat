@echo off
setlocal enabledelayedexpansion

title Next-Videos Desktop Launcher
cd /d "%~dp0"

:: Start backend in background if not already running
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3005/api/health' -TimeoutSec 1; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    start "" /b node backend/server.js
    timeout /t 2 /nobreak >nul
)

:: Find Chrome executable
set "CHROME_PATH="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

:: Launch in App window mode or default browser
if defined CHROME_PATH (
    start "" "!CHROME_PATH!" --app=http://localhost:3005 --app-id=next-videos --icon="%~dp0image\logo.ico"
) else (
    start "" "http://localhost:3005"
)

exit /b 0
