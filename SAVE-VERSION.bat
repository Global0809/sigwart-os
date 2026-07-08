@echo off
title SIGWART_OS // SAVE VERSION
cd /d "%~dp0"
echo.
echo   Saving snapshot of the entire website...
echo.
git add -A
git commit -m "manual save %date% %time%"
echo.
echo   ============ SAVED VERSIONS (newest first) ============
git log --pretty=format:"   %%h  %%ad  %%s" --date=format:"%%d-%%m-%%Y %%H:%%M" -10
echo.
echo.
echo   To restore any version: tell Claude the code (e.g. "restore 0f500cc")
echo.
pause
