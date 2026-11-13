@echo off
chcp 65001 >nul
setlocal
if not defined GAME_MIN_FPS set "GAME_MIN_FPS=59.0"
if not defined GAME_ALLOW_GAP_MS set "GAME_ALLOW_GAP_MS=80.0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未找到 node.exe，请确保 Node.js 已安装并加入 PATH。
  pause
  exit /b 1
)
node "%~dp0internal\run-auto.mjs" --record --start 1 --end 10 %*
set "EXITCODE=%errorlevel%"
if %EXITCODE% neq 0 (
  echo [ERROR] 录制执行失败，退出码: %EXITCODE%
)
pause
exit /b %EXITCODE%
