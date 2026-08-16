# 🚀 Next-Videos - The Ultimate Multi-Platform Video Downloader & Converter Suite

<div align="center">

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-Universal-red?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Enabled-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge)](https://github.com/lyarinet/Next-Videos)

<p align="center">
  A high-performance full-stack video downloader, media converter, multi-language audio extractor, and mobile-to-desktop handoff suite.
</p>

![Next-Videos Dashboard](image/Next-Videos.png)

</div>

---

## 📑 Table of Contents
- [✨ Key Features](#-key-features)
- [🧩 Google Chrome Browser Extension](#-google-chrome-browser-extension)
- [🪟 Windows Desktop Executable (.exe) Suite](#-windows-desktop-executable-exe-suite)
- [🏗️ System Architecture](#️-system-architecture)
- [📁 Project Structure](#-project-structure)
- [🚦 Quick Start](#-quick-start)
  - [🪟 Windows Desktop Setup](#-windows-desktop-setup)
  - [🐧 Linux & 🍎 macOS Setup](#-linux--macos-setup)
  - [📦 Universal npm Scripts](#-universal-npm-scripts)
- [🌐 Production Deployment & Hosting Guide](#-production-deployment--hosting-guide)
- [🌐 Access Points & Default Credentials](#-access-points--default-credentials)
- [🎛️ Dual-Engine Video Converter](#️-dual-engine-video-converter)
- [📱 Mobile QR Handoff Ecosystem](#-mobile-qr-handoff-ecosystem)
- [🎧 Multi-Language Audio Extraction](#-multi-language-audio-extraction)
- [🛡️ Admin Panel & Cookies Manager](#️-admin-panel--cookies-manager)
- [⚙️ Environment Configuration](#️-environment-configuration)
- [📡 API Endpoints Overview](#-api-endpoints-overview)
- [🧹 Auto-Pilot Disk Hygiene](#-auto-pilot-disk-hygiene)
- [🗺️ Future Roadmap](#️-future-roadmap---whats-next-for-next-videos)
- [📄 License & Disclaimer](#-license--disclaimer)

---

## ✨ Key Features

* **📡 1000+ Platforms Universal Support:** Powered by `yt-dlp` and `ffmpeg` to download from YouTube, Facebook, Instagram, TikTok, X (Twitter), LinkedIn, Reddit, Twitch, Vimeo, Bilibili, Dailymotion, and 1000+ more.
* **📊 Real-Time Progress Engine:** Sub-second frame-sync live percentage progress bar using **Server-Sent Events (SSE)**.
* **🔊 Multi-Language Dubbed Audio Downloads:** Detects multi-language audio tracks on YouTube (English, Spanish, Hindi, French, Japanese, Korean, Arabic, etc.). Download specific tracks or build a single **MKV** containing every detected audio track with correct ISO language metadata tags.
* **🔄 Dual-Engine Video Converter:**
  * **Server-Side FFmpeg Engine:** Encode to Mobile (240p/480p/720p), PlayStation, Xbox, Web HLS (`m3u8`), Web DASH, and Web Optimized FastStart MP4.
  * **Client-Side WebAssembly FFmpeg Engine:** Converts videos locally inside the browser using `@ffmpeg/core` with zero server CPU consumption.
* **📱 Mobile-Desktop QR Handoff:**
  * **Send to Phone:** Scan a generated SVG QR code on your desktop to instantly transfer completed downloads to your smartphone.
  * **Send to Desktop:** Scan a QR on your phone to open a zero-install mobile page, paste any video URL, and stream it straight to your desktop downloader.
* **👤 User Workspace & Custom Presets:** User authentication with `scrypt` password hashing, personal download history, and customizable video encoding presets (bitrate, codecs, CRF/CQ, FPS, aspect ratios).
* **🛡️ Admin Control Panel (`/#/admin`):** Secure dashboard to edit site titles, hero messages, disclaimer, theme options, and upload `cookies.txt` for restricted or member-only videos.
* **🖼️ Smart Thumbnail Proxy:** Bypass Instagram/Facebook CORS and `403 Forbidden` restrictions with server-side proxy headers.
* **🧩 Official Chrome Browser Extension (Manifest V3):** 1-click video downloader popup with active tab auto-URL capture and direct right-click context menu downloading.
* **🪟 Native Windows `.exe` Setup & Standalone Launcher:** Graphical Setup Wizard (`Setup-Next-Videos.exe`) and Dedicated App Launcher (`Next-Videos.exe`) with official brand icon.

---

## 🧩 Google Chrome Browser Extension

Next-Videos comes with an official **Manifest V3 Chrome Browser Extension** located in the [`extension/`](extension/) directory.

### ✨ Extension Capabilities:
* **Automatic Tab URL Detection:** Open any video on YouTube, TikTok, Instagram Reels, Facebook, X (Twitter), or Vimeo, and click the Next-Videos toolbar icon — the video URL is instantly analyzed.
* **Right-Click Context Menu:** Right-click on any video link, web video player, or web page and select **"Download Video with Next-Videos"**.
* **Quality & Audio Track Selector:** Pick 4K, 1080p, 720p, or MP3 Audio directly inside the popup.
* **Live SSE Progress Tracking:** Real-time percentage progress bar synced with the Next-Videos backend.
* **Smart Local/Remote Server Support:** Configurable backend server URL (defaults to `http://localhost:3005`).

### 🚀 How to Install in Chrome (Under 30 Seconds):
1. In Google Chrome, go to `chrome://extensions` (or 3 dots menu $\to$ **Extensions** $\to$ **Manage Extensions**).
2. Toggle **Developer mode** to **ON** in the top-right corner.
3. Click **Load unpacked** (top-left) and select the `Next-Videos-main/extension` folder.
4. Pin the **Next-Videos Downloader** icon to your Chrome toolbar.

---

## 🪟 Windows Desktop Executable (.exe) Suite

Next-Videos includes native compiled Windows executables with embedded brand icons (`image/logo.ico`):

1. **`Setup-Next-Videos.exe` (Windows Graphical Installer Wizard):**
   * Automatically checks for Node.js (and triggers silent winget install if missing).
   * Automatically downloads & extracts the latest **FFmpeg**, **FFprobe**, and **yt-dlp** binaries into `backend/bin/`.
   * Automatically installs all NPM packages and builds the optimized frontend bundle.
   * Creates a **Desktop Shortcut** (`Next-Videos.lnk`) with the official brand icon.
   * Automatically launches Chrome with `chrome://extensions` and an interactive onboarding guide.

2. **`Next-Videos.exe` (Standalone Windows App Launcher):**
   * Launches the backend server silently in the background (no ugly black CMD window).
   * Opens Next-Videos in dedicated standalone app window mode with custom icon and taskbar branding.

3. **`installer/InnoSetup.iss`:**
   * Ready-to-compile Inno Setup script for generating a single distribution setup executable (`Next-Videos-Setup-v1.0.0.exe`).

---

## 🏗️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Frontend (React 19 + Vite)               │
│  - Main Downloader UI    - User Workspace (/#/workspace)│
│  - Admin Panel (/#/admin)- Client-side WASM FFmpeg     │
└──────────────────────────┬─────────────────────────────┘
                           │ REST API & Real-Time SSE
┌──────────────────────────▼─────────────────────────────┐
│             Backend API Server (Node.js / Express)     │
│  - /api/video-info       - /api/download               │
│  - /api/progress/:id     - /api/convert                │
│  - /api/pair/create      - /m/:id Mobile Handoff       │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
┌──────────────▼─────────────┐ ┌───────────▼─────────────┐
│     yt-dlp Engine          │ │      FFmpeg & FFprobe   │
│ - Universal Video Extractor│ │ - Audio Track Muxer     │
│ - Multi-Stream Parser      │ │ - Transcoding Engine    │
└────────────────────────────┘ └─────────────────────────┘
```

---

## 📁 Project Structure

```text
.
├── app/                  # Frontend (React 19 + TypeScript + Vite + Tailwind)
│   ├── src/
│   │   ├── components/   # Converter, WasmConverter, PhoneHandoff, SendToPhone, UI
│   │   ├── App.tsx       # Main Downloader UI
│   │   ├── UserWorkspace.tsx # User Workspace & History
│   │   ├── Admin.tsx     # Admin Control Panel
│   │   └── main.tsx      # Routing & Root Configuration
│   └── vite.config.ts    # Vite Server & Backend Proxy (Port 3005)
├── backend/              # Backend API Server
│   ├── bin/              # Standalone binaries (yt-dlp.exe, ffmpeg.exe, ffprobe.exe)
│   ├── downloads/        # Temporary media output directory
│   ├── server.js         # Express API, SSE Engine & Media Processors
│   ├── config.json       # Dynamic Site Branding Config
│   ├── users.json        # User Accounts & Profiles Store
│   └── cookies.txt       # Optional YouTube Cookies Storage
├── package.json          # Root Multi-Platform Workspace Scripts
├── start.bat             # Windows 1-Click Launcher
├── start.ps1             # Windows PowerShell Launcher
├── install.bat           # Windows 1-Click Installer
├── install.ps1           # Windows PowerShell Installer
├── start.sh              # Linux / macOS Full Launcher
├── start-dev.sh          # Linux / macOS Development Launcher
├── start-prod.sh         # Linux / macOS Production Launcher
└── install.sh            # Linux / macOS Dependency Installer
```

---

## 🚦 Quick Start

### 🪟 Windows Desktop Setup

#### Method 1: Native Windows `.exe` Setup & Launcher (Recommended)
1. Double-click **`Setup-Next-Videos.exe`** (or `Setup-Next-Videos.bat`) to run the graphical dependency installer:
   - Automatically detects and installs Node.js
   - Automatically downloads **FFmpeg**, **FFprobe**, and **yt-dlp** directly into `backend/bin/`
   - Installs all NPM dependencies and builds the production web application
   - Creates a **Desktop Shortcut** with the official brand icon (`logo.ico`)
   - Automatically opens Google Chrome at `chrome://extensions` with an interactive setup guide
2. Double-click **`Next-Videos.exe`** (or your desktop shortcut) to launch the app directly in dedicated window mode!

#### Method 2: Command Line (npm)
```cmd
npm run install:all
npm run dev
```

---

### 🐧 Linux & 🍎 macOS Setup

1. **Make scripts executable and install dependencies:**
   ```bash
   chmod +x install.sh start.sh start-dev.sh start-prod.sh
   ./install.sh
   ```
2. **Start the application:**
   ```bash
   ./start.sh
   # Or for development with hot-reload:
   ./start-dev.sh
   ```

---

### 📦 Universal npm Scripts

From the root folder on **any operating system**:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs backend (Port 3005) and frontend (Port 5173) concurrently |
| `npm run install:all` | Installs dependencies for root, backend, and frontend |
| `npm run build` | Packages the optimized frontend production bundle |
| `npm start` | Launches the backend production server |

---

## 🌐 Production Deployment & Hosting Guide

Because Next-Videos performs real-time video downloading, multi-language audio extraction, and heavy FFmpeg encoding, choosing the right hosting environment is important:

### 🏆 Recommended: Cloud VPS (Hetzner / DigitalOcean / Linode / AWS EC2)
* **Best performance, unlimited processing timeouts, and full disk write access.**
1. Install Node.js (18+), Python, FFmpeg, and yt-dlp:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm ffmpeg python3 python3-pip
   sudo pip3 install yt-dlp
   ```
2. Clone repository & install dependencies:
   ```bash
   git clone https://github.com/lyarinet/Next-Videos.git
   cd Next-Videos
   npm run install:all
   npm run build
   ```
3. Run as background service using **systemd** (template provided in [`next-videos.service`](next-videos.service)):
   ```bash
   sudo cp next-videos.service /etc/systemd/system/
   sudo systemctl enable --now next-videos
   ```

### 🐳 PaaS / Docker Container (Render / Railway / Fly.io)
* Deploy backend using Docker or Node runtime with custom start command `npm start`.

### ⚠️ Note on Serverless Platforms (Netlify / Vercel)
* **Frontend Only:** You can host the frontend (`app/dist`) on Netlify or Vercel for free.
* **Backend Requirement:** Serverless functions have strict execution timeouts (10-25s) and cannot execute long video processing jobs or install persistent FFmpeg. The frontend must point its `VITE_API_URL` to a backend hosted on a VPS or container.

---

## 🌐 Access Points & Default Credentials

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:5173` | React 19 UI with Vite HMR |
| **Backend API** | `http://localhost:3005` | Express REST & SSE server |
| **Admin Control Panel** | `http://localhost:5173/#/admin` | Username: `admin` \| Password: `admin123` |
| **User Workspace** | `http://localhost:5173/#/workspace` | Register or login to save presets |
| **Mobile Pairing Page** | `http://<your-ip>:3005/m/:id` | Lightweight mobile URL submission page |

---

## 🎛️ Dual-Engine Video Converter

Next-Videos gives you two ways to convert videos:

1. **Server-Side FFmpeg Engine (`/api/convert`):**
   * **Mobile Profiles:** Low (240p), Medium (480p), High (720p).
   * **Console Profiles:** PlayStation & Xbox optimized MP4.
   * **Web Streaming:** HLS (`.m3u8` playlists) and MPEG-DASH.
   * **Web Optimized MP4:** FastStart header placement for instant web streaming.
   * **Custom Encoding:** Custom bitrate, FPS, scale, trim start/end timestamps.

2. **In-Browser WebAssembly Converter ([WasmConverter.tsx](app/src/components/WasmConverter.tsx)):**
   * Powered by `@ffmpeg/core` running inside Web Workers.
   * Transcodes downloaded files directly in your browser without utilizing server CPU or bandwidth.

---

## 📱 Mobile QR Handoff Ecosystem

* **Phone $\to$ Desktop:** Open Next-Videos on desktop, click **"Mobile Handoff"**, scan the QR code with your phone. Paste any video link on your phone, and it automatically loads on your desktop screen in real-time.
* **Desktop $\to$ Phone:** Once any video is downloaded, click **"Send to Phone"** to generate an instant QR download link accessible on your local network.

---

## 🎧 Multi-Language Audio Extraction

For videos with multiple dubbed languages (e.g. YouTube multi-track audio):
* **Default Audio:** Downloads the default stream.
* **Select Audio Track:** Downloads the chosen language (e.g., Hindi, Spanish, French) and muxes it with the video.
* **All Audio Tracks:** Downloads every detected language track and packages them into a single **MKV** container with proper ISO language tags (`eng`, `spa`, `hin`, `fra`, etc.) for VLC/mpv.

---

## 🛡️ Admin Panel & Cookies Manager

Access the Admin Panel at `http://localhost:5173/#/admin`:
* **Live Customization:** Update Site Title, Hero Headline, Subtitles, and Footer Disclaimers in real-time.
* **Theme Proposal:** Toggle between Default and Cyber-Glass themes.
* **Cookies Manager:** Upload a `cookies.txt` file directly from the browser to allow `yt-dlp` to download age-restricted, private, or member-only videos.

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```env
PORT=3005
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ENABLE_DEEP_AUDIO_PROBE=false
```

### Frontend (`app/.env`)
```env
VITE_API_URL=/api
```

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/config` | Read site branding configuration |
| `GET` | `/api/video-info?url=` | Scrapes video metadata, formats & audio tracks |
| `POST`| `/api/download` | Initiates video/audio download job |
| `GET` | `/api/progress/:id` | Real-time SSE stream for download progress |
| `GET` | `/api/download/file/:filename` | Serves completed media files |
| `GET` | `/api/thumbnail-proxy?url=` | Proxies external thumbnails to bypass CORS |
| `GET` | `/api/qr?data=` | Generates standalone SVG QR codes |
| `POST`| `/api/pair/create` | Creates mobile-desktop handoff session |
| `GET` | `/api/pair/listen/:id` | Desktop SSE listener for paired mobile inputs |
| `POST`| `/api/pair/submit/:id` | Mobile client pushes URL to desktop |
| `GET` | `/m/:id` | Minimal mobile URL submission page |
| `POST`| `/api/auth/register` | Register new user account |
| `POST`| `/api/auth/login` | Authenticate user and issue token |
| `GET` | `/api/user/workspace` | Retrieve user presets & download history |
| `POST`| `/api/convert` | Starts server-side FFmpeg conversion |

---

## 🧹 Auto-Pilot Disk Hygiene

A built-in background cron runs every **15 minutes** to delete files in `backend/downloads/` that are older than **1 hour**, preventing disk space overflow on active servers.

---

## 🗺️ Future Roadmap - What's Next for Next-Videos

We are constantly evolving to provide the fastest, cleanest, and most versatile video downloader ecosystem. Below is our updated roadmap and progress milestones:

| Category | Feature / Milestone | Target Platform | Status |
| :--- | :--- | :--- | :--- |
| **Desktop Application** | Native Windows App (`Next-Videos.exe`) & Setup Suite | Windows 10 / 11 | ✅ **Ready & Released (v1.0)** |
| **Browser Extension** | Official Chrome Extension (Manifest V3) | Google Chrome, Edge, Brave | ✅ **Ready & Released (v1.0)** |
| **UI & Theming** | Sober Studio Minimal Luxury & Multi-Theme Engine | Web, Desktop, Extension | ✅ **Ready & Released (v1.0)** |
| **Browser Extension** | Firefox Add-on & Safari Web Extension | Mozilla Firefox, Apple Safari | 🔄 In Development |
| **Desktop Suite** | macOS Universal (`.dmg`) & Linux (`.AppImage`, `.deb`) | macOS (Apple Silicon / Intel), Linux | 🚧 In Progress |
| **Core Features** | Full Playlist & Multi-URL Batch Downloader (`.zip`) | Universal Web / Backend | 🚧 In Progress |
| **Mobile Apps** | Native Android APK with Background Downloader | Android 10+ | 🚧 Planned (Q3 2026) |
| **Mobile Apps** | iOS Companion App & Shortcuts Integration | iOS 16+ | 📋 Roadmap |
| **AI Enhancements** | AI Subtitle Generation (`.srt`/`.vtt`) via Whisper | Universal Engine | 📋 Roadmap |
| **Cloud Sync** | Direct Cloud Upload (Google Drive, Dropbox, OneDrive) | Universal Web | 📋 Roadmap |
| **Bots & API** | Telegram & Discord Video Downloader Bots | Telegram, Discord | 📋 Roadmap |

---

### 🌟 Detailed Phase Breakdown

#### 1. 💻 Standalone Desktop Applications
- [x] **Windows Native Desktop App (`Next-Videos.exe`):** Dedicated window mode app launcher with custom logo taskbar icon & zero-console background execution.
- [x] **Windows Setup Wizard (`Setup-Next-Videos.exe`):** 1-Click graphical installer auto-downloading FFmpeg, yt-dlp, Node runtime & creating desktop shortcuts.
- [ ] **macOS Package (`.dmg`):** Universal Apple Silicon (M1/M2/M3/M4) and Intel binary with native dark mode support.
- [ ] **Linux Suite (`.deb`, `.rpm`, `.AppImage`):** Open-source packaging with CLI and GUI modes.
- [ ] **Hardware Acceleration:** GPU-accelerated transcoding (NVIDIA NVENC / Intel QuickSync / AMD AMF).

#### 2. 🔗 Browser Extensions Ecosystem
- [x] **Chrome / Edge Extension (v1.0):** Auto-detect active video tab, format/quality selector, SSE live download tracker, and context menu downloader.
- [ ] **Firefox Add-on:** Ported Manifest V3 with privacy-focused permissions.
- [ ] **Safari Extension:** macOS and iOS Safari Web Extension companion.
- [ ] **One-Click Page Overlays:** Embed sleek floating download buttons directly inside YouTube, TikTok, and Instagram player interfaces.
- [ ] **macOS Package (`.dmg`):** Universal Apple Silicon (M1/M2/M3/M4) and Intel binary with native dark mode support.
- [ ] **Linux Suite (`.deb`, `.rpm`, `.AppImage`):** Open-source packaging with CLI and GUI modes.
- [ ] **Hardware Acceleration:** GPU-accelerated transcoding (NVIDIA NVENC / Intel QuickSync / AMD AMF).

#### 3. 📱 Native Mobile Applications
- [ ] **Android Native App (`.apk`):** Native Android downloader powered by Kotlin/React Native with background worker downloads, local media vault, and picture-in-picture player.
- [ ] **iOS Companion:** Native share-sheet integration for instant video grabbing directly from iOS photos and social apps.

#### 4. 🚀 Upcoming Advanced Core Features
- [ ] **Batch & Playlist Downloader:** Download complete YouTube playlists, channel uploads, and Instagram carousels in 1-click as structured `.zip` archives.
- [ ] **AI-Powered Whisper Transcriber:** Automatically generate multi-language subtitle tracks (`.srt`, `.vtt`) and burn them into video streams.
- [ ] **Cloud Drive Direct Handoff:** Stream converted videos directly into your Google Drive, Dropbox, or OneDrive storage without filling local server disk.
- [ ] **Telegram Bot Downloader:** Send video links to a private Telegram bot and receive high-res video files instantly on your phone.

> [!TIP]
> Have an idea or specific feature request? Open an issue on [GitHub Issues](https://github.com/lyarinet/Next-Videos/issues) or reach out via our Contact page!

---

## 📄 License & Disclaimer

This project is licensed under the ISC License.

> **Disclaimer:** Next-Videos is intended for personal and educational use. Please respect copyright laws and the terms of service of each respective content platform. Do not download copyrighted media without appropriate authorization.
