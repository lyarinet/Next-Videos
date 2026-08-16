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
      const appUrl = `${serverUrl}/#url=${encodeURIComponent(targetUrl)}`;
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
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#f97316' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});
