@echo off
REM OCTOLOOP backend starter (Windows). Run from project root.
setlocal
cd /d "%~dp0\.."

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r backend\requirements.txt

echo Initializing database (create tables + seed demo data)...
python scripts\init_db.py

echo Starting OCTOLOOP backend on http://localhost:8000 ...
echo API docs: http://localhost:8000/docs
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

endlocal
