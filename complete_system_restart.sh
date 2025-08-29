#!/bin/bash

# Complete System Restart Script for Node.js + nginx + PM2
# Addresses persistent 400 errors and cache issues

set -e

echo "🚀 Starting complete system restart process..."

# Configuration
BACKEND_PATH="/path/to/your/backend"  # Update this path
LOG_FILE="/tmp/restart_$(date +%Y%m%d_%H%M%S).log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Phase 1: Stop all services
log "🔄 Phase 1: Stopping services..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sudo systemctl stop nginx
sudo systemctl stop redis-server 2>/dev/null || true
sudo pkill -f node 2>/dev/null || true
sudo pkill -f pm2 2>/dev/null || true
sleep 3
log "✅ Phase 1 complete - All services stopped"

# Phase 2: Clear all caches
log "🔄 Phase 2: Clearing caches..."
sudo rm -rf /var/cache/nginx/* 2>/dev/null || true
sudo rm -rf /tmp/nginx/* 2>/dev/null || true
sudo rm -rf /var/lib/nginx/fastcgi/* 2>/dev/null || true
sudo rm -rf /var/lib/nginx/uwsgi/* 2>/dev/null || true
sudo rm -rf /var/lib/nginx/scgi/* 2>/dev/null || true

# Clear system caches
sudo sync
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'

# Clear Redis cache
redis-cli FLUSHALL 2>/dev/null || log "⚠️  Redis not available"

# Clear PM2 caches
rm -rf ~/.pm2/logs/* 2>/dev/null || true

# Clear temp files
sudo rm -rf /tmp/multer-* 2>/dev/null || true
sudo rm -rf /tmp/upload-* 2>/dev/null || true

# Clear nginx logs for fresh monitoring
sudo truncate -s 0 /var/log/nginx/access.log 2>/dev/null || true
sudo truncate -s 0 /var/log/nginx/error.log 2>/dev/null || true

log "✅ Phase 2 complete - All caches cleared"

# Phase 3: Verify configurations
log "🔄 Phase 3: Verifying configurations..."
if sudo nginx -t; then
    log "✅ nginx configuration valid"
else
    log "❌ nginx configuration invalid - CRITICAL ERROR"
    exit 1
fi

log "✅ Phase 3 complete - Configurations verified"

# Phase 4: Start services in correct order
log "🔄 Phase 4: Starting services..."

# Start Redis
sudo systemctl start redis-server 2>/dev/null || log "⚠️  Redis not available"
sleep 2

# Start nginx
sudo systemctl start nginx
sleep 2

if sudo systemctl is-active --quiet nginx; then
    log "✅ nginx started successfully"
else
    log "❌ nginx failed to start - CRITICAL ERROR"
    sudo journalctl -u nginx --no-pager -n 20
    exit 1
fi

# Start Node.js backend with PM2
if [[ -d "$BACKEND_PATH" ]]; then
    cd "$BACKEND_PATH"
    
    # Build if needed
    if [[ -f "package.json" ]] && grep -q "build" package.json; then
        log "🔨 Building application..."
        npm run build || log "⚠️  Build failed, continuing with existing build"
    fi
    
    # Start with PM2
    log "🚀 Starting backend with PM2..."
    pm2 start server.js --name "backend" \
        --max-memory-restart 1G \
        --time \
        --merge-logs \
        --log-date-format="YYYY-MM-DD HH:mm:ss Z" \
        --env production
    
    sleep 5
    
    if pm2 list | grep -q "online"; then
        log "✅ Backend started successfully with PM2"
        pm2 startup
        pm2 save
    else
        log "❌ Backend failed to start - CRITICAL ERROR"
        pm2 logs --lines 50
        exit 1
    fi
else
    log "⚠️  Backend path not found: $BACKEND_PATH"
fi

log "✅ Phase 4 complete - All services started"

# Phase 5: Verification tests
log "🔄 Phase 5: Running verification tests..."

# Test nginx
if curl -f -s -I http://localhost:80 >/dev/null; then
    log "✅ nginx responding"
else
    log "⚠️  nginx not responding on port 80"
fi

# Test backend
if curl -f -s -I http://localhost:8080/api/health >/dev/null; then
    log "✅ Backend API responding"
else
    log "⚠️  Backend API not responding on port 8080"
fi

# Display service status
log "📊 Final service status:"
sudo systemctl status nginx --no-pager -l | head -10 | tee -a "$LOG_FILE"
pm2 status | tee -a "$LOG_FILE"

log "🎉 Complete system restart finished!"
log "📋 Full log available at: $LOG_FILE"

echo ""
echo "Next steps:"
echo "1. Monitor logs: pm2 logs"
echo "2. Test file upload with your frontend"
echo "3. Check nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "4. Review restart log: cat $LOG_FILE"