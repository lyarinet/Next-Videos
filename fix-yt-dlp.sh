#!/bin/bash
# Script to update yt-dlp and restart the backend
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Updating yt-dlp in virtual environment..."
"$SCRIPT_DIR/backend/venv/bin/pip" install -U yt-dlp

echo "Updating system symlink..."
sudo ln -sf "$SCRIPT_DIR/backend/venv/bin/yt-dlp" /usr/local/bin/yt-dlp

echo "Restarting backend..."
# Kill existing node processes running server.js
pkill -f "node server.js" || true

echo "Done! If you are using the 'start.sh' manager, please restart it to see the new status."
