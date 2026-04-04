# VideoGrab - Download Implementation Status

## 📊 Current Status

### ✅ What's Working:
- ✅ Video info fetching (metadata, thumbnails, etc.)
- ✅ Platform detection
- ✅ Error handling
- ✅ API endpoints responding
- ✅ Audio download endpoint structure

### ⚠️ Download Limitations:

#### **Video Downloads (MP4)**
**Status:** Partial - Returns success message but file not actually downloaded

**Why:** YouTube uses **DASH (Dynamic Adaptive Streaming over HTTP)** which separates video and audio into different streams. To get a complete video file with both video and audio, you need to:
1. Download the video-only stream
2. Download the audio-only stream  
3. Merge them together using `ffmpeg`

**Current Behavior:**
```json
{
  "success": true,
  "filename": "video_title_timestamp.mp4",
  "downloadUrl": "/api/download/file/video_title_timestamp.mp4",
  "message": "Download initiated. Note: Full video download requires ffmpeg for merging audio/video streams.",
  "note": "For complete implementation, install ffmpeg and use it to merge separate video/audio streams from YouTube."
}
```

#### **Audio Downloads (MP3)**
**Status:** Not working yet - `play.stream()` API issue

**Issue:** The `play-dl` library's streaming API needs proper configuration.

---

## 🔧 Solutions

### Option 1: Install FFmpeg (Recommended for Production)

FFmpeg is required to merge YouTube's separate video and audio streams.

#### Installation:

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Linux (CentOS/RHEL):**
```bash
sudo yum install ffmpeg
```

**Windows:**
Download from: https://ffmpeg.org/download.html

#### After Installing FFmpeg:

The backend code needs to be updated to use ffmpeg for merging streams. Here's what the implementation would look like:

```javascript
const { exec } = require('child_process');

// Download video stream
const videoStream = await play.stream(url, { quality: targetQuality });
const videoPath = path.join(downloadsDir, `video_${timestamp}.mp4`);
// ... save video stream

// Download audio stream  
const audioStream = await play.stream(url, { quality: 0 });
const audioPath = path.join(downloadsDir, `audio_${timestamp}.m4a`);
// ... save audio stream

// Merge with ffmpeg
exec(`ffmpeg -i ${videoPath} -i ${audioPath} -c:v copy -c:a aac ${finalPath}`, (err) => {
  if (err) {
    console.error('FFmpeg error:', err);
    return res.status(500).json({ error: 'Failed to merge streams' });
  }
  // Clean up temp files
  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);
  // Return success
  res.json({ success: true, downloadUrl: `/api/download/file/${filename}` });
});
```

---

### Option 2: Use yt-dlp (Easiest Solution)

`yt-dlp` is a powerful command-line tool that handles all the complexity automatically.

#### Installation:

**macOS:**
```bash
brew install yt-dlp
brew install ffmpeg  # Required for merging
```

**Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
sudo apt-get install ffmpeg
```

#### Implementation:

```javascript
const { exec } = require('child_process');

app.post('/api/download', async (req, res) => {
  const { url, quality, format } = req.body;
  const safeFilename = `${Date.now()}`;
  const outputPath = path.join(downloadsDir, `${safeFilename}.%(ext)s`);
  
  // Build yt-dlp command
  let cmd = `yt-dlp -o "${outputPath}"`;
  
  if (format.toLowerCase() === 'mp3') {
    cmd += ' -x --audio-format mp3';
  } else {
    const qualityMap = {
      '4K (2160p)': '2160',
      '1080p HD': '1080',
      '720p HD': '720',
      '480p': '480',
      '360p': '360'
    };
    const q = qualityMap[quality] || '720';
    cmd += ` -f "bestvideo[height<=${q}]+bestaudio/best[height<=${q}]"`;
  }
  
  cmd += ` "${url}"`;
  
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('yt-dlp error:', error);
      return res.status(500).json({ error: 'Download failed', message: error.message });
    }
    
    // Find the downloaded file
    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(f => f.startsWith(safeFilename));
    
    if (downloadedFile) {
      res.json({
        success: true,
        filename: downloadedFile,
        downloadUrl: `/api/download/file/${downloadedFile}`
      });
    } else {
      res.status(500).json({ error: 'File not found after download' });
    }
  });
});
```

**Pros:**
- ✅ Handles all platforms (YouTube, Twitter, Instagram, TikTok, etc.)
- ✅ Automatic stream merging
- ✅ Quality selection
- ✅ Metadata embedding
- ✅ Actively maintained

**Cons:**
- ❌ Requires Python installed
- ❌ External dependency
- ❌ Slower than native Node.js solution

---

### Option 3: Fix play-dl Streaming (Current Approach)

To make the current `play-dl` implementation work properly:

#### For Audio Downloads:

```javascript
// Fixed audio download
if (format.toLowerCase() === 'mp3' || quality === 'Audio Only') {
  try {
    // Get audio stream
    const audioInfo = await play.stream(url, { 
      quality: 0,  // 0 = lowest quality (audio only)
      language: 'en'
    });
    
    const filename = `${safeTitle}_${timestamp}.mp3`;
    const filepath = path.join(downloadsDir, filename);
    
    const writeStream = fs.createWriteStream(filepath);
    
    audioInfo.stream.pipe(writeStream);
    
    writeStream.on('finish', () => {
      console.log('Audio download completed:', filename);
      res.json({
        success: true,
        filename: filename,
        downloadUrl: `/api/download/file/${filename}`
      });
    });
    
    writeStream.on('error', (err) => {
      console.error('Audio write error:', err);
      res.status(500).json({ error: 'Download failed', message: err.message });
    });
    
  } catch (err) {
    console.error('Audio stream error:', err);
    res.status(500).json({ 
      error: 'Failed to process audio download',
      message: err.message 
    });
  }
}
```

#### For Video Downloads (Requires FFmpeg):

```javascript
// Download video and audio separately, then merge
const videoFormat = info.format.filter(f => f.qualityLabel && !f.audioEncoding)[0];
const audioFormat = info.format.filter(f => f.audioEncoding && !f.qualityLabel)[0];

// Download video stream
const videoStream = await play.stream_from_info(info, { quality: parseInt(videoFormat.qualityLabel) });
const videoPath = path.join(downloadsDir, `temp_video_${timestamp}.mp4`);
const videoWriteStream = fs.createWriteStream(videoPath);
videoStream.stream.pipe(videoWriteStream);

// Wait for video download
await new Promise((resolve, reject) => {
  videoWriteStream.on('finish', resolve);
  videoWriteStream.on('error', reject);
});

// Download audio stream
const audioStream = await play.stream_from_info(info, { quality: 0 });
const audioPath = path.join(downloadsDir, `temp_audio_${timestamp}.m4a`);
const audioWriteStream = fs.createWriteStream(audioPath);
audioStream.stream.pipe(audioWriteStream);

// Wait for audio download
await new Promise((resolve, reject) => {
  audioWriteStream.on('finish', resolve);
  audioWriteStream.on('error', reject);
});

// Merge with ffmpeg
const finalPath = path.join(downloadsDir, `${safeTitle}_${timestamp}.mp4`);
exec(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac "${finalPath}"`, (err) => {
  // Clean up temp files
  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);
  
  if (err) {
    console.error('FFmpeg merge error:', err);
    return res.status(500).json({ error: 'Failed to merge streams' });
  }
  
  res.json({
    success: true,
    filename: `${safeTitle}_${timestamp}.mp4`,
    downloadUrl: `/api/download/file/${safeTitle}_${timestamp}.mp4`
  });
});
```

---

## 🎯 Recommended Path Forward

### For Development/Testing:
Keep current implementation - it shows the structure and returns proper responses.

### For Production:

**Best Option:** Use `yt-dlp` + `ffmpeg`
```bash
# Install dependencies
brew install yt-dlp ffmpeg  # macOS
# or
sudo apt-get install yt-dlp ffmpeg  # Linux

# Update backend to use yt-dlp (see Option 2 above)
```

**Benefits:**
- ✅ Works for ALL platforms (not just YouTube)
- ✅ Handles all edge cases
- ✅ Minimal code changes
- ✅ Reliable and tested
- ✅ Active community support

---

## 📝 Current API Response

When users click download now, they get:

```json
{
  "success": true,
  "filename": "Rick_Astley_Never_Gonna_Give_You_Up_1775294334246.mp4",
  "downloadUrl": "/api/download/file/Rick_Astley_Never_Gonna_Give_You_Up_1775294334246.mp4",
  "message": "Download initiated. Note: Full video download requires ffmpeg for merging audio/video streams.",
  "note": "For complete implementation, install ffmpeg and use it to merge separate video/audio streams from YouTube."
}
```

The frontend then tries to access `/api/download/file/filename.mp4` but the file doesn't exist yet because we're not actually downloading it.

---

## 🔨 Quick Fix (Temporary)

If you want downloads to work immediately without ffmpeg:

1. **Install ffmpeg:**
   ```bash
   brew install ffmpeg  # macOS
   ```

2. **Update the backend code** to implement one of the solutions above

3. **Restart the server:**
   ```bash
   ./start-prod.sh
   ```

---

## 📊 Comparison Table

| Feature | Current (play-dl) | With FFmpeg | With yt-dlp |
|---------|-------------------|-------------|-------------|
| YouTube Video | ❌ Incomplete | ✅ Works | ✅ Works |
| YouTube Audio | ❌ Not working | ✅ Works | ✅ Works |
| Other Platforms | ❌ No | ❌ No | ✅ Yes |
| Complexity | Low | Medium | Low |
| Dependencies | Node.js only | +ffmpeg | +ffmpeg +Python |
| Maintenance | Manual | Manual | Auto-updated |
| Speed | Fast | Fast | Medium |

---

## 💡 Recommendation

**For a production-ready video downloader:**

1. Install `yt-dlp` and `ffmpeg`
2. Replace the download endpoint with yt-dlp implementation
3. Keep the current video-info endpoint (it works great!)
4. Add rate limiting and file cleanup
5. Deploy!

This gives you:
- ✅ Support for 1000+ sites
- ✅ Reliable downloads
- ✅ Minimal maintenance
- ✅ Professional results

---

## 🚀 Next Steps

Choose your path:

**A) Quick & Easy (Recommended):**
```bash
brew install yt-dlp ffmpeg
# Then I'll help you update the code to use yt-dlp
```

**B) Learn & Implement:**
```bash
brew install ffmpeg
# Then I'll help you implement the ffmpeg merging solution with play-dl
```

**C) Keep As-Is:**
- Info fetching works perfectly
- Downloads show informative messages
- Good for demo/portfolio purposes

Let me know which option you prefer, and I'll implement it! 🎯
