# Next-Videos - Troubleshooting Guide

Common issues and their solutions.

## 🚨 Issues Fixed in Latest Update

### ✅ Fixed: `combined/.env: No such file or directory`
**Problem:** The start-prod.sh script was trying to create .env file before changing to the correct directory.

**Solution:** Added `cd "$SCRIPT_DIR"` before creating the .env file.

---

### ✅ Fixed: `Cannot find module 'express'` in combined folder
**Problem:** The combined directory had node_modules but dependencies were incomplete or corrupted.

**Solution:** 
- Script now checks for node_modules and reinstalls if missing
- Always updates server.js to latest version from backend folder
- Manual fix: Run `npm install` in the combined directory

---

### ✅ Fixed: Wrong static files path in production
**Problem:** Server was looking for static files in `../app/dist` instead of `./public` when running from combined folder.

**Solution:** Updated server.js to check for `public` folder first (for combined mode), then fallback to `../app/dist` (for backend-only mode).

---

## 🔧 Common Issues & Solutions

### 1. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or for port 5173
lsof -ti:5173 | xargs kill -9
```

---

### 2. Dependencies Not Installing

**Error:** npm install fails with permission errors

**Solution:**
```bash
# Fix npm cache permissions
sudo chown -R $(whoami) ~/.npm

# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

### 3. Frontend Build Fails

**Error:** TypeScript or build errors

**Solution:**
```bash
cd app
npm run build
# Check error messages for specific issues

# If TypeScript errors:
npx tsc --noEmit
```

---

### 4. Backend Won't Start

**Error:** Module not found or syntax errors

**Solution:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm start
```

---

### 5. CORS Errors in Browser

**Error:** `Access to fetch at '...' has been blocked by CORS policy`

**Solution:**
- Make sure backend is running on port 3001
- Check that `app/.env` has correct API URL: `VITE_API_URL=http://localhost:3001/api`
- Restart frontend dev server after changing .env

---

### 6. Video Download Fails

**Error:** "Failed to fetch video info" or download errors

**Possible causes:**
- Invalid or unsupported URL
- Video is private or age-restricted
- Network connectivity issues
- play-dl library limitations

**Solution:**
- Verify the URL is correct and publicly accessible
- Check backend logs for detailed error messages
- Try a different video URL
- Some platforms may require authentication

---

### 7. Hot Reload Not Working

**Problem:** Changes to code don't reflect in browser

**Solution:**
- Make sure you're using `start-dev.sh` (not start-prod.sh)
- Check terminal for Vite dev server output
- Clear browser cache (Cmd+Shift+R on Mac)
- Restart dev server

---

### 8. Combined Deployment Not Updating

**Problem:** Changes to backend/server.js don't appear in production mode

**Solution:**
The start-prod.sh script now automatically copies the latest server.js. Just restart:
```bash
./start-prod.sh
```

---

## 🧹 Clean Slate Reset

If nothing else works, do a complete reset:

```bash
# Stop all running servers
pkill -f "node server.js"
pkill -f "vite"

# Remove all node_modules
rm -rf backend/node_modules backend/package-lock.json
rm -rf app/node_modules app/package-lock.json
rm -rf combined/node_modules combined/package-lock.json

# Remove builds
rm -rf app/dist
rm -rf combined/public

# Reinstall everything
./install.sh

# Start fresh
./start-dev.sh
```

---

## 📊 Checking Server Status

### Backend API
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

### Frontend Dev Server
Open browser to: http://localhost:5173 (or next available port)

### Production Server
Open browser to: http://localhost:3001

---

## 🔍 Debugging Tips

### View Backend Logs
Backend logs appear in the terminal where you started the server. Look for:
- `Serving static files from: ...`
- `Next-Videos server running on port 3001`
- Error messages with stack traces

### View Frontend Logs
Check browser console (F12 or Cmd+Option+I):
- Network tab for API calls
- Console tab for JavaScript errors

### Check Environment Variables
```bash
# Backend
cat backend/.env

# Frontend
cat app/.env

# Combined
cat combined/.env
```

### Verify File Structure
```bash
# Should exist:
ls backend/server.js
ls backend/node_modules
ls app/src/App.tsx
ls app/node_modules
ls app/dist/index.html  # After build
ls combined/server.js
ls combined/public/index.html
```

---

## 💡 Pro Tips

1. **Always check logs first** - Most issues are clearly explained in error messages
2. **Use the right script** - Development vs Production have different purposes
3. **Keep terminals open** - Don't close terminal windows running servers
4. **One change at a time** - Makes it easier to identify what caused an issue
5. **Git commit often** - So you can revert if something breaks

---

## 🆘 Still Having Issues?

1. Check the main [README.md](README.md) for detailed documentation
2. Review [QUICKSTART.md](QUICKSTART.md) for setup instructions
3. Read [SCRIPTS.md](SCRIPTS.md) for script-specific information
4. Check Node.js version: `node -v` (should be v18+)
5. Check npm version: `npm -v` (should be 9+)

If the problem persists, try:
- Restarting your computer
- Reinstalling Node.js
- Checking system permissions
- Running scripts with verbose output: `npm install --verbose`

---

## 📝 Reporting Bugs

When reporting issues, include:
1. Which script you're running
2. Full error message (copy-paste, not screenshot)
3. Node.js version: `node -v`
4. npm version: `npm -v`
5. Operating system
6. Steps to reproduce

Example:
```
Script: ./start-prod.sh
Error: Cannot find module 'express'
Node: v20.19.6
npm: 10.2.4
OS: macOS Sonoma 14.0
Steps: Ran ./start-prod.sh, got module error
```

---

Remember: Most issues are related to missing dependencies, port conflicts, or incorrect paths. The scripts handle most of these automatically now! 🎉
