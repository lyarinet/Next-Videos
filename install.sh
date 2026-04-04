#!/bin/bash

# Next-Videos - Install Dependencies Only
# Use this script to install dependencies without starting servers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Next-Videos Install Dependencies${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[✗]${NC} Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi
print_status "Node.js $(node -v) detected"

# Create .env files
print_info "Setting up environment files..."
cd "$SCRIPT_DIR"

if [ ! -f "backend/.env" ]; then
    echo "PORT=3001" > backend/.env
    print_status "Created backend/.env"
fi

if [ ! -f "app/.env" ]; then
    echo "VITE_API_URL=http://localhost:3001/api" > app/.env
    print_status "Created app/.env"
fi

# Install backend dependencies
echo ""
print_info "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install
print_status "Backend dependencies installed"

# Install frontend dependencies
echo ""
print_info "Installing frontend dependencies..."
cd "$SCRIPT_DIR/app"
npm install
print_status "Frontend dependencies installed"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Run ./start-dev.sh   - Start development servers"
echo "  • Run ./start-prod.sh  - Start production server"
echo "  • Run ./start.sh       - Full setup and start"
echo ""
