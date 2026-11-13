@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\..\.."
set "PATH=%~dp0..\..\..\tools\.runtime\node;%~dp0..\..\..\tools\ffmpeg\bin;%PATH%"
node download\Mad-Medicine-20261102-100432\scripts\internal\verify-recordings.mjs %*
set "EXITCODE=%errorlevel%"
echo EXITCODE=%EXITCODE%
pause
exit /b %EXITCODE%
