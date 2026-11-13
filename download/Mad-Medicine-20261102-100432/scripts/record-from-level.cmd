@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\..\.."
set "PATH=%~dp0..\..\..\tools\.runtime\node;%~dp0..\..\..\tools\ffmpeg\bin;%PATH%"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0..\..\..\tools\.runtime\ms-playwright"
set "LVL=%~1"
if "%LVL%"=="" set "LVL=1"
shift
node download\Mad-Medicine-20261102-100432\scripts\internal\run-auto.mjs --record --start-level %LVL% --levels 10 %1 %2 %3 %4 %5 %6
set "EXITCODE=%errorlevel%"
echo EXITCODE=%EXITCODE%
pause
exit /b %EXITCODE%
