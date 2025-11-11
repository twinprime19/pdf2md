# Codebase Summary

## Overview
PDF OCR application built with Node.js that extracts Vietnamese text from scanned PDF documents using Tesseract OCR and system poppler utilities.

## Architecture
**Type**: Stateless web application with frontend/backend separation
**Processing Model**: Synchronous request-response with temporary file cleanup
**Port**: 3847 (random port to avoid conflicts)

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
- PDF to images conversion using system `pdftoppm` (poppler)
- Multi-language OCR with Tesseract (Vietnamese + English)
- Page-by-page text extraction with fallback mechanisms
- Text file generation with metadata headers

### Utility Scripts
- **verify-setup.js**: System dependency verification (Node.js, Tesseract, poppler)
- **stop.sh**: Cleanup script for stopping services and removing temp files
- **create-test-pdf.js**: Test PDF generator for development

## Dependencies

### System Requirements
- Node.js 18+
- Tesseract OCR with Vietnamese language pack (`vie`)
- poppler-utils (`pdftoppm`, `pdftocairo`)

### NPM Dependencies
- **express**: Web server framework
- **multer**: File upload middleware
- **node-tesseract-ocr**: Tesseract OCR wrapper
- **pdf2pic**: PDF processing library (unused after system poppler implementation)

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

### Language Support
- Primary: Vietnamese (`vie`)
- Secondary: English (`eng`)
- Fallback mechanism if Vietnamese OCR fails

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