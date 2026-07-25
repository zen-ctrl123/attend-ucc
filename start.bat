@echo off
echo Starting AttendUCC...

start "Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

timeout /t 2 >nul

start "Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

timeout /t 3 >nul

start chrome http://localhost:5173