# VideoGrab - Real Video Downloader

A full-stack video downloader application with real video metadata fetching and download capabilities.

## Features

- ✅ Real video metadata fetching (title, thumbnail, duration, channel, views)
- ✅ Support for YouTube, Facebook, X/Twitter, Instagram, TikTok, Vimeo, Dailymotion
- ✅ Multiple quality options (1080p, 720p, 480p, 360p, Audio Only)
- ✅ Real-time video preview with thumbnail
- ✅ Progress tracking during download
- ✅ Modern dark UI with gradient accents

## Project Structure

```
/mnt/okcomputer/output/
├── app/                    # Frontend (React + Vite + TypeScript)
│   ├── src/
│   ├── dist/              # Built frontend files
│   └── ...
├── backend/               # Backend (Express + Node.js)
│   ├── server.js          # Main server file
│   ├── package.json
│   └── ...
└── combined/              # Combined deployment folder
    ├── public/            # Frontend files
    ├── server.js          # Backend server
    └── ...
```

## Quick Start

### 1. Start the Backend Server

```bash
cd /mnt/okcomputer/output/backend
npm install
npm start
```

The backend will run on `http://localhost:3001`

### 2. Start the Frontend (Development)

```bash
cd /mnt/okcomputer/output/app
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Or Serve Both Together

```bash
cd /mnt/okcomputer/output/combined
npm install
npm start
```

This serves both frontend and backend on `http://localhost:3001`

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/video-info?url=VIDEO_URL
Fetch video metadata.

**Parameters:**
- `url` (required): The video URL to analyze

**Response:**
```json
{
  "title": "Video Title",
  "description": "Video description...",
  "thumbnail": "https://...",
  "duration": "12:34",
  "durationSeconds": 754,
  "channel": "Channel Name",
  "views": "1.2M views",
  "platform": "YouTube",
  "url": "https://...",
  "formats": [
    { "quality": "1080p HD", "format": "MP4", "size": "~120 MB" },
    { "quality": "720p HD", "format": "MP4", "size": "~65 MB" },
    ...
  ]
}
```

### POST /api/download
Download a video.

**Body:**
```json
{
  "url": "https://...",
  "quality": "720p HD",
  "format": "MP4"
}
```

**Response:**
```json
{
  "success": true,
  "filename": "Video_Title_1234567890.mp4",
  "downloadUrl": "/api/download/file/Video_Title_1234567890.mp4"
}
```

## Supported Platforms

| Platform | Support Status |
|----------|---------------|
| YouTube | ✅ Full Support |
| YouTube Shorts | ✅ Full Support |
| Facebook | ✅ Full Support |
| X / Twitter | ✅ Full Support |
| Instagram | ✅ Full Support |
| TikTok | ✅ Full Support |
| Vimeo | ✅ Full Support |
| Dailymotion | ✅ Full Support |

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- Lucide icons

### Backend
- Node.js
- Express
- play-dl (for video downloading)
- CORS enabled

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
```

For the frontend, create a `.env` file in the app directory:

```env
VITE_API_URL=http://localhost:3001/api
```

## Troubleshooting

### Backend won't start
- Make sure port 3001 is not in use
- Check that all dependencies are installed: `npm install`

### Video info not fetching
- Check the URL is valid and accessible
- Some platforms may require authentication for certain videos
- Check backend logs for error messages

### CORS errors
- Make sure the backend is running
- Check that `VITE_API_URL` points to the correct backend URL

## Deployment

### Frontend Only (Static)
The frontend is already built and deployed at:
https://36d2ggi2iwlwk.ok.kimi.link

### Full Stack (with Backend)
To deploy with backend functionality:

1. Set up a Node.js server (e.g., Heroku, Railway, VPS)
2. Upload the `combined` folder
3. Run `npm install && npm start`
4. Configure environment variables
5. Update frontend API URL to point to your backend

## License

MIT License - Free for personal and commercial use.

## Disclaimer

This tool is for educational purposes only. Please respect copyright laws and the terms of service of video platforms. Only download videos you have permission to download.
# VideoGrab
