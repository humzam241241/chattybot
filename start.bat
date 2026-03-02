@echo off
title ChattyBot Dev Environment
color 0A
echo.
echo  ============================================
echo    ChattyBot - Starting Dev Environment
echo  ============================================
echo.

REM Check Node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Check backend .env exists
if not exist "backend\.env" (
    echo [ERROR] backend\.env not found.
    echo Copy backend\.env.example to backend\.env and fill in your values.
    pause
    exit /b 1
)

REM Check admin .env exists
if not exist "admin\.env" (
    echo [ERROR] admin\.env not found.
    echo Copy admin\.env.example to admin\.env and fill in your values.
    pause
    exit /b 1
)

REM Install backend dependencies if needed
if not exist "backend\node_modules" (
    echo [1/3] Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

REM Install admin dependencies if needed
if not exist "admin\node_modules" (
    echo [2/3] Installing admin dependencies...
    cd admin
    npm install
    cd ..
)

echo.
echo  Starting services in separate windows...
echo.

REM Start backend in a new window
start "ChattyBot Backend :3001" cmd /k "cd /d %~dp0backend && echo Backend starting on http://localhost:3001 && npm run dev"

REM Wait 2 seconds then start admin
timeout /t 2 /nobreak >nul

REM Start admin dashboard in a new window  
start "ChattyBot Admin :3000" cmd /k "cd /d %~dp0admin && echo Admin dashboard starting on http://localhost:3000 && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo  ============================================
echo    All services started!
echo  ============================================
echo.
echo    Backend API  ->  http://localhost:3001
echo    Admin Panel  ->  http://localhost:3000
echo    Health Check ->  http://localhost:3001/health
echo.
echo    Close the individual windows to stop each service.
echo.
pause
