#!/bin/bash
# Production startup script for Railway deployment
# Force production mode with explicit server start

echo "=== Starting production server ==="
echo "Node environment: $NODE_ENV"
echo "Build directory exists: $(ls -la build/ | wc -l) files"

# Ensure build directory exists
if [ ! -d "build" ]; then
    echo "ERROR: build directory not found!"
    exit 1
fi

# Start production server
echo "Executing: node server.js"
exec node server.js