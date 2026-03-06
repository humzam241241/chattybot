@echo off
title Restart ChattyBot Backend
color 0E
echo.
echo ============================================
echo   Restarting ChattyBot Backend
echo ============================================
echo.

REM Kill all Node processes (this will stop backend and admin)
echo [1/3] Stopping all Node processes...
taskkill /F /IM node.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    echo    ✓ Stopped successfully
) else (
    echo    ℹ No Node processes were running
)
timeout /t 2 /nobreak >nul

REM Check if .env exists
if not exist "backend\.env" (
    echo.
    echo [ERROR] backend\.env not found!
    echo Please create it from backend\.env.example
    pause
    exit /b 1
)

REM Start backend
echo.
echo [2/3] Starting backend on http://localhost:3001...
cd backend
start "ChattyBot Backend :3001" cmd /k "echo. && echo [Backend] Starting... && node src/app.js"
cd ..
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Checking backend health...
timeout /t 2 /nobreak >nul
curl http://localhost:3001/health 2>nul
if %errorlevel% equ 0 (
    echo    ✓ Backend is running!
) else (
    echo    ⚠ Backend may still be starting...
    echo    Check the backend window for errors
)

echo.
echo ============================================
echo   Backend Restarted!
echo ============================================
echo.
echo   API: http://localhost:3001
echo   Health: http://localhost:3001/health
echo.
echo   The backend window will show logs.
echo   Close this window to keep backend running.
echo.
pause
