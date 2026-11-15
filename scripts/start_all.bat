@echo off
REM OCTOLOOP Full stack starter (Windows 11) — run from project root
cd /d "%~dp0.."
echo [OCTOLOOP] Starting backend (terminal 1) and frontend (terminal 2)...
start "OCTOLOOP Backend" cmd /k scripts\start_backend.bat
timeout /t 3 /nobreak >nul
start "OCTOLOOP Frontend" cmd /k scripts\start_frontend.bat
echo [OCTOLOOP] Backend: http://localhost:8000/docs   Frontend: http://localhost:3000
echo [OCTOLOOP] Demo login: admin / Admin@12345
pause
