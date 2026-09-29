@echo off
cd /d "%~dp0"
title NotesApp
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Starting NotesApp at http://localhost:3456
start "" http://localhost:3456
call npm start
pause
