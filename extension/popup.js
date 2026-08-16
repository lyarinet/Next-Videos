// Next-Videos Chrome Extension - Persistent Popup Logic

const DEFAULT_SERVER_URL = 'http://localhost:3005';
const CANDIDATE_PORTS = ['3005', '3000', '5000'];

let currentVideoInfo = null;
let currentServerUrl = DEFAULT_SERVER_URL;

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
const openAppBtn = document.getElementById('openAppBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const serverUrlInput = document.getElementById('serverUrlInput');

// Persistent Active Download Elements
const activeDownloadCard = document.getElementById('activeDownloadCard');
const activeThumb = document.getElementById('activeThumb');
const activeTitle = document.getElementById('activeTitle');
const activeQuality = document.getElementById('activeQuality');
const activeDuration = document.getElementById('activeDuration');
const activePlatformTag = document.getElementById('activePlatformTag');
const activeProgressStatus = document.getElementById('activeProgressStatus');
const activeProgressPercent = document.getElementById('activeProgressPercent');
const activeProgressBarFill = document.getElementById('activeProgressBarFill');
const dismissActiveBtn = document.getElementById('dismissActiveBtn');

// Handle image load fallbacks
if (videoThumb) videoThumb.onerror = () => { videoThumb.src = 'icons/icon128.png'; };
if (activeThumb) activeThumb.onerror = () => { activeThumb.src = 'icons/icon128.png'; };

// Get configured Server URL or auto-detect working local port
async function getServerUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverUrl'], async (result) => {
      let savedUrl = (result.serverUrl || '').trim().replace(/\/$/, '');
      if (savedUrl) {
        try {
          const res = await fetch(`${savedUrl}/api/health`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) {
            currentServerUrl = savedUrl;
            return resolve(savedUrl);
          }
        } catch (_) {}
      }

      for (const port of CANDIDATE_PORTS) {
        const testUrl = `http://localhost:${port}`;
        try {
          const res = await fetch(`${testUrl}/api/health`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) {
            chrome.storage.sync.set({ serverUrl: testUrl });
            if (serverUrlInput) serverUrlInput.value = testUrl;
            currentServerUrl = testUrl;
            return resolve(testUrl);
          }
        } catch (_) {}
      }

      currentServerUrl = savedUrl || DEFAULT_SERVER_URL;
      resolve(currentServerUrl);
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const serverUrl = await getServerUrl();
  if (serverUrlInput) serverUrlInput.value = serverUrl;

  let currentTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
  } catch (e) {}

  // 1. Check if there is an active background download
  chrome.storage.local.get(['activeDownload'], async (result) => {
    const active = result.activeDownload;

    if (active && active.status === 'downloading') {
      renderActiveDownload(active);
      return;
    }

    if (active && active.status === 'finished') {
      // If user switched to another tab or finished more than 3 seconds ago, clear it
      const timeSinceFinish = Date.now() - (active.finishedAt || 0);
      const isDifferentTab = currentTab && currentTab.url && currentTab.url !== active.url;

      if (timeSinceFinish > 3000 || isDifferentTab) {
        chrome.storage.local.remove(['activeDownload']);
        handleTabAutoDetect(currentTab);
      } else {
        renderActiveDownload(active);
        // Transition after 3 seconds to active tab
        setTimeout(() => {
          chrome.storage.local.remove(['activeDownload'], () => {
            handleTabAutoDetect(currentTab);
          });
        }, 3000);
      }
      return;
    }

    // 2. Fresh open: auto-detect URL from active tab
    handleTabAutoDetect(currentTab);
  });
});

function handleTabAutoDetect(tab) {
  if (tab && tab.url && tab.url.startsWith('http')) {
    videoUrlInput.value = tab.url;
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
}

// Listen to real-time progress updates from Background Service Worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'downloadProgressUpdate' && msg.activeDownload) {
    renderActiveDownload(msg.activeDownload);

    // If just finished, auto dismiss after 3.5 seconds
    if (msg.activeDownload.status === 'finished') {
      setTimeout(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.storage.local.remove(['activeDownload'], () => {
          handleTabAutoDetect(tab);
        });
      }, 3500);
    }
  }
});

// Render Active Download Card
function renderActiveDownload(active) {
  if (!activeDownloadCard) return;

  hideError();
  previewCard.classList.add('hidden');
  activeDownloadCard.classList.remove('hidden');

  activeTitle.textContent = active.title || 'Downloading Video...';
  activeQuality.textContent = `${active.quality || 'Best Quality'} • ${active.format || 'MP4'}`;
  activeDuration.textContent = active.duration || '';
  activePlatformTag.textContent = active.platform || 'Next-Videos';

  let thumbUrl = 'icons/icon128.png';
  if (active.thumbnail) {
    thumbUrl = active.thumbnail.startsWith('/') ? `${currentServerUrl}${active.thumbnail}` : active.thumbnail;
  }
  activeThumb.src = thumbUrl;

  const pct = active.progress || 0;
  activeProgressPercent.textContent = `${pct}%`;
  activeProgressBarFill.style.width = `${pct}%`;

  if (active.status === 'finished') {
    activeProgressStatus.textContent = '✅ Download Complete! Saved to Downloads.';
    activeProgressBarFill.style.background = '#10b981';
    dismissActiveBtn.textContent = 'Download Another Video';
  } else if (active.status === 'error') {
    activeProgressStatus.textContent = `❌ ${active.error || 'Download Error'}`;
    activeProgressBarFill.style.background = '#ef4444';
    dismissActiveBtn.textContent = 'Try Another Video';
  } else {
    activeProgressStatus.textContent = `Downloading in background (${pct}%)...`;
    activeProgressBarFill.style.background = 'linear-gradient(90deg, #0047BA, #0099DE)';
    dismissActiveBtn.textContent = 'Download Another Video';
  }
}

// Dismiss active download to start fresh
dismissActiveBtn.addEventListener('click', async () => {
  chrome.storage.local.remove(['activeDownload'], async () => {
    activeDownloadCard.classList.add('hidden');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    handleTabAutoDetect(tab);
  });
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
  activeDownloadCard.classList.add('hidden');

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
    const firstTrack = info.audioTracks[0];
    const firstName = firstTrack ? (typeof firstTrack === 'string' ? firstTrack : firstTrack.name) : 'Original';
    let opts = `<option value="default">⭐ ${info.audioTracks.length === 1 ? `${firstName} (Original)` : `Default Audio (${firstName})`}</option>`;
    if (info.audioTracks.length > 1) {
      opts += '<option value="all">🎵 All Audio Tracks (MKV)</option>';
      info.audioTracks.forEach(track => {
        const code = typeof track === 'string' ? track : track.code;
        const name = typeof track === 'string' ? track.toUpperCase() : track.name;
        if (code && code !== 'default' && code !== 'all') {
          opts += `<option value="${code}">🎙️ ${name}</option>`;
        }
      });
    }
    audioTrackSelect.innerHTML = opts;
  } else {
    audioTrackSection.classList.add('hidden');
  }

  // Re-render formats when audio track selection changes (e.g. MKV for all tracks)
  audioTrackSelect.onchange = () => {
    renderFormatList(info);
  };

  renderFormatList(info);
  previewCard.classList.remove('hidden');
}

function renderFormatList(info) {
  formatsContainer.innerHTML = '';
  if (!info || !info.formats || info.formats.length === 0) return;

  const isAllAudio = audioTrackSelect && audioTrackSelect.value === 'all';

  info.formats.forEach((fmt) => {
    const isAudio = (fmt.quality || '').startsWith('Audio');
    const dispFmt = (!isAudio && isAllAudio) ? 'MKV' : (fmt.format || 'MP4');
    const upperFmt = dispFmt.toUpperCase();

    let badgeClass = 'fmt-badge-mp4';
    if (upperFmt === 'MKV') badgeClass = 'fmt-badge-mkv';
    else if (upperFmt === '3GP') badgeClass = 'fmt-badge-3gp';
    else if (upperFmt === 'MP3') badgeClass = 'fmt-badge-mp3';
    else if (upperFmt === 'M4A') badgeClass = 'fmt-badge-m4a';

    const btn = document.createElement('button');
    btn.className = 'format-btn';
    btn.innerHTML = `
      <div class="fmt-badge-box ${badgeClass}">
        <span class="fmt-badge-text">${upperFmt}</span>
      </div>
      <div class="fmt-info">
        <span class="format-quality">${fmt.quality}</span>
        <span class="format-details">${dispFmt} • ${fmt.size}</span>
      </div>
    `;
    btn.addEventListener('click', () => startPersistentDownload(fmt));
    formatsContainer.appendChild(btn);
  });
}

// Start download via Background Service Worker
async function startPersistentDownload(option) {
  if (!currentVideoInfo) return;

  const serverUrl = await getServerUrl();
  const selectedAudio = audioTrackSelect ? audioTrackSelect.value : 'default';

  chrome.runtime.sendMessage({
    action: 'startBackgroundDownload',
    payload: {
      videoInfo: currentVideoInfo,
      option,
      audioTrack: selectedAudio,
      serverUrl
    }
  }, (res) => {
    if (res && res.activeDownload) {
      renderActiveDownload(res.activeDownload);
    }
  });
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
