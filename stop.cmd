@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -Command "try { $h=Invoke-RestMethod 'http://127.0.0.1:41740/api/health' -TimeoutSec 2 -ErrorAction SilentlyContinue; if ($h -and $h.analyzer -and $h.analyzer.pid) { Stop-Process -Id ([int]$h.analyzer.pid) -Force -ErrorAction SilentlyContinue } } catch {}"

powershell.exe -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 41740 -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }; exit 0 } else { exit 1 }"
if errorlevel 1 goto not_running

echo H5 Game Archiver stopped.
exit /b 0

:not_running
echo H5 Game Archiver is not running.
exit /b 0
