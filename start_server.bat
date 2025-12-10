@echo off
echo ========================================
echo SIFT Image Stitching Tool - Web Server
echo ========================================
echo.

echo Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Starting Flask development server...
echo Open your browser to: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
python src\api.py

pause
