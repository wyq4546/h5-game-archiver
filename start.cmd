@echo off
setlocal
cd /d "%~dp0"

set "PLAYWRIGHT_BROWSERS_PATH=%~dp0tools\.runtime\ms-playwright"

rem Prefer the project-local Node.js runtime.
if exist "%~dp0tools\.runtime\node\node.exe" set "PATH=%~dp0tools\.runtime\node;%PATH%"

where node.exe >nul 2>nul
if errorlevel 1 goto node_missing
node.exe -e "try { require('node:sqlite') } catch { process.exit(1) }" >nul 2>nul
if errorlevel 1 goto node_missing
if not exist "node_modules\playwright" goto dependencies_missing

rem Stop any running service or process listening on port 41740 so the newest code is loaded
echo Stopping the running service so the newest code is loaded...
powershell.exe -NoProfile -Command "try { $serviceId=[int](Get-Content -LiteralPath 'data/logs/web.pid' -ErrorAction Stop); $service=Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $serviceId); if ($service.Name -eq 'node.exe' -and $service.CommandLine -match 'src[\\/]web\.mjs') { Stop-Process -Id $serviceId -Force -ErrorAction Stop } } catch {}"
powershell.exe -NoProfile -Command "try { $h=Invoke-RestMethod 'http://127.0.0.1:41740/api/health' -TimeoutSec 1 -ErrorAction SilentlyContinue; if ($h -and $h.analyzer -and $h.analyzer.pid) { Stop-Process -Id ([int]$h.analyzer.pid) -Force -ErrorAction SilentlyContinue } } catch {}; $conns = Get-NetTCPConnection -LocalPort 41740 -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } }"

set /a stop_tries=0
:wait_for_stop
powershell.exe -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 41740 -State Listen -ErrorAction SilentlyContinue; if (-not $conns) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    set /a stop_tries+=1 >nul
    if %stop_tries% GEQ 20 goto stop_failed
    powershell.exe -NoProfile -Command "Start-Sleep -Milliseconds 300"
    goto wait_for_stop
)

:start_service
echo Starting H5 Game Archiver...
echo The service will keep running in the background. Run stop.cmd to stop it.
if not exist "data\logs" mkdir "data\logs"
if errorlevel 1 goto start_failed
if exist "data\logs\web.stdout.log" copy /y "data\logs\web.stdout.log" "data\logs\web.stdout.previous.log" >nul
if exist "data\logs\web.stderr.log" copy /y "data\logs\web.stderr.log" "data\logs\web.stderr.previous.log" >nul
powershell.exe -NoProfile -WindowStyle Hidden -Command "$ErrorActionPreference='Stop'; try { $service=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'src/web.mjs' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -RedirectStandardOutput 'data/logs/web.stdout.log' -RedirectStandardError 'data/logs/web.stderr.log' -PassThru; [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path 'data/logs/web.pid'), [string]$service.Id) } catch { Write-Error $_; exit 1 }"
if errorlevel 1 goto start_failed

set /a start_tries=0
:wait_for_server
node.exe -e "fetch('http://127.0.0.1:41740/api/health',{signal:AbortSignal.timeout(3000)}).then(function(r){return r.json()}).then(function(v){process.exit(v.name==='h5-game-archiver'?0:1)}).catch(function(){process.exit(1)})" >nul 2>nul
if not errorlevel 1 goto server_ready
powershell.exe -NoProfile -Command "try { $serviceId=[int](Get-Content -LiteralPath 'data/logs/web.pid' -ErrorAction Stop); Get-Process -Id $serviceId -ErrorAction Stop >$null } catch { exit 1 }"
if errorlevel 1 goto process_exited
set /a start_tries+=1 >nul
if %start_tries% GEQ 30 goto start_timeout
powershell.exe -NoProfile -Command "Start-Sleep -Milliseconds 300"
goto wait_for_server

:server_ready
echo H5 Game Archiver started.
start "" "http://127.0.0.1:41740/"
exit /b 0

:stop_failed
echo.
echo Could not stop the service already listening on http://127.0.0.1:41740/.
echo Run stop.cmd, or end the node.exe process, then start again.
pause
exit /b 1

:node_missing
echo Node.js 22.13 or newer is required.
pause
exit /b 1

:dependencies_missing
echo Project dependencies are missing.
echo Run npm install in this directory first.
pause
exit /b 1

:start_failed
echo.
echo Failed to start the service on http://127.0.0.1:41740/.
goto show_start_error

:process_exited
echo.
echo The service process exited before it became ready.
goto show_start_error

:start_timeout
echo.
echo The service process is still running, but startup checks timed out.
echo Check the logs below before restarting; initialization may still be in progress.

:show_start_error
echo Logs: %~dp0data\logs\web.stdout.log
echo       %~dp0data\logs\web.stderr.log
powershell.exe -NoProfile -Command "if (Test-Path -LiteralPath 'data/logs/web.stderr.log') { Get-Content -LiteralPath 'data/logs/web.stderr.log' -Tail 20 }"
pause
exit /b 1
