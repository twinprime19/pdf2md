# Phase 4: Frontend Interface and File Download

## Objectives
- Create simple upload interface
- Implement file selection and validation
- Show processing status and results
- Enable text file download functionality

## Tasks

### 4.1 HTML Structure
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF OCR - Vietnamese Text Extraction</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>PDF OCR Tool</h1>
    <p>Extract Vietnamese text from PDF documents</p>

    <div class="upload-section">
      <input type="file" id="pdfFile" accept=".pdf" />
      <button id="uploadBtn" disabled>Extract Text</button>
    </div>

    <div class="status" id="status"></div>
    <div class="results" id="results"></div>
  </div>

  <script src="script.js"></script>
</body>
</html>
```

### 4.2 CSS Styling
```css
/* public/styles.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;
  padding: 20px;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.upload-section {
  margin: 30px 0;
  text-align: center;
}

#pdfFile, #uploadBtn {
  margin: 10px;
  padding: 10px 20px;
}

.status {
  margin: 20px 0;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}

.status.processing {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.results {
  margin: 20px 0;
}

.text-preview {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 15px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 14px;
}

.download-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.download-btn:hover {
  background-color: #218838;
}
```

### 4.3 JavaScript Functionality
```javascript
// public/script.js
class PdfOcrApp {
  constructor() {
    this.fileInput = document.getElementById('pdfFile');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.status = document.getElementById('status');
    this.results = document.getElementById('results');

    this.initEventListeners();
  }

  initEventListeners() {
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    this.uploadBtn.addEventListener('click', this.handleUpload.bind(this));
  }

  handleFileSelect(event) {
    const file = event.target.files[0];

    if (file && file.type === 'application/pdf') {
      this.uploadBtn.disabled = false;
      this.showStatus('File selected: ' + file.name, 'info');
    } else {
      this.uploadBtn.disabled = true;
      this.showStatus('Please select a valid PDF file', 'error');
    }
  }

  async handleUpload() {
    const file = this.fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      this.uploadBtn.disabled = true;
      this.showStatus('Processing PDF... This may take a few moments.', 'processing');
      this.results.innerHTML = '';

      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        this.showStatus('Text extraction completed successfully!', 'success');
        this.displayResults(result.text, result.filename);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      this.showStatus('Error: ' + error.message, 'error');
    } finally {
      this.uploadBtn.disabled = false;
    }
  }

  displayResults(text, filename) {
    const preview = document.createElement('div');
    preview.className = 'text-preview';
    preview.textContent = text.substring(0, 1000) + (text.length > 1000 ? '...' : '');

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = `Download ${filename}`;
    downloadBtn.onclick = () => this.downloadText(text, filename);

    this.results.appendChild(preview);
    this.results.appendChild(downloadBtn);
  }

  downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  showStatus(message, type) {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PdfOcrApp();
});
```

### 4.4 File Validation Enhancement
- Client-side PDF type checking
- File size validation (before upload)
- Clear error messages for invalid files
- Visual feedback during processing

### 4.5 User Experience Features
- Progress indication during OCR
- Text preview with scrolling
- One-click download functionality
- Responsive design for mobile

## Acceptance Criteria
- Clean, intuitive upload interface
- File validation prevents invalid uploads
- Processing status clearly communicated
- Extracted text displayed with preview
- Download button generates text file
- Responsive design works on mobile
- Error messages helpful and clear

## Key Files
- `public/index.html` - Complete UI structure
- `public/styles.css` - Responsive styling
- `public/script.js` - Full client functionality

## User Flow
1. Select PDF file from local system
2. Click "Extract Text" button
3. See processing status indicator
4. View text preview when complete
5. Download full text as .txt file

## Testing
- File selection enables upload button
- Invalid files show error messages
- Processing status updates correctly
- Text preview displays properly
- Download generates correct file
- Interface works on mobile devices

## Next Phase
Proceed to Phase 5: Error Handling and Cleanup