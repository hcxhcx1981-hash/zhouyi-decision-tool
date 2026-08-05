@echo off
setlocal

cd /d "D:\zhouyi-decision-tool" || goto :fail

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python was not found.
  goto :fail
)

if not exist "out\index.html" (
  echo ERROR: out\index.html was not found. Run npm run build first.
  goto :fail
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3037 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo ERROR: Port 3037 is already in use. No process was stopped.
  goto :fail
)

start "Zhouyi Static Preview" /D "D:\zhouyi-decision-tool" cmd.exe /k "python -m http.server 3037 --bind 127.0.0.1 --directory out"

powershell.exe -NoProfile -Command "$previewDeadline = (Get-Date).AddSeconds(30); do { try { $previewResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3037' -UseBasicParsing -TimeoutSec 1; if ($previewResponse.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $previewDeadline); exit 1"
if errorlevel 1 (
  echo ERROR: Static preview did not become ready within 30 seconds.
  goto :fail
)

start "" "http://127.0.0.1:3037"
exit /b 0

:fail
echo.
echo Static preview failed. Review the message above.
pause
exit /b 1
