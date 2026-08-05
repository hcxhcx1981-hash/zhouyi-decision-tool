@echo off
setlocal

if "%~1"=="" (
  echo ERROR: Missing test URL.
  echo Usage: prepare-test-release.bat https://example-test-domain
  goto :fail
)

set "TEST_SITE_URL=%~1"
if /I not "%TEST_SITE_URL:~0,8%"=="https://" (
  echo ERROR: The test URL must start with https://
  goto :fail
)

cd /d "D:\zhouyi-decision-tool" || goto :fail

for /f "delims=" %%G in ('git status --porcelain') do (
  echo ERROR: Git working tree is not clean.
  goto :fail
)

set "NEXT_PUBLIC_SITE_URL=%TEST_SITE_URL%"

echo Running npm run typecheck...
call npm run typecheck
if errorlevel 1 (
  set "FAILED_COMMAND=npm run typecheck"
  goto :command_failed
)

echo Running npm test...
call npm test
if errorlevel 1 (
  set "FAILED_COMMAND=npm test"
  goto :command_failed
)

echo Running npm run lint...
call npm run lint
if errorlevel 1 (
  set "FAILED_COMMAND=npm run lint"
  goto :command_failed
)

echo Running npm run build...
call npm run build
if errorlevel 1 (
  set "FAILED_COMMAND=npm run build"
  goto :command_failed
)

echo Running npm run release:audit...
call npm run release:audit
if errorlevel 1 (
  set "FAILED_COMMAND=npm run release:audit"
  goto :command_failed
)

for /f %%G in ('git rev-parse HEAD') do set "CURRENT_COMMIT=%%G"
echo.
echo Release output: D:\zhouyi-decision-tool\out
echo Commit: %CURRENT_COMMIT%
echo NOT DEPLOYED. The release package is prepared for manual test-environment upload only.
exit /b 0

:command_failed
echo.
echo ERROR: Command failed: %FAILED_COMMAND%

:fail
echo Release preparation stopped. Nothing was deployed.
pause
exit /b 1
