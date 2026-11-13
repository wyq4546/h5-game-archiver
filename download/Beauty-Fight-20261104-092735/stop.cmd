@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $game=(Resolve-Path -LiteralPath '.').Path; $archive=Join-Path $game 'archive'; $pidFile=Join-Path $archive '.replay.pid'; $portFile=Join-Path $archive '.replay.port'; if (-not (Test-Path -LiteralPath $pidFile)) { Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue; Write-Host 'This game is not running.'; exit 0 }; $serverId=[int](Get-Content -LiteralPath $pidFile); $process=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $serverId) -ErrorAction SilentlyContinue; if ($null -eq $process) { Remove-Item -LiteralPath $pidFile,$portFile -Force -ErrorAction SilentlyContinue; Write-Host 'This game is not running.'; exit 0 }; if ($process.Name -ne 'node.exe' -or $process.CommandLine.IndexOf($game,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) { Write-Host 'The saved process does not belong to this game. Nothing was stopped.'; exit 2 }; Stop-Process -Id $serverId -Force; Remove-Item -LiteralPath $pidFile,$portFile -Force -ErrorAction SilentlyContinue; Write-Host 'Game stopped.'"
if errorlevel 2 goto stop_failed
exit /b 0

:stop_failed
pause
exit /b 2
