#!/bin/bash

# VideoGrab - Project Setup and Start Script
# This script installs dependencies and starts both frontend and backend

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  VideoGrab Setup & Start Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to print status messages
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Check if Node.js is installed
print_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js (v18 or higher) first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
print_status "Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi
print_status "npm $(npm -v) detected"
echo ""

# Create .env files if they don't exist
print_info "Setting up environment configuration..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    print_info "Creating backend/.env file..."
    cat > backend/.env << EOF
PORT=3001
EOF
    print_status "Backend .env created"
else
    print_status "Backend .env already exists"
fi

# Frontend .env
if [ ! -f "app/.env" ]; then
    print_info "Creating app/.env file..."
    cat > app/.env << EOF
VITE_API_URL=http://localhost:3001/api
EOF
    print_status "Frontend .env created"
else
    print_status "Frontend .env already exists"
fi
echo ""

# Install backend dependencies
print_info "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
if [ -d "node_modules" ]; then
    print_warning "Backend node_modules exists. Reinstalling..."
    rm -rf node_modules package-lock.json
fi
npm install
print_status "Backend dependencies installed"
echo ""

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd "$SCRIPT_DIR/app"
if [ -d "node_modules" ]; then
    print_warning "Frontend node_modules exists. Reinstalling..."
    rm -rf node_modules package-lock.json
fi
npm install
print_status "Frontend dependencies installed"
echo ""

# Build frontend
print_info "Building frontend application..."
cd "$SCRIPT_DIR/app"
npm run build
print_status "Frontend build completed"
echo ""

# Create combined deployment folder
print_info "Setting up combined deployment folder..."
cd "$SCRIPT_DIR/combined"

# Copy backend files
cp "$SCRIPT_DIR/backend/server.js" .
cp "$SCRIPT_DIR/backend/package.json" .

# Copy frontend build
if [ -d "public" ]; then
    rm -rf public
fi
cp -r "$SCRIPT_DIR/app/dist" public

# Install combined dependencies
if [ -d "node_modules" ]; then
    rm -rf node_modules package-lock.json
fi
npm install
print_status "Combined deployment folder ready"
echo ""

# Start servers
print_info "Starting servers..."
echo ""
print_info "Backend will run on: http://localhost:3001"
print_info "Frontend dev server will run on: http://localhost:5173"
print_info "Combined server will be available at: http://localhost:3001"
echo ""
print_warning "Press Ctrl+C to stop all servers"
echo ""

# Start both servers using npm concurrently or manually
cd "$SCRIPT_DIR"

# Check if 'concurrently' is available, otherwise start separately
if command -v concurrently &> /dev/null; then
    concurrently \
        "cd backend && npm start" \
        "cd app && npm run dev"
else
    # Start backend in background
    cd "$SCRIPT_DIR/backend"
    npm start &
    BACKEND_PID=$!
    
    # Wait a moment for backend to start
    sleep 2
    
    # Start frontend
    cd "$SCRIPT_DIR/app"
    npm run dev &
    FRONTEND_PID=$!
    
    # Handle cleanup on exit
    cleanup() {
        print_info "Shutting down servers..."
        kill $BACKEND_PID 2>/dev/null
        kill $FRONTEND_PID 2>/dev/null
        wait $BACKEND_PID 2>/dev/null
        wait $FRONTEND_PID 2>/dev/null
        print_status "All servers stopped"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Wait for processes
    wait
fi
