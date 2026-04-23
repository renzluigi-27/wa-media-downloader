const scanBtn = document.getElementById('scanBtn');
const downloadBtn = document.getElementById('downloadBtn');
const countEl = document.getElementById('count');
const doneEl = document.getElementById('done');
const statusEl = document.getElementById('status');
const progressWrap = document.getElementById('progress-wrap');
const progressFill = document.getElementById('progress-fill');
const filtersEl = document.getElementById('filters');

let scanned = null;
let currentTab = null;
let selected = { docs: false, images: false, videos: false, audio: false };
let selectedDocExts = {}; // e.g. { pdf: true, docx: false }

// --- Media type toggles ---
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    selected[type] = !selected[type];
    btn.classList.toggle('inactive', !selected[type]);

    // Show/hide doc ext toggles
    if (type === 'docs') {
      const extWrap = document.getElementById('doc-ext-filters');
      if (extWrap) extWrap.style.display = selected.docs ? 'flex' : 'none';
    }

    updateDownloadLabel();
  });
});

function getSelectedDocExts() {
  return Object.keys(selectedDocExts).filter(ext => selectedDocExts[ext]);
}

function countSelectedDocs() {
  if (!scanned) return 0;
  const exts = getSelectedDocExts();
  if (!selected.docs || exts.length === 0) return 0;
  return scanned.docs.filter(d => {
    const ext = d.filename.split('.').pop().toLowerCase();
    return exts.includes(ext);
  }).length;
}

function updateDownloadLabel() {
  if (!scanned) return;
  let total = countSelectedDocs();
  if (selected.images) total += scanned.images.length;
  if (selected.videos) total += scanned.videos.length;
  if (selected.audio) total += scanned.audio.length;
  countEl.textContent = total;
  downloadBtn.textContent = `Download Selected (${total})`;
}

// --- STEP 1: Scan ---
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusEl.textContent = 'Scanning...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  chrome.tabs.sendMessage(tab.id, { action: 'scanMedia' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      statusEl.textContent = 'Error: Reload WhatsApp Web and try again.';
      scanBtn.disabled = false;
      return;
    }

    scanned = res;

    // Build media type toggles
    filtersEl.style.display = 'flex';
    const types = ['docs', 'images', 'videos', 'audio'];
    types.forEach(type => {
      const count = res[type].length;
      document.getElementById(`f${type}`).textContent = count;
      const btn = document.getElementById(`filter-${type}`);
      if (count === 0) {
        btn.style.display = 'none';
        selected[type] = false;
      }
    });

    // Build doc extension sub-toggles
    if (res.docs.length > 0) {
      const extCount = {};
      res.docs.forEach(d => {
        const ext = d.filename.split('.').pop().toLowerCase();
        extCount[ext] = (extCount[ext] || 0) + 1;
      });

      // Init all ext as false
      selectedDocExts = {};
      Object.keys(extCount).forEach(ext => { selectedDocExts[ext] = false; });

      // Build ext toggle buttons
      let extWrap = document.getElementById('doc-ext-filters');
      if (!extWrap) {
        extWrap = document.createElement('div');
        extWrap.id = 'doc-ext-filters';
        extWrap.style.cssText = 'display:none; flex-wrap:wrap; gap:6px; margin-bottom:12px; padding-left:8px;';
        filtersEl.insertAdjacentElement('afterend', extWrap);
      }
      extWrap.innerHTML = '';

      Object.keys(extCount).forEach(ext => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn inactive';
        btn.style.fontSize = '11px';
        btn.textContent = `.${ext.toUpperCase()} (${extCount[ext]})`;
        btn.addEventListener('click', () => {
          selectedDocExts[ext] = !selectedDocExts[ext];
          btn.classList.toggle('inactive', !selectedDocExts[ext]);
          updateDownloadLabel();
        });
        extWrap.appendChild(btn);
      });
    }

    updateDownloadLabel();
    statusEl.textContent = 'Select types then download.';
    scanBtn.style.display = 'none';
    downloadBtn.style.display = 'block';
  });
});

// --- STEP 2: Download ---
downloadBtn.addEventListener('click', () => {
  downloadBtn.disabled = true;
  progressWrap.style.display = 'block';
  doneEl.textContent = '0';

  const allowedExt = getSelectedDocExts();

  // Click docs via content.js (filtered by ext)
  if (selected.docs && allowedExt.length > 0) {
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'clickDocs',
      allowedExt
    }, () => {});
  }

  // Download other media
  const mediaItems = [
    ...(selected.images ? scanned.images : []),
    ...(selected.videos ? scanned.videos : []),
    ...(selected.audio ? scanned.audio : [])
  ];
  if (mediaItems.length > 0) {
    chrome.runtime.sendMessage({ action: 'downloadMedia', media: mediaItems }, () => {});
  }

  const total = parseInt(countEl.textContent || '0');
  statusEl.textContent = `Downloading ${total} file(s)...`;
});

// --- Progress ---
let doneCount = 0;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'docProgress' || msg.action === 'progress') {
    doneCount++;
    doneEl.textContent = doneCount;
    const total = parseInt(countEl.textContent || '1');
    progressFill.style.width = `${Math.round((doneCount / total) * 100)}%`;

    if (doneCount >= total) {
      statusEl.textContent = `✅ Done! ${doneCount} file(s) downloaded.`;
      downloadBtn.disabled = false;
    }
  }
});