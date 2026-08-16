@echo off
setlocal enabledelayedexpansion
title Next-Videos Launcher

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ===================================================
echo             Next-Videos Launcher
echo ===================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [*] First time setup: Installing dependencies...
    call "%SCRIPT_DIR%install.bat"
)

if not exist "backend\node_modules" (
    echo [*] Installing backend dependencies...
    cd /d "%SCRIPT_DIR%backend"
    call npm install
    cd /d "%SCRIPT_DIR%"
)

if not exist "app\node_modules" (
    echo [*] Installing frontend dependencies...
    cd /d "%SCRIPT_DIR%app"
    call npm install
    cd /d "%SCRIPT_DIR%"
)

echo.
echo [*] Starting Next-Videos (Backend on port 3005, Frontend on port 5173)...
echo [*] Press Ctrl+C at any time to stop both servers.
echo.

:: Launch with npm dev (concurrently)
call npm run dev

pause
