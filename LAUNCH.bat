@echo off
title SIGWART_OS // LOCAL UPLINK
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -OpenBrowser
echo.
echo   [uplink terminated]
pause
