// SIFT Image Stitching Tool - Frontend Application
// State Management
const state = {
    overviewFile: null,
    closeupFiles: [],
    jobId: null,
    eventSource: null
};

// API Configuration
const API_BASE = window.location.origin;

// DOM Elements
const overviewDropZone = document.getElementById('overview-drop-zone');
const overviewInput = document.getElementById('overview-input');
const overviewPreview = document.getElementById('overview-preview');
const overviewPreviewImg = document.getElementById('overview-preview-img');
const overviewFilename = document.getElementById('overview-filename');

const closeupsDropZone = document.getElementById('closeups-drop-zone');
const closeupsInput = document.getElementById('closeups-input');
const closeupsPreview = document.getElementById('closeups-preview');
const closeupsPreviewGrid = document.getElementById('closeups-preview-grid');
const closeupCount = document.getElementById('closeup-count');

const canvasScale = document.getElementById('canvas-scale');
const canvasScaleValue = document.getElementById('canvas-scale-value');
const strength = document.getElementById('strength');
const strengthValue = document.getElementById('strength-value');
const siftMatches = document.getElementById('sift-matches');
const siftMatchesValue = document.getElementById('sift-matches-value');

const startBtn = document.getElementById('start-btn');
const progressPanel = document.getElementById('progress-panel');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const statusBadge = document.getElementById('status-badge');
const logContainer = document.getElementById('log-container');

const resultsPanel = document.getElementById('results-panel');
const resultImage = document.getElementById('result-image');
const downloadBtn = document.getElementById('download-btn');
const statSuccess = document.getElementById('stat-success');
const statSkip = document.getElementById('stat-skip');
const statTotal = document.getElementById('stat-total');

// Utility Functions
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ja-JP');
}

function updateStartButton() {
    startBtn.disabled = !(state.overviewFile && state.closeupFiles.length > 0);
}

function addLog(message, timestamp = null) {
    const time = timestamp ? formatTimestamp(timestamp) : new Date().toLocaleTimeString('ja-JP');
    const logEntry = document.createElement('div');
    logEntry.className = 'text-xs py-1';
    logEntry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = percent;
}

function updateStatus(status, text) {
    const statusClasses = {
        'processing': 'bg-blue-100 text-blue-800 status-badge',
        'completed': 'bg-green-100 text-green-800',
        'failed': 'bg-red-100 text-red-800',
        'uploaded': 'bg-yellow-100 text-yellow-800'
    };

    statusBadge.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`;
    statusBadge.textContent = text;
}

// File Handling
function handleOverviewFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
    }

    state.overviewFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        overviewPreviewImg.src = e.target.result;
        overviewFilename.textContent = file.name;
        overviewPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    updateStartButton();
}

function handleCloseupFiles(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        alert('画像ファイルを選択してください');
        return;
    }

    state.closeupFiles = imageFiles;
    closeupCount.textContent = imageFiles.length;

    closeupsPreviewGrid.innerHTML = '';

    imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-image rounded border';
            img.title = file.name;
            closeupsPreviewGrid.appendChild(img);
        };
        reader.readAsDataURL(file);
    });

    closeupsPreview.classList.remove('hidden');
    updateStartButton();
}

// Drag and Drop Handlers
function setupDropZone(dropZone, input, handler) {
    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handler(files);
        }
    });

    input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handler(files);
        }
    });
}

// API Calls
async function uploadFiles() {
    const formData = new FormData();
    formData.append('overview', state.overviewFile);

    state.closeupFiles.forEach((file) => {
        formData.append('closeups', file);
    });

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

async function startStitching(jobId, params) {
    try {
        const response = await fetch(`${API_BASE}/api/stitch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: jobId,
                params: params
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Stitching start failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Stitching error:', error);
        throw error;
    }
}

function streamProgress(jobId) {
    const eventSource = new EventSource(`${API_BASE}/api/stream/${jobId}`);
    state.eventSource = eventSource;

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'log':
                addLog(data.data.message, data.data.timestamp);
                break;

            case 'progress':
                updateProgress(data.data.progress);

                if (data.data.status === 'processing') {
                    updateStatus('processing', '処理中...');
                }
                break;

            case 'complete':
                updateProgress(100);
                updateStatus('completed', '完了');
                handleCompletion(data.data);
                eventSource.close();
                break;

            case 'error':
                updateStatus('failed', 'エラー');
                addLog(`エラー: ${data.data.error}`);
                eventSource.close();
                startBtn.disabled = false;
                break;
        }
    };

    eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
    };
}

function handleCompletion(stats) {
    statSuccess.textContent = stats.success_count || 0;
    statSkip.textContent = stats.skip_count || 0;
    statTotal.textContent = stats.total_closeups || 0;

    resultImage.src = `${API_BASE}/api/result/${state.jobId}?t=${Date.now()}`;

    resultsPanel.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.textContent = '再度合成';
}

// Main Process
async function processStitching() {
    try {
        startBtn.disabled = true;
        startBtn.textContent = '処理中...';

        progressPanel.classList.remove('hidden');
        resultsPanel.classList.add('hidden');
        logContainer.innerHTML = '';
        updateProgress(0);
        updateStatus('uploaded', 'アップロード中...');

        addLog('画像をアップロード中...');

        const uploadResult = await uploadFiles();
        state.jobId = uploadResult.job_id;

        addLog(`アップロード完了: Overview 1枚, Closeups ${uploadResult.closeup_count}枚`);

        const params = {
            canvas_scale: parseInt(canvasScale.value),
            strength: parseInt(strength.value),
            sift_min_matches: parseInt(siftMatches.value),
            sift_ratio_test: 0.75,
            ransac_threshold: 3.0
        };

        addLog('処理を開始します...');
        updateStatus('processing', '処理中...');

        await startStitching(state.jobId, params);

        streamProgress(state.jobId);

    } catch (error) {
        alert(`エラーが発生しました: ${error.message}`);
        addLog(`エラー: ${error.message}`);
        updateStatus('failed', 'エラー');
        startBtn.disabled = false;
        startBtn.textContent = '合成を開始';
    }
}

// Download Handler
downloadBtn.addEventListener('click', () => {
    if (state.jobId) {
        window.location.href = `${API_BASE}/api/download/${state.jobId}`;
    }
});

// Parameter Sliders
canvasScale.addEventListener('input', (e) => {
    canvasScaleValue.textContent = e.target.value;
});

strength.addEventListener('input', (e) => {
    strengthValue.textContent = e.target.value;
});

siftMatches.addEventListener('input', (e) => {
    siftMatchesValue.textContent = e.target.value;
});

// Start Button
startBtn.addEventListener('click', processStitching);

// Initialize
setupDropZone(overviewDropZone, overviewInput, (files) => {
    if (files[0]) handleOverviewFile(files[0]);
});

setupDropZone(closeupsDropZone, closeupsInput, (files) => {
    handleCloseupFiles(files);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (state.eventSource) {
        state.eventSource.close();
    }
});

console.log('SIFT Image Stitching Tool initialized');
