@echo off
echo ========================================================
echo   Starting Quick Analysis API (FastAPI + DuckDB)
echo ========================================================
cd /d "%~dp0backend"
set PYTHONPATH=.
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
