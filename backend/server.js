const express = require('express');
const cors = require('cors');
const play = require('play-dl');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Load env if available
try { require('dotenv').config(); } catch(e) {}

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
const staticPath = path.join(__dirname, 'public');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  console.log('Serving static files from:', staticPath);
} else {
  const fallbackPath = path.join(__dirname, '../app/dist');
  if (fs.existsSync(fallbackPath)) {
    app.use(express.static(fallbackPath));
    console.log('Serving static files from:', fallbackPath);
  }
}

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Config file setup
const configFilePath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configFilePath)) {
  fs.writeFileSync(configFilePath, JSON.stringify({
    siteTitle: "VideoGrab",
    heroPrimaryText: "Download Videos from Any Platform",
    heroSecondaryText: "Fast, free, and easy video downloader. Support for YouTube, Facebook, X, Instagram, and 1000+ sites.",
    footerText: "© 2026 VideoGrab. Disclaimer: Please do not download or use copyrighted materials without permission."
  }, null, 2));
}

// Admin setup
const adminToken = crypto.randomBytes(32).toString('hex');
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
console.log('\n=================================');
console.log('🛡️  ADMIN PANEL CONFIGURATION');
console.log(`URL: /#/admin`);
console.log(`PASSWORD: ${adminPassword}`);
console.log('=================================\n');

// Global state for SSE real-time download tracking
const downloadProgressMap = new Map();

// Get video info endpoint
app.get('/api/video-info', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Fetching info for:', url);
    
    // Detect platform
    const platform = detectPlatform(url);
    if (platform === 'Unknown') {
      return res.status(400).json({ error: 'Unsupported platform or invalid URL' });
    }

    // Use yt-dlp for all platforms to get video info
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      // Get video info using yt-dlp
      const cmd = `yt-dlp --dump-json --no-download "${url}"`;
      const { stdout } = await execPromise(cmd, { timeout: 30000 });
      const videoData = JSON.parse(stdout);
      
      // Format the response
      const rawThumbnail = videoData.thumbnail || videoData.thumbnails?.[0]?.url || '';
      const responseData = {
        title: videoData.title || 'Unknown Title',
        description: videoData.description || '',
        thumbnail: rawThumbnail ? `/api/thumbnail-proxy?url=${encodeURIComponent(rawThumbnail)}` : '',
        duration: formatDuration(videoData.duration || 0),
        durationSeconds: videoData.duration || 0,
        channel: videoData.channel || videoData.uploader || 'Unknown Channel',
        views: formatViews(videoData.view_count || 0),
        platform: platform,
        url: url,
        formats: getAvailableFormatsForPlatform(platform)
      };

      console.log('Video info fetched:', responseData.title);
      res.json(responseData);
      
    } catch (err) {
      console.error('yt-dlp info error:', err.message);
      
      // Fallback to play-dl for YouTube if yt-dlp fails
      if (platform === 'YouTube') {
        try {
          const info = await play.video_info(url);
          const video = info.video_details;
          
          const rawFallbackThumb = video.thumbnails[0]?.url || video.thumbnail?.url || '';
          const videoData = {
            title: video.title || 'Unknown Title',
            description: video.description || '',
            thumbnail: rawFallbackThumb ? `/api/thumbnail-proxy?url=${encodeURIComponent(rawFallbackThumb)}` : '',
            duration: formatDuration(video.durationInSec || 0),
            durationSeconds: video.durationInSec || 0,
            channel: video.channel?.name || video.author?.name || 'Unknown Channel',
            views: formatViews(video.views || 0),
            platform: platform,
            url: url,
            formats: getAvailableFormats(info)
          };

          console.log('Video info fetched (fallback):', videoData.title);
          return res.json(videoData);
        } catch (playErr) {
          console.error('play-dl fallback error:', playErr.message);
        }
      }
      
      return res.status(500).json({ 
        error: 'Failed to fetch video information',
        message: 'Video may be private, age-restricted, or unavailable'
      });
    }
    
  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch video info',
      message: error.message 
    });
  }
});

// Settings API
app.get('/api/config', (req, res) => {
  try {
    const configData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    res.json(configData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// Admin Authentication API
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === adminPassword) {
    res.json({ token: adminToken });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token && token === adminToken) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.post('/api/admin/config', verifyAdmin, (req, res) => {
  try {
    const currentConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8') || '{}');
    const newConfig = { ...currentConfig, ...req.body };
    fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write config' });
  }
});

// Download video endpoint using yt-dlp
app.post('/api/download', async (req, res) => {
  const { url, quality, format, downloadId } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Starting download:', url, 'Quality:', quality, 'Format:', format);
    
    // Detect platform
    const platform = detectPlatform(url);
    
    // Generate safe filename
    const timestamp = Date.now();
    const activeDownloadId = downloadId || timestamp.toString();
    downloadProgressMap.set(activeDownloadId, 0);

    const outputTemplate = path.join(downloadsDir, `video_${timestamp}`);
    
    // Build yt-dlp command
    let cmd = `yt-dlp`;
    
    // Set output template
    cmd += ` -o "${outputTemplate}.%(ext)s"`;
    
    // Handle audio-only download
    if (format.toLowerCase() === 'mp3' || quality === 'Audio Only') {
      cmd += ' -x --audio-format mp3 --audio-quality 0';
      cmd += ` --extract-audio`;
    } else {
      // Video download with quality selection
      const qualityMap = {
        '4K (2160p)': '2160',
        '1080p HD': '1080',
        '720p HD': '720',
        '480p': '480',
        '360p': '360'
      };
      
      const maxHeight = qualityMap[quality] || '720';
      
      // Use best available video and audio that matches criteria, fallback to best overall
      cmd += ` -f "bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best"`;
      cmd += ' --merge-output-format mp4';
    }
    
    // Add URL
    cmd += ` "${url}"`;
    
    console.log('Executing:', cmd);
    
    // Execute yt-dlp
    const child = exec(cmd, { timeout: 300000, maxBuffer: 10485760 }, (error, stdout, stderr) => {
      // Clean up progress hook
      downloadProgressMap.delete(activeDownloadId);

      if (error) {
        console.error('yt-dlp error:', error.message);
        console.error('stderr:', stderr);
        
        // Provide more specific error messages
        let userMessage = 'Download failed';
        if (stderr.includes('Requested format is not available')) {
          userMessage = 'This video format is not available for download';
        } else if (stderr.includes('ERROR: [Instagram]')) {
          userMessage = 'Instagram video unavailable or requires authentication. Try a public post.';
        } else if (stderr.includes('Private video') || stderr.includes('login')) {
          userMessage = 'This content is private and requires authentication';
        } else if (stderr.includes('Video unavailable') || stderr.includes('does not exist')) {
          userMessage = 'Video not found or has been deleted';
        } else if (stderr.includes('Sign in')) {
          userMessage = 'Authentication required. This content may be private.';
        }
        
        return res.status(500).json({ 
          error: 'Download failed',
          message: userMessage,
          details: stderr.split('\n')[0] // First line of error
        });
      }
      
      console.log('yt-dlp stdout:', stdout);
      
      // Find the downloaded file
      try {
        const files = fs.readdirSync(downloadsDir);
        const downloadedFile = files.find(f => f.startsWith(`video_${timestamp}`));
        
        if (!downloadedFile) {
          return res.status(500).json({ error: 'File not found after download' });
        }
        
        console.log('Download completed:', downloadedFile);
        
        res.json({
          success: true,
          filename: downloadedFile,
          downloadUrl: `/api/download/file/${downloadedFile}`
        });
      } catch (err) {
        console.error('Error finding file:', err);
        res.status(500).json({ error: 'Failed to locate downloaded file' });
      }
    });
    
    // Parse stdout for progress updates
    child.stdout.on('data', (data) => {
      const match = data.toString().match(/\[download\]\s+([\d\.]+)%/);
      if (match) {
        const percent = parseFloat(match[1]);
        downloadProgressMap.set(activeDownloadId, percent);
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
});

// Serve downloaded files
app.get('/api/download/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(downloadsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filepath, filename, (err) => {
    if (err && err.code !== 'EPIPE' && err.code !== 'ECONNRESET' && err.message !== 'Request aborted') {
      console.error('Download error:', err.message || err);
    }
    // Optionally delete file after download
    // fs.unlinkSync(filepath);
  });
});

// Thumbnail proxy - fetches external images server-side to bypass CORP restrictions
app.get('/api/thumbnail-proxy', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  const fetchImage = (targetUrlString, redirectCount = 0) => {
    if (redirectCount > 3) return res.status(502).json({ error: 'Too many redirects' });
    
    let targetUrl;
    try {
      targetUrl = new URL(targetUrlString);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const protocol = targetUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
      }
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        return fetchImage(proxyRes.headers.location, redirectCount + 1);
      }

      // Forward content-type but remove restrictive CORP/CORS headers
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.statusCode = proxyRes.statusCode;
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Thumbnail proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch thumbnail' });
    });

    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).json({ error: 'Thumbnail proxy timeout' });
    });

    proxyReq.end();
  };

  fetchImage(url);
});

app.get('/api/progress/:id', (req, res) => {
  const id = req.params.id;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*' // Explicit CORS for SSE if needed
  });

  const sendProgress = () => {
    // If it was deleted from map, it means download finished (or failed)
    const progress = downloadProgressMap.has(id) ? downloadProgressMap.get(id) : 100;
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    
    if (progress >= 100 || !downloadProgressMap.has(id)) {
      clearInterval(interval);
      res.end();
    }
  };

  sendProgress();
  const interval = setInterval(sendProgress, 500);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper functions
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M views';
  } else if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K views';
  }
  return views + ' views';
}

function detectPlatform(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'YouTube';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return 'Facebook';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'X / Twitter';
  if (lowerUrl.includes('instagram.com')) return 'Instagram';
  if (lowerUrl.includes('tiktok.com')) return 'TikTok';
  if (lowerUrl.includes('vimeo.com')) return 'Vimeo';
  if (lowerUrl.includes('dailymotion.com')) return 'Dailymotion';
  
  // For all other 1000+ supported sites, extract the domain neatly
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '');
    // Basic capitalization (e.g., cnn.com -> Cnn.com)
    domain = domain.charAt(0).toUpperCase() + domain.slice(1);
    return domain;
  } catch (e) {
    return 'Website';
  }
}

function mapQuality(quality) {
  const qualityMap = {
    '4K (2160p)': 2160,
    '1080p HD': 1080,
    '720p HD': 720,
    '480p': 480,
    '360p': 360,
    'Audio Only': 0
  };
  return qualityMap[quality] || 720;
}

function getAvailableFormats(info) {
  const formats = [];
  
  // Add video formats
  formats.push(
    { quality: '1080p HD', format: 'MP4', size: '~120 MB' },
    { quality: '720p HD', format: 'MP4', size: '~65 MB' },
    { quality: '480p', format: 'MP4', size: '~35 MB' },
    { quality: '360p', format: 'MP4', size: '~20 MB' }
  );
  
  // Add audio format
  formats.push({ quality: 'Audio Only', format: 'MP3', size: '~8 MB' });
  
  return formats;
}

function getAvailableFormatsForPlatform(platform) {
  // All platforms support the same basic formats
  // yt-dlp will handle finding the best available quality
  const formats = [
    { quality: '1080p HD', format: 'MP4', size: '~120 MB' },
    { quality: '720p HD', format: 'MP4', size: '~65 MB' },
    { quality: '480p', format: 'MP4', size: '~35 MB' },
    { quality: '360p', format: 'MP4', size: '~20 MB' },
    { quality: 'Audio Only', format: 'MP3', size: '~8 MB' }
  ];
  
  return formats;
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve frontend for all non-API routes
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(__dirname, '../app/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: 'VideoGrab API Server',
      status: 'running',
      endpoints: [
        '/api/health',
        '/api/video-info?url=VIDEO_URL',
        '/api/download (POST)'
      ]
    });
  }
});

// Start auto-cleanup cron job (runs every 15 minutes)
// Deletes files older than 1 hour to prevent server disk space overflow
setInterval(() => {
  try {
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    files.forEach(file => {
      // Ignore hidden files like .gitkeep
      if (file.startsWith('.')) return; 
      
      const filePath = path.join(downloadsDir, file);
      const stat = fs.statSync(filePath);
      
      // Delete if file older than 1 hour (3600000 ms)
      if (now - stat.mtimeMs > 3600000) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Auto-Cleaned up old media file: ${file}`);
        } catch (e) {
          console.error(`Failed to delete old file ${file}:`, e.message);
        }
      }
    });
  } catch (err) {
    console.error('Cleanup cron error:', err);
  }
}, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`VideoGrab server running on port ${PORT}`);
  console.log(`Downloads directory: ${downloadsDir}`);
  console.log(`API endpoints:`);
  console.log(`  - GET /api/health`);
  console.log(`  - GET /api/video-info?url=VIDEO_URL`);
  console.log(`  - POST /api/download`);
});
