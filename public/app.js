// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const pdfFile = document.getElementById('pdfFile');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const processBtn = document.getElementById('processBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const processingTime = document.getElementById('processingTime');
const pageCount = document.getElementById('pageCount');
const newFileBtn = document.getElementById('newFileBtn');
const retryBtn = document.getElementById('retryBtn');
const fileInputLabel = document.querySelector('.file-input-label');

// State
let selectedFile = null;
let isProcessing = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    resetUI();
});

function setupEventListeners() {
    // File input change
    pdfFile.addEventListener('change', handleFileSelect);

    // Form submission
    uploadForm.addEventListener('submit', handleFormSubmit);

    // Drag and drop
    fileInputLabel.addEventListener('dragover', handleDragOver);
    fileInputLabel.addEventListener('dragleave', handleDragLeave);
    fileInputLabel.addEventListener('drop', handleDrop);

    // Reset buttons
    newFileBtn.addEventListener('click', resetUI);
    retryBtn.addEventListener('click', resetUI);

    // Copy and download buttons
    document.getElementById('copyOriginal').addEventListener('click', () => copyText('originalText'));
    document.getElementById('copyCleaned').addEventListener('click', () => copyText('cleanedText'));
    document.getElementById('downloadOriginal').addEventListener('click', downloadOriginal);
    document.getElementById('downloadDiff').addEventListener('click', downloadDiff);

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, preventDefaults);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragOver(e) {
    e.preventDefault();
    fileInputLabel.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    fileInputLabel.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    fileInputLabel.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
            pdfFile.files = files;
            handleFileSelect();
        } else {
            showError('Please select a PDF file.');
        }
    }
}

function handleFileSelect() {
    const file = pdfFile.files[0];

    if (!file) {
        resetFileInfo();
        return;
    }

    if (file.type !== 'application/pdf') {
        showError('Please select a PDF file.');
        resetFileInfo();
        return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
        showError('File size must be less than 50MB.');
        resetFileInfo();
        return;
    }

    selectedFile = file;
    showFileInfo(file);
    processBtn.disabled = false;
}

function showFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'flex';
}

function resetFileInfo() {
    selectedFile = null;
    fileInfo.style.display = 'none';
    processBtn.disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function copyText(textareaId) {
    const textarea = document.getElementById(textareaId);
    textarea.select();
    document.execCommand('copy');

    // Update button text temporarily
    const buttonId = textareaId === 'originalText' ? 'copyOriginal' : 'copyCleaned';
    const button = document.getElementById(buttonId);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => button.textContent = originalText, 2000);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedFile || isProcessing) {
        return;
    }

    isProcessing = true;

    hideAllSections();
    showProgress();

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
        const startTime = Date.now();

        const response = await fetch('/api/ocr', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Processing failed');
        }

        // Get JSON response with original and cleaned text
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            // Check if this is streaming mode response
            if (data.sessionId && data.streaming) {
                hideProgress();
                showStreamingMessage(data, startTime);
                return;
            }

            // Legacy mode - handle dual-text response
            hideProgress();
            showSuccess(data);

            // Setup synchronized scrolling after textareas are populated
            setupSynchronizedScrolling();
        } else {
            // Fallback for old blob response format (should not happen with current code)
            const blob = await response.blob();
            const textContent = await blob.text();
            hideProgress();
            showSuccess({
                original: textContent,
                cleaned: textContent,
                metadata: { documentType: 'unknown', changesCount: 0, confidence: 0 },
                filename: selectedFile.name
            });
        }

    } catch (error) {
        console.error('OCR processing error:', error);
        hideProgress();
        showError(error.message || 'An unexpected error occurred');
    } finally {
        isProcessing = false;
    }
}

function showProgress() {
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';

    // Simulate progress (since we don't have real progress updates)
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) {
            progress = 90;
            clearInterval(interval);
        }
        progressFill.style.width = progress + '%';
    }, 500);

    // Store interval ID to clear it later if needed
    progressSection.dataset.intervalId = interval;
}

function hideProgress() {
    const intervalId = progressSection.dataset.intervalId;
    if (intervalId) {
        clearInterval(parseInt(intervalId));
    }

    progressFill.style.width = '100%';

    setTimeout(() => {
        progressSection.style.display = 'none';
    }, 500);
}

function showSuccess(data) {
    processingTime.textContent = `Processing time: ${(data.processingTime / 1000).toFixed(1)}s`;
    pageCount.textContent = `File: ${data.filename} (${data.pages} pages)`;
    resultSection.style.display = 'block';

    // Display both original and cleaned text in textareas
    if (data.original && data.cleaned) {
        document.getElementById('originalText').value = data.original;
        document.getElementById('cleanedText').value = data.cleaned;
        document.getElementById('textPreview').style.display = 'block';

        // Update metadata display
        document.getElementById('docType').textContent = formatDocumentType(data.metadata.documentType);
        document.getElementById('corrections').textContent = data.metadata.changesCount || 0;
        document.getElementById('confidence').textContent = Math.round((data.metadata.confidence || 0) * 100);
        document.getElementById('ocrTime').textContent = data.ocrTime || 0;
        document.getElementById('cleanTime').textContent = data.cleaningTime || 0;
    }
}

function showError(message) {
    errorText.textContent = message;
    errorSection.style.display = 'block';
}

function hideAllSections() {
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    document.getElementById('textPreview').style.display = 'none';

    // Hide streaming section if it exists
    const streamingSection = document.getElementById('streamingSection');
    if (streamingSection) {
        streamingSection.style.display = 'none';
    }
}

function resetUI() {
    // Reset form
    uploadForm.reset();
    selectedFile = null;
    isProcessing = false;

    // Reset UI elements
    resetFileInfo();
    hideAllSections();

    // Clear any progress intervals
    const intervalId = progressSection.dataset.intervalId;
    if (intervalId) {
        clearInterval(parseInt(intervalId));
    }

    // Clear streaming status intervals
    const statusIntervalId = document.body.dataset.statusIntervalId;
    if (statusIntervalId) {
        clearInterval(parseInt(statusIntervalId));
        delete document.body.dataset.statusIntervalId;
    }

    // Reset progress bar
    progressFill.style.width = '0%';
    progressText.textContent = 'Processing PDF...';

    console.log('UI reset completed');
}

// Streaming mode functions
function showStreamingMessage(sessionData, startTime) {
    const streamingSection = getOrCreateStreamingSection();

    streamingSection.innerHTML = `
        <div class="streaming-info">
            <h3>🔄 Processing Large File</h3>
            <p><strong>Session:</strong> ${sessionData.sessionId.substring(0, 8)}...</p>
            <p><strong>File:</strong> ${sessionData.filename}</p>
            <p><strong>Size:</strong> ${formatFileSize(sessionData.fileSize)}</p>

            <div class="streaming-progress">
                <div class="progress-bar">
                    <div id="streamingProgressFill" class="progress-fill"></div>
                </div>
                <div id="streamingProgressText" class="progress-text">Initializing...</div>
            </div>

            <div class="streaming-status">
                <div id="streamingStatus">Starting processing...</div>
                <div id="streamingEta"></div>
            </div>

            <div class="streaming-actions">
                <button id="downloadStreamingBtn" disabled>Download Result</button>
                <button id="cancelStreamingBtn">Cancel</button>
            </div>
        </div>
    `;

    streamingSection.style.display = 'block';

    // Setup event listeners
    document.getElementById('downloadStreamingBtn').addEventListener('click', () => {
        downloadStreamingResult(sessionData.sessionId);
    });

    document.getElementById('cancelStreamingBtn').addEventListener('click', () => {
        cancelStreamingSession(sessionData.sessionId);
    });

    // Start polling for status
    pollSessionStatus(sessionData.sessionId, startTime);
}

function getOrCreateStreamingSection() {
    let section = document.getElementById('streamingSection');
    if (!section) {
        section = document.createElement('div');
        section.id = 'streamingSection';
        section.className = 'section streaming-section';
        section.style.display = 'none';

        // Insert after progress section
        progressSection.parentNode.insertBefore(section, progressSection.nextSibling);
    }
    return section;
}

function pollSessionStatus(sessionId, startTime) {
    const pollInterval = 2000; // Poll every 2 seconds

    const poll = async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}/status`);

            if (!response.ok) {
                throw new Error('Failed to get session status');
            }

            const status = await response.json();
            updateStreamingUI(status, startTime);

            if (status.complete) {
                // Processing completed
                clearInterval(intervalId);
                delete document.body.dataset.statusIntervalId;

                if (status.hasOutput) {
                    enableDownload(sessionId);
                    showStreamingSuccess(status, startTime);
                } else {
                    showError('Processing completed but no output file found');
                }
            } else if (status.status === 'not_found') {
                // Session not found or error
                clearInterval(intervalId);
                delete document.body.dataset.statusIntervalId;
                showError('Session not found or processing failed');
            }

        } catch (error) {
            console.error('Status polling error:', error);
            // Continue polling - don't stop on temporary errors
        }
    };

    const intervalId = setInterval(poll, pollInterval);
    document.body.dataset.statusIntervalId = intervalId;

    // Initial poll
    poll();
}

function updateStreamingUI(status, startTime) {
    const progressFill = document.getElementById('streamingProgressFill');
    const progressText = document.getElementById('streamingProgressText');
    const statusDiv = document.getElementById('streamingStatus');
    const etaDiv = document.getElementById('streamingEta');

    if (progressFill) {
        progressFill.style.width = `${status.percentage || 0}%`;
    }

    if (progressText) {
        progressText.textContent = `Page ${status.lastPage || 0} of ${status.totalPages || 'Unknown'} (${status.percentage || 0}%)`;
    }

    if (statusDiv) {
        if (status.complete) {
            statusDiv.textContent = '✅ Processing completed!';
        } else {
            statusDiv.textContent = `Processing page ${status.lastPage || 0}/${status.totalPages || '?'}...`;
        }
    }

    if (etaDiv && status.estimatedTimeRemaining) {
        const eta = Math.round(status.estimatedTimeRemaining / 1000);
        etaDiv.textContent = `Estimated time remaining: ${eta}s`;
    } else if (etaDiv) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        etaDiv.textContent = `Elapsed time: ${elapsed}s`;
    }
}

function enableDownload(sessionId) {
    const downloadBtn = document.getElementById('downloadStreamingBtn');
    if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download Result';
    }
}

function downloadStreamingResult(sessionId) {
    const url = `/api/session/${sessionId}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function cancelStreamingSession(sessionId) {
    if (confirm('Are you sure you want to cancel processing?')) {
        fetch(`/api/session/${sessionId}`, { method: 'DELETE' })
            .then(() => {
                resetUI();
            })
            .catch(error => {
                console.error('Cancel error:', error);
                showError('Failed to cancel session');
            });
    }
}

function showStreamingSuccess(status, startTime) {
    const streamingSection = document.getElementById('streamingSection');
    if (streamingSection) {
        streamingSection.innerHTML = `
            <div class="streaming-success">
                <h3>✅ Processing Complete</h3>
                <p><strong>Pages processed:</strong> ${status.totalPages}</p>
                <p><strong>Total time:</strong> ${Math.round((Date.now() - startTime) / 1000)}s</p>
                <div class="success-actions">
                    <button onclick="downloadStreamingResult('${status.sessionId}')">Download Result</button>
                    <button onclick="resetUI()">Process Another File</button>
                </div>
            </div>
        `;
    }
}

// ============================================
// DUAL-TEXT COMPARISON FEATURES
// ============================================

/**
 * Setup synchronized scrolling between original and cleaned textareas
 */
function setupSynchronizedScrolling() {
    const originalTA = document.getElementById('originalText');
    const cleanedTA = document.getElementById('cleanedText');

    if (!originalTA || !cleanedTA) return;

    let isSyncing = false;

    // Sync from original to cleaned
    originalTA.addEventListener('scroll', () => {
        if (!isSyncing) {
            isSyncing = true;
            cleanedTA.scrollTop = originalTA.scrollTop;
            cleanedTA.scrollLeft = originalTA.scrollLeft;
            setTimeout(() => isSyncing = false, 50);
        }
    });

    // Sync from cleaned to original
    cleanedTA.addEventListener('scroll', () => {
        if (!isSyncing) {
            isSyncing = true;
            originalTA.scrollTop = cleanedTA.scrollTop;
            originalTA.scrollLeft = cleanedTA.scrollLeft;
            setTimeout(() => isSyncing = false, 50);
        }
    });

    console.log('Synchronized scrolling enabled');
}

/**
 * Download original OCR text as .txt file
 */
function downloadOriginal() {
    const text = document.getElementById('originalText').value;
    const filename = selectedFile ? selectedFile.name.replace('.pdf', '_original.txt') : 'original_ocr.txt';

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename);
}

/**
 * Generate and download diff report comparing original and cleaned text
 */
function downloadDiff() {
    const original = document.getElementById('originalText').value;
    const cleaned = document.getElementById('cleanedText').value;

    // Get metadata
    const docType = document.getElementById('docType').textContent;
    const corrections = document.getElementById('corrections').textContent;
    const confidence = document.getElementById('confidence').textContent;
    const ocrTime = document.getElementById('ocrTime').textContent;
    const cleanTime = document.getElementById('cleanTime').textContent;

    // Generate diff report
    const report = generateDiffReport(original, cleaned, {
        docType,
        corrections,
        confidence,
        ocrTime,
        cleanTime
    });

    const filename = selectedFile ? selectedFile.name.replace('.pdf', '_diff_report.txt') : 'ocr_diff_report.txt';
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename);
}

/**
 * Generate a text-based diff report
 */
function generateDiffReport(original, cleaned, metadata) {
    const header = `
========================================
OCR CLEANING DIFF REPORT
========================================

Generated: ${new Date().toLocaleString()}
Document Type: ${metadata.docType}
Corrections Made: ${metadata.corrections}
Confidence Score: ${metadata.confidence}%
OCR Processing Time: ${metadata.ocrTime}ms
Cleaning Time: ${metadata.cleanTime}ms

========================================
STATISTICS
========================================

Original Length: ${original.length} characters
Cleaned Length: ${cleaned.length} characters
Difference: ${cleaned.length - original.length} characters

========================================
ORIGINAL TEXT
========================================

${original}

========================================
CLEANED TEXT
========================================

${cleaned}

========================================
END OF REPORT
========================================
`;

    return header;
}

/**
 * Helper function to download blob as file
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Format document type for display
 */
function formatDocumentType(type) {
    if (!type || type === 'unknown') return 'Unknown';

    // Convert snake_case to Title Case
    return type.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}