# Code Standards and Codebase Structure

## Project Structure Standards

### Directory Organization
```
/
├── public/                 # Static frontend assets
│   ├── index.html         # Main HTML interface
│   ├── app.js             # Client-side JavaScript (ES6)
│   └── styles.css         # CSS styling with modern features
├── docs/                  # Comprehensive documentation
│   ├── README.md          # User guide and quick start
│   ├── codebase-summary.md # Technical codebase overview
│   ├── project-overview-pdr.md # Requirements and specifications
│   ├── system-architecture.md # Architecture documentation
│   └── code-standards.md  # This file
├── temp/                  # Temporary file storage (auto-created)
├── ocr-processor.js       # Core OCR processing module
├── server.js              # Express server and API
├── verify-setup.js        # System dependency verification
├── create-test-pdf.js     # Development testing utility
├── stop.sh                # Server shutdown script
├── package.json           # Node.js project configuration
└── README.md              # Main project README
```

## Code Style Guidelines

### JavaScript Standards

#### ES Module System
```javascript
// ✅ Correct: Use ES6 import/export
import express from 'express';
import { processPDF } from './ocr-processor.js';

export async function generateTextFile(text, filename, dir) {
  // Implementation
}

// ❌ Incorrect: CommonJS require/exports
const express = require('express');
module.exports = { processPDF };
```

#### Function Declarations
```javascript
// ✅ Preferred: Async/await for asynchronous operations
export async function processPDF(pdfPath, tempDir) {
  try {
    const result = await convertToImages(pdfPath);
    return result;
  } catch (error) {
    throw new Error(`Processing failed: ${error.message}`);
  }
}

// ✅ Acceptable: Arrow functions for callbacks
const imageFiles = files
  .filter(file => file.endsWith('.jpg'))
  .map(file => path.join(outputDir, file))
  .sort();

// ✅ JSDoc documentation for public functions
/**
 * Convert PDF to images using system poppler
 * @param {string} pdfPath - Path to PDF file
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<string[]>} Array of image file paths
 */
```

#### Error Handling Standards
```javascript
// ✅ Comprehensive try-catch with meaningful messages
try {
  const result = await risky_operation();
  return result;
} catch (error) {
  // Log detailed error for debugging
  console.error('Operation failed:', error);

  // Throw user-friendly error
  throw new Error(`Operation failed: ${error.message}`);
}

// ✅ Fallback mechanisms for OCR
try {
  const text = await tesseract.recognize(imagePath, { lang: 'vie+eng' });
  return text.trim();
} catch (error) {
  console.warn(`Vietnamese OCR failed, trying English fallback...`);
  try {
    const fallbackConfig = { lang: 'eng' };
    const text = await tesseract.recognize(imagePath, fallbackConfig);
    return text.trim();
  } catch (fallbackError) {
    throw new Error(`OCR failed: ${fallbackError.message}`);
  }
}
```

#### Variable and Function Naming
```javascript
// ✅ Descriptive, camelCase variable names
const imageOutputDirectory = path.join(tempDir, `images_${sessionId}`);
const processingStartTime = Date.now();
const extractedTextResults = await Promise.all(textPromises);

// ✅ Clear function names that describe actions
async function convertPdfToImages(pdfPath, outputDir) { }
async function extractTextFromImage(imagePath) { }
async function generateFormattedTextFile(text, filename, dir) { }

// ✅ Constants in UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_PORT = 3000;
const OCR_CONFIG = {
  lang: 'vie+eng',
  oem: 1,
  psm: 3,
};
```

### File Structure Standards

#### Module Organization
```javascript
// File header pattern for all modules
import { exec } from 'child_process';
import { promisify } from 'util';
import tesseract from 'node-tesseract-ocr';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Export functions in logical order
export async function pdfToImages() { }
export async function extractTextFromImage() { }
export async function processPDF() { }
export async function cleanupDirectory() { }
export async function generateTextFile() { }
```

#### Configuration Management
```javascript
// ✅ Environment variables with defaults
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 50 * 1024 * 1024;
const TEMP_DIR = process.env.TEMP_DIR || 'temp';

// ✅ Configuration objects
const multerConfig = {
  dest: 'temp/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: MAX_FILE_SIZE },
};
```

## Frontend Standards

### HTML Structure
```html
<!-- ✅ Semantic HTML5 elements -->
<main>
  <div class="upload-section">
    <form id="uploadForm" enctype="multipart/form-data">
      <!-- Form content -->
    </form>
  </div>

  <div class="progress-section" id="progressSection">
    <!-- Progress indicators -->
  </div>
</main>

<!-- ✅ Accessibility attributes -->
<input type="file" id="pdfFile" name="pdf" accept=".pdf" required aria-describedby="file-help">
<label for="pdfFile" class="file-input-label">
  <span class="file-input-text">Choose PDF file or drag & drop</span>
</label>
```

### CSS Standards
```css
/* ✅ Component-based organization */
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ✅ CSS custom properties for consistency */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --error-color: #721c24;
  --success-color: #155724;
}

/* ✅ Mobile-first responsive design */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

@media (max-width: 768px) {
  .container {
    padding: 15px;
  }
}

/* ✅ Component naming convention */
.file-input-wrapper { }
.file-input-label { }
.file-input-text { }
.file-input-button { }
```

### JavaScript Frontend Standards
```javascript
// ✅ Event-driven architecture
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  resetUI();
});

// ✅ Modular function organization
function setupEventListeners() {
  pdfFile.addEventListener('change', handleFileSelect);
  uploadForm.addEventListener('submit', handleFormSubmit);
  fileInputLabel.addEventListener('dragover', handleDragOver);
}

// ✅ State management pattern
let selectedFile = null;
let isProcessing = false;

function resetUI() {
  selectedFile = null;
  isProcessing = false;
  hideAllSections();
  resetFileInfo();
}
```

## Backend Standards

### Express.js Application Structure
```javascript
// ✅ Middleware organization
const app = express();
const PORT = process.env.PORT || 3000;

// Static files middleware
app.use(express.static('public'));

// File upload middleware
const upload = multer(multerConfig);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API endpoints
app.post('/api/ocr', upload.single('pdf'), async (req, res) => {
  // Implementation
});

// Error handling middleware (must be last)
app.use(errorHandler);
```

### API Response Standards
```javascript
// ✅ Consistent error responses
if (!req.file) {
  return res.status(400).json({
    error: 'No PDF file uploaded'
  });
}

// ✅ Success responses with metadata
res.json({
  success: true,
  processingTime: processingTimeMs,
  pages: pageCount,
  filename: generatedFilename
});

// ✅ File download responses
res.download(textFilePath, path.basename(textFilePath), (err) => {
  if (err) {
    console.error('Download error:', err);
  }
  // Cleanup after download
});
```

## Testing Standards

### System Verification
```javascript
// ✅ Dependency validation pattern
const checks = [
  {
    name: 'Node.js version',
    command: 'node --version',
    validator: (output) => output.trim().startsWith('v') && output.includes('18')
  },
  {
    name: 'Tesseract installation',
    command: 'tesseract --version',
    validator: (output) => output.includes('tesseract')
  }
];

// ✅ Automated verification with user feedback
async function runVerification() {
  console.log('🔍 Verifying PDF OCR setup...\n');
  let allPassed = true;

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);
    // Implementation
  }
}
```

## Documentation Standards

### JSDoc Comments
```javascript
/**
 * Process entire PDF: convert to images and extract all text
 * @param {string} pdfPath - Path to PDF file
 * @param {string} tempDir - Temporary directory for processing
 * @returns {Promise<{text: string, pages: number, processingTime: number}>}
 * @throws {Error} When PDF processing fails
 */
export async function processPDF(pdfPath, tempDir) {
  // Implementation
}
```

### README Structure
```markdown
# Project Name

Brief description

## Features
- Feature list

## Quick Start
- Installation steps
- Basic usage

## Requirements
- System dependencies
- Version requirements

## Configuration
- Settings and options

## Troubleshooting
- Common issues and solutions
```

## Security Standards

### Input Validation
```javascript
// ✅ File type validation
const upload = multer({
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// ✅ Size limits
limits: {
  fileSize: 50 * 1024 * 1024, // 50MB limit
}
```

### Cleanup Patterns
```javascript
// ✅ Automatic cleanup on success
setTimeout(async () => {
  for (const filePath of tempFilesToCleanup) {
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.warn(`Cleanup warning: ${cleanupError.message}`);
    }
  }
}, 1000);

// ✅ Cleanup on error
} catch (error) {
  // Process error

  // Always cleanup
  for (const filePath of tempFilesToCleanup) {
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.warn(`Cleanup warning: ${cleanupError.message}`);
    }
  }
}
```

## Performance Standards

### Async Processing
```javascript
// ✅ Parallel processing for independent operations
const textPromises = imagePaths.map((imagePath, index) => {
  console.log(`Processing page ${index + 1}/${imagePaths.length}...`);
  return extractTextFromImage(imagePath);
});

const textResults = await Promise.all(textPromises);
```

### Memory Management
```javascript
// ✅ Immediate cleanup after use
await cleanupDirectory(imageDir);

// ✅ Stream processing for large files
const files = await fs.readdir(outputDir);
const imageFiles = files
  .filter(file => file.endsWith('.jpg'))
  .map(file => path.join(outputDir, file))
  .sort();
```

## Deployment Standards

### Process Management
```bash
#!/bin/bash
# stop.sh - Process cleanup script

echo "Stopping PDF OCR application..."

# Kill process on specific port
PORT_PID=$(lsof -ti:3847)
if [ ! -z "$PORT_PID" ]; then
    echo "Killing process on port 3847 (PID: $PORT_PID)"
    kill -9 $PORT_PID
fi

# Clean up temp files
if [ -d "temp" ]; then
    rm -rf temp/*
fi
```

### Environment Configuration
```javascript
// ✅ Environment-based configuration
const config = {
  port: process.env.PORT || 3847,
  tempDir: process.env.TEMP_DIR || 'temp',
  maxFileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024,
  ocrLanguages: process.env.OCR_LANGUAGES || 'vie+eng'
};
```

## Commit Standards

### Commit Message Format
```
feat: add Vietnamese language fallback mechanism
fix: resolve memory leak in image processing
docs: update installation requirements
refactor: simplify OCR configuration management
test: add dependency verification tests
```

### Code Review Checklist
- [ ] ES6 modules used consistently
- [ ] Error handling implemented with user-friendly messages
- [ ] Temporary files cleaned up properly
- [ ] JSDoc comments for public functions
- [ ] Responsive design maintained
- [ ] Security validations in place
- [ ] Performance considerations addressed
- [ ] Documentation updated if needed