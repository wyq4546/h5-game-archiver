@echo off
chcp 65001 >nul
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未找到 node.exe，请确保 Node.js 已安装并加入 PATH。
  pause
  exit /b 1
)
node "%~dp0internal\run-auto.mjs" --play --visible --start 1 --end 0 %*
pause
