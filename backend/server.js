const express = require('express');
const cors = require('cors');
const play = require('play-dl');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

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
      const responseData = {
        title: videoData.title || 'Unknown Title',
        description: videoData.description || '',
        thumbnail: videoData.thumbnail || videoData.thumbnails?.[0]?.url || '',
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
          
          const videoData = {
            title: video.title || 'Unknown Title',
            description: video.description || '',
            thumbnail: video.thumbnails[0]?.url || video.thumbnail?.url || '',
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

// Download video endpoint using yt-dlp
app.post('/api/download', async (req, res) => {
  const { url, quality, format } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Starting download:', url, 'Quality:', quality, 'Format:', format);
    
    // Detect platform
    const platform = detectPlatform(url);
    
    // Generate safe filename
    const timestamp = Date.now();
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
      
      // Select best video+audio format within quality limit
      cmd += ` -f "bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]"`;
      cmd += ' --merge-output-format mp4';
    }
    
    // Add URL
    cmd += ` "${url}"`;
    
    console.log('Executing:', cmd);
    
    // Execute yt-dlp
    exec(cmd, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error.message);
        console.error('stderr:', stderr);
        return res.status(500).json({ 
          error: 'Download failed',
          message: error.message 
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
    if (err) {
      console.error('Download error:', err);
    }
    // Optionally delete file after download
    // fs.unlinkSync(filepath);
  });
});

// Get download progress (for future implementation with WebSocket)
app.get('/api/download/progress/:id', (req, res) => {
  res.json({ progress: 0, status: 'pending' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper functions
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
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
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'YouTube';
  } else if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) {
    return 'Facebook';
  } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'X / Twitter';
  } else if (lowerUrl.includes('instagram.com')) {
    return 'Instagram';
  } else if (lowerUrl.includes('tiktok.com')) {
    return 'TikTok';
  } else if (lowerUrl.includes('vimeo.com')) {
    return 'Vimeo';
  } else if (lowerUrl.includes('dailymotion.com')) {
    return 'Dailymotion';
  }
  return 'Unknown';
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

app.listen(PORT, () => {
  console.log(`VideoGrab server running on port ${PORT}`);
  console.log(`Downloads directory: ${downloadsDir}`);
  console.log(`API endpoints:`);
  console.log(`  - GET /api/health`);
  console.log(`  - GET /api/video-info?url=VIDEO_URL`);
  console.log(`  - POST /api/download`);
});
