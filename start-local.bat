@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm，请先安装 Node.js。
  pause
  exit /b 1
)

echo 正在启动周易问事决策工具：http://127.0.0.1:3036
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:3036'"
npm run dev:3036

endlocal
