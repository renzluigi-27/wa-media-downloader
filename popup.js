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

// --- Toggle filter buttons ---
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    selected[type] = !selected[type];
    btn.classList.toggle('inactive', !selected[type]);
    updateDownloadLabel();
  });
});

function updateDownloadLabel() {
  if (!scanned) return;
  let total = 0;
  if (selected.docs) total += scanned.docs.length;
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

    // Show/hide filters based on count
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

  let total = 0;
  if (selected.docs) total += scanned.docs.length;
  if (selected.images) total += scanned.images.length;
  if (selected.videos) total += scanned.videos.length;
  if (selected.audio) total += scanned.audio.length;
  countEl.textContent = total;

  // Click docs
  if (selected.docs && scanned.docs.length > 0) {
    chrome.tabs.sendMessage(currentTab.id, { action: 'clickDocs' }, () => {});
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