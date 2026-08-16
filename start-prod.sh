#!/bin/bash

# Next-Videos - Production Start Script
# This script starts the combined deployment (frontend + backend on same server)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BUILD_ONLY=false
if [[ "$1" == "--build-only" ]]; then
    BUILD_ONLY=true
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# --- Setup Combined Folder ---
setup_combined() {
    print_info "Setting up combined deployment..."
    
    # Ensure backend is ready
    if [ ! -f "backend/server.js" ]; then
        print_error "Backend server.js not found"
        exit 1
    fi
    
    # Build frontend
    print_info "Building frontend..."
    cd "$SCRIPT_DIR/app"
    npm run build
    
    # Setup combined directory
    cd "$SCRIPT_DIR/combined"
    
    # Copy backend runtime files on every production sync
    cp "$SCRIPT_DIR/backend/server.js" .
    cp "$SCRIPT_DIR/backend/package.json" .
    if [ -f "$SCRIPT_DIR/backend/package-lock.json" ]; then
        cp "$SCRIPT_DIR/backend/package-lock.json" .
    fi
    if [ -f "$SCRIPT_DIR/backend/users.json" ]; then
        cp "$SCRIPT_DIR/backend/users.json" .
    elif [ ! -f "users.json" ]; then
        printf '{\n  "users": []\n}\n' > users.json
    fi
    
    # Copy frontend build
    if [ -d "public" ]; then rm -rf public; fi
    cp -r "$SCRIPT_DIR/app/dist" public

    # Create downloads directory early
    mkdir -p downloads
    
    # Install dependencies
    print_info "Installing combined dependencies..."
    npm install
    
    # Create .env if missing
    if [ ! -f ".env" ]; then
        echo "PORT=3001" > .env
    fi
    
    print_status "Combined deployment ready"
}

# Always sync combined deployment so backend/frontend changes are picked up
setup_combined

# Ensure downloads directory exists in combined folder to avoid cron errors
mkdir -p "$SCRIPT_DIR/combined/downloads"

if [ "$BUILD_ONLY" = true ]; then
    print_status "Build complete (--build-only)"
    exit 0
fi

# --- Start Server ---
cd "$SCRIPT_DIR/combined"

# Get network IP
NETWORK_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [ "$1" == "--background" ]; then
    mkdir -p "$SCRIPT_DIR/logs" "$SCRIPT_DIR/.pids"
    print_info "Starting Production Server in BACKGROUND mode..."
    nohup npm start > "$SCRIPT_DIR/logs/prod.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pids/prod.pid"
    print_status "Production server started in background"
    print_info "Logs: logs/prod.log"
    exit 0
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Starting Production Server          ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
print_info "Local:   http://localhost:3001"
if [ -n "$NETWORK_IP" ]; then
    print_info "Network: http://${NETWORK_IP}:3001"
fi
echo ""
print_warning "Press Ctrl+C to stop the server"
echo ""

npm start
