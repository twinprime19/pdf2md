# Codebase Summary

## Overview
PDF OCR Application is a Node.js-based web application designed for extracting Vietnamese text from scanned PDF documents using Tesseract OCR. The application provides a simple web interface for uploading PDF files and downloading extracted text as .txt files with comprehensive Vietnamese language support.

## Architecture
**Type**: Stateless three-layer web application with frontend/backend separation
**Processing Model**: Synchronous request-response with temporary file cleanup and session isolation
**Port**: 3847 (configured to avoid default port conflicts on development machines)
**Pattern**: ES6 modules with async/await throughout the codebase

## Core Components

### Frontend (`/public`)
- **index.html**: Single-page application with drag-drop PDF upload interface
- **app.js**: Vanilla JavaScript handling file upload, progress tracking, and download management
- **styles.css**: CSS styling with responsive design and drag-drop visual feedback

### Backend (`/server.js`)
- Express.js server on port 3847
- Multer middleware for multipart file uploads (50MB limit)
- PDF file validation and temporary storage
- Automatic cleanup of temporary files after processing
- Health check endpoint at `/health`

### OCR Processing (`/ocr-processor.js`)
**Core OCR Backend Libraries:**
- **node-tesseract-ocr (^2.2.1)**: Node.js wrapper for Tesseract OCR engine
- **Tesseract OCR Engine**: System-level OCR with LSTM neural networks (OEM 1)
- **Poppler pdftoppm**: System command for PDF to image conversion at 300 DPI
- **pdf2pic (^2.1.4)**: Declared dependency but unused (replaced by direct poppler usage)

**OCR Processing Pipeline:**
1. `pdfToImages()`: Converts PDF pages to JPEG using `pdftoppm -jpeg -r 300`
2. `extractTextFromImage()`: Performs OCR with Vietnamese+English (`vie+eng`) configuration
3. `processPDF()`: Orchestrates complete workflow with session-based temporary directories
4. Vietnamese language support with English fallback mechanism
5. Page segmentation mode 3 (fully automatic) for optimal text detection
6. Text assembly with page separators and metadata headers

### Utility Scripts
- **verify-setup.js**: System dependency verification (Node.js, Tesseract, poppler)
- **stop.sh**: Cleanup script for stopping services and removing temp files
- **create-test-pdf.js**: Test PDF generator for development

## Dependencies

### System Requirements
- Node.js 18+
- Tesseract OCR with Vietnamese language pack (`vie`)
- poppler-utils (`pdftoppm`, `pdftocairo`)

### NPM Dependencies (Production)
- **express (^4.19.0)**: Web server framework providing HTTP routing and middleware
- **multer (^1.4.5-lts.1)**: Multipart/form-data parsing for file uploads with validation
- **node-tesseract-ocr (^2.2.1)**: Node.js wrapper for Tesseract OCR engine with promise support
- **pdf2pic (^2.1.4)**: PDF processing library (declared but not actively used)
- **dotenv (^17.2.3)**: Environment variable management and configuration

### System Dependencies (Critical)
- **Tesseract OCR with Vietnamese language pack (`vie`)**: Core text recognition engine
- **Poppler Utils (`pdftoppm`, `pdftocairo`)**: PDF manipulation and image conversion tools
- **Node.js (>=18)**: JavaScript runtime with ES6 module support

## Data Flow

1. **File Upload**: Drag-drop or browse PDF files (max 50MB)
2. **Server Processing**:
   - Multer stores uploaded file in `temp/` directory
   - OCR processor converts PDF to JPEG images (300 DPI)
   - Tesseract extracts text from each image
   - Text combined with page separators
3. **Response**: Generated text file sent for download
4. **Cleanup**: Temporary files automatically removed

## Key Features

### Vietnamese Language Support Implementation
**OCR Configuration:**
- **Primary Language**: Vietnamese (`vie`) using Tesseract trained data
- **Secondary Language**: English (`eng`) for mixed content documents
- **Combined Mode**: `vie+eng` for optimal recognition of mixed Vietnamese-English text
- **Fallback Mechanism**: Automatic English-only processing if Vietnamese OCR fails

**Technical Implementation:**
```javascript
const config = {
  lang: 'vie+eng',    // Vietnamese + English dual language
  oem: 1,             // LSTM OCR Engine Mode (neural network)
  psm: 3,             // Fully automatic page segmentation
};
```

**Vietnamese Character Support:**
- Diacritical marks: á, à, ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ
- Special characters: ă, â, đ, ê, ô, ơ, ư
- Tone marks and combined characters properly recognized

### File Processing
- Stateless operation (no persistent storage)
- Temporary file management with automatic cleanup
- Progress simulation for user feedback
- Error handling with meaningful messages

### Security & Limits
- File type validation (PDF only)
- 50MB file size limit
- Temporary file isolation
- Process cleanup on server shutdown

## Configuration

### Port Management
- Fixed port 3847 to avoid default port conflicts
- Stop script specifically targets this port
- Multiple service support on development machine

### Processing Settings
- OCR Engine Mode: LSTM (OEM 1)
- Page Segmentation: Fully automatic (PSM 3)
- Image Resolution: 300 DPI for optimal OCR accuracy
- Text Format: UTF-8 with metadata headers

## Deployment Notes

### Setup Verification
Run `npm run verify` to check:
- Node.js version compatibility
- Tesseract installation and Vietnamese language pack
- Poppler utilities availability
- Temporary directory creation

### Process Management
- Start: `npm start`
- Stop: `npm run stop` or `./stop.sh`
- Verification: `npm run verify`

### Troubleshooting
- System dependencies must be installed via package manager (brew on macOS)
- Tesseract language pack installation: `brew install tesseract-lang`
- Port conflicts resolved by using non-standard port 3847