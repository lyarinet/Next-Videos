#!/bin/bash

# Next-Videos - Comprehensive Linux Installation Script
# This script installs system dependencies (yt-dlp, ffmpeg, python3) and project dependencies.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Next-Videos Linux Installer         ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

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

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# --- 1. System Dependency Checks ---
print_info "Checking system dependencies..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi
print_status "Node.js $(node -v) detected"

# Detect Package Manager
PKG_MANAGER=""
if command -v apt-get &> /dev/null; then PKG_MANAGER="apt-get";
elif command -v dnf &> /dev/null; then PKG_MANAGER="dnf";
elif command -v yum &> /dev/null; then PKG_MANAGER="yum"; fi

# Install Python3, FFmpeg, and Curl if missing
install_system_dep() {
    local cmd=$1
    local pkg=$2
    if ! command -v "$cmd" &> /dev/null; then
        print_warning "$cmd not found. Attempting to install $pkg..."
        if [ -n "$PKG_MANAGER" ]; then
            sudo $PKG_MANAGER update -y && sudo $PKG_MANAGER install -y "$pkg"
            print_status "$pkg installed successfully"
        else
            print_error "Package manager not found. Please install $pkg manually."
            exit 1
        fi
    else
        print_status "$cmd already installed"
    fi
}

install_system_dep "python3" "python3"
install_system_dep "ffmpeg" "ffmpeg"
install_system_dep "curl" "curl"

# --- 2. yt-dlp Installation (Direct Binary for Latest Version) ---
if ! command -v yt-dlp &> /dev/null; then
    print_info "Installing yt-dlp..."
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
    print_status "yt-dlp installed to /usr/local/bin/yt-dlp"
else
    # Update yt-dlp to ensure latest features/fixes
    print_info "Updating yt-dlp to latest version..."
    sudo yt-dlp -U || print_warning "Could not auto-update yt-dlp. You may need to update it manually."
    print_status "yt-dlp version: $(yt-dlp --version)"
fi

# --- 3. App Setup ---
print_info "Setting up application..."

# Create .env files if missing
if [ ! -f "backend/.env" ]; then
    echo "PORT=3001" > backend/.env
    echo "ADMIN_PASSWORD=admin123" >> backend/.env
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

# Build combined folder for production
echo ""
print_info "Building production bundle..."
cd "$SCRIPT_DIR"
./start-prod.sh --build-only || print_warning "Initial build failed. You can build later using ./start-prod.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    Installation Complete!              ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Run ./start.sh       - Unified dashboard & auto-start setup"
echo "  • Run ./start-dev.sh   - Start in development mode"
echo "  • Run ./start-prod.sh  - Start in production mode"
echo ""

