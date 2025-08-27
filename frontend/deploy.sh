#!/bin/bash
# Railway deployment script to ensure proper production build

echo "Starting deployment process..."

# Build the React app
echo "Building React application..."
npm run build

# Verify build directory exists
if [ ! -d "build" ]; then
    echo "Error: Build directory not found!"
    exit 1
fi

echo "Build completed successfully. Starting production server..."
node server.js