@echo off
title PANDAVAS SQARD - BUS BOOKING MANAGEMENT SYSTEM
echo ==========================================================
echo   STARTING PANDAVAS SQARD BUS BOOKING SYSTEM
echo ==========================================================
echo.
cd /d "%~dp0"

echo [1/2] Initializing database and verifying credentials...
python init_db.py

echo.
echo [2/2] Launching Flask server on http://localhost:5000...
echo Default Credentials:
echo   OWNER  : owner / OwnerPassword123!
echo   DRIVER : driver_kumar / DriverPassword123!
echo.
python app.py
pause
