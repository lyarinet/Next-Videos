#!/bin/bash

# Next-Videos - Unified Project Manager
# Use this script to start development servers, production servers, or setup auto-start.

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

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# --- Check Dependencies ---
check_deps() {
    print_info "Checking dependencies..."
    local missing=0
    
    if ! command -v node &> /dev/null; then print_error "Node.js is missing"; missing=1; fi
    if ! command -v yt-dlp &> /dev/null; then print_error "yt-dlp is missing"; missing=1; fi
    if ! command -v ffmpeg &> /dev/null; then print_error "ffmpeg is missing"; missing=1; fi
    
    if [ $missing -eq 1 ]; then
        print_warning "Some dependencies are missing. Please run ./install.sh first."
        exit 1
    fi
}

# --- Get System Status ---
get_system_status() {
    local backend_status="${RED}STOPPED${NC}"
    local frontend_status="${RED}STOPPED${NC}"
    local service_status="${RED}INACTIVE${NC}"
    
    # Check ports
    if netstat -tuln 2>/dev/null | grep -q ":3001 "; then
        backend_status="${GREEN}RUNNING${NC} (Port 3001)"
    elif ss -tuln 2>/dev/null | grep -q ":3001 "; then
        backend_status="${GREEN}RUNNING${NC} (Port 3001)"
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":5173 "; then
        frontend_status="${GREEN}RUNNING${NC} (Port 5173)"
    elif ss -tuln 2>/dev/null | grep -q ":5173 "; then
        frontend_status="${GREEN}RUNNING${NC} (Port 5173)"
    fi
    
    # Check systemd service
    if command -v systemctl &> /dev/null; then
        if systemctl is-active next-videos &>/dev/null; then
            service_status="${GREEN}ACTIVE${NC}"
        fi
    fi
    
    local ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}')
    
    echo -e "${BLUE}--- SYSTEM STATUS ---${NC}"
    echo -e "Backend API (3001):  $backend_status"
    echo -e "Frontend Dev (5173): $frontend_status"
    echo -e "Background Service:  $service_status"
    echo -e "Local Network IP:    ${YELLOW}${ip_addr:-N/A}${NC}"
    echo -e "${BLUE}---------------------${NC}"
}

# --- Auto-Start Setup (Systemd) ---
setup_autostart() {
    echo ""
    print_info "Setting up Auto-Start via Systemd..."
    
    if ! command -v systemctl &> /dev/null; then
        print_error "Systemd (systemctl) not found. Auto-start only supports Systemd-based Linux."
        return 1
    fi
    
    local UNIT_FILE="/etc/systemd/system/next-videos.service"
    local CURRENT_USER=$(whoami)
    
    # Ensure production build exists
    if [ ! -d "combined/public" ]; then
        print_info "Building production bundle first..."
        ./start-prod.sh --build-only
    fi
    
    print_info "Generating service file..."
    sed "s|{{USER}}|$CURRENT_USER|g; s|{{PROJECT_DIR}}|$SCRIPT_DIR|g" next-videos.service.template > next-videos.service
    
    print_info "Installing service (requires sudo)..."
    sudo cp next-videos.service $UNIT_FILE
    sudo systemctl daemon-reload
    sudo systemctl enable next-videos.service
    sudo systemctl start next-videos.service
    
    echo ""
    print_status "Auto-start setup complete!"
    print_info "The service is now running in the background."
    print_info "Manage it with:"
    print_info "  - sudo systemctl status next-videos"
    print_info "  - sudo systemctl restart next-videos"
    print_info "  - sudo systemctl stop next-videos"
    echo ""
    
    read -p "Press Enter to return to menu..."
}

# --- Background Process Management ---
stop_background() {
    echo ""
    print_info "Stopping all background processes..."
    
    local found=0
    for pidfile in .pids/*.pid; do
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            print_info "Stopping process $pid ($(basename "$pidfile" .pid))..."
            kill "$pid" 2>/dev/null || true
            rm "$pidfile"
            found=1
        fi
    done
    
    if [ $found -eq 1 ]; then
        print_status "All background processes stopped"
    else
        print_warning "No background processes found"
    fi
    sleep 1
}

view_logs() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Process Log Viewer                  ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "1) View Development Backend Logs"
    echo "2) View Development Frontend Logs"
    echo "3) View Production Logs"
    echo "4) Return to Menu"
    echo ""
    read -p "Select a log file [1-4]: " log_choice
    
    case $log_choice in
        1) tail -n 50 -f logs/dev-backend.log ;;
        2) tail -n 50 -f logs/dev-frontend.log ;;
        3) tail -n 50 -f logs/prod.log ;;
        4) return ;;
        *) print_error "Invalid option"; sleep 1; view_logs ;;
    esac
}

# --- Main Menu ---
show_menu() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Next-Videos Unified Manager         ${NC}"
    echo -e "${BLUE}========================================${NC}"
    get_system_status
    echo ""
    echo -e "${YELLOW}--- Foreground (Busy Terminal) ---${NC}"
    echo "1) Start in Development Mode"
    echo "2) Start in Production Mode"
    echo ""
    echo -e "${YELLOW}--- Background (Free Terminal) ---${NC}"
    echo "3) Start Dev in Background"
    echo "4) Start Prod in Background"
    echo "5) STOP All Background Processes"
    echo "6) View Background Logs"
    echo ""
    echo -e "${YELLOW}--- System ---${NC}"
    echo "7) Setup / Update Auto-Start (Systemd)"
    echo "8) RESTART Auto-Start Service (Systemd)"
    echo "9) Run Installer / Update Dependencies"
    echo "10) Exit"
    echo ""
    read -p "Select an option [1-10]: " choice
    
    case $choice in
        1) ./start-dev.sh ;;
        2) ./start-prod.sh ;;
        3) ./start-dev.sh --background; sleep 2; show_menu ;;
        4) ./start-prod.sh --background; sleep 2; show_menu ;;
        5) stop_background; show_menu ;;
        6) view_logs; show_menu ;;
        7) setup_autostart; show_menu ;;
        8) 
            echo ""
            print_info "Restarting Systemd service..."
            sudo systemctl restart next-videos 2>/dev/null || print_warning "Service not active or failed to restart"
            print_status "Service restart command completed"
            sleep 2
            show_menu
            ;;
        9) ./install.sh; show_menu ;;
        10) exit 0 ;;
        *) print_error "Invalid option"; sleep 1; show_menu ;;
    esac
}

# Check deps before showing menu
check_deps
show_menu
