@echo off
REM ChattyBot Analytics - Quick Start Script (Windows)
REM This script helps you get the analytics system running quickly

echo.
echo  ChattyBot Analytics Setup
echo ==============================
echo.

REM Check if we're in the right directory
if not exist "backend" (
    echo Error: backend directory not found
    echo Run this script from the chattybot root directory
    exit /b 1
)

if not exist "admin-dashboard" (
    echo Error: admin-dashboard directory not found
    echo Run this script from the chattybot root directory
    exit /b 1
)

echo  Step 1: Install Dependencies
echo --------------------------------
echo.

REM Backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
cd ..

REM Dashboard dependencies
echo Installing dashboard dependencies...
cd admin-dashboard
call npm install
cd ..

echo.
echo  Dependencies installed
echo.

echo  Step 2: Database Setup
echo -------------------------
echo.

REM Check if .env exists
if not exist "backend\.env" (
    echo  No .env file found. Copying .env.example...
    copy "backend\.env.example" "backend\.env"
    echo  Please edit backend\.env with your actual credentials
    pause
    exit /b 1
)

echo Creating database indexes...
cd backend
call node scripts\createIndexes.js
cd ..

echo  Database indexes created
echo.

echo  Step 3: Environment Configuration
echo ------------------------------------
echo.

if not exist "admin-dashboard\.env" (
    echo  No dashboard .env file found. Copying .env.example...
    copy "admin-dashboard\.env.example" "admin-dashboard\.env"
    echo  Please edit admin-dashboard\.env with your backend URL
)

echo.
echo  Setup Complete!
echo.
echo  Next Steps:
echo.
echo 1. Start the backend:
echo    cd backend ^&^& npm start
echo.
echo 2. Start the dashboard:
echo    cd admin-dashboard ^&^& npm start
echo.
echo 3. Set up workers (Windows Task Scheduler):
echo    - Task 1: Run every 5 minutes
echo      Program: node
echo      Arguments: "%CD%\backend\workers\summarizeWorker.js"
echo.
echo    - Task 2: Run every 10 minutes
echo      Program: node
echo      Arguments: "%CD%\backend\workers\leadExtractor.js"
echo.
echo 4. Access dashboard at http://localhost:3000
echo.
echo  Documentation:
echo    - ANALYTICS_SETUP.md       - Deployment guide
echo    - ANALYTICS_IMPLEMENTATION.md - Technical overview
echo    - DEPLOYMENT_CHECKLIST.md  - Pre-launch checklist
echo.
pause
