@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\..\.."
set "PATH=%~dp0..\..\..\tools\.runtime\node;%~dp0..\..\..\tools\ffmpeg\bin;%PATH%"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0..\..\..\tools\.runtime\ms-playwright"
node download\Mad-Medicine-20261102-100432\scripts\internal\run-auto.mjs --record --start-level 1 --levels 10 %*
set "EXITCODE=%errorlevel%"
echo EXITCODE=%EXITCODE%
pause
exit /b %EXITCODE%
