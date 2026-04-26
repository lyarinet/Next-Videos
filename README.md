# 🚀 Next-Videos - The Ultimate Video Downloader

A modern, high-performance full-stack video downloader for 2026. Built with a focus on speed, reliability, and extreme platform support. 

![Next-Videos Dashboard](image.png)

## 🌟 Premium Features

### 📡 1000+ Platforms Support
Powered by an optimized `yt-dlp` backend, Next-Videos can process almost any link on the internet, including **YouTube, Facebook, Instagram, TikTok, LinkedIn, Reddit, Twitch, Vimeo, CNN, Netflix**, and 1000+ more.

### 📊 Real-Time Progress Engine
No more guessing. Using Server-Sent Events (SSE), the download interface provides a **live, frame-sync percentage bar** that tracks data transmission from the source server to our backend in real-time.

### 🔊 Multi-Language Audio Downloads
For supported YouTube videos, the downloader can detect and export multiple dubbed audio tracks such as **English, Hindi, French, Japanese, Korean, Spanish**, and more.

- `Default Audio (Best)` downloads the platform default track.
- `Select Audio Track` downloads the exact chosen language and muxes it into the final file.
- `All Audio Tracks` builds a single **MKV** containing every detected language track with proper language tags for players like VLC.

### 🛡️ Admin Control Panel (`/#/admin`)
Full control without touching a line of code. Securely manage your site's:
- Branding & Logo
- Hero Headlines & Subtitles
- Footer Copyright & Disclaimer
- Default Site Title

### 🧹 Auto-Pilot Maintenance
Keep your server clean automatically. A built-in cleanup cron-job scans and **deletes downloaded media files older than 1 hour**, ensuring your disk space never overflows.

### 🖼️ Smart Thumbnail Proxy
Effortlessly bypasses Instagram's `403 Forbidden` and CORS restrictions using a custom-built image proxy that spoofs browser headers to ensure every video looks perfect in the preview.

---

## 🛠️ Project Structure

```text
.
├── app/          # Frontend (React 19 + Vite + TypeScript + Tailwind)
├── backend/      # Backend API (Express + yt-dlp + Node.js)
├── start.sh      # Unified one-command launch script
└── install.sh    # Quick-start dependency installer
```

---

## 🚦 Quick Start

### 1. Installation
Run the installer to set up both frontend and backend dependencies in one go:
```bash
chmod +x install.sh
./install.sh
```

### 2. Launching the App
Start both the backend and frontend development server simultaneously:
```bash
./start.sh
```
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:3005`

### 3. Admin Access
Configure your site branding by navigating to:
URL: `http://localhost:5173/#/admin`  
Default Password: `admin123`

---

## ⚙️ Technical Specifications

### Frontend
- **Framework:** React 19 (Latest)
- **Styling:** Tailwind CSS + shadcn/ui
- **Type Safety:** TypeScript
- **State:** SSE (Server-Sent Events) for real-time data streaming

### Backend
- **Server:** Node.js + Express
- **Engine:** `yt-dlp` (Universal Scraper)
- **Muxing:** `ffmpeg` for exact audio-track selection and multi-track MKV output
- **Security:** In-memory crypto tokenization for admin sessions
- **Storage:** File-based lightweight persistence (`config.json`)

---

## 🧪 Environmental Setup

### Backend (`backend/.env`)
```env
PORT=3005
ADMIN_PASSWORD=your_secret_password
```

### Frontend (`app/.env`)
```env
VITE_API_URL=/api
```
*(The Vite proxy handles routing to the correctly configured backend port)*

### Cookies for YouTube Dubbed Audio
If you want YouTube videos to expose all available dubbed tracks, place a valid `cookies.txt` file in:

```text
backend/cookies.txt
```

Without cookies, many videos will fall back to default audio only.

---

## 🎧 Audio Track Notes

- Single-language downloads keep only the selected audio track in the final file.
- `All Audio Tracks` always exports as **MKV**, because MP4 is not a good container for many separate dubbed audio streams.
- Older files downloaded before the latest audio-track fixes will not change automatically. Download them again to get corrected language tracks.

---

## 🚀 What's Next?

We're expanding Next-Videos beyond the web! Check out our [Full Roadmap](NEXT.md) for details on upcoming features:
- 📱 **Mobile Apps:** Native Android and iOS support.
- 💻 **Desktop Apps:** Dedicated Windows, Linux, and macOS versions.
- 🔗 **Browser Extensions:** Chrome and Firefox plugins for one-click downloads.

---

## 📜 License & Disclaimer
**MIT License.** Free for personal and commercial use.  
*Disclaimer: This tool is for educational purposes only. Please respect copyright laws and the terms of service of video platforms. Only download videos you have explicit permission to save.*
