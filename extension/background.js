const DEFAULT_SERVER_URL = 'http://localhost:3005';

// Supported platform domains for active badge indication
const SUPPORTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'fb.watch',
  'twitter.com',
  'x.com',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
  'reddit.com',
  'soundcloud.com',
  'bilibili.com',
  'rumble.com'
];

// Initialize Context Menus on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'next-videos-download-link',
    title: 'Download Video with Next-Videos',
    contexts: ['link', 'video', 'audio', 'page']
  });

  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (!result.serverUrl) {
      chrome.storage.sync.set({ serverUrl: DEFAULT_SERVER_URL });
    }
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'next-videos-download-link') {
    const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
    if (!targetUrl) return;

    chrome.storage.sync.get(['serverUrl'], (result) => {
      const serverUrl = (result.serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
      const appUrl = `${serverUrl}/?url=${encodeURIComponent(targetUrl)}`;
      chrome.tabs.create({ url: appUrl });
    });
  }
});

// Detect when user visits supported video site and display badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && changeInfo.status === 'complete') {
    const isSupported = SUPPORTED_DOMAINS.some(domain => tab.url.includes(domain));
    if (isSupported) {
      chrome.action.setBadgeText({ tabId, text: 'VIDEO' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#0099DE' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});

// Persistent Background Download Engine
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startBackgroundDownload') {
    const { videoInfo, option, audioTrack, serverUrl } = request.payload;
    const downloadId = Date.now().toString();

    const activeDownload = {
      downloadId,
      url: videoInfo.url,
      title: videoInfo.title || 'Video',
      thumbnail: videoInfo.thumbnail || '',
      platform: videoInfo.platform || 'Video',
      duration: videoInfo.duration || '',
      channel: videoInfo.channel || '',
      quality: option.quality,
      format: option.format,
      progress: 0,
      status: 'downloading',
      error: null,
      serverUrl: serverUrl || DEFAULT_SERVER_URL,
      startedAt: Date.now()
    };

    chrome.storage.local.set({ activeDownload });
    executeBackgroundDownload(activeDownload, audioTrack);

    sendResponse({ success: true, activeDownload });
    return true;
  }

  if (request.action === 'cancelActiveDownload') {
    chrome.storage.local.remove(['activeDownload'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Execute Download and monitor SSE progress persistently in Background Service Worker
 */
async function executeBackgroundDownload(activeDownload, audioTrack) {
  const { downloadId, url, quality, format, serverUrl } = activeDownload;

  try {
    const response = await fetch(`${serverUrl}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        quality,
        format,
        downloadId,
        audioTrack: audioTrack || 'default'
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || 'Server rejected download request');
    }

    const eventSourceUrl = `${serverUrl}/api/progress/${downloadId}`;
    const sseResponse = await fetch(eventSourceUrl);
    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop();

      for (const chunk of chunks) {
        if (chunk.startsWith('data:')) {
          try {
            const data = JSON.parse(chunk.replace(/^data:\s*/, ''));

            if (data.progress !== undefined) {
              activeDownload.progress = Math.min(Math.round(data.progress), 100);
              activeDownload.status = 'downloading';
              chrome.storage.local.set({ activeDownload });

              chrome.runtime.sendMessage({
                action: 'downloadProgressUpdate',
                activeDownload
              }).catch(() => {});
            }

            if (data.downloadUrl) {
              const downloadPath = data.downloadUrl.startsWith('/') ? data.downloadUrl : `/${data.downloadUrl}`;
              const finalFileUrl = `${serverUrl}${downloadPath}`;

              activeDownload.progress = 100;
              activeDownload.status = 'finished';
              activeDownload.finishedAt = Date.now();
              activeDownload.downloadUrl = finalFileUrl;
              chrome.storage.local.set({ activeDownload });

              // Native Chrome Download
              chrome.downloads.download({
                url: finalFileUrl,
                saveAs: false
              }, () => {
                if (chrome.runtime.lastError) {
                  chrome.tabs.create({ url: finalFileUrl });
                }
              });

              chrome.runtime.sendMessage({
                action: 'downloadProgressUpdate',
                activeDownload
              }).catch(() => {});

              // Auto-clear from storage after 6 seconds so next opens are fresh
              setTimeout(() => {
                chrome.storage.local.get(['activeDownload'], (res) => {
                  if (res.activeDownload && res.activeDownload.downloadId === downloadId && res.activeDownload.status === 'finished') {
                    chrome.storage.local.remove(['activeDownload']);
                  }
                });
              }, 6000);

              return;
            }

            if (data.error) {
              activeDownload.status = 'error';
              activeDownload.error = data.error;
              chrome.storage.local.set({ activeDownload });

              chrome.runtime.sendMessage({
                action: 'downloadProgressUpdate',
                activeDownload
              }).catch(() => {});

              setTimeout(() => {
                chrome.storage.local.remove(['activeDownload']);
              }, 5000);

              return;
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    activeDownload.status = 'error';
    activeDownload.error = err.message || 'Download failed';
    chrome.storage.local.set({ activeDownload });

    chrome.runtime.sendMessage({
      action: 'downloadProgressUpdate',
      activeDownload
    }).catch(() => {});

    setTimeout(() => {
      chrome.storage.local.remove(['activeDownload']);
    }, 5000);
  }
}
