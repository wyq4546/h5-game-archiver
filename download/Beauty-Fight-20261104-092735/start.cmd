@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 goto node_missing
if not exist "..\..\src\cli.mjs" goto project_missing
if not exist "archive\manifest.json" goto archive_missing

powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $game=(Resolve-Path -LiteralPath '.').Path; $root=(Resolve-Path -LiteralPath (Join-Path $game '..\..')).Path; $archive=Join-Path $game 'archive'; $pidFile=Join-Path $archive '.replay.pid'; $portFile=Join-Path $archive '.replay.port'; $manifestText=Get-Content -Raw -LiteralPath (Join-Path $archive 'manifest.json'); $sourceUrl=[regex]::Match($manifestText,'sourceUrl[^h]+(https?://[a-zA-Z0-9:/?&=._-]+)').Groups[1].Value; if (-not $sourceUrl) { throw 'manifest sourceUrl is missing' }; $previousPort=0; if (Test-Path -LiteralPath $portFile) { try { $previousPort=[int](Get-Content -LiteralPath $portFile) } catch {} }; if (Test-Path -LiteralPath $pidFile) { $serverId=[int](Get-Content -LiteralPath $pidFile); $oldProcess=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $serverId) -ErrorAction SilentlyContinue; if ($null -ne $oldProcess) { if ($oldProcess.Name -eq 'node.exe' -and $oldProcess.CommandLine.IndexOf($game,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) { Write-Host ('Stopping previous replay process ' + $serverId + '...'); Stop-Process -Id $serverId -Force; for ($wait=0; $wait -lt 50; $wait++) { if ($null -eq (Get-Process -Id $serverId -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Milliseconds 100 }; if ($null -ne (Get-Process -Id $serverId -ErrorAction SilentlyContinue)) { throw 'Previous replay process did not stop.' } } else { Write-Warning 'The saved replay PID belongs to another process; stale launcher state will be replaced.' } } }; Remove-Item -LiteralPath $pidFile,$portFile -Force -ErrorAction SilentlyContinue; do { $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0); try { $listener.Start(); $port=([System.Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() } } while ($port -eq $previousPort); Write-Host ('Using free random port ' + $port + '.'); $url='http://127.0.0.1:' + $port + '/'; $cli=Join-Path $root 'src\cli.mjs'; $args='\"' + $cli + '\" replay --archive \"' + $game + '\" --port ' + $port; $out=Join-Path $archive 'replay.log'; $err=Join-Path $archive 'replay-error.log'; $process=Start-Process -FilePath 'node.exe' -ArgumentList $args -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru; Set-Content -LiteralPath $pidFile -Value $process.Id; Set-Content -LiteralPath $portFile -Value $port; for ($attempt=0; $attempt -lt 40; $attempt++) { Start-Sleep -Milliseconds 250; if ($process.HasExited) { Remove-Item -LiteralPath $pidFile,$portFile -Force -ErrorAction SilentlyContinue; Write-Host ('Replay service exited. See: ' + $err); exit 3 }; try { $ready=Invoke-RestMethod ($url + '__archive_info') -TimeoutSec 1; if ($ready.sourceUrl -eq $sourceUrl) { if ($ready.replayUrl) { $url=$ready.replayUrl }; Write-Host ('Game started at ' + $url); if ($ready.browserHostMapping) { $browserCli=Join-Path $root 'src\offline-origin-player.mjs'; $browserArgs='\"' + $browserCli + '\" --archive \"' + $game + '\" --url \"' + $url + '\" --local-port ' + $port; Start-Process -FilePath 'node.exe' -ArgumentList $browserArgs -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $archive 'browser.log') -RedirectStandardError (Join-Path $archive 'browser-error.log') } else { Start-Process $url }; exit 0 } } catch {} }; Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $pidFile,$portFile -Force -ErrorAction SilentlyContinue; Write-Host 'Replay service did not become ready.'; exit 4"
if errorlevel 1 goto start_failed
exit /b 0

:node_missing
echo Node.js 20 or newer is required.
goto failed

:project_missing
echo The H5 Game Archiver project was not found two folders above this game.
goto failed

:archive_missing
echo archive\manifest.json is missing. This download is incomplete.
goto failed

:start_failed
echo Failed to start the game. Check archive\replay-error.log for details.

:failed
pause
exit /b 1
