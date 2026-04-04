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

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Next-Videos Development Server${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Get the directory where this script is located
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

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    cd "$SCRIPT_DIR/backend"
    npm install
    print_status "Backend dependencies installed"
fi

cd "$SCRIPT_DIR/app"
if [ ! -d "app/node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    npm install
    print_status "Frontend dependencies installed"
fi

# Create .env files if they don't exist
cd "$SCRIPT_DIR"
if [ ! -f "backend/.env" ]; then
    echo "PORT=3001" > backend/.env
    print_status "Created backend/.env"
fi

if [ ! -f "app/.env" ]; then
    echo "VITE_API_URL=http://localhost:3001/api" > app/.env
    print_status "Created app/.env"
fi

echo ""

# Get network IP
get_network_ips() {
  local ips=""
  if command -v ipconfig &> /dev/null; then
    ips=$(ipconfig getifaddr en0 2>/dev/null)
    if [ -z "$ips" ]; then
      ips=$(ipconfig getifaddr en1 2>/dev/null)
    fi
  elif command -v hostname &> /dev/null; then
    ips=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  echo "$ips"
}

NETWORK_IP=$(get_network_ips)

print_info "Starting development servers..."
echo ""
print_info "Backend API:"
print_info "  Local:   http://localhost:3001"
if [ -n "$NETWORK_IP" ]; then
  print_info "  Network: http://${NETWORK_IP}:3001"
fi

echo ""
print_info "Frontend Dev Server:"
print_info "  Local:   http://localhost:5173"
if [ -n "$NETWORK_IP" ]; then
  print_info "  Network: http://${NETWORK_IP}:5173"
fi

echo ""
if [ -n "$NETWORK_IP" ]; then
  print_warning "Access from other devices using the Network URLs above"
fi
print_warning "Press Ctrl+C to stop all servers"
echo ""

# Function to cleanup processes
cleanup() {
    echo ""
    print_info "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    print_status "All servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend in background
cd "$SCRIPT_DIR/backend"
npm start &
BACKEND_PID=$!

# Wait for backend to initialize
sleep 2

# Start frontend in background
cd "$SCRIPT_DIR/app"
npm run dev &
FRONTEND_PID=$!

# Wait for processes
wait
