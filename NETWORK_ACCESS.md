# Network Access Guide

## 🌐 Accessing VideoGrab from Other Devices

All startup scripts now display network URLs automatically!

---

## 📱 What You'll See

When you run any start script, you'll see output like this:

```
================================
  VideoGrab Development Server
================================

[i] Starting development servers...

[i] Backend API:
[i]   Local:   http://localhost:3001
[i]   Network: http://192.168.1.100:3001

[i] Frontend Dev Server:
[i]   Local:   http://localhost:5173
[i]   Network: http://192.168.1.100:5173

[!] Access from other devices using the Network URLs above
[!] Press Ctrl+C to stop all servers
```

---

## 🔍 Understanding the URLs

### **Local** (localhost)
- Only accessible from **this computer**
- Use for development on your machine
- Example: `http://localhost:3001`

### **Network** (IP address)
- Accessible from **any device on your WiFi/network**
- Use for testing on phones, tablets, other computers
- Example: `http://192.168.1.100:3001`

---

## 📲 How to Access from Phone/Tablet

### Step 1: Start the Server
```bash
./start-dev.sh
# or
./start-prod.sh
```

### Step 2: Note the Network URL
Look for the line that says:
```
Network: http://192.168.1.XXX:3001
```

### Step 3: Open on Mobile Device
1. Make sure your phone is on the **same WiFi** as your computer
2. Open browser on phone
3. Type the Network URL exactly as shown
4. The app should load!

---

## 🖥️ Access from Another Computer

Same process:
1. Both computers on same network
2. Use the Network URL shown in terminal
3. Open in browser: `http://YOUR_IP:3001`

---

## 🔧 If Network URL Doesn't Show

### Possible Causes:
1. **No network connection** - Check WiFi/Ethernet
2. **Firewall blocking** - Allow port 3001 and 5173
3. **Different network interfaces** - Script checks en0/en1 (macOS)

### Manual IP Check:

**macOS:**
```bash
ipconfig getifaddr en0
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Linux:**
```bash
hostname -I
# or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```

Then manually construct URL: `http://YOUR_IP:3001`

---

## 🛡️ Firewall Configuration

### macOS:
System Preferences → Security & Privacy → Firewall
- Allow incoming connections for Node.js
- Or temporarily disable firewall for testing

### Linux (UFW):
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 5173/tcp
```

### Windows:
Windows Defender Firewall → Advanced Settings
- Add inbound rules for ports 3001 and 5173

---

## 💡 Tips

### For Best Results:
1. ✅ Use same WiFi network
2. ✅ Check firewall settings
3. ✅ Use the exact URL shown (including port number)
4. ✅ Keep server running while accessing

### Common Issues:
- ❌ Different networks (phone on cellular, computer on WiFi)
- ❌ Firewall blocking ports
- ❌ Typo in URL
- ❌ Server not running

---

## 🎯 Quick Reference

| Script | Local URL | Network URL |
|--------|-----------|-------------|
| `./start-dev.sh` | http://localhost:5173 | http://IP:5173 |
| `./start-prod.sh` | http://localhost:3001 | http://IP:3001 |
| `./start.sh` | Both dev servers | Both with IPs |

---

## 🔒 Security Note

⚠️ **Important:** When exposing to network:
- Only use on trusted networks (home/office WiFi)
- Don't expose to public networks
- Anyone on your network can access the app
- Consider adding authentication for production use

---

## 🚀 Example Usage

**Testing on iPhone:**
```bash
# Terminal shows:
[i] Frontend Dev Server:
[i]   Local:   http://localhost:5173
[i]   Network: http://192.168.1.105:5173

# On iPhone Safari:
# Type: http://192.168.1.105:5173
# App loads! Test mobile responsiveness!
```

**Sharing with colleague:**
```bash
# They're on same office WiFi
# Tell them: "Open http://192.168.1.105:3001"
# They can test the app too!
```

---

## ✨ Summary

The scripts now automatically:
- ✅ Detect your network IP
- ✅ Display both Local and Network URLs
- ✅ Show clear instructions
- ✅ Support macOS and Linux
- ✅ Make mobile testing easy

Just look for the **Network:** URL and use it on other devices! 📱💻
