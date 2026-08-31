@echo off
setlocal

cd /d "D:\zhouyi-decision-tool" || goto :fail

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found.
  goto :fail
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3036 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo ERROR: Port 3036 is already in use. No process was stopped.
  goto :fail
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

start "Zhouyi Dev Server" /D "D:\zhouyi-decision-tool" cmd.exe /k "call npm run dev:3036"

powershell.exe -NoProfile -Command "$taskDeadline = (Get-Date).AddSeconds(30); do { try { $taskResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3036' -UseBasicParsing -TimeoutSec 1; if ($taskResponse.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $taskDeadline); exit 1"
if errorlevel 1 (
  echo ERROR: The development server did not become ready within 30 seconds.
  goto :fail
)

start "" "http://127.0.0.1:3036/bazi/"
exit /b 0

:fail
echo.
echo Startup failed. Review the message above.
pause
exit /b 1
