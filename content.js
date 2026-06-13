let cancelDownload = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === 'cancelDownload') {
    cancelDownload = true;
    sendResponse({ ok: true });
  }

  // --- SCAN: find all media + docs ---
  if (msg.action === 'scanMedia') {
    const results = { docs: [], images: [], videos: [], audio: [] };

    document.querySelectorAll('[data-testid="document-thumb"]').forEach(btn => {
      const title = btn.getAttribute('title') || '';
      const match = title.match(/"(.+?)"/);
      const filename = match ? match[1] : 'unknown_file';
      results.docs.push({ filename, element: null });
    });

    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      if (src.startsWith('blob:') || src.includes('whatsapp.net')) {
        results.images.push({ url: src, filename: `wa_image_${results.images.length + 1}.jpg` });
      }
    });

    document.querySelectorAll('video[src], video source[src]').forEach(el => {
      if (el.src && (el.src.startsWith('blob:') || el.src.includes('whatsapp.net'))) {
        results.videos.push({ url: el.src, filename: `wa_video_${results.videos.length + 1}.mp4` });
      }
    });

    document.querySelectorAll('audio[src]').forEach(el => {
      if (el.src && (el.src.startsWith('blob:') || el.src.includes('whatsapp.net'))) {
        results.audio.push({ url: el.src, filename: `wa_audio_${results.audio.length + 1}.ogg` });
      }
    });

    sendResponse({
      docs: results.docs,
      images: results.images,
      videos: results.videos,
      audio: results.audio
    });
  }

  // --- DOWNLOAD DOCS: open preview → click Download → close → next ---
  if (msg.action === 'clickDocs') {
    const allowed = msg.allowedExt || [];
    const allButtons = document.querySelectorAll('[data-testid="document-thumb"]');

    const buttons = Array.from(allButtons).filter(btn => {
      const title = btn.getAttribute('title') || '';
      const match = title.match(/"(.+?)"/);
      if (!match) return false;
      const ext = match[1].split('.').pop().toLowerCase();
      return allowed.length === 0 || allowed.includes(ext);
    });

    cancelDownload = false;
    sendResponse({ started: true, total: buttons.length });

    (async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const find = sels => sels.map(s => document.querySelector(s)).find(Boolean);

      let done = 0;
      for (const btn of buttons) {

        // Check cancel before each file
        if (cancelDownload) {
          chrome.runtime.sendMessage({
            action: 'docProgress',
            completed: done,
            total: buttons.length,
            cancelled: true
          });
          break;
        }

        // 1) open preview
        btn.click();

        // 2) poll up to ~12s for the Download button
        let dl = null;
        for (let i = 0; i < 40; i++) {
          await wait(300);
          dl = find(['[aria-label="Download"]', '[data-icon="ic-download"]']);
          if (dl) break;
        }

        // 3) click Download
        if (dl) {
          (dl.closest('[role="button"],button,div[role="button"]') || dl).click();
          await wait(1800);
        }

        // 4) close preview
        let x = null;
        for (let i = 0; i < 20; i++) {
          x = find(['[aria-label="Close"]', '[data-icon="x-refreshed"]', '[data-icon="x"]']);
          if (x) break;
          await wait(200);
        }
        if (x) {
          (x.closest('[role="button"],button') || x).click();
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }
        await wait(1500);

        // 5) progress
        done++;
        chrome.runtime.sendMessage({
          action: 'docProgress',
          completed: done,
          total: buttons.length
        });
      }
    })();
  }

  return true;
});
