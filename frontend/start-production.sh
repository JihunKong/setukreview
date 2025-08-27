#!/bin/bash

echo "=== PRODUCTION STARTUP SCRIPT ==="
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Ensure build directory exists
if [ ! -d "build" ]; then
    echo "ERROR: Build directory not found!"
    echo "Running build process..."
    npm run build
fi

# Verify server.js exists
if [ ! -f "server.js" ]; then
    echo "ERROR: server.js not found!"
    exit 1
fi

echo "Starting production Express server..."
echo "Serving from: $(pwd)/build"
echo "Server file: $(pwd)/server.js"

# Start the production server
exec node server.js