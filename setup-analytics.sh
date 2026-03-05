#!/bin/bash

# ChattyBot Analytics - Quick Start Script
# This script helps you get the analytics system running quickly

echo "🚀 ChattyBot Analytics Setup"
echo "=============================="

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "admin-dashboard" ]; then
  echo "❌ Error: Run this script from the chattybot root directory"
  exit 1
fi

echo ""
echo "📦 Step 1: Install Dependencies"
echo "--------------------------------"

# Backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# Dashboard dependencies
echo "Installing dashboard dependencies..."
cd admin-dashboard
npm install
cd ..

echo "✅ Dependencies installed"

echo ""
echo "🗄️  Step 2: Database Setup"
echo "-------------------------"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
  echo "⚠️  No .env file found. Copying .env.example..."
  cp backend/.env.example backend/.env
  echo "⚠️  Please edit backend/.env with your actual credentials"
  exit 1
fi

echo "Creating database indexes..."
cd backend
node scripts/createIndexes.js
cd ..

echo "✅ Database indexes created"

echo ""
echo "🔧 Step 3: Environment Configuration"
echo "------------------------------------"

if [ ! -f "admin-dashboard/.env" ]; then
  echo "⚠️  No dashboard .env file found. Copying .env.example..."
  cp admin-dashboard/.env.example admin-dashboard/.env
  echo "⚠️  Please edit admin-dashboard/.env with your backend URL"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Start the backend:"
echo "   cd backend && npm start"
echo ""
echo "2. Start the dashboard:"
echo "   cd admin-dashboard && npm start"
echo ""
echo "3. Set up workers (choose one):"
echo ""
echo "   Option A - Cron jobs:"
echo "   */5 * * * * cd $(pwd)/backend && node workers/summarizeWorker.js"
echo "   */10 * * * * cd $(pwd)/backend && node workers/leadExtractor.js"
echo ""
echo "   Option B - PM2:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "4. Access dashboard at http://localhost:3000"
echo ""
echo "📚 Documentation:"
echo "   - ANALYTICS_SETUP.md       - Deployment guide"
echo "   - ANALYTICS_IMPLEMENTATION.md - Technical overview"
echo ""
