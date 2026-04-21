@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo node_modules not found.
  echo Run install-full.bat first.
  pause
  exit /b 1
)

echo Starting localhost server in a new window...
start "NBA Guessing Game Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"
echo Dev server launched. You can close this window.
pause

endlocal
