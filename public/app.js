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

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', copyText);

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

function copyText() {
    const textarea = document.getElementById('ocrText');
    textarea.select();
    document.execCommand('copy');
    document.getElementById('copyBtn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copyBtn').textContent = 'Copy Text', 2000);
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

        // The response should trigger a file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Get filename from response headers or generate one
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'ocr_result.txt';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=((['\\\"]).?|[^;\\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['\\\"]/g, '');
            }
        }
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        const processingTimeMs = Date.now() - startTime;

        // Read blob content for textarea display
        const textContent = blob.type === 'text/plain' ? await blob.text() : null;

        hideProgress();
        showSuccess({
            processingTime: processingTimeMs,
            filename: filename,
            textContent: textContent
        });

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
    pageCount.textContent = `File: ${data.filename}`;
    resultSection.style.display = 'block';

    // Display OCR text in textarea if available
    if (data.textContent) {
        document.getElementById('ocrText').value = data.textContent;
        document.getElementById('textPreview').style.display = 'block';
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

    // Reset progress bar
    progressFill.style.width = '0%';
    progressText.textContent = 'Processing PDF...';

    console.log('UI reset completed');
}