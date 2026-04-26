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

DEFAULT_BACKEND_PORT=3001
DEFAULT_FRONTEND_PORT=5173
LEGACY_BACKEND_PORT=3005

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

read_env_value() {
    local file="$1"
    local key="$2"
    if [ -f "$file" ]; then
        sed -n "s/^${key}=//p" "$file" | tail -n 1
    fi
}

get_backend_port() {
    local env_port
    env_port=$(read_env_value "$SCRIPT_DIR/backend/.env" "PORT")
    echo "${env_port:-$DEFAULT_BACKEND_PORT}"
}

get_frontend_port() {
    local env_port
    env_port=$(read_env_value "$SCRIPT_DIR/app/.env" "VITE_PORT")
    echo "${env_port:-$DEFAULT_FRONTEND_PORT}"
}

safe_clear() {
    if [ -t 1 ] && [ -n "${TERM:-}" ]; then
        clear
    fi
}

ensure_dev_env_ports() {
    local backend_port="$DEFAULT_BACKEND_PORT"
    local frontend_port="$DEFAULT_FRONTEND_PORT"

    mkdir -p "$SCRIPT_DIR/backend" "$SCRIPT_DIR/app"

    if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
        printf 'PORT=%s\n' "$backend_port" > "$SCRIPT_DIR/backend/.env"
        print_info "Created backend/.env with PORT=$backend_port"
    elif ! grep -q "^PORT=${backend_port}$" "$SCRIPT_DIR/backend/.env"; then
        if grep -q '^PORT=' "$SCRIPT_DIR/backend/.env"; then
            sed -i "s/^PORT=.*/PORT=${backend_port}/" "$SCRIPT_DIR/backend/.env"
        else
            printf '\nPORT=%s\n' "$backend_port" >> "$SCRIPT_DIR/backend/.env"
        fi
        print_info "Updated backend/.env to PORT=$backend_port"
    fi

    if [ ! -f "$SCRIPT_DIR/app/.env" ]; then
        printf 'VITE_API_URL=/api\n' > "$SCRIPT_DIR/app/.env"
        print_info "Created app/.env with VITE_API_URL=/api"
    else
        if grep -q '^VITE_API_URL=' "$SCRIPT_DIR/app/.env"; then
            sed -i "s|^VITE_API_URL=.*|VITE_API_URL=/api|" "$SCRIPT_DIR/app/.env"
        else
            printf '\nVITE_API_URL=/api\n' >> "$SCRIPT_DIR/app/.env"
        fi

        if grep -q '^VITE_PORT=' "$SCRIPT_DIR/app/.env"; then
            sed -i "s/^VITE_PORT=.*/VITE_PORT=${frontend_port}/" "$SCRIPT_DIR/app/.env"
        fi
    fi
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

get_port_pids() {
    local port="$1"
    local pids=""

    if command -v lsof &> /dev/null; then
        pids=$(lsof -ti tcp:"$port" 2>/dev/null | tr '\n' ' ')
    elif command -v fuser &> /dev/null; then
        pids=$(fuser "$port"/tcp 2>/dev/null | tr ' ' '\n' | tr '\n' ' ')
    elif command -v ss &> /dev/null; then
        pids=$(ss -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | tr '\n' ' ')
    fi

    echo "$pids" | xargs -n1 2>/dev/null | sort -u | xargs 2>/dev/null || true
}

kill_port_processes() {
    local port="$1"
    local label="$2"
    local pids
    pids=$(get_port_pids "$port")

    if [ -z "$pids" ]; then
        print_info "No process found on port $port ($label)"
        return 0
    fi

    print_warning "Stopping $label on port $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 2

    local remaining
    remaining=$(get_port_pids "$port")
    if [ -n "$remaining" ]; then
        print_warning "Force killing remaining $label process(es): $remaining"
        kill -9 $remaining 2>/dev/null || true
        sleep 1
    fi
}

restart_dev_ports() {
    local backend_port
    local frontend_port
    backend_port=$(get_backend_port)
    frontend_port=$(get_frontend_port)

    echo ""
    print_info "Cleaning development ports before start..."
    kill_port_processes "$backend_port" "backend"
    if [ "$backend_port" != "$LEGACY_BACKEND_PORT" ]; then
        kill_port_processes "$LEGACY_BACKEND_PORT" "legacy backend"
    fi
    kill_port_processes "$frontend_port" "frontend"
}

restart_prod_port() {
    echo ""
    print_info "Cleaning production port before start..."
    kill_port_processes 3001 "production server"
    if [ "$LEGACY_BACKEND_PORT" != "3001" ]; then
        kill_port_processes "$LEGACY_BACKEND_PORT" "legacy production server"
    fi
}

# --- Get System Status ---
get_system_status() {
    local backend_port
    local frontend_port
    backend_port=$(get_backend_port)
    frontend_port=$(get_frontend_port)

    local backend_status="${RED}STOPPED${NC}"
    local frontend_status="${RED}STOPPED${NC}"
    local service_status="${RED}INACTIVE${NC}"
    
    # Check ports
    if netstat -tuln 2>/dev/null | grep -q ":${backend_port} "; then
        backend_status="${GREEN}RUNNING${NC} (Port ${backend_port})"
    elif ss -tuln 2>/dev/null | grep -q ":${backend_port} "; then
        backend_status="${GREEN}RUNNING${NC} (Port ${backend_port})"
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":${frontend_port} "; then
        frontend_status="${GREEN}RUNNING${NC} (Port ${frontend_port})"
    elif ss -tuln 2>/dev/null | grep -q ":${frontend_port} "; then
        frontend_status="${GREEN}RUNNING${NC} (Port ${frontend_port})"
    fi
    
    # Check systemd service
    if command -v systemctl &> /dev/null; then
        if systemctl is-active next-videos &>/dev/null; then
            service_status="${GREEN}ACTIVE${NC}"
        fi
    fi
    
    local ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}')
    
    echo -e "${BLUE}--- SYSTEM STATUS ---${NC}"
    echo -e "Backend API (${backend_port}):  $backend_status"
    echo -e "Frontend Dev (${frontend_port}): $frontend_status"
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

    kill_port_processes "$(get_backend_port)" "backend/production"
    if [ "$(get_backend_port)" != "$LEGACY_BACKEND_PORT" ]; then
        kill_port_processes "$LEGACY_BACKEND_PORT" "legacy backend/production"
    fi
    kill_port_processes "$(get_frontend_port)" "frontend"
    
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
    safe_clear
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
        1) ensure_dev_env_ports; restart_dev_ports; ./start-dev.sh ;;
        2) restart_prod_port; ./start-prod.sh ;;
        3) ensure_dev_env_ports; restart_dev_ports; ./start-dev.sh --background; sleep 2; show_menu ;;
        4) restart_prod_port; ./start-prod.sh --background; sleep 2; show_menu ;;
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
