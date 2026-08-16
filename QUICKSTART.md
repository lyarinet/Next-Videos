# Next-Videos - Multi-Platform Quick Start Guide

## 🚀 Getting Started

Next-Videos is 100% multi-platform, supporting **Windows**, **Linux**, and **macOS**.

---

### 🪟 Windows (Batch & PowerShell)

#### 1. One-Click Setup & Run (Recommended)
1. Double-click `install.bat` (or run `./install.ps1` in PowerShell).
2. Double-click `start.bat` (or run `./start.ps1` in PowerShell).

#### 2. Cross-Platform npm Commands
```cmd
npm run install:all
npm run dev
```

---

### 🐧 Linux & 🍎 macOS (Bash)

#### 1. Quick Launch
```bash
chmod +x install.sh start.sh
./install.sh
./start.sh
```

#### 2. Development Mode
```bash
./start-dev.sh
```

#### 3. Production Mode
```bash
./start-prod.sh
```

---

## 📋 Prerequisites

- **Node.js** version 18 or higher
- **npm** (comes with Node.js)

Check your versions:
```bash
node -v   # Should be v18 or higher
npm -v    # Should be 9 or higher
```

If you need to install Node.js, download it from: https://nodejs.org/

---

## 🔧 Manual Installation (Alternative)

If you prefer to set up manually:

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend (in a separate terminal)
```bash
cd app
npm install
npm run dev
```

---

## 🌐 Access Points

| Mode | URL | Description |
|------|-----|-------------|
| Development - Backend | http://localhost:3005 | API server |
| Development - Frontend | http://localhost:5173 | React dev server with HMR |
| Production | http://localhost:3005 | Combined server |

---

## 🛑 Stopping the Servers

Press `Ctrl+C` in the terminal to stop all running servers.

---

## 📁 Environment Variables

The scripts automatically create these files:

**backend/.env**
```env
PORT=3001
```

**app/.env**
```env
VITE_API_URL=http://localhost:3001/api
```

You can modify these values if you need different ports or configurations.

---

## 🐛 Troubleshooting

### Port Already in Use
If you get a "port already in use" error:
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Dependencies Issues
If you encounter dependency errors:
```bash
# Clean reinstall
rm -rf backend/node_modules backend/package-lock.json
rm -rf app/node_modules app/package-lock.json
./start.sh
```

### Build Errors
If the frontend build fails:
```bash
cd app
npm run build
# Check error messages for specific issues
```

---

## 📝 API Endpoints

Once the backend is running, you can test these endpoints:

- **Health Check:** http://localhost:3001/api/health
- **Video Info:** http://localhost:3001/api/video-info?url=VIDEO_URL
- **Download:** POST http://localhost:3001/api/download

---

## 💡 Tips

1. **For Development:** Use `start-dev.sh` for faster iteration with hot reload
2. **For Testing Production:** Use `start-prod.sh` to test the final build
3. **First Time:** Use `start.sh` to ensure everything is properly set up
4. **Terminal Tabs:** Keep backend and frontend logs separate by using different terminal tabs/windows

---

## 🎯 Supported Platforms

- YouTube & YouTube Shorts
- Facebook
- X / Twitter
- Instagram
- TikTok
- Vimeo
- Dailymotion
- And many more...

---

## ⚠️ Important Notes

- Downloaded videos are stored in `backend/downloads/`
- Files are not automatically deleted (manage disk space)
- Respect copyright laws and platform terms of service
- Only download videos you have permission to download

---

Need help? Check the main [README.md](README.md) for more detailed documentation.
