#!/bin/bash

# Next-Videos - Quick Start Script (Development Mode)
# This script starts both frontend and backend in development mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# --- Initialization ---
BACKGROUND=false
if [[ "$1" == "--background" ]]; then
    BACKGROUND=true
    mkdir -p logs .pids
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Starting Development Environment    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for .env files
if [ ! -f "backend/.env" ] || [ ! -f "app/.env" ]; then
    print_warning "Environment files missing. Generating defaults..."
    [ ! -f "backend/.env" ] && echo "PORT=3001" > backend/.env
    [ ! -f "app/.env" ] && echo "VITE_API_URL=http://localhost:3001/api" > app/.env
fi

# Get network IP
NETWORK_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [ "$BACKGROUND" = true ]; then
    print_info "Running in BACKGROUND mode"
    print_info "Backend Logs:  logs/dev-backend.log"
    print_info "Frontend Logs: logs/dev-frontend.log"
else
    print_info "Backend API:      http://localhost:3001"
    print_info "Frontend Dashboard: http://localhost:5173"
    if [ -n "$NETWORK_IP" ]; then
        print_info "Network Access:   http://${NETWORK_IP}:5173"
    fi
    echo ""
    print_warning "Press Ctrl+C to stop both servers"
    echo ""
fi

# --- Process Management ---
cleanup() {
    if [ "$BACKGROUND" = false ]; then
        echo ""
        print_info "Shutting down servers..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
        print_status "All servers stopped"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
cd "$SCRIPT_DIR/backend"
if [ "$BACKGROUND" = true ]; then
    nohup npm run dev > "$SCRIPT_DIR/logs/dev-backend.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pids/dev-backend.pid"
    BACKEND_PID=$!
else
    npm run dev &
    BACKEND_PID=$!
fi

# Start frontend
cd "$SCRIPT_DIR/app"
if [ "$BACKGROUND" = true ]; then
    nohup npm run dev > "$SCRIPT_DIR/logs/dev-frontend.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pids/dev-frontend.pid"
    FRONTEND_PID=$!
    
    print_status "Development servers started in background"
    print_info "Use ./start.sh to view logs or stop them"
else
    npm run dev &
    FRONTEND_PID=$!
    # Wait for processes
    wait
fi
