const express = require('express');
const cors = require('cors');
const play = require('play-dl');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Find yt-dlp path (prefer venv)
const getYtDlpPath = () => {
  const venvPath = path.join(__dirname, 'venv', 'bin', 'yt-dlp');
  if (fs.existsSync(venvPath)) return venvPath;
  return '/usr/local/bin/yt-dlp';
};

// Returns --cookies flag if a cookies.txt file is present in the backend directory
const getCookiesFlag = () => {
  const cookiesPath = path.join(__dirname, 'cookies.txt');
  return fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
};

const execPromise = require('util').promisify(exec);

// Probe audio track metadata from the stream URLs already returned by yt-dlp dump-json.
// Uses ffprobe directly on the CDN URLs — no second yt-dlp / YouTube request needed.
// Returns an array of { code, name } objects.
async function probeAudioTracksFromFormats(audioFormats) {
  // Collect one representative URL per format_id (avoid hitting the same language twice)
  const seen = new Set();
  const toProbe = [];
  for (const f of audioFormats) {
    if (f.url && f.format_id && !seen.has(f.format_id)) {
      seen.add(f.format_id);
      toProbe.push(f.url);
    }
  }
  if (toProbe.length === 0) return [];

  const tracks = [];
  const seenLangs = new Set();
  for (const streamUrl of toProbe.slice(0, 3)) {
    try {
      const { stdout } = await execPromise(
        `ffprobe -v quiet -print_format json -show_streams -select_streams a "${streamUrl}"`,
        { timeout: 4000 }
      );
      const data = JSON.parse(stdout);
      for (const s of (data.streams || [])) {
        const code = s.tags?.language;
        if (!code || seenLangs.has(code)) continue;
        seenLangs.add(code);
        const rawTitle = s.tags?.title || s.tags?.handler_name || '';
        const name = rawTitle
          .split(',')[0]
          .replace(/\s*\(default\)/gi, '')
          .replace(/\s*original$/gi, '')
          .trim() || code.toUpperCase();
        tracks.push({ code, name });
      }
    } catch (_) {}
  }
  return tracks;
}

const normalizeLanguageCode = (value) => String(value || '').trim().toLowerCase().replace(/_/g, '-');

const getNumericFormatValue = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getAudioFormatScore = (format) => {
  return (
    getNumericFormatValue(format.abr) * 1000 +
    getNumericFormatValue(format.asr) +
    getNumericFormatValue(format.tbr)
  );
};

const toFfmpegLanguageTag = (value) => {
  const normalized = normalizeLanguageCode(value);
  const languageMap = {
    ar: 'ara',
    de: 'deu',
    'de-de': 'deu',
    en: 'eng',
    'en-us': 'eng',
    es: 'spa',
    'es-us': 'spa',
    fr: 'fra',
    'fr-fr': 'fra',
    hi: 'hin',
    id: 'ind',
    it: 'ita',
    ja: 'jpn',
    ko: 'kor',
    nl: 'nld',
    'nl-nl': 'nld',
    pl: 'pol',
    pt: 'por',
    'pt-br': 'por'
  };

  return languageMap[normalized] || normalized.slice(0, 3) || 'und';
};

const getVideoFormatScore = (format) => {
  return (
    getNumericFormatValue(format.height) * 1000000 +
    getNumericFormatValue(format.fps) * 1000 +
    getNumericFormatValue(format.tbr)
  );
};

async function fetchYtDlpMetadata(url) {
  const nodePath = process.execPath || '/usr/bin/node';
  const cookies = getCookiesFlag();
  const hasCookies = !!cookies;
  const clients = hasCookies ? 'tv' : 'android_vr';
  const metadataTimeout = 30000;
  let cmd = `"${getYtDlpPath()}" --dump-json --no-download --audio-multistreams --js-runtimes "node:${nodePath}" ${cookies} --extractor-args "youtube:player_client=${clients}" "${url}"`;

  try {
    const result = await execPromise(cmd, { timeout: metadataTimeout, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(result.stdout);
  } catch (err) {
    if (err.stdout && err.stdout.trim().startsWith('{')) {
      return JSON.parse(err.stdout);
    }

    console.log(`yt-dlp ${clients} failed (${err.message?.slice(0, 120)}), trying default...`);
    cmd = `"${getYtDlpPath()}" --dump-json --no-download --audio-multistreams --js-runtimes "node:${nodePath}" ${cookies} "${url}"`;
    const result = await execPromise(cmd, { timeout: metadataTimeout, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(result.stdout);
  }
}

const sanitizeFilenamePart = (value) => {
  return String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildUniqueDownloadLabel = (timestamp) => {
  const uniqueNumber = `${timestamp}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  return `unicq-lyarinet-${uniqueNumber}`;
};

const getQualityLabel = (quality, format, audioTrack) => {
  if (!quality) return '';
  if (quality === '4K (2160p)') return '2160p';
  if (quality === '2K (1440p)') return '1440p';
  if (quality === '1080p HD') return '1080p';
  if (quality === '720p HD') return '720p';
  if (quality === '480p') return '480p';
  if (quality === '360p') return '360p';
  if (quality === '240p (320x240)') return '240p';
  if (quality === '144p') return '144p';

  if (quality.startsWith('Audio (') || quality === 'Audio Only') {
    return `${String(format || 'audio').toUpperCase()} Audio`;
  }

  if (audioTrack === 'all') return 'Multi Audio';
  return sanitizeFilenamePart(quality);
};

const buildDownloadBaseName = ({ quality, format, audioTrack, timestamp }) => {
  const safeTitle = buildUniqueDownloadLabel(timestamp);
  const safeQuality = getQualityLabel(quality, format, audioTrack);
  const parts = [safeQuality, safeTitle].filter(Boolean);
  let baseName = parts.join(' ');

  if (audioTrack === 'all' && !(quality.startsWith('Audio (') || quality === 'Audio Only')) {
    baseName += ' Multi Audio';
  }

  baseName = baseName
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();

  return baseName || `video_${timestamp}`;
};

function pickBestVideoFormat(formats, maxHeight) {
  const limit = getNumericFormatValue(maxHeight);
  const videoCandidates = (formats || [])
    .filter((format) =>
      format &&
      format.format_id &&
      format.vcodec &&
      format.vcodec !== 'none' &&
      getNumericFormatValue(format.height) > 0 &&
      getNumericFormatValue(format.height) <= limit
    )
    .sort((a, b) => getVideoFormatScore(b) - getVideoFormatScore(a));

  return videoCandidates[0] || null;
}

function pickPreferredAudioFormats(formats, selectedLanguage) {
  const targetLanguage = normalizeLanguageCode(selectedLanguage);
  const audioFormats = (formats || []).filter((format) =>
    format &&
    format.format_id &&
    format.vcodec === 'none' &&
    format.acodec &&
    format.acodec !== 'none'
  );

  if (targetLanguage) {
    const exactMatches = audioFormats
      .filter((format) => normalizeLanguageCode(format.language) === targetLanguage)
      .sort((a, b) => getAudioFormatScore(b) - getAudioFormatScore(a));
    if (exactMatches.length > 0) return [exactMatches[0]];

    const looseMatches = audioFormats
      .filter((format) => {
        const language = normalizeLanguageCode(format.language);
        return language && (language.startsWith(targetLanguage) || targetLanguage.startsWith(language));
      })
      .sort((a, b) => getAudioFormatScore(b) - getAudioFormatScore(a));
    if (looseMatches.length > 0) return [looseMatches[0]];
  }

  const bestByLanguage = new Map();
  for (const format of audioFormats) {
    const languageKey = normalizeLanguageCode(format.language) || `und-${format.format_id}`;
    const current = bestByLanguage.get(languageKey);
    if (!current || getAudioFormatScore(format) > getAudioFormatScore(current)) {
      bestByLanguage.set(languageKey, format);
    }
  }

  return [...bestByLanguage.values()].sort((a, b) => getAudioFormatScore(b) - getAudioFormatScore(a));
}

const runYtDlpDownload = (command, downloadId, progressStart, progressSpan) => new Promise((resolve, reject) => {
  const proc = exec(command, { timeout: 3600000, maxBuffer: 10485760 }, (err) => {
    if (err) reject(new Error('yt-dlp failed: ' + err.message));
    else resolve();
  });

  proc.stdout?.on('data', (chunk) => {
    const m = chunk.toString().match(/\[download\]\s+([\d.]+)%/);
    if (m && downloadId) {
      const rawPct = parseFloat(m[1]);
      const pct = Math.round(progressStart + (rawPct / 100) * progressSpan);
      downloadProgressMap.set(downloadId, { progress: pct, downloadUrl: null, error: null });
    }
  });
});

function findDownloadedFile(prefix) {
  const allFiles = fs.readdirSync(downloadsDir);
  const base = path.basename(prefix);
  const found = allFiles.find((file) => file.startsWith(base));
  return found ? path.join(downloadsDir, found) : null;
}

// When a specific audio track is selected: yt-dlp downloads all streams, ffprobe locates
// the right stream index, ffmpeg remuxes/transcodes with just that track.
async function downloadWithFfmpegTrackSelection(url, quality, format, audioTrack, outputTemplate, downloadId) {
  const cookies = getCookiesFlag();
  const nodePath = process.execPath || '/usr/bin/node';
  const isAudioOnly = quality.startsWith('Audio (');
  const tempVideoOutput = outputTemplate + '_video';
  const tempAudioOutput = outputTemplate + '_audio';

  const qualityMap = { '4K (2160p)': '2160', '2K (1440p)': '1440', '1080p HD': '1080', '720p HD': '720', '480p': '480', '360p': '360', '240p (320x240)': '240', '144p': '144' };
  const maxHeight = qualityMap[quality] || '720';
  const videoData = await fetchYtDlpMetadata(url);
  const formats = videoData.formats || [];

  // Phase 1 – yt-dlp: download the requested video plus one best audio stream per language
  // into a temp MKV so ffmpeg can keep only the selected track.
  const selectedAudioFormats = pickPreferredAudioFormats(formats, audioTrack);
  if (selectedAudioFormats.length === 0) {
    throw new Error(`No audio stream found for language "${audioTrack}"`);
  }

  const jsRuntime = `--js-runtimes "node:${nodePath}"`;
  const dlClients = cookies ? 'tv' : 'android_vr';
  const dlClientArg = `--extractor-args "youtube:player_client=${dlClients}"`;
  const selectedAudioFormat = selectedAudioFormats[0];
  let tempVideoPath = null;
  let tempAudioPath = null;

  const audioDownloadCmd = `"${getYtDlpPath()}" --newline --progress ${cookies} ${jsRuntime} ${dlClientArg} ` +
    `-f "${selectedAudioFormat.format_id}" -o "${tempAudioOutput}.%(ext)s" "${url}"`;

  if (isAudioOnly) {
    await runYtDlpDownload(audioDownloadCmd, downloadId, 0, 85);
    tempAudioPath = findDownloadedFile(tempAudioOutput);
    if (!tempAudioPath) throw new Error('Selected audio file not found');
  } else {
    const bestVideoFormat = pickBestVideoFormat(formats, maxHeight);
    if (!bestVideoFormat) {
      throw new Error(`No video stream found for quality "${quality}"`);
    }

    const videoDownloadCmd = `"${getYtDlpPath()}" --newline --progress ${cookies} ${jsRuntime} ${dlClientArg} ` +
      `-f "${bestVideoFormat.format_id}" -o "${tempVideoOutput}.%(ext)s" "${url}"`;

    await runYtDlpDownload(videoDownloadCmd, downloadId, 0, 55);
    tempVideoPath = findDownloadedFile(tempVideoOutput);
    if (!tempVideoPath) throw new Error('Video stream file not found');

    await runYtDlpDownload(audioDownloadCmd, downloadId, 55, 25);
    tempAudioPath = findDownloadedFile(tempAudioOutput);
    if (!tempAudioPath) throw new Error('Selected audio file not found');
  }

  downloadProgressMap.set(downloadId, { progress: 87, downloadUrl: null, error: null });

  // Phase 3 – ffmpeg: remux/transcode with only the selected audio track
  const audioCodecMap = { mp3: 'libmp3lame', m4a: 'aac', wav: 'pcm_s16le', flac: 'flac', opus: 'libopus' };
  let outputExt, ffmpegCmd;
  const ffmpegLanguageTag = toFfmpegLanguageTag(audioTrack);

  if (isAudioOnly) {
    outputExt = format.toLowerCase();
    const codec = audioCodecMap[outputExt] || 'libmp3lame';
    const outPath = `${outputTemplate}.${outputExt}`;
    ffmpegCmd = `ffmpeg -y -i "${tempAudioPath}" -map 0:a:0 -metadata:s:a:0 language=${ffmpegLanguageTag} -c:a ${codec} "${outPath}"`;
  } else {
    outputExt = 'mkv';
    const outPath = `${outputTemplate}.${outputExt}`;
    ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -metadata:s:a:0 language=${ffmpegLanguageTag} -c copy "${outPath}"`;
  }

  await execPromise(ffmpegCmd, { timeout: 3600000 });

  try { if (tempVideoPath) fs.unlinkSync(tempVideoPath); } catch (_) {}
  try { if (tempAudioPath) fs.unlinkSync(tempAudioPath); } catch (_) {}

  const outputFileName = `${path.basename(outputTemplate)}.${outputExt}`;
  downloadProgressMap.set(downloadId, {
    progress: 100,
    downloadUrl: `/api/download/file/${outputFileName}`,
    error: null
  });
}

async function downloadWithAllAudioTracks(url, quality, outputTemplate, downloadId) {
  const qualityMap = { '4K (2160p)': '2160', '2K (1440p)': '1440', '1080p HD': '1080', '720p HD': '720', '480p': '480', '360p': '360', '240p (320x240)': '240', '144p': '144' };
  const maxHeight = qualityMap[quality] || '720';

  const videoData = await fetchYtDlpMetadata(url);
  const formats = videoData.formats || [];
  const bestVideoFormat = pickBestVideoFormat(formats, maxHeight);
  const audioFormats = pickPreferredAudioFormats(formats);

  if (!bestVideoFormat || audioFormats.length === 0) {
    throw new Error('Could not resolve video/audio streams for all-track download');
  }
  const videoUrl = bestVideoFormat.url;
  const audioInputFormats = audioFormats.filter((item) => item.url);
  if (!videoUrl || audioInputFormats.length === 0) {
    throw new Error('Resolved formats are missing downloadable stream URLs');
  }

  downloadProgressMap.set(downloadId, { progress: 70, downloadUrl: null, error: null });

  const ffmpegInputs = [`-i "${videoUrl}"`, ...audioInputFormats.map((item) => `-i "${item.url}"`)].join(' ');
  const ffmpegMaps = ['-map 0:v:0', ...audioInputFormats.map((_, index) => `-map ${index + 1}:a:0`)].join(' ');
  const ffmpegMetadata = audioInputFormats
    .map((item, index) => `-metadata:s:a:${index} language=${toFfmpegLanguageTag(item.language)}`)
    .join(' ');
  const outPath = `${outputTemplate}.mkv`;
  const ffmpegCmd = `ffmpeg -y ${ffmpegInputs} ${ffmpegMaps} ${ffmpegMetadata} -c copy "${outPath}"`;

  await execPromise(ffmpegCmd, { timeout: 3600000 });

  const outputFileName = `${path.basename(outputTemplate)}.mkv`;
  downloadProgressMap.set(downloadId, {
    progress: 100,
    downloadUrl: `/api/download/file/${outputFileName}`,
    error: null
  });
}

// Load env if available
try { require('dotenv').config(); } catch (e) { }

const app = express();
const PORT = process.env.PORT || 3001;
const ENABLE_DEEP_AUDIO_PROBE = process.env.ENABLE_DEEP_AUDIO_PROBE === 'true';

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
    siteTitle: "Next-Videos",
    heroPrimaryText: "Download Videos from Any Platform",
    heroSecondaryText: "Fast, free, and easy video downloader. Support for YouTube, Facebook, X, Instagram, and .",
    footerText: "© 2026 Next-Videos. Disclaimer: Please do not download or use copyrighted materials without permission."
  }, null, 2));
}

// User workspace storage
const usersFilePath = path.join(__dirname, 'users.json');
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }, null, 2));
}

const userSessions = new Map();

const defaultWorkspacePreset = () => ({
  presetName: 'My Default Profile',
  activeTab: 'video',
  outputFormat: 'MP4',
  sizeLimit: 'Off',
  qualityMode: 'Optimal quality',
  videoEncode: 'MPEG4 (Xvid)',
  videoSize: '320x240',
  bitrate: 'Default',
  crfCq: '10 (High quality)',
  audioCodec: 'AAC',
  noAudio: 'Off',
  fps: 'Default',
  aspectRatio: 'Fully Expand',
  subtitleMode: 'Off',
  extraMode: 'Other'
});

const readUsersData = () => {
  try {
    const raw = fs.readFileSync(usersFilePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!Array.isArray(parsed.users)) return { users: [] };
    return parsed;
  } catch (_) {
    return { users: [] };
  }
};

const writeUsersData = (data) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
};

const sanitizeWorkspacePreset = (input) => {
  const source = input && typeof input === 'object' ? input : {};
  const fallback = defaultWorkspacePreset();
  return {
    presetName: sanitizeFilenamePart(source.presetName || fallback.presetName).slice(0, 60) || fallback.presetName,
    activeTab: ['video', 'audio', 'subtitle', 'other', 'watermark'].includes(source.activeTab) ? source.activeTab : fallback.activeTab,
    outputFormat: sanitizeFilenamePart(source.outputFormat || fallback.outputFormat).slice(0, 20) || fallback.outputFormat,
    sizeLimit: sanitizeFilenamePart(source.sizeLimit || fallback.sizeLimit).slice(0, 40) || fallback.sizeLimit,
    qualityMode: sanitizeFilenamePart(source.qualityMode || fallback.qualityMode).slice(0, 40) || fallback.qualityMode,
    videoEncode: sanitizeFilenamePart(source.videoEncode || fallback.videoEncode).slice(0, 60) || fallback.videoEncode,
    videoSize: sanitizeFilenamePart(source.videoSize || fallback.videoSize).slice(0, 40) || fallback.videoSize,
    bitrate: sanitizeFilenamePart(source.bitrate || fallback.bitrate).slice(0, 40) || fallback.bitrate,
    crfCq: sanitizeFilenamePart(source.crfCq || fallback.crfCq).slice(0, 40) || fallback.crfCq,
    audioCodec: sanitizeFilenamePart(source.audioCodec || fallback.audioCodec).slice(0, 30) || fallback.audioCodec,
    noAudio: sanitizeFilenamePart(source.noAudio || fallback.noAudio).slice(0, 10) || fallback.noAudio,
    fps: sanitizeFilenamePart(source.fps || fallback.fps).slice(0, 20) || fallback.fps,
    aspectRatio: sanitizeFilenamePart(source.aspectRatio || fallback.aspectRatio).slice(0, 40) || fallback.aspectRatio,
    subtitleMode: sanitizeFilenamePart(source.subtitleMode || fallback.subtitleMode).slice(0, 30) || fallback.subtitleMode,
    extraMode: sanitizeFilenamePart(source.extraMode || fallback.extraMode).slice(0, 30) || fallback.extraMode
  };
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
};

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  createdAt: user.createdAt
});

const getUserTokenFromRequest = (req) => req.headers.authorization?.split(' ')[1];

const getUserFromRequest = (req) => {
  const token = getUserTokenFromRequest(req);
  if (!token) return null;
  const userId = userSessions.get(token);
  if (!userId) return null;
  const usersData = readUsersData();
  return usersData.users.find((item) => item.id === userId) || null;
};

const verifyUser = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
};

const updateUserRecord = (userId, updater) => {
  const usersData = readUsersData();
  const userIndex = usersData.users.findIndex((item) => item.id === userId);
  if (userIndex === -1) return null;
  const currentUser = usersData.users[userIndex];
  const nextUser = updater(currentUser);
  usersData.users[userIndex] = nextUser;
  writeUsersData(usersData);
  return nextUser;
};

// Admin setup
const adminToken = crypto.randomBytes(32).toString('hex');
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
console.log('\n=================================');
console.log('🛡️  ADMIN PANEL CONFIGURATION');
console.log(`URL: /#/admin`);
console.log(`USERNAME: ${adminUsername}`);
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

    try {
      // Get video info using yt-dlp
      // Priority:
      //   1. web+android  — web supports cookies, android supports cookies+DASH (exposes dubbed tracks)
      //   2. android_vr   — fallback without cookies (DASH only, but skipped when cookies present)
      //   3. default      — last resort
      const videoData = await fetchYtDlpMetadata(url);

      // Extract unique language tracks using the language code field (not format_note which is a quality description)
      const audioFormats = videoData.formats ? videoData.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none') : [];

      const langMap = new Map();
      for (const f of audioFormats) {
        if (f.language && !langMap.has(f.language)) {
          // Build a clean display name from format_note (e.g. "English (US) original (default), low" → "English (US)")
          let name = f.language;
          if (f.format_note) {
            name = f.format_note.split(',')[0]
              .replace(/\s*\(default\)/gi, '')
              .replace(/\s*original$/gi, '')
              .trim() || f.language;
          }
          langMap.set(f.language, name);
        }
      }
      let languages = [...langMap.entries()].map(([code, name]) => ({ code, name }));

      // Deep probing is intentionally opt-in because ffprobe against remote CDN URLs
      // can add several seconds and make the analyze step feel stuck.
      if (ENABLE_DEEP_AUDIO_PROBE && languages.length <= 1 && audioFormats.length > 0) {
        const probed = await probeAudioTracksFromFormats(audioFormats);
        if (probed.length > languages.length) {
          languages = probed;
        }
      }

      if (languages.length === 0) {
        languages = [{ code: 'default', name: 'Default Audio' }];
      }

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
        formats: getAvailableFormatsForPlatform(platform),
        audioTracks: languages
      };

      console.log('Video info fetched:', responseData.title, '| audio tracks:', languages.length);
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
            formats: getAvailableFormats(info),
            audioTracks: ['default']
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
    console.error('Error reading config file:', err.message);
    res.status(500).json({ 
      error: 'Failed to read config', 
      message: err.message 
    });
  }
});

// Admin Authentication API
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === adminUsername && password === adminPassword) {
    res.json({ token: adminToken });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body || {};
  const cleanUsername = sanitizeFilenamePart(username || '').replace(/\s+/g, '-').slice(0, 40);
  const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);
  const rawPassword = String(password || '');

  if (!cleanUsername || !cleanEmail || rawPassword.length < 6) {
    return res.status(400).json({ error: 'Username, email, and password (min 6 chars) are required' });
  }

  const usersData = readUsersData();
  const emailExists = usersData.users.some((item) => item.email === cleanEmail);
  const usernameExists = usersData.users.some((item) => item.username.toLowerCase() === cleanUsername.toLowerCase());
  if (emailExists || usernameExists) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    email: cleanEmail,
    passwordHash: hashPassword(rawPassword),
    createdAt: new Date().toISOString(),
    preset: defaultWorkspacePreset(),
    downloadHistory: []
  };

  usersData.users.push(user);
  writeUsersData(usersData);

  const token = crypto.randomBytes(32).toString('hex');
  userSessions.set(token, user.id);
  res.json({ token, user: publicUser(user), preset: user.preset, downloadHistory: user.downloadHistory });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const usersData = readUsersData();
  const user = usersData.users.find((item) => item.email === cleanEmail);

  if (!user || !verifyPassword(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  userSessions.set(token, user.id);
  res.json({ token, user: publicUser(user), preset: user.preset || defaultWorkspacePreset(), downloadHistory: user.downloadHistory || [] });
});

app.post('/api/auth/logout', verifyUser, (req, res) => {
  const token = getUserTokenFromRequest(req);
  if (token) userSessions.delete(token);
  res.json({ success: true });
});

app.get('/api/auth/me', verifyUser, (req, res) => {
  res.json({
    user: publicUser(req.user),
    preset: req.user.preset || defaultWorkspacePreset(),
    downloadHistory: req.user.downloadHistory || []
  });
});

app.get('/api/user/workspace', verifyUser, (req, res) => {
  res.json({
    user: publicUser(req.user),
    preset: req.user.preset || defaultWorkspacePreset(),
    downloadHistory: req.user.downloadHistory || []
  });
});

app.post('/api/user/preset', verifyUser, (req, res) => {
  const nextPreset = sanitizeWorkspacePreset(req.body);
  const updatedUser = updateUserRecord(req.user.id, (currentUser) => ({
    ...currentUser,
    preset: nextPreset
  }));

  if (!updatedUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, preset: updatedUser.preset });
});

app.get('/api/user/downloads', verifyUser, (req, res) => {
  res.json({ downloadHistory: req.user.downloadHistory || [] });
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

// Cookies management — upload, status, delete
const multer = require('multer');
const cookiesPath = path.join(__dirname, 'cookies.txt');
const multerUpload = multer({ dest: path.join(__dirname, 'tmp_uploads') });

app.get('/api/admin/cookies-status', verifyAdmin, (req, res) => {
  if (!fs.existsSync(cookiesPath)) return res.json({ exists: false });
  const stat = fs.statSync(cookiesPath);
  res.json({ exists: true, size: stat.size, modified: stat.mtime });
});

app.post('/api/admin/upload-cookies', verifyAdmin, multerUpload.single('cookies'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    fs.renameSync(req.file.path, cookiesPath);
    res.json({ success: true, message: 'cookies.txt saved — all future downloads will use it' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save cookies file' });
  }
});

app.delete('/api/admin/cookies', verifyAdmin, (req, res) => {
  try {
    if (fs.existsSync(cookiesPath)) fs.unlinkSync(cookiesPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete cookies file' });
  }
});

// Download video endpoint using yt-dlp
app.post('/api/download', async (req, res) => {
  const { url, quality, format, downloadId, audioTrack } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('Starting download:', url, 'Quality:', quality, 'Format:', format);
    const workspaceUser = getUserFromRequest(req);

    // Detect platform
    const platform = detectPlatform(url);

    // Generate safe filename
    const timestamp = Date.now();
    const activeDownloadId = downloadId || timestamp.toString();
    downloadProgressMap.set(activeDownloadId, { progress: 0, downloadUrl: null, error: null });
    let resolvedTitle = 'Video';
    try {
      const metadata = await fetchYtDlpMetadata(url);
      resolvedTitle = metadata?.title || resolvedTitle;
    } catch (err) {
      console.log(`Could not resolve title for filename: ${err.message}`);
    }

    const outputBaseName = buildDownloadBaseName({
      quality,
      format,
      audioTrack,
      timestamp
    });
    const outputTemplate = path.join(downloadsDir, outputBaseName);
    const historyEntryId = crypto.randomUUID();

    if (workspaceUser) {
      updateUserRecord(workspaceUser.id, (currentUser) => ({
        ...currentUser,
        downloadHistory: [
          {
            id: historyEntryId,
            url,
            title: resolvedTitle,
            quality,
            format,
            audioTrack: audioTrack || 'default',
            platform,
            status: 'processing',
            fileName: `${outputBaseName}.${(quality.startsWith('Audio (') || quality === 'Audio Only') ? String(format || 'mp3').toLowerCase() : 'mp4'}`,
            createdAt: new Date().toISOString(),
            preset: currentUser.preset || defaultWorkspacePreset()
          },
          ...(currentUser.downloadHistory || [])
        ].slice(0, 25)
      }));
    }

    const updateWorkspaceDownload = (patch) => {
      if (!workspaceUser) return;
      updateUserRecord(workspaceUser.id, (currentUser) => ({
        ...currentUser,
        downloadHistory: (currentUser.downloadHistory || []).map((entry) =>
          entry.id === historyEntryId ? { ...entry, ...patch } : entry
        )
      }));
    };

    // When a specific audio track is selected, download that exact stream and mux it with video.
    // When all audio tracks are selected, mux one downloaded audio file per language into a single MKV.
    if (audioTrack && audioTrack !== 'default' && audioTrack !== 'all') {
      console.log(`Using ffmpeg track selection for audioTrack="${audioTrack}"`);
      downloadWithFfmpegTrackSelection(url, quality, format, audioTrack, outputTemplate, activeDownloadId)
        .then(() => {
          updateWorkspaceDownload({ status: 'completed', fileName: `${outputBaseName}.mkv`, completedAt: new Date().toISOString() });
        })
        .catch(err => {
          console.error('ffmpeg track selection failed:', err.message);
          downloadProgressMap.set(activeDownloadId, { progress: 0, downloadUrl: null, error: 'Download failed: ' + err.message });
          updateWorkspaceDownload({ status: 'failed', error: err.message, completedAt: new Date().toISOString() });
        });
      return res.json({ success: true, downloadId: activeDownloadId });
    }

    if (audioTrack === 'all' && !(quality.startsWith('Audio (') || quality === 'Audio Only')) {
      console.log('Using ffmpeg multi-track mux for all audio tracks');
      downloadWithAllAudioTracks(url, quality, outputTemplate, activeDownloadId)
        .then(() => {
          updateWorkspaceDownload({ status: 'completed', fileName: `${outputBaseName}.mkv`, completedAt: new Date().toISOString() });
        })
        .catch(err => {
          console.error('ffmpeg all-track mux failed:', err.message);
          downloadProgressMap.set(activeDownloadId, { progress: 0, downloadUrl: null, error: 'Download failed: ' + err.message });
          updateWorkspaceDownload({ status: 'failed', error: err.message, completedAt: new Date().toISOString() });
        });
      return res.json({ success: true, downloadId: activeDownloadId });
    }

    // Plain yt-dlp path (default audio or all-tracks MKV)
    const dlNodePath = process.execPath || '/usr/bin/node';
    const plainCookies = getCookiesFlag();
    const plainClient = plainCookies ? 'tv' : 'android_vr';
    let cmd = `"${getYtDlpPath()}" --newline --progress --audio-multistreams ${plainCookies} --embed-metadata --js-runtimes "node:${dlNodePath}" --extractor-args "youtube:player_client=${plainClient}"`;
    cmd += ` -o "${outputTemplate}.%(ext)s"`;

    if (quality.startsWith('Audio (') || quality === 'Audio Only') {
      let audioFormat = 'mp3';
      if (format.toLowerCase() === 'm4a') audioFormat = 'm4a';
      else if (format.toLowerCase() === 'wav') audioFormat = 'wav';
      else if (format.toLowerCase() === 'flac') audioFormat = 'flac';
      else if (format.toLowerCase() === 'opus') audioFormat = 'opus';

      cmd += ' -f bestaudio';
      cmd += ` -x --audio-format ${audioFormat} --audio-quality 0 --extract-audio`;
    } else {
      const qualityMap = { '4K (2160p)': '2160', '2K (1440p)': '1440', '1080p HD': '1080', '720p HD': '720', '480p': '480', '360p': '360', '240p (320x240)': '240', '144p': '144' };
      const maxHeight = qualityMap[quality] || '720';

      cmd += ` -f "bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best"`;
      if (maxHeight >= '1440' || maxHeight === '144') cmd += ' --merge-output-format mp4';
    }

    cmd += ` "${url}"`;
    console.log('Executing:', cmd);

    // Run yt-dlp in the background; SSE tracks progress
    exec(cmd, { timeout: 3600000, maxBuffer: 10485760 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error.message);
        let userMessage = 'Download failed';
        if (stderr.includes('Requested format is not available')) userMessage = 'Format not available';
        else if (stderr.includes('Private video')) userMessage = 'Private video';
        downloadProgressMap.set(activeDownloadId, { progress: 0, downloadUrl: null, error: userMessage });
        updateWorkspaceDownload({ status: 'failed', error: userMessage, completedAt: new Date().toISOString() });
        return;
      }

      const files = fs.readdirSync(downloadsDir);
      const templateBase = path.basename(outputTemplate);
      const downloadedFile = files.find(f => f.startsWith(templateBase));
      if (!downloadedFile) {
        downloadProgressMap.set(activeDownloadId, { progress: 0, downloadUrl: null, error: 'File not found' });
        updateWorkspaceDownload({ status: 'failed', error: 'File not found', completedAt: new Date().toISOString() });
        return;
      }
      downloadProgressMap.set(activeDownloadId, { progress: 100, downloadUrl: `/api/download/file/${downloadedFile}`, error: null });
      updateWorkspaceDownload({ status: 'completed', fileName: downloadedFile, completedAt: new Date().toISOString() });
    }).stdout.on('data', (data) => {
      const match = data.toString().match(/\[download\]\s+([\d\.]+)%/);
      if (match) {
        const current = downloadProgressMap.get(activeDownloadId) || {};
        downloadProgressMap.set(activeDownloadId, { ...current, progress: parseFloat(match[1]) });
      }
    });

    return res.json({ success: true, downloadId: activeDownloadId });
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
    'Access-Control-Allow-Origin': '*', // Explicit CORS for SSE if needed
    'X-Accel-Buffering': 'no' // Prevent Nginx from buffering SSE
  });

  const sendProgress = () => {
    const data = downloadProgressMap.get(id) || { progress: 100, downloadUrl: null, error: null };
    res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Only close the connection when we actually have the final URL or an error
    if (data.downloadUrl || data.error || !downloadProgressMap.has(id)) {
      clearInterval(interval);
      setTimeout(() => downloadProgressMap.delete(id), 5000);
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
    '2K (1440p)': 1440,
    '1080p HD': 1080,
    '720p HD': 720,
    '480p': 480,
    '360p': 360,
    '240p (320x240)': 240,
    'Audio Only': 0
  };
  return qualityMap[quality] || 720;
}

function getAvailableFormats(info) {
  const formats = [];

  // Add video formats
  formats.push(
    { quality: '4K (2160p)', format: 'MP4', size: '~450 MB' },
    { quality: '2K (1440p)', format: 'MP4', size: '~250 MB' },
    { quality: '1080p HD', format: 'MP4', size: '~120 MB' },
    { quality: '720p HD', format: 'MP4', size: '~65 MB' },
    { quality: '480p', format: 'MP4', size: '~35 MB' },
    { quality: '360p', format: 'MP4', size: '~20 MB' },
    { quality: '240p (320x240)', format: 'MP4', size: '~14 MB' },
    { quality: '144p', format: '3GP', size: '~10 MB' }
  );

  // Add audio formats
  formats.push(
    { quality: 'Audio (MP3)', format: 'MP3', size: '~8 MB' },
    { quality: 'Audio (M4A)', format: 'M4A', size: '~8 MB' },
    { quality: 'Audio (WAV)', format: 'WAV', size: '~30 MB' },
    { quality: 'Audio (FLAC)', format: 'FLAC', size: '~20 MB' },
    { quality: 'Audio (OPUS)', format: 'OPUS', size: '~5 MB' }
  );

  return formats;
}

function getAvailableFormatsForPlatform(platform) {
  // All platforms support the same basic formats
  // yt-dlp will handle finding the best available quality
  const formats = [
    { quality: '4K (2160p)', format: 'MP4', size: '~450 MB' },
    { quality: '2K (1440p)', format: 'MP4', size: '~250 MB' },
    { quality: '1080p HD', format: 'MP4', size: '~120 MB' },
    { quality: '720p HD', format: 'MP4', size: '~65 MB' },
    { quality: '480p', format: 'MP4', size: '~35 MB' },
    { quality: '360p', format: 'MP4', size: '~20 MB' },
    { quality: '240p (320x240)', format: 'MP4', size: '~14 MB' },
    { quality: '144p', format: '3GP', size: '~10 MB' },
    { quality: 'Audio (MP3)', format: 'MP3', size: '~8 MB' },
    { quality: 'Audio (M4A)', format: 'M4A', size: '~8 MB' },
    { quality: 'Audio (WAV)', format: 'WAV', size: '~30 MB' },
    { quality: 'Audio (FLAC)', format: 'FLAC', size: '~20 MB' },
    { quality: 'Audio (OPUS)', format: 'OPUS', size: '~5 MB' }
  ];

  return formats;
}

// Video Converter Feature
const conversionJobs = new Map();

app.get('/api/convert/files', (req, res) => {
  try {
    const user = getUserFromRequest(req);
    let files = [];
    
    if (user && user.downloadHistory) {
      // Extract file names from completed downloads in user's history
      const userFiles = user.downloadHistory
        .filter(entry => entry.status === 'completed' && entry.fileName)
        .map(entry => entry.fileName);
      
      // Only include files that actually still exist on disk
      files = userFiles.filter(file => fs.existsSync(path.join(downloadsDir, file)));
    }
    
    // De-duplicate just in case
    files = [...new Set(files)];
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.post('/api/convert', (req, res) => {
  const { sourceFile, profile, options } = req.body;
  if (!sourceFile) return res.status(400).json({ error: 'Source file is required' });
  
  const sourcePath = path.join(downloadsDir, sourceFile);
  if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'Source file not found' });
  
  const jobId = crypto.randomUUID();
  const timestamp = Date.now();
  
  let outExt = 'mp4';
  if (options && options.format) {
    outExt = options.format.toLowerCase();
  } else if (profile && profile.includes('HLS')) {
    outExt = 'm3u8';
  }
  
  const safeSourceFile = sanitizeFilenamePart(path.basename(sourceFile, path.extname(sourceFile)));
  const outputBaseName = `converted_${timestamp}_${safeSourceFile}`;
  const outputPath = path.join(downloadsDir, `${outputBaseName}.${outExt}`);
  
  let ffmpegCmd = `ffmpeg -y -i "${sourcePath}"`;
  
  if (options && options.custom) {
    if (options.vcodec) ffmpegCmd += ` -c:v ${options.vcodec}`;
    if (options.acodec) ffmpegCmd += ` -c:a ${options.acodec}`;
    if (options.bitrate) ffmpegCmd += ` -b:v ${options.bitrate}`;
    if (options.fps) ffmpegCmd += ` -r ${options.fps}`;
    if (options.resolution) ffmpegCmd += ` -vf scale=${options.resolution}`;
    if (options.trimStart) ffmpegCmd += ` -ss ${options.trimStart}`;
    if (options.trimEnd) ffmpegCmd += ` -to ${options.trimEnd}`;
  } else if (profile) {
    if (profile === 'Mobile Low') {
      ffmpegCmd += ' -vf scale=-2:240 -c:v libx264 -b:v 400k -c:a aac -b:a 64k';
    } else if (profile === 'Mobile Medium') {
      ffmpegCmd += ' -vf scale=-2:480 -c:v libx264 -b:v 1000k -c:a aac -b:a 128k';
    } else if (profile === 'Mobile High') {
      ffmpegCmd += ' -vf scale=-2:720 -c:v libx264 -b:v 2500k -c:a aac -b:a 192k';
    } else if (profile === 'Console PlayStation') {
      ffmpegCmd += ' -c:v libx264 -preset fast -profile:v high -level 4.1 -b:v 4000k -c:a aac -b:a 256k';
    } else if (profile === 'Console Xbox') {
      ffmpegCmd += ' -c:v libx264 -preset fast -profile:v main -level 4.1 -b:v 4000k -c:a aac -b:a 256k';
    } else if (profile === 'Web HLS') {
      ffmpegCmd += ' -c:v libx264 -c:a aac -f hls -hls_time 10 -hls_list_size 0';
    } else if (profile === 'Web DASH') {
      ffmpegCmd += ' -c:v libx264 -c:a aac -f dash';
    } else if (profile === 'Web Optimized MP4') {
      ffmpegCmd += ' -c:v libx264 -c:a aac -movflags +faststart';
    }
  }
  
  ffmpegCmd += ` "${outputPath}"`;
  console.log('Running conversion:', ffmpegCmd);
  
  conversionJobs.set(jobId, { status: 'Processing', progress: 0, resultUrl: null, error: null });
  
  const proc = exec(ffmpegCmd, { timeout: 7200000 });
  
  let totalDurationSec = 0;
  proc.stderr.on('data', (data) => {
    const output = data.toString();
    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
    if (durationMatch) {
      totalDurationSec = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]);
    }
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
    if (timeMatch && totalDurationSec > 0) {
      const currentSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
      const progress = Math.min(100, Math.round((currentSec / totalDurationSec) * 100));
      const job = conversionJobs.get(jobId);
      if (job) conversionJobs.set(jobId, { ...job, progress });
    }
  });
  
  proc.on('close', (code) => {
    if (code === 0) {
      conversionJobs.set(jobId, { status: 'Completed', progress: 100, resultUrl: `/api/download/file/${path.basename(outputPath)}`, error: null });
    } else {
      conversionJobs.set(jobId, { status: 'Failed', progress: 0, resultUrl: null, error: 'FFmpeg process failed with code ' + code });
    }
  });
  
  res.json({ jobId, message: 'Conversion started' });
});

app.get('/api/convert/status/:id', (req, res) => {
  const id = req.params.id;
  const job = conversionJobs.get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

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
      message: 'Next-Videos API Server',
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

// Start the server
app.listen(PORT, () => {
  console.log(`Next-Videos server running on port ${PORT}`);
  console.log(`Downloads directory: ${downloadsDir}`);
  console.log(`API endpoints:`);
  console.log(`  - GET /api/health`);
  console.log(`  - GET /api/video-info?url=VIDEO_URL`);
  console.log(`  - POST /api/download`);
});
