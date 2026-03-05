// API Config
const API_BASE_URL = 'https://video-downloader-production-f0a1.up.railway.app';

// DOM Elements
const ytToggle = document.getElementById('ytToggle');
const ttToggle = document.getElementById('ttToggle');
const form = document.getElementById('downloadForm');
const urlInput = document.getElementById('videoUrl');
const fetchBtn = document.getElementById('fetchBtn');
const btnText = fetchBtn.querySelector('.btn-text');
const btnSpinner = fetchBtn.querySelector('.spinner');

const resultCard = document.getElementById('resultCard');
const videoThumb = document.getElementById('videoThumb');
const videoTitle = document.getElementById('videoTitle');
const videoDuration = document.getElementById('videoDuration');
const formatSelect = document.getElementById('formatSelect');
const startDownloadBtn = document.getElementById('startDownloadBtn');

const progressSection = document.getElementById('progressSection');
const progressStatusText = document.getElementById('progressStatusText');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const finalDownloadLink = document.getElementById('finalDownloadLink');
const toastContainer = document.getElementById('toastContainer');

let currentJobId = null;
let pollInterval = null;

// Helpers
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s].filter(Boolean).join(':');
}

function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Trigger reflow for animation
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function setLoadingState(isLoading, btn, textElement, originalText) {
    if (isLoading) {
        btn.disabled = true;
        textElement.textContent = 'Loading...';
        btn.querySelector('.spinner')?.classList.remove('hidden');
    } else {
        btn.disabled = false;
        textElement.textContent = originalText;
        btn.querySelector('.spinner')?.classList.add('hidden');
    }
}

// Event Listeners
const pasteBtn = document.getElementById('pasteBtn');
if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                showToast('Pasted from clipboard!', 'success');
            }
        } catch (err) {
            showToast('Unable to read clipboard. Please paste manually.', 'error');
            console.error('Failed to read clipboard: ', err);
        }
    });
}
ytToggle.addEventListener('click', () => {
    ytToggle.classList.add('active');
    ttToggle.classList.remove('active');
    urlInput.placeholder = 'https://www.youtube.com/watch?v=...';
    urlInput.value = '';
    urlInput.focus();
});

ttToggle.addEventListener('click', () => {
    ttToggle.classList.add('active');
    ytToggle.classList.remove('active');
    urlInput.placeholder = 'https://www.tiktok.com/@user/video/...';
    urlInput.value = '';
    urlInput.focus();
});

let vignetteLoaded = false;
function loadVignette() {
    if (!vignetteLoaded) {
        // Appends the exact snippet to the body
        (function (s) {
            s.dataset.zone = '10669202';
            s.src = 'https://gizokraijaw.net/vignette.min.js';
        })([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
        vignetteLoaded = true;
    }
}

// Preload the script slightly before the actual click so it can intercept the click event
fetchBtn.addEventListener('mouseenter', loadVignette, { once: true });
fetchBtn.addEventListener('touchstart', loadVignette, { once: true });
urlInput.addEventListener('focus', loadVignette, { once: true });

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Ensure it's loaded just in case they bypassed the hover/focus events
    loadVignette();

    const url = urlInput.value.trim();
    if (!url) return showToast('Please enter a valid URL', 'error');

    // Quick frontend validation based on selected tab
    const isTiktok = ttToggle.classList.contains('active');
    if (isTiktok && !url.includes('tiktok.')) {
        return showToast('Please enter a valid TikTok URL', 'error');
    } else if (!isTiktok && url.includes('tiktok.')) {
        return showToast('Please select the TikTok tab for TikTok links', 'error');
    }

    // Reset UI
    resultCard.classList.remove('visible');
    progressSection.classList.add('hidden');
    finalDownloadLink.classList.add('hidden');
    startDownloadBtn.classList.remove('hidden');
    startDownloadBtn.disabled = false;
    if (startDownloadBtn.querySelector('span')) {
        startDownloadBtn.querySelector('span').textContent = 'Download';
    } else {
        startDownloadBtn.textContent = 'Download';
    }
    setTimeout(() => resultCard.classList.add('hidden'), 300);

    setLoadingState(true, fetchBtn, btnText, 'Get Video');

    try {
        const response = await fetch(`${API_BASE_URL}/api/video/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch video info');
        }

        renderVideoInfo(data.data);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setLoadingState(false, fetchBtn, btnText, 'Get Video');
    }
});

function renderVideoInfo(data) {
    videoTitle.textContent = data.title;
    videoThumb.src = data.thumbnail;
    videoThumb.alt = `${data.title} - Video Thumbnail`;
    videoDuration.textContent = formatTime(data.duration);

    // Dynamically populate available formats and qualities
    formatSelect.innerHTML = '';
    data.formats.forEach(f => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ formatId: f.formatId, ext: 'mp4' });
        option.textContent = f.label;
        formatSelect.appendChild(option);
    });

    // Show result card smoothly
    resultCard.classList.remove('hidden');
    // Force reflow
    void resultCard.offsetWidth;
    resultCard.classList.add('visible');
}

startDownloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const formatDataStr = formatSelect.value;
    if (!formatDataStr) return;

    const formatData = JSON.parse(formatDataStr);

    startDownloadBtn.disabled = true;
    startDownloadBtn.querySelector('span').textContent = 'Starting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/video/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                format: formatData.formatId
            })
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.message || 'Download start failed');

        currentJobId = result.data.jobId;

        // Show progress UI elements
        progressSection.classList.remove('hidden');
        progressStatusText.textContent = 'Processing request...';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        startDownloadBtn.classList.add('hidden'); // hide download btn config

        startPolling();

    } catch (error) {
        showToast(error.message, 'error');
        startDownloadBtn.disabled = false;
        startDownloadBtn.querySelector('span').textContent = 'Download Now';
    }
});

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/video/status/${currentJobId}`);
            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.message || 'Error fetching status');
            }

            const data = result.data;

            if (data.state === 'completed') {
                clearInterval(pollInterval);
                finishDownload();
            } else if (data.state === 'failed') {
                clearInterval(pollInterval);
                showToast(data.failedReason || 'Download failed processing', 'error');
                resetDownloadBtn();
            } else {
                // 'active', 'waiting', 'delayed'
                let percent = 0;

                if (data.progress !== undefined && data.progress !== null) {
                    percent = typeof data.progress === 'number' ? data.progress : parseInt(data.progress) || 0;
                }

                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent.toFixed(0)}%`;

                if (percent < 99) {
                    progressStatusText.textContent = 'Downloading media...';
                } else {
                    progressStatusText.textContent = 'Merging files...';
                }
            }
        } catch (error) {
            console.error('Polling error', error);
            clearInterval(pollInterval);
            showToast(error.message || 'Connection lost. Please try again.', 'error');
            resetDownloadBtn();
        }
    }, 1000);
}

function finishDownload() {
    progressBar.style.width = `100%`;
    progressPercent.textContent = `100%`;
    progressStatusText.textContent = 'Ready!';

    finalDownloadLink.href = `${API_BASE_URL}/api/video/file/${currentJobId}`;
    finalDownloadLink.classList.remove('hidden');
    showToast('Processing complete! File is ready.', 'success');
}

function resetDownloadBtn() {
    startDownloadBtn.classList.remove('hidden');
    startDownloadBtn.disabled = false;
    startDownloadBtn.querySelector('span').textContent = 'Try Again';
    progressSection.classList.add('hidden');
}
