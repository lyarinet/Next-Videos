// Next-Videos Chrome Extension - Popup Logic

const DEFAULT_SERVER_URL = 'http://localhost:3005';
const CANDIDATE_PORTS = ['3005', '3000', '5000'];

let currentVideoInfo = null;
let activeDownloadEventSource = null;

// DOM Elements
const videoUrlInput = document.getElementById('videoUrlInput');
const pasteBtn = document.getElementById('pasteBtn');
const fetchBtn = document.getElementById('fetchBtn');
const fetchBtnText = document.getElementById('fetchBtnText');
const fetchSpinner = document.getElementById('fetchSpinner');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');
const previewCard = document.getElementById('previewCard');
const videoThumb = document.getElementById('videoThumb');
const videoTitle = document.getElementById('videoTitle');
const videoChannel = document.getElementById('videoChannel');
const videoDuration = document.getElementById('videoDuration');
const platformTag = document.getElementById('platformTag');
const audioTrackSection = document.getElementById('audioTrackSection');
const audioTrackSelect = document.getElementById('audioTrackSelect');
const formatsContainer = document.getElementById('formatsContainer');
const progressSection = document.getElementById('progressSection');
const progressStatus = document.getElementById('progressStatus');
const progressPercent = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const openAppBtn = document.getElementById('openAppBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const serverUrlInput = document.getElementById('serverUrlInput');

// Get configured Server URL or auto-detect working local port
async function getServerUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverUrl'], async (result) => {
      let savedUrl = (result.serverUrl || '').trim().replace(/\/$/, '');
      if (savedUrl) {
        // Test saved URL
        try {
          const res = await fetch(`${savedUrl}/api/health`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) return resolve(savedUrl);
        } catch (_) {}
      }

      // Auto-probe candidate ports
      for (const port of CANDIDATE_PORTS) {
        const testUrl = `http://localhost:${port}`;
        try {
          const res = await fetch(`${testUrl}/api/health`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) {
            chrome.storage.sync.set({ serverUrl: testUrl });
            if (serverUrlInput) serverUrlInput.value = testUrl;
            return resolve(testUrl);
          }
        } catch (_) {}
      }

      resolve(savedUrl || DEFAULT_SERVER_URL);
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load server URL in settings input
  const serverUrl = await getServerUrl();
  serverUrlInput.value = serverUrl;

  // Auto-detect URL from active Chrome tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      videoUrlInput.value = tab.url;
      // If on video site, auto-analyze
      if (
        tab.url.includes('youtube.com') ||
        tab.url.includes('youtu.be') ||
        tab.url.includes('instagram.com') ||
        tab.url.includes('tiktok.com') ||
        tab.url.includes('facebook.com') ||
        tab.url.includes('x.com') ||
        tab.url.includes('twitter.com') ||
        tab.url.includes('vimeo.com')
      ) {
        fetchVideoInfo(tab.url);
      }
    }
  } catch (e) {
    console.error('Error querying tab:', e);
  }
});

// Paste button
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      videoUrlInput.value = text.trim();
      fetchVideoInfo(videoUrlInput.value);
    }
  } catch (err) {
    console.error('Clipboard paste failed:', err);
  }
});

// Fetch button
fetchBtn.addEventListener('click', () => {
  const url = videoUrlInput.value.trim();
  if (url) {
    fetchVideoInfo(url);
  } else {
    showError('Please paste a valid video URL.');
  }
});

// Open in Full Web App
openAppBtn.addEventListener('click', async () => {
  const serverUrl = await getServerUrl();
  const currentUrl = videoUrlInput.value.trim();
  const appUrl = currentUrl ? `${serverUrl}/#url=${encodeURIComponent(currentUrl)}` : serverUrl;
  chrome.tabs.create({ url: appUrl });
});

// Settings Modal controls
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
  const newUrl = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  chrome.storage.sync.set({ serverUrl: newUrl }, () => {
    settingsModal.classList.add('hidden');
  });
});

// Fetch video info from Next-Videos API
async function fetchVideoInfo(url) {
  hideError();
  setLoading(true);
  previewCard.classList.add('hidden');
  progressSection.classList.add('hidden');

  try {
    const serverUrl = await getServerUrl();
    const apiUrl = `${serverUrl}/api/video-info?url=${encodeURIComponent(url)}`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    currentVideoInfo = data;
    renderVideoInfo(data, serverUrl);
  } catch (err) {
    showError(err.message || 'Failed to connect to Next-Videos server. Make sure the app backend is running on port 3005.');
  } finally {
    setLoading(false);
  }
}

// Render Video Metadata in UI
function renderVideoInfo(info, serverUrl = '') {
  let thumbUrl = 'icons/icon128.png';
  if (info.thumbnail) {
    thumbUrl = info.thumbnail.startsWith('/') ? `${serverUrl}${info.thumbnail}` : info.thumbnail;
  }
  videoThumb.src = thumbUrl;
  videoTitle.textContent = info.title || 'Untitled Video';
  videoChannel.textContent = info.channel ? `By ${info.channel}` : (info.views ? `${info.views} views` : '');
  videoDuration.textContent = info.duration || '';
  platformTag.textContent = info.platform || 'Video';

  // Audio track selector
  if (info.audioTracks && info.audioTracks.length > 0) {
    audioTrackSection.classList.remove('hidden');
    audioTrackSelect.innerHTML = `
      <option value="default">Default Audio (Best)</option>
      <option value="all">All Audio Tracks (MKV)</option>
    `;
    info.audioTracks.forEach(track => {
      const code = typeof track === 'string' ? track : track.code;
      const name = typeof track === 'string' ? track.toUpperCase() : track.name;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      audioTrackSelect.appendChild(opt);
    });
  } else {
    audioTrackSection.classList.add('hidden');
  }

  // Render format buttons
  formatsContainer.innerHTML = '';
  if (info.formats && info.formats.length > 0) {
    info.formats.forEach((fmt) => {
      const btn = document.createElement('button');
      btn.className = 'format-btn';
      btn.innerHTML = `
        <span class="format-quality">${fmt.quality}</span>
        <span class="format-details">${fmt.format} • ${fmt.size}</span>
      `;
      btn.addEventListener('click', () => startDownload(fmt));
      formatsContainer.appendChild(btn);
    });
  }

  previewCard.classList.remove('hidden');
}

// Start download handler
async function startDownload(option) {
  if (!currentVideoInfo) return;

  const serverUrl = await getServerUrl();
  const progressId = Date.now().toString();
  const selectedAudio = audioTrackSelect ? audioTrackSelect.value : 'default';

  progressSection.classList.remove('hidden');
  progressStatus.textContent = `Initializing ${option.quality}...`;
  progressPercent.textContent = '0%';
  progressBarFill.style.width = '0%';

  if (activeDownloadEventSource) {
    activeDownloadEventSource.close();
  }

  // Connect SSE for progress
  try {
    const sse = new EventSource(`${serverUrl}/api/progress/${progressId}`);
    activeDownloadEventSource = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) {
          const percent = Math.min(Math.round(data.progress), 100);
          progressPercent.textContent = `${percent}%`;
          progressBarFill.style.width = `${percent}%`;
          progressStatus.textContent = `Downloading ${option.quality}...`;
        }

        if (data.downloadUrl) {
          const downloadPath = data.downloadUrl.startsWith('/') ? data.downloadUrl : `/${data.downloadUrl}`;
          const finalUrl = `${serverUrl}${downloadPath}`;
          progressStatus.textContent = 'Download Complete!';
          progressPercent.textContent = '100%';
          progressBarFill.style.width = '100%';
          chrome.tabs.create({ url: finalUrl });
          sse.close();
        }

        if (data.error) {
          showError(data.error);
          sse.close();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    sse.onerror = () => {
      sse.close();
    };

    // Send Download Request to API
    const response = await fetch(`${serverUrl}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: currentVideoInfo.url || videoUrlInput.value.trim(),
        quality: option.quality,
        format: option.format,
        downloadId: progressId,
        audioTrack: selectedAudio
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || 'Download initialization failed');
    }
  } catch (err) {
    showError(err.message || 'Download error occurred.');
  }
}

// Helpers
function setLoading(loading) {
  if (loading) {
    fetchBtn.disabled = true;
    fetchBtnText.classList.add('hidden');
    fetchSpinner.classList.remove('hidden');
  } else {
    fetchBtn.disabled = false;
    fetchBtnText.classList.remove('hidden');
    fetchSpinner.classList.add('hidden');
  }
}

function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.classList.add('hidden');
}
