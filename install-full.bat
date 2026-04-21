@echo off
setlocal
cd /d "%~dp0"

echo Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo Refreshing player data...
call npm run refresh:data
if errorlevel 1 goto :fail

echo Running validation...
call npm run lint
if errorlevel 1 goto :fail

call npm run test
if errorlevel 1 goto :fail

call npm run build
if errorlevel 1 goto :fail

echo.
echo Full installation and validation completed.
echo Starting localhost server in a new window...
start "NBA Guessing Game Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"
goto :success

:fail
echo.
echo Command failed. Check the output above.
pause
exit /b 1

:success
echo You can close this window. The dev server is running in the new window.
pause
endlocal
