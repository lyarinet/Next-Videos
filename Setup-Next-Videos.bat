@echo off
setlocal enabledelayedexpansion

title Next-Videos Windows Desktop Setup & Dependency Installer
cd /d "%~dp0"

echo =================================================================
echo            Next-Videos Windows Desktop App Installer
echo =================================================================
echo.
echo Launching automated environment & dependency setup...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"

exit /b %errorlevel%
