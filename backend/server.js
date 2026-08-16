const path = require('path');
const fs = require('fs');

// Load env if available with explicit path
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) { }

const express = require('express');
const cors = require('cors');
const play = require('play-dl');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const QRCode = require('qrcode');

// Cross-platform binary resolvers
const isWindows = process.platform === 'win32';

const getYtDlpPath = () => {
  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    return process.env.YT_DLP_PATH;
  }

  const candidates = isWindows
    ? [
        path.join(__dirname, 'venv', 'Scripts', 'yt-dlp.exe'),
        path.join(__dirname, '..', 'venv', 'Scripts', 'yt-dlp.exe'),
        path.join(__dirname, 'bin', 'yt-dlp.exe'),
        path.join(__dirname, '..', 'bin', 'yt-dlp.exe')
      ]
    : [
        path.join(__dirname, 'venv', 'bin', 'yt-dlp'),
        path.join(__dirname, '..', 'venv', 'bin', 'yt-dlp'),
        path.join(__dirname, 'bin', 'yt-dlp'),
        path.join(__dirname, '..', 'bin', 'yt-dlp'),
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp'
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return isWindows ? 'yt-dlp.exe' : 'yt-dlp';
};

const getFfmpegPath = () => {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localBin = isWindows
    ? path.join(__dirname, 'bin', 'ffmpeg.exe')
    : path.join(__dirname, 'bin', 'ffmpeg');
  if (fs.existsSync(localBin)) return localBin;
  return isWindows ? 'ffmpeg.exe' : 'ffmpeg';
};

const getFfprobePath = () => {
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }
  const localBin = isWindows
    ? path.join(__dirname, 'bin', 'ffprobe.exe')
    : path.join(__dirname, 'bin', 'ffprobe');
  if (fs.existsSync(localBin)) return localBin;
  return isWindows ? 'ffprobe.exe' : 'ffprobe';
};

const getNodePath = () => {
  return process.execPath || (isWindows ? 'node.exe' : 'node');
};

const getFfmpegLocationFlag = () => {
  const localBin = path.join(__dirname, 'bin');
  const localFfmpeg = isWindows ? path.join(localBin, 'ffmpeg.exe') : path.join(localBin, 'ffmpeg');
  if (fs.existsSync(localFfmpeg)) {
    return `--ffmpeg-location "${localBin}"`;
  }
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return `--ffmpeg-location "${path.dirname(process.env.FFMPEG_PATH)}"`;
  }
  return '';
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
        `"${getFfprobePath()}" -v quiet -print_format json -show_streams -select_streams a "${streamUrl}"`,
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
    } catch (_) { }
  }
  return tracks;
}

function getNativeLanguageName(code) {
  if (!code || code === 'default' || code === 'und') return null;
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    return dn.of(code);
  } catch (_) {
    return null;
  }
}

// Auto-extract audio track display name directly from YouTube format metadata
function extractAudioTrackName(format) {
  let note = format.format_note || '';

  // Clean out quality descriptions like "low", "medium", "high", "DRC", "(default)"
  let cleanNote = note
    .replace(/\b(?:ultra[- ]?low|tiny|low|medium|high|standard|drc|original)\b/gi, '')
    .replace(/\s*\(default\)/gi, '')
    .replace(/^[\s,–\-:]+|[\s,–\-:]+$/g, '')
    .trim();

  const langCode = format.language;
  const standardName = getNativeLanguageName(langCode);

  if (cleanNote && cleanNote.length > 1 && !/^\d+k?$/i.test(cleanNote)) {
    return cleanNote;
  }

  if (standardName) {
    return standardName;
  }

  if (langCode && langCode !== 'und' && langCode !== 'default') {
    return langCode.toUpperCase();
  }

  return 'Original Audio';
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
  const nodePath = getNodePath();
  const cookies = getCookiesFlag();
  const metadataTimeout = 40000;

  // Query with player_client=all,default and audio-multistreams to discover all audio tracks & dubs
  let cmd = `"${getYtDlpPath()}" --dump-json --no-download --audio-multistreams ${getFfmpegLocationFlag()} --js-runtimes "node:${nodePath}" ${cookies} --extractor-args "youtube:player_client=all,default" "${url}"`;

  try {
    const result = await execPromise(cmd, { timeout: metadataTimeout, maxBuffer: 25 * 1024 * 1024 });
    return JSON.parse(result.stdout);
  } catch (err) {
    if (err.stdout && err.stdout.trim().startsWith('{')) {
      return JSON.parse(err.stdout);
    }

    console.log(`yt-dlp multi-client metadata failed (${err.message?.slice(0, 100)}), falling back to standard...`);
    cmd = `"${getYtDlpPath()}" --dump-json --no-download --audio-multistreams ${getFfmpegLocationFlag()} --js-runtimes "node:${nodePath}" ${cookies} "${url}"`;
    const result = await execPromise(cmd, { timeout: metadataTimeout, maxBuffer: 25 * 1024 * 1024 });
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
  return `ln-lyarinet-${uniqueNumber}`;
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
  const nodePath = getNodePath();
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
  const dlClients = cookies ? 'tv' : 'android,web';
  const dlClientArg = `--extractor-args "youtube:player_client=${dlClients}"`;
  const selectedAudioFormat = selectedAudioFormats[0];
  let tempVideoPath = null;
  let tempAudioPath = null;

  const audioDownloadCmd = `"${getYtDlpPath()}" --newline --progress --no-mtime ${getFfmpegLocationFlag()} ${cookies} ${jsRuntime} ${dlClientArg} ` +
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

    const videoDownloadCmd = `"${getYtDlpPath()}" --newline --progress --no-mtime ${getFfmpegLocationFlag()} ${cookies} ${jsRuntime} ${dlClientArg} ` +
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
    ffmpegCmd = `"${getFfmpegPath()}" -y -i "${tempAudioPath}" -map 0:a:0 -metadata:s:a:0 language=${ffmpegLanguageTag} -c:a ${codec} "${outPath}"`;
  } else {
    outputExt = 'mkv';
    const outPath = `${outputTemplate}.${outputExt}`;
    ffmpegCmd = `"${getFfmpegPath()}" -y -i "${tempVideoPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -metadata:s:a:0 language=${ffmpegLanguageTag} -c copy "${outPath}"`;
  }

  await execPromise(ffmpegCmd, { timeout: 3600000 });

  try { if (tempVideoPath) fs.unlinkSync(tempVideoPath); } catch (_) { }
  try { if (tempAudioPath) fs.unlinkSync(tempAudioPath); } catch (_) { }

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
  const ffmpegCmd = `"${getFfmpegPath()}" -y ${ffmpegInputs} ${ffmpegMaps} ${ffmpegMetadata} -c copy "${outPath}"`;

  await execPromise(ffmpegCmd, { timeout: 3600000 });

  const outputFileName = `${path.basename(outputTemplate)}.mkv`;
  downloadProgressMap.set(downloadId, {
    progress: 100,
    downloadUrl: `/api/download/file/${outputFileName}`,
    error: null
  });
}

const app = express();
const PORT = process.env.PORT || 3005;
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

// Ensure tmp_uploads directory exists
const tmpUploadsDir = path.join(__dirname, 'tmp_uploads');
if (!fs.existsSync(tmpUploadsDir)) {
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
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

const multer = require('multer');
const upload = multer({ dest: tmpUploadsDir });

// Workspace User Authentication Routes
app.post(['/api/auth/register', '/auth/register'], (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    const usersData = readUsersData();
    const existing = usersData.users.find(u => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const newUser = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      password: hashPassword(password),
      preset: defaultWorkspacePreset(),
      downloadHistory: [],
      createdAt: new Date().toISOString()
    };

    usersData.users.push(newUser);
    writeUsersData(usersData);

    const token = crypto.randomBytes(32).toString('hex');
    userSessions.set(token, newUser.id);

    console.log(`[Workspace Auth] Registered new user: ${cleanUsername} (${cleanEmail})`);
    res.json({
      token,
      user: publicUser(newUser),
      preset: newUser.preset,
      downloadHistory: newUser.downloadHistory
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account', message: err.message });
  }
});

app.post(['/api/auth/login', '/auth/login'], (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanIdentifier = String(email).trim().toLowerCase();
    const usersData = readUsersData();
    const user = usersData.users.find(u => (u.email && u.email.toLowerCase() === cleanIdentifier) || (u.username && u.username.toLowerCase() === cleanIdentifier));

    const storedHash = user ? (user.passwordHash || user.password) : null;
    if (!user || !verifyPassword(password, storedHash)) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    userSessions.set(token, user.id);

    console.log(`[Workspace Auth] User logged in: ${user.username}`);
    res.json({
      token,
      user: publicUser(user),
      preset: user.preset || defaultWorkspacePreset(),
      downloadHistory: user.downloadHistory || []
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login', message: err.message });
  }
});

app.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
  const token = getUserTokenFromRequest(req);
  if (token) {
    userSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out' });
});

app.get(['/api/workspace', '/api/auth/me'], verifyUser, (req, res) => {
  res.json({
    user: publicUser(req.user),
    preset: req.user.preset || defaultWorkspacePreset(),
    downloadHistory: req.user.downloadHistory || []
  });
});

app.post(['/api/user/preset', '/api/workspace/preset'], verifyUser, (req, res) => {
  const sanitized = sanitizeWorkspacePreset(req.body);
  const updatedUser = updateUserRecord(req.user.id, (user) => ({
    ...user,
    preset: sanitized
  }));
  res.json({ success: true, preset: updatedUser.preset });
});

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

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token && token === adminToken) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized admin access' });
};

// Admin Login
app.post(['/api/admin/login', '/admin/login'], (req, res) => {
  const { username, password } = req.body;
  if (username === adminUsername && password === adminPassword) {
    return res.json({ token: adminToken, message: 'Admin authenticated successfully' });
  }
  res.status(401).json({ error: 'Invalid admin credentials' });
});

// Site Configuration endpoints
app.get(['/api/config', '/config'], (req, res) => {
  try {
    if (fs.existsSync(configFilePath)) {
      const data = JSON.parse(fs.readFileSync(configFilePath, 'utf8') || '{}');
      return res.json(data);
    }
    res.json({});
  } catch (err) {
    res.status(500).json({ error: 'Failed to read site config' });
  }
});

app.post(['/api/config', '/config'], verifyAdmin, (req, res) => {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(req.body, null, 2));
    res.json({ message: 'Configuration saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// YouTube Cookies Management for Admin
app.get(['/api/admin/cookies-status', '/admin/cookies-status'], verifyAdmin, (req, res) => {
  const cookiesPath = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    const stats = fs.statSync(cookiesPath);
    return res.json({ exists: true, size: stats.size, modified: stats.mtime });
  }
  res.json({ exists: false });
});

app.post(['/api/admin/upload-cookies', '/admin/upload-cookies'], verifyAdmin, upload.single('cookies'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const cookiesPath = path.join(__dirname, 'cookies.txt');
  fs.rename(req.file.path, cookiesPath, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save cookies.txt' });
    res.json({ message: 'cookies.txt uploaded successfully' });
  });
});

app.delete(['/api/admin/cookies', '/admin/cookies'], verifyAdmin, (req, res) => {
  const cookiesPath = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    fs.unlinkSync(cookiesPath);
  }
  res.json({ message: 'cookies.txt removed' });
});

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

      // Extract unique audio tracks directly from YouTube's video formats
      const audioFormats = videoData.formats ? videoData.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none') : [];
      const trackMap = new Map();

      for (const f of audioFormats) {
        let langCode = f.language;
        if (!langCode && f.format_note) {
          const match = f.format_note.match(/\[([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)?)\]/);
          if (match) langCode = match[1];
        }
        if (!langCode && f.format_id) {
          const match = f.format_id.match(/[-_]([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)?)$/);
          if (match) langCode = match[1];
        }
        if (!langCode) {
          langCode = 'default';
        }

        const normCode = normalizeLanguageCode(langCode);
        if (!trackMap.has(normCode)) {
          trackMap.set(normCode, {
            code: normCode,
            name: extractAudioTrackName(f)
          });
        }
      }

      let languages = [...trackMap.values()];

      // Deep probing fallback if enabled
      if (ENABLE_DEEP_AUDIO_PROBE && languages.length <= 1 && audioFormats.length > 0) {
        const probed = await probeAudioTracksFromFormats(audioFormats);
        if (probed.length > languages.length) {
          languages = probed;
        }
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

      console.log('Video info fetched:', responseData.title, '| audio tracks detected:', languages.length);
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
            audioTracks: []
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

    // Native yt-dlp download pipeline with direct audio track selection and multi-audio support
    const dlNodePath = getNodePath();
    const plainCookies = getCookiesFlag();
    let cmd = `"${getYtDlpPath()}" --newline --progress --no-mtime ${getFfmpegLocationFlag()} ${plainCookies} --embed-metadata --js-runtimes "node:${dlNodePath}" --extractor-args "youtube:player_client=all" --retries 20 --fragment-retries 20 --file-access-retries 10`;
    cmd += ` -o "${outputTemplate}.%(ext)s"`;

    if (quality.startsWith('Audio (') || quality === 'Audio Only') {
      let audioFormat = 'mp3';
      if (format.toLowerCase() === 'm4a') audioFormat = 'm4a';
      else if (format.toLowerCase() === 'wav') audioFormat = 'wav';
      else if (format.toLowerCase() === 'flac') audioFormat = 'flac';
      else if (format.toLowerCase() === 'opus') audioFormat = 'opus';

      if (audioTrack && audioTrack !== 'default' && audioTrack !== 'all') {
        cmd += ` --audio-multistreams -f "bestaudio[language=${audioTrack}]/bestaudio[language*=${audioTrack}]/bestaudio" -S "lang:${audioTrack}"`;
      } else {
        cmd += ' -f bestaudio';
      }
      cmd += ` -x --audio-format ${audioFormat} --audio-quality 0 --extract-audio`;
    } else {
      const qualityMap = { '4K (2160p)': '2160', '2K (1440p)': '1440', '1080p HD': '1080', '720p HD': '720', '480p': '480', '360p': '360', '240p (320x240)': '240', '144p': '144' };
      const maxHeight = qualityMap[quality] || '720';

      if (audioTrack === 'all') {
        // Multi-audio streams download into MKV container with all audio tracks (prioritizing stable m4a streams)
        cmd += ` --audio-multistreams -f "bestvideo[height<=${maxHeight}]+mergeall[format_id^=140]/bestvideo[height<=${maxHeight}]+mergeall[format_id^=251]/bestvideo[height<=${maxHeight}]+mergeall[vcodec=none]/best[height<=${maxHeight}]" --merge-output-format mkv`;
      } else if (audioTrack && audioTrack !== 'default') {
        // Specific language audio track merged with video
        cmd += ` --audio-multistreams -f "bestvideo[height<=${maxHeight}]+bestaudio[language=${audioTrack}]/bestvideo[height<=${maxHeight}]+bestaudio[language*=${audioTrack}]/bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best" -S "lang:${audioTrack}" --merge-output-format mp4`;
      } else {
        // Default original audio track
        cmd += ` -f "bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best" --merge-output-format mp4`;
      }
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
      setTimeout(() => cleanOrphanAndOldDownloads(6, 15 * 60 * 1000), 3000);
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

// Serve downloaded files (supports both /api/download/file and /download/file)
app.get(['/api/download/file/:filename', '/download/file/:filename'], (req, res) => {
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

// Stream video files with HTTP 206 Range support for smooth HTML5 player seeking
app.get(['/api/stream/file/:filename', '/stream/file/:filename'], (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(downloadsDir, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.3gp': 'video/3gpp'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filepath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filepath).pipe(res);
  }
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

// Generic QR generator — encodes any URL as an SVG. Used by the
// "Send to Phone" flow on the desktop to share a finished download.
app.get('/api/qr', (req, res) => {
  const data = typeof req.query.data === 'string' ? req.query.data : '';
  if (!data || data.length > 2048) {
    return res.status(400).json({ error: 'invalid_data' });
  }
  QRCode.toString(data, {
    type: 'svg',
    margin: 1,
    width: 256,
    color: { dark: '#0f172a', light: '#ffffff' }
  })
    .then((svg) => {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(svg);
    })
    .catch(() => res.status(500).json({ error: 'qr_failed' }));
});

// === Mobile QR Handoff: pair desktop and phone via short-lived session ===
// Desktop creates a session, opens an SSE listener, and renders a QR.
// Phone scans the QR -> hits the mobile page -> submits a URL ->
// backend pushes the URL down the SSE stream -> desktop auto-loads it.
const PAIR_SESSION_TTL_MS = 15 * 60 * 1000;
const pairSessions = new Map();

const buildPublicBaseUrl = (req) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

const cleanupPairSessions = () => {
  const now = Date.now();
  for (const [id, session] of pairSessions) {
    if (session.expiresAt < now) {
      try { session.listener && session.listener.end(); } catch (_) {}
      pairSessions.delete(id);
    }
  }
};
setInterval(cleanupPairSessions, 60 * 1000);

app.post('/api/pair/create', (req, res) => {
  cleanupPairSessions();
  const sessionId = crypto.randomBytes(8).toString('hex');
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + PAIR_SESSION_TTL_MS;
  pairSessions.set(sessionId, { token, expiresAt, listener: null });

  let base = buildPublicBaseUrl(req);
  const requestedBase = req.body && typeof req.body.baseUrl === 'string' ? req.body.baseUrl : '';
  if (requestedBase) {
    try {
      const parsed = new URL(requestedBase);
      base = `${parsed.protocol}//${parsed.host}`;
    } catch (_) { /* fall back to request-derived base */ }
  }
  const mobileUrl = `${base}/m/${sessionId}#${token}`;

  QRCode.toString(mobileUrl, { type: 'svg', margin: 1, width: 256, color: { dark: '#0f172a', light: '#ffffff' } })
    .then((qrSvg) => {
      res.json({ sessionId, token, mobileUrl, qrSvg, expiresAt });
    })
    .catch((err) => {
      console.error('QR generation failed:', err);
      res.status(500).json({ error: 'qr_generation_failed' });
    });
});

app.get('/api/pair/listen/:id', (req, res) => {
  const id = req.params.id;
  const session = pairSessions.get(id);
  if (!session) {
    return res.status(404).end();
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  res.write(`data: ${JSON.stringify({ type: 'ready' })}\n\n`);
  session.listener = res;

  const heartbeat = setInterval(() => {
    try { res.write(': hb\n\n'); } catch (_) {}
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (session.listener === res) session.listener = null;
  });
});

app.post('/api/pair/submit/:id', (req, res) => {
  const id = req.params.id;
  const { url, token } = req.body || {};
  const session = pairSessions.get(id);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  if (session.expiresAt < Date.now()) {
    pairSessions.delete(id);
    return res.status(410).json({ error: 'session_expired' });
  }
  if (!token || token !== session.token) {
    return res.status(403).json({ error: 'invalid_token' });
  }
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'invalid_url' });
  }
  try { new URL(url); } catch { return res.status(400).json({ error: 'invalid_url' }); }
  if (!session.listener) {
    return res.status(409).json({ error: 'desktop_offline' });
  }
  try {
    session.listener.write(`data: ${JSON.stringify({ type: 'url', url })}\n\n`);
  } catch (e) {
    return res.status(500).json({ error: 'push_failed' });
  }
  res.json({ ok: true });
});

// Mobile pairing page — minimal HTML, no SPA dependency, works on any phone.
app.get('/m/:id', (req, res) => {
  const id = req.params.id;
  const session = pairSessions.get(id);
  const expired = !session || session.expiresAt < Date.now();
  const submitEndpoint = `/api/pair/submit/${encodeURIComponent(id)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Send to Desktop · Next-Videos</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh;
    background: radial-gradient(circle at top, #1e1b3a, #0b0b14 60%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 420px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px; padding: 24px;
    backdrop-filter: blur(8px);
  }
  h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; background: linear-gradient(90deg,#f87171,#fb923c,#fbbf24); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p.lead { margin: 0 0 20px; color: #cbd5e1; font-size: 14px; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  textarea {
    width: 100%; min-height: 92px; padding: 12px;
    background: rgba(0,0,0,0.35); color: #fff;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px; font-size: 16px; resize: none;
    -webkit-user-select: text; user-select: text;
  }
  textarea:focus { outline: none; border-color: rgba(248,113,113,0.6); box-shadow: 0 0 0 4px rgba(248,113,113,0.15); }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  button {
    flex: 1; height: 48px; border: 0; border-radius: 12px; font-size: 15px; font-weight: 600;
    cursor: pointer; transition: transform 0.05s, opacity 0.2s;
  }
  button:active { transform: scale(0.98); }
  .primary { background: linear-gradient(90deg,#ef4444,#f97316); color: #fff; }
  .secondary { background: rgba(255,255,255,0.08); color: #fff; }
  .status { margin-top: 16px; min-height: 22px; font-size: 14px; text-align: center; }
  .status.ok { color: #4ade80; }
  .status.err { color: #fca5a5; }
  .expired { text-align: center; color: #fca5a5; }
  .footer { margin-top: 18px; font-size: 12px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <h1>📱 → 💻 Send to Desktop</h1>
    <p class="lead">Paste a video link and it will appear instantly on your desktop's Next-Videos.</p>
    ${expired ? `
      <div class="expired">⚠️ This pairing has expired.<br/>Go back to your desktop and scan a new QR code.</div>
    ` : `
      <label for="url">Video URL</label>
      <textarea id="url" placeholder="https://…" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
      <div class="row">
        <button class="secondary" id="paste">Paste</button>
        <button class="primary" id="send">Send →</button>
      </div>
      <div id="status" class="status"></div>
    `}
    <div class="footer">One-tap handoff · token ${expired ? 'expired' : 'active for 15 min'}</div>
  </div>
${expired ? '' : `
<script>
(function () {
  var token = (location.hash || '').slice(1);
  var endpoint = ${JSON.stringify(submitEndpoint)};
  var urlEl = document.getElementById('url');
  var statusEl = document.getElementById('status');
  var sendBtn = document.getElementById('send');
  var pasteBtn = document.getElementById('paste');

  // Auto-prefill from clipboard if available and looks like a URL
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(function (txt) {
      if (txt && /^https?:\\/\\//i.test(txt.trim())) urlEl.value = txt.trim();
    }).catch(function(){});
  }

  pasteBtn.addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (txt) {
        if (txt) urlEl.value = txt.trim();
      }).catch(function () {
        urlEl.focus();
      });
    } else {
      urlEl.focus();
    }
  });

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status ' + (kind || '');
  }

  sendBtn.addEventListener('click', function () {
    var url = (urlEl.value || '').trim();
    if (!url) { setStatus('Paste a URL first.', 'err'); return; }
    try { new URL(url); } catch (_) { setStatus('That doesn\\'t look like a valid URL.', 'err'); return; }

    sendBtn.disabled = true;
    setStatus('Sending…', '');
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, token: token })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        sendBtn.disabled = false;
        if (res.ok) {
          setStatus('✅ Sent to desktop!', 'ok');
          urlEl.value = '';
        } else {
          var msg = (res.j && res.j.error) || 'send_failed';
          if (msg === 'desktop_offline') setStatus('Desktop is offline. Reopen the QR on desktop.', 'err');
          else if (msg === 'session_expired' || msg === 'session_not_found') setStatus('Session expired. Scan a new QR.', 'err');
          else if (msg === 'invalid_token') setStatus('Token invalid. Scan a new QR.', 'err');
          else setStatus('Error: ' + msg, 'err');
        }
      })
      .catch(function () { sendBtn.disabled = false; setStatus('Network error.', 'err'); });
  });
})();
</script>`}
</body>
</html>`);
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

// Video Converter & Hardware Acceleration
const conversionJobs = new Map();

// Helper to determine hardware-accelerated video encoder
function resolveVideoEncoder(hwaccelMode, customCodec) {
  if (customCodec && customCodec !== 'libx264' && customCodec !== 'auto') {
    return { vcodec: customCodec, extraFlags: '' };
  }

  switch (hwaccelMode) {
    case 'nvenc':
    case 'nvidia':
      return { vcodec: 'h264_nvenc', extraFlags: '-preset p4 -rc vbr -cq 23' };
    case 'qsv':
    case 'intel':
      return { vcodec: 'h264_qsv', extraFlags: '-global_quality 23' };
    case 'amf':
    case 'amd':
      return { vcodec: 'h264_amf', extraFlags: '-quality balanced' };
    case 'videotoolbox':
    case 'apple':
      return { vcodec: 'h264_videotoolbox', extraFlags: '-q:v 65' };
    default:
      return { vcodec: 'libx264', extraFlags: '' };
  }
}

// Endpoint to probe GPU hardware acceleration capabilities
app.get('/api/system/gpu-capabilities', (req, res) => {
  const ffmpeg = getFfmpegPath();
  exec(`"${ffmpeg}" -encoders`, (err, stdout) => {
    if (err) {
      return res.json({
        available: false,
        encoders: [],
        nvenc: false,
        qsv: false,
        amf: false,
        videotoolbox: false
      });
    }

    const hasNvenc = stdout.includes('h264_nvenc') || stdout.includes('hevc_nvenc');
    const hasQsv = stdout.includes('h264_qsv') || stdout.includes('hevc_qsv');
    const hasAmf = stdout.includes('h264_amf') || stdout.includes('hevc_amf');
    const hasVideotoolbox = stdout.includes('h264_videotoolbox');

    res.json({
      available: hasNvenc || hasQsv || hasAmf || hasVideotoolbox,
      nvenc: hasNvenc,
      qsv: hasQsv,
      amf: hasAmf,
      videotoolbox: hasVideotoolbox,
      recommended: hasNvenc ? 'nvenc' : (hasQsv ? 'qsv' : (hasAmf ? 'amf' : 'off'))
    });
  });
});

app.get('/api/convert/files', (req, res) => {
  try {
    const user = getUserFromRequest(req);
    let files = [];

    if (user && user.downloadHistory) {
      const userFiles = user.downloadHistory
        .filter(entry => entry.status === 'completed' && entry.fileName)
        .map(entry => entry.fileName);

      files = userFiles.filter(file => fs.existsSync(path.join(downloadsDir, file)));
    }

    // Include all completed media files present in downloads directory
    if (fs.existsSync(downloadsDir)) {
      const validMediaExts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.ts', '.m4a', '.mp3', '.wav', '.flac', '.aac', '.ogg', '.3gp'];
      const dirFiles = fs.readdirSync(downloadsDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        const isIntermediate = /\.f\d+([-\w]*)\./i.test(f) || /\.temp\./i.test(f);
        return validMediaExts.includes(ext) && !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.tmp') && !isIntermediate;
      });
      files = [...files, ...dirFiles];
    }

    files = [...new Set(files)];
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Purge all files in downloads directory
app.post(['/api/downloads/clean-all', '/api/admin/clean-downloads'], (req, res) => {
  try {
    if (!fs.existsSync(downloadsDir)) {
      return res.json({ success: true, count: 0, message: 'Downloads directory is empty' });
    }

    const files = fs.readdirSync(downloadsDir);
    let deletedCount = 0;

    files.forEach(file => {
      if (file.startsWith('.')) return; // Keep hidden files like .gitkeep
      const fp = path.join(downloadsDir, file);
      try {
        if (fs.statSync(fp).isFile()) {
          fs.unlinkSync(fp);
          deletedCount++;
        }
      } catch (e) {
        console.error(`Failed to delete ${file}:`, e.message);
      }
    });

    console.log(`[Storage Cleanup] Purged ${deletedCount} files from downloads directory`);
    res.json({ success: true, count: deletedCount, message: `Successfully deleted ${deletedCount} downloaded media files.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clean downloads directory', message: err.message });
  }
});

app.post('/api/convert', (req, res) => {
  const { sourceFile, profile, options, hwaccel } = req.body;
  if (!sourceFile) return res.status(400).json({ error: 'Source file is required' });

  const sourcePath = path.join(downloadsDir, sourceFile);
  if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'Source file not found' });

  const jobId = crypto.randomUUID();
  const timestamp = Date.now();

  let outExt = 'mp4';
  if (options && options.format) {
    outExt = options.format.toLowerCase();
  } else if (profile && (profile.includes('3GP') || profile.includes('Feature Phone'))) {
    outExt = '3gp';
  } else if (profile && profile.includes('HLS')) {
    outExt = 'm3u8';
  }

  const safeSourceFile = sanitizeFilenamePart(path.basename(sourceFile, path.extname(sourceFile)));
  const outputBaseName = `converted_${timestamp}_${safeSourceFile}`;
  const outputPath = path.join(downloadsDir, `${outputBaseName}.${outExt}`);

  // Resolve video encoder based on explicit user setting (Default is Software libx264)
  const selectedHwaccel = (options && options.hwaccel) || hwaccel || 'off';
  const { vcodec, extraFlags } = resolveVideoEncoder(selectedHwaccel, options?.vcodec);

  let ffmpegCmd = `"${getFfmpegPath()}" -y -i "${sourcePath}"`;

  if (options && options.custom) {
    ffmpegCmd += ` -c:v ${vcodec}`;
    if (extraFlags) ffmpegCmd += ` ${extraFlags}`;
    if (options.acodec) ffmpegCmd += ` -c:a ${options.acodec}`;
    if (options.bitrate) ffmpegCmd += ` -b:v ${options.bitrate}`;
    if (options.fps) ffmpegCmd += ` -r ${options.fps}`;
    if (options.resolution) ffmpegCmd += ` -vf scale=${options.resolution}`;
    if (options.trimStart) ffmpegCmd += ` -ss ${options.trimStart}`;
    if (options.trimEnd) ffmpegCmd += ` -to ${options.trimEnd}`;
  } else if (profile) {
    if (profile === 'Feature Phone 3GP (176x144 QCIF / H.263 / AMR)' || profile === 'Feature Phone (QCIF 176x144)') {
      // Classic Nokia / Java / Keypad Phone format (176x144, 15fps, H.263, AMR-NB 8kHz)
      ffmpegCmd += ` -s 176x144 -r 15 -c:v h263 -b:v 128k -c:a amr_nb -ar 8000 -ac 1 -b:a 12.2k`;
    } else if (profile === 'Feature Phone 3GP (320x240 QVGA / MPEG-4 / AAC)' || profile === 'Feature Phone (QVGA 320x240)') {
      // High Quality 3GP format for color keypad phones (320x240, 20fps, MPEG-4, AAC)
      ffmpegCmd += ` -s 320x240 -r 20 -c:v mpeg4 -b:v 320k -c:a aac -ar 32000 -ac 2 -b:a 48k`;
    } else if (profile === 'Mobile Low') {
      ffmpegCmd += ` -vf scale=-2:240 -c:v ${vcodec} ${extraFlags} -b:v 400k -c:a aac -b:a 64k`;
    } else if (profile === 'Mobile Medium') {
      ffmpegCmd += ` -vf scale=-2:480 -c:v ${vcodec} ${extraFlags} -b:v 1000k -c:a aac -b:a 128k`;
    } else if (profile === 'Mobile High') {
      ffmpegCmd += ` -vf scale=-2:720 -c:v ${vcodec} ${extraFlags} -b:v 2500k -c:a aac -b:a 192k`;
    } else if (profile === 'Console PlayStation') {
      ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -preset fast -profile:v high -level 4.1 -b:v 4000k -c:a aac -b:a 256k`;
    } else if (profile === 'Console Xbox') {
      ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -preset fast -profile:v main -level 4.1 -b:v 4000k -c:a aac -b:a 256k`;
    } else if (profile === 'Web HLS') {
      ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -c:a aac -f hls -hls_time 10 -hls_list_size 0`;
    } else if (profile === 'Web DASH') {
      ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -c:a aac -f dash`;
    } else if (profile === 'Web Optimized MP4') {
      ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -c:a aac -movflags +faststart`;
    }
  }

  ffmpegCmd += ` "${outputPath}"`;
  console.log(`[Conversion Job ${jobId}] HWAccel: ${selectedHwaccel} | Command:`, ffmpegCmd);

  conversionJobs.set(jobId, { status: 'Processing', progress: 0, resultUrl: null, error: null, hwaccel: selectedHwaccel });

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
      // If hardware acceleration failed, attempt automatic fallback to software CPU libx264
      if (selectedHwaccel !== 'off') {
        console.warn(`[Conversion Job ${jobId}] HW Acceleration failed with code ${code}. Attempting CPU fallback...`);
        const fallbackCmd = ffmpegCmd.replace(new RegExp(`-c:v ${vcodec}[^ ]*`, 'g'), '-c:v libx264');
        exec(fallbackCmd, { timeout: 7200000 }, (fbErr) => {
          if (!fbErr && fs.existsSync(outputPath)) {
            conversionJobs.set(jobId, { status: 'Completed', progress: 100, resultUrl: `/api/download/file/${path.basename(outputPath)}`, error: null, fallbackUsed: true });
          } else {
            conversionJobs.set(jobId, { status: 'Failed', progress: 0, resultUrl: null, error: `Conversion failed (Hardware encoder error code ${code})` });
          }
        });
      } else {
        conversionJobs.set(jobId, { status: 'Failed', progress: 0, resultUrl: null, error: 'FFmpeg process failed with code ' + code });
      }
    }
  });

  res.json({ jobId, message: 'Conversion started', hwaccel: selectedHwaccel });
});

app.get('/api/convert/status/:id', (req, res) => {
  const id = req.params.id;
  const job = conversionJobs.get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Real-time Video Splitter & Segment Trimming Engine
const splitJobs = new Map();

app.post('/api/video/split', (req, res) => {
  const { sourceFile, mode = 'trim', startTime = 0, endTime = 0, partDuration = 30, lossless = true, format = 'mp4', hwaccel = 'off' } = req.body;

  if (!sourceFile) return res.status(400).json({ error: 'Source file is required' });
  const sourcePath = path.join(downloadsDir, sourceFile);
  if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'Source file not found' });

  const jobId = crypto.randomUUID();
  const timestamp = Date.now();
  const safeBaseName = sanitizeFilenamePart(path.basename(sourceFile, path.extname(sourceFile)));

  splitJobs.set(jobId, {
    status: 'Processing',
    progress: 10,
    sourceFile,
    createdAt: new Date().toISOString()
  });

  res.json({ jobId, message: 'Splitting job initiated' });

  (async () => {
    try {
      if (mode === 'trim') {
        const outExt = format ? format.toLowerCase() : 'mp4';
        const outputFileName = `split_${timestamp}_${safeBaseName}.${outExt}`;
        const outputPath = path.join(downloadsDir, outputFileName);

        const duration = Math.max(0.1, endTime - startTime);
        let ffmpegCmd = `"${getFfmpegPath()}" -y -ss ${startTime} -i "${sourcePath}" -t ${duration}`;

        if (outExt === '3gp') {
          // Feature Phone 3GP compliant encoding (320x240, 20fps, MPEG-4, AAC)
          ffmpegCmd += ` -s 320x240 -r 20 -c:v mpeg4 -b:v 320k -c:a aac -ar 32000 -ac 2 -b:a 48k "${outputPath}"`;
        } else if (outExt === 'mp3') {
          ffmpegCmd += ` -vn -c:a mp3 -b:a 192k "${outputPath}"`;
        } else if (lossless && (outExt === 'mp4' || outExt === 'mkv')) {
          // Lossless ultra-fast stream copy
          ffmpegCmd += ` -c copy "${outputPath}"`;
        } else {
          const { vcodec, extraFlags } = resolveVideoEncoder(hwaccel);
          ffmpegCmd += ` -c:v ${vcodec} ${extraFlags} -c:a aac -b:a 192k "${outputPath}"`;
        }

        console.log('[VideoSplitter] Executing trim:', ffmpegCmd);
        await execPromise(ffmpegCmd);

        splitJobs.set(jobId, {
          status: 'Completed',
          progress: 100,
          outputFile: outputFileName,
          downloadUrl: `/api/download/file/${outputFileName}`
        });
      } else if (mode === 'equal_parts') {
        // Split into equal segments of partDuration (for WhatsApp / Reels / Shorts)
        const segmentDuration = Math.max(5, parseInt(partDuration) || 30);
        const outputPattern = `part_%03d_${timestamp}_${safeBaseName}.mp4`;
        const outputPathPattern = path.join(downloadsDir, outputPattern);

        let ffmpegCmd = `"${getFfmpegPath()}" -y -i "${sourcePath}" -c copy -map 0 -segment_time ${segmentDuration} -f segment -reset_timestamps 1 "${outputPathPattern}"`;
        console.log('[VideoSplitter] Executing equal parts split:', ffmpegCmd);
        await execPromise(ffmpegCmd);

        const allFiles = fs.readdirSync(downloadsDir);
        const partFiles = allFiles
          .filter(f => f.startsWith('part_') && f.includes(String(timestamp)))
          .map(f => ({ name: f, url: `/api/download/file/${f}` }));

        splitJobs.set(jobId, {
          status: 'Completed',
          progress: 100,
          parts: partFiles,
          outputFile: partFiles[0]?.name,
          downloadUrl: partFiles[0]?.url
        });
      }
    } catch (err) {
      console.error('[VideoSplitter] Split error:', err);
      splitJobs.set(jobId, {
        status: 'Failed',
        error: err.message
      });
    }
  })();
});

app.get('/api/video/split/status/:id', (req, res) => {
  const id = req.params.id;
  const job = splitJobs.get(id);
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

// Automated Disk Hygiene Engine
// Automatically deletes orphan temporary fragments and trims downloads to retain only the most recent files
function cleanOrphanAndOldDownloads(maxKeep = 6, maxAgeMs = 15 * 60 * 1000) {
  try {
    if (!fs.existsSync(downloadsDir)) return;
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();

    // 1. Immediately delete orphan temporary / fragment / intermediate files
    files.forEach(file => {
      if (file.startsWith('.')) return;
      const isTemporary = file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.tmp') || /\.f\d+([-\w]*)\./i.test(file) || /\.temp\./i.test(file);
      const filePath = path.join(downloadsDir, file);
      try {
        const stat = fs.statSync(filePath);
        // Delete temporary fragments older than 1 minute or files older than maxAgeMs
        if (isTemporary && (now - stat.mtimeMs > 60000)) {
          fs.unlinkSync(filePath);
          console.log(`[Auto-Clean] Deleted temporary fragment: ${file}`);
        } else if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          console.log(`[Auto-Clean] Deleted expired file (>15min): ${file}`);
        }
      } catch (_) {}
    });

    // 2. Keep only the most recent 'maxKeep' completed media files (prevent disk accumulation)
    const validMediaExts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.ts', '.m4a', '.mp3', '.wav', '.flac', '.aac', '.ogg', '.3gp'];
    const remainingFiles = fs.readdirSync(downloadsDir)
      .filter(f => !f.startsWith('.') && validMediaExts.includes(path.extname(f).toLowerCase()))
      .map(f => {
        const fp = path.join(downloadsDir, f);
        try {
          return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (remainingFiles.length > maxKeep) {
      const toDelete = remainingFiles.slice(maxKeep);
      toDelete.forEach(item => {
        try {
          fs.unlinkSync(item.path);
          console.log(`[Auto-Clean] Removed excess old download to free space: ${item.name}`);
        } catch (_) {}
      });
    }
  } catch (err) {
    console.error('[Auto-Clean] Error during cleanup:', err.message);
  }
}

// Run auto-cleanup every 2 minutes
setInterval(() => {
  cleanOrphanAndOldDownloads(6, 15 * 60 * 1000);
}, 2 * 60 * 1000);

// Run initial cleanup on server startup
cleanOrphanAndOldDownloads(6, 15 * 60 * 1000);

// Start the server
app.listen(PORT, () => {
  console.log(`Next-Videos server running on port ${PORT}`);
  console.log(`Downloads directory: ${downloadsDir}`);
  console.log(`API endpoints:`);
  console.log(`  - GET /api/health`);
  console.log(`  - GET /api/video-info?url=VIDEO_URL`);
  console.log(`  - POST /api/download`);
});
