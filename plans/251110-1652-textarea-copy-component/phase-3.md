# Phase 3: Backend Integration

## Objective
Modify OCR endpoint to return JSON with extracted text while maintaining download functionality.

## Tasks

### 3.1 Update OCR Endpoint Response
**File: `/server.js` or `/ocr-processor.js`**

Modify OCR endpoint to return JSON:
```javascript
// Update the /api/ocr endpoint
app.post('/api/ocr', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const startTime = Date.now();
        const extractedText = await processOCR(req.file);
        const processingTime = Date.now() - startTime;

        // Generate filename
        const originalName = req.file.originalname.replace(/\.pdf$/i, '');
        const filename = `${originalName}_ocr_${Date.now()}.txt`;

        // Return JSON response with text and metadata
        res.json({
            success: true,
            text: extractedText,
            metadata: {
                originalFilename: req.file.originalname,
                outputFilename: filename,
                processingTime: processingTime,
                textLength: extractedText.length,
                wordCount: extractedText.split(/\s+/).filter(word => word.length > 0).length
            }
        });

    } catch (error) {
        console.error('OCR processing error:', error);
        res.status(500).json({
            error: 'OCR processing failed',
            details: error.message
        });
    }
});
```

### 3.2 Add Download Endpoint
**File: `/server.js`**

Create separate endpoint for text download:
```javascript
// New endpoint for downloading text files
app.post('/api/download-text', (req, res) => {
    try {
        const { text, filename } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename || 'ocr_result.txt'}"`);

        // Send text content
        res.send(text);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            error: 'Download failed',
            details: error.message
        });
    }
});
```

### 3.3 Update Frontend OCR Processing
**File: `/public/app.js`**

Update form submission handler:
```javascript
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

        // Parse JSON response
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Processing failed');
        }

        hideProgress();
        showTextResult(data);

    } catch (error) {
        console.error('OCR processing error:', error);
        hideProgress();
        showError(error.message || 'An unexpected error occurred');
    } finally {
        isProcessing = false;
    }
}
```

### 3.4 Update Result Display Function
**File: `/public/app.js`**

Create new function to display text results:
```javascript
function showTextResult(data) {
    const { text, metadata } = data;

    // Update text display
    const extractedTextArea = document.getElementById('extractedText');
    extractedTextArea.value = text;

    // Update metadata display
    const processingTime = document.getElementById('processingTime');
    const pageCount = document.getElementById('pageCount');

    processingTime.textContent = `Processing time: ${(metadata.processingTime / 1000).toFixed(1)}s`;
    pageCount.textContent = `Words: ${metadata.wordCount} | Characters: ${metadata.textLength}`;

    // Store metadata for download
    extractedTextArea.dataset.filename = metadata.outputFilename;

    // Show text display section
    const textDisplaySection = document.getElementById('textDisplaySection');
    textDisplaySection.style.display = 'block';

    // Also show result section for metadata
    const resultSection = document.getElementById('resultSection');
    resultSection.style.display = 'block';

    // Initialize copy functionality
    initializeClipboard();
}
```

### 3.5 Implement Download Functionality
**File: `/public/app.js`**

Add download button handler:
```javascript
function setupDownloadButton() {
    const downloadBtn = document.getElementById('downloadTextBtn');
    const extractedTextArea = document.getElementById('extractedText');

    downloadBtn.addEventListener('click', async () => {
        const text = extractedTextArea.value;
        const filename = extractedTextArea.dataset.filename || 'ocr_result.txt';

        if (!text.trim()) {
            showNotification('No text to download', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/download-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    filename: filename
                })
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Create download link
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showNotification('File downloaded successfully', 'success');

        } catch (error) {
            console.error('Download error:', error);
            showNotification('Download failed', 'error');
        }
    });
}
```

### 3.6 Update Section Visibility
**File: `/public/app.js`**

Update visibility functions:
```javascript
function hideAllSections() {
    const sections = [
        'progressSection',
        'resultSection',
        'errorSection',
        'textDisplaySection'
    ];

    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    });
}

function resetUI() {
    // Reset form
    uploadForm.reset();
    selectedFile = null;
    isProcessing = false;

    // Reset UI elements
    resetFileInfo();
    hideAllSections();

    // Clear text area
    const extractedTextArea = document.getElementById('extractedText');
    if (extractedTextArea) {
        extractedTextArea.value = '';
        extractedTextArea.dataset.filename = '';
    }

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
```

## Expected Outcome
- OCR endpoint returns JSON with extracted text and metadata
- Download functionality works via separate endpoint
- Frontend displays text immediately after processing
- Maintains backward compatibility
- Proper error handling for all scenarios