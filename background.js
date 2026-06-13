// Show welcome page on first install only
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// Intercept WA doc downloads → redirect to WA_Media folder
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (
    item.referrer.includes('web.whatsapp.com') ||
    item.url.includes('whatsapp.net') ||
    item.url.includes('web.whatsapp.com')
  ) {
    suggest({
      filename: `WA_Media/${item.filename}`,
      conflictAction: 'uniquify'
    });
  } else {
    suggest();
  }
});

// Handle media downloads
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'downloadMedia') {
    const items = msg.media;
    let completed = 0;

    if (!items || items.length === 0) {
      sendResponse({ done: true, total: 0 });
      return true;
    }

    items.forEach((item, index) => {
      setTimeout(() => {
        chrome.downloads.download({
          url: item.url,
          filename: `WA_Media/${item.filename}`,
          saveAs: false,
          conflictAction: 'uniquify'
        }, () => {
          completed++;
          chrome.runtime.sendMessage({
            action: 'progress',
            completed,
            total: items.length
          });
        });
      }, index * 300);
    });

    sendResponse({ started: true, total: items.length });
  }
  return true;
});
