#!/bin/bash
set -e

echo "🚀 Deploying backend updates..."

# Stop the backend service  
echo "Stopping backend service..."
pm2 stop setukreview-backend

# Backup current files
echo "Creating backup..."
cp /home/ubuntu/setukreview/backend/src/routes/report.js /home/ubuntu/setukreview/backend/src/routes/report.js.backup || true
cp /home/ubuntu/setukreview/backend/src/services/ReportGenerator.js /home/ubuntu/setukreview/backend/src/services/ReportGenerator.js.backup || true

# Update source files
echo "Updating source files..."
cp /home/ubuntu/backend/src/routes/report.ts /home/ubuntu/setukreview/backend/src/routes/
cp /home/ubuntu/backend/src/services/ReportGenerator.ts /home/ubuntu/setukreview/backend/src/services/
cp /home/ubuntu/backend/package.json /home/ubuntu/setukreview/backend/

# Install new dependencies
echo "Installing dependencies..."
cd /home/ubuntu/setukreview/backend
npm install

# Rebuild
echo "Building backend..."
npm run build

# Restart service
echo "Restarting backend service..."
pm2 start setukreview-backend

echo "✅ Backend update completed!"
