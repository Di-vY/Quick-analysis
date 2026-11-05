@echo off
echo ========================================================
echo   Launching Quick Analysis (Backend + Frontend)
echo ========================================================

start "Quick Analysis API (FastAPI)" cmd /k "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "Quick Analysis UI (Next.js)" cmd /k "%~dp0run_frontend.bat"

echo.
echo Services launched!
echo - API:      http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)
echo - Frontend: http://localhost:3000
echo.
pause
