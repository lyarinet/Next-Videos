#!/bin/bash

# VideoGrab - Production Start Script
# This script starts the combined deployment (frontend + backend on same server)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  VideoGrab Production Server${NC}"
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

# Setup combined folder if needed
if [ ! -f "combined/server.js" ] || [ ! -d "combined/public" ]; then
    print_info "Setting up combined deployment..."
    
    cd "$SCRIPT_DIR/combined"
    
    # Copy backend files
    cp "$SCRIPT_DIR/backend/server.js" .
    cp "$SCRIPT_DIR/backend/package.json" .
    
    # Build frontend if needed
    if [ ! -d "$SCRIPT_DIR/app/dist" ]; then
        print_info "Building frontend..."
        cd "$SCRIPT_DIR/app"
        npm run build
    fi
    
    # Copy frontend build
    if [ -d "public" ]; then
        rm -rf public
    fi
    cp -r "$SCRIPT_DIR/app/dist" public
    
    # Install dependencies
    print_info "Installing combined dependencies..."
    npm install
    print_status "Combined deployment ready"
else
    print_status "Combined deployment already configured"
    # Always update server.js to latest version
    cp "$SCRIPT_DIR/backend/server.js" "$SCRIPT_DIR/combined/server.js"
    
    # Ensure dependencies are installed
    cd "$SCRIPT_DIR/combined"
    if [ ! -d "node_modules" ]; then
        print_info "Installing combined dependencies..."
        npm install
        print_status "Dependencies installed"
    fi
fi

# Create .env if it doesn't exist
cd "$SCRIPT_DIR"
if [ ! -f "combined/.env" ]; then
    echo "PORT=3001" > combined/.env
    print_status "Created combined/.env"
fi

echo ""
print_info "Starting production server..."
print_info "Application will be available at: http://localhost:3001"
echo ""
print_warning "Press Ctrl+C to stop the server"
echo ""

# Start the combined server
cd "$SCRIPT_DIR/combined"
npm start
