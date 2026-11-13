@echo off
chcp 65001 >nul
setlocal
if not defined GAME_MIN_FPS set "GAME_MIN_FPS=59.0"
if not defined GAME_ALLOW_GAP_MS set "GAME_ALLOW_GAP_MS=80.0"
set /p START_LVL="请输入起始关卡 (默认 1): "
if "%START_LVL%"=="" set "START_LVL=1"
node "%~dp0internal\run-auto.mjs" --record --start %START_LVL% --end 0 %*
pause
