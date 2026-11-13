@echo off
chcp 65001 >nul
setlocal
node "%~dp0internal\verify-recordings.mjs" %*
pause
