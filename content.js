chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // --- SCAN: find all media + docs ---
  if (msg.action === 'scanMedia') {
    const results = { docs: [], images: [], videos: [], audio: [] };

    // Docs — via document-thumb buttons
    document.querySelectorAll('[data-testid="document-thumb"]').forEach(btn => {
      const title = btn.getAttribute('title') || '';
      const match = title.match(/Download "(.+?)"/);
      const filename = match ? match[1] : 'unknown_file';
      results.docs.push({ filename, element: null }); // element not serializable
    });

    // Images
    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      if (src.startsWith('blob:') || src.includes('whatsapp.net')) {
        results.images.push({ url: src, filename: `wa_image_${results.images.length + 1}.jpg` });
      }
    });

    // Videos
    document.querySelectorAll('video[src], video source[src]').forEach(el => {
      if (el.src && (el.src.startsWith('blob:') || el.src.includes('whatsapp.net'))) {
        results.videos.push({ url: el.src, filename: `wa_video_${results.videos.length + 1}.mp4` });
      }
    });

    // Audio
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

  // --- DOWNLOAD DOCS: click each button with delay ---
  if (msg.action === 'clickDocs') {
    const buttons = document.querySelectorAll('[data-testid="document-thumb"]');
    let clicked = 0;

    buttons.forEach((btn, i) => {
      setTimeout(() => {
        btn.click();
        clicked++;
        chrome.runtime.sendMessage({
          action: 'docProgress',
          completed: clicked,
          total: buttons.length
        });
      }, i * 1500); // 1.5s between each click
    });

    sendResponse({ started: true, total: buttons.length });
  }

  return true;
});