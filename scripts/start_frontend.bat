@echo off
REM OCTOLOOP Frontend starter (Windows 11) — run from project root
cd /d "%~dp0.."
if not exist frontend\node_modules (
  echo [OCTOLOOP] Installing frontend dependencies...
  cd frontend && call npm install && cd ..
)
echo [OCTOLOOP] Starting Next.js frontend on http://localhost:3000
cd frontend && call npm run dev
pause
