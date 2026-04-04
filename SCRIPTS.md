# VideoGrab - Scripts Overview

This document provides an overview of all the startup scripts created for the VideoGrab project.

## 📜 Available Scripts

### 1. `install.sh` - Install Dependencies Only
**Purpose:** Install all required dependencies without starting servers.

**What it does:**
- ✅ Checks Node.js installation
- ✅ Creates `.env` configuration files
- ✅ Installs backend dependencies (`backend/node_modules`)
- ✅ Installs frontend dependencies (`app/node_modules`)

**When to use:**
- First-time setup before running any servers
- After pulling new code from repository
- When you only want to install/update dependencies

**Usage:**
```bash
./install.sh
```

---

### 2. `start-dev.sh` - Development Mode (Recommended)
**Purpose:** Quick start for development with hot reload support.

**What it does:**
- ✅ Installs dependencies if missing
- ✅ Creates `.env` files if needed
- ✅ Starts backend API server on port 3001
- ✅ Starts frontend dev server on port 5173 (or next available)
- ✅ Supports hot module replacement (HMR)
- ✅ Automatic cleanup on Ctrl+C

**When to use:**
- Daily development work
- When you need fast iteration with hot reload
- Testing features during development

**Usage:**
```bash
./start-dev.sh
```

**Access:**
- Frontend: http://localhost:5173 (or 5174, 5175, etc.)
- Backend API: http://localhost:3001

---

### 3. `start-prod.sh` - Production Mode
**Purpose:** Start the application in production mode with combined frontend + backend.

**What it does:**
- ✅ Builds the frontend application
- ✅ Copies build files to `combined/public`
- ✅ Sets up combined deployment structure
- ✅ Starts single server serving both frontend and API
- ✅ All served from one port

**When to use:**
- Testing production build
- Deploying to a server
- Performance testing
- Final validation before deployment

**Usage:**
```bash
./start-prod.sh
```

**Access:**
- Application: http://localhost:3001

---

### 4. `start.sh` - Full Setup & Start
**Purpose:** Complete setup from scratch including build and deployment preparation.

**What it does:**
- ✅ Validates Node.js version (requires v18+)
- ✅ Creates all `.env` configuration files
- ✅ Installs backend dependencies
- ✅ Installs frontend dependencies
- ✅ Builds the frontend application
- ✅ Sets up combined deployment folder
- ✅ Installs combined dependencies
- ✅ Starts both development servers

**When to use:**
- First-time complete setup
- Clean reinstall of everything
- Setting up on a new machine
- Ensuring everything is freshly built

**Usage:**
```bash
./start.sh
```

**Access:**
- Frontend Dev: http://localhost:5173
- Backend API: http://localhost:3001

---

## 🔧 Environment Configuration

All scripts automatically create these environment files:

### `backend/.env`
```env
PORT=3001
```

### `app/.env`
```env
VITE_API_URL=http://localhost:3001/api
```

You can modify these values to change ports or API endpoints.

---

## 🎯 Quick Reference

| Task | Script to Use |
|------|---------------|
| First time setup | `./install.sh` then `./start-dev.sh` |
| Daily development | `./start-dev.sh` |
| Test production build | `./start-prod.sh` |
| Complete fresh setup | `./start.sh` |
| Just install deps | `./install.sh` |

---

## 🛑 Stopping Servers

All scripts handle cleanup automatically. To stop:
- Press `Ctrl+C` in the terminal
- The script will gracefully shut down all processes

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Clean Reinstall
```bash
rm -rf backend/node_modules backend/package-lock.json
rm -rf app/node_modules app/package-lock.json
rm -rf combined/node_modules combined/package-lock.json
./install.sh
```

### Build Issues
```bash
cd app
npm run build
# Check error messages
```

---

## 📊 What Gets Installed

### Backend Dependencies
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `play-dl` - Video downloading library

### Frontend Dependencies
- `react` & `react-dom` - UI library
- `vite` - Build tool and dev server
- `typescript` - Type safety
- `tailwindcss` - Utility-first CSS
- `shadcn/ui` - UI components
- `lucide-react` - Icons
- And many more UI/utility libraries

---

## 💡 Pro Tips

1. **Use separate terminals:** For better log visibility, consider running backend and frontend in separate terminals manually
2. **Check logs:** Watch terminal output for errors or important messages
3. **Environment variables:** Modify `.env` files before starting if you need custom ports
4. **Production testing:** Always test with `start-prod.sh` before deploying
5. **Keep updated:** Run `./install.sh` periodically to update dependencies

---

## 🔐 Security Notes

- Never commit `.env` files to version control
- Review and restrict CORS settings for production
- Implement rate limiting for production deployments
- Add authentication if exposing publicly
- Monitor disk space for downloaded videos

---

## 📝 Script Permissions

All scripts should be executable. If they're not:
```bash
chmod +x install.sh start-dev.sh start-prod.sh start.sh
```

---

Need more help? Check [QUICKSTART.md](QUICKSTART.md) or [README.md](README.md).
