@echo off
REM Reset OCTOLOOP demo database (Windows): delete DB, recreate, reseed.
setlocal
cd /d "%~dp0\.."

if exist ".venv\Scripts\activate.bat" call .venv\Scripts\activate.bat

echo Deleting existing database...
if exist "database\octoloop.db" del /f /q "database\octoloop.db"

echo Recreating tables and seeding demo data...
python scripts\init_db.py

echo Reset complete.
endlocal
