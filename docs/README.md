# PDF OCR Application

Self-contained Vietnamese text extraction tool for scanned PDF documents using Tesseract OCR and system poppler utilities.

## Features

- **Vietnamese + English OCR**: Dual-language support with fallback mechanism
- **Drag & Drop Interface**: Intuitive web interface for file uploads
- **Stateless Processing**: No persistent storage, automatic cleanup
- **Large File Support**: Up to 50MB PDF files
- **Download Results**: Extracted text as formatted .txt files
- **System Integration**: Uses system poppler for reliable PDF processing

## Quick Start

### Prerequisites
```bash
# macOS
brew install node tesseract tesseract-lang poppler

# Verify Node.js 18+
node --version
```

### Installation
```bash
npm install
npm run verify  # Check system dependencies
```

### Usage
```bash
npm start       # Start server on http://localhost:3847
npm run stop    # Stop server and cleanup
```

## System Requirements

### Core Dependencies
- **Node.js 18+**: JavaScript runtime
- **Tesseract OCR**: Text recognition engine with Vietnamese language pack
- **Poppler Utils**: PDF processing tools (`pdftoppm`, `pdftocairo`)

### Installation Commands
```bash
# macOS with Homebrew
brew install tesseract tesseract-lang poppler

# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-vie poppler-utils

# Verify installation
tesseract --list-langs | grep vie
which pdftoppm
```

## Application Structure

### Frontend
- **Interface**: Single-page application at `http://localhost:3847`
- **Upload**: Drag-drop or browse PDF files
- **Progress**: Real-time processing feedback
- **Download**: Automatic text file download

### Backend
- **Server**: Express.js on port 3847
- **Upload**: Multer middleware (50MB limit)
- **Processing**: Custom OCR pipeline
- **Cleanup**: Automatic temporary file management

## Processing Pipeline

1. **File Upload**: PDF validation and temporary storage
2. **PDF Conversion**: System poppler converts pages to JPEG (300 DPI)
3. **Text Extraction**: Tesseract OCR with Vietnamese + English
4. **Text Assembly**: Combined pages with metadata headers
5. **File Generation**: Formatted .txt file for download
6. **Cleanup**: Automatic removal of temporary files

## Configuration

### Port Settings
- **Default Port**: 3847 (avoids common conflicts)
- **Health Check**: `GET /health`
- **API Endpoint**: `POST /api/ocr`

### OCR Settings
```javascript
{
  lang: 'vie+eng',    // Vietnamese + English
  oem: 1,             // LSTM OCR Engine Mode
  psm: 3,             // Fully automatic page segmentation
}
```

### File Limits
- **Maximum Size**: 50MB
- **Supported Format**: PDF only
- **Processing Time**: ~1-3 seconds per page

## File Structure

```
.
├── public/
│   ├── index.html      # Web interface
│   ├── app.js          # Frontend JavaScript
│   └── styles.css      # UI styling
├── server.js           # Express server
├── ocr-processor.js    # OCR pipeline
├── verify-setup.js     # Dependency verification
├── stop.sh             # Cleanup script
└── docs/               # Documentation
    ├── README.md       # This file
    ├── codebase-summary.md
    ├── project-overview-pdr.md
    └── system-architecture.md
```

## Scripts

```bash
npm start           # Start server
npm run dev         # Development mode (watch files)
npm run stop        # Stop server and cleanup
npm run verify      # Check system dependencies
```

## Troubleshooting

### Common Issues

**Tesseract Not Found**
```bash
brew install tesseract tesseract-lang
tesseract --version
```

**Vietnamese Language Pack Missing**
```bash
tesseract --list-langs | grep vie
# If not found: brew reinstall tesseract-lang
```

**Poppler Missing**
```bash
brew install poppler
which pdftoppm
```

**Port Already in Use**
- Application uses port 3847 specifically to avoid conflicts
- Run `npm run stop` to cleanup any remaining processes

### Error Messages

- **"Only PDF files are allowed"**: Check file format
- **"File too large (max 50MB)"**: Reduce file size
- **"No text found in PDF"**: PDF may be pure image or corrupted
- **"Processing failed"**: Check system dependencies with `npm run verify`

## Development

### Local Development
```bash
git clone <repository>
cd pdf-ocr-app
npm install
npm run verify
npm start
```

### Testing
```bash
node create-test-pdf.js  # Generate test PDF
# Upload test file via web interface
```

### Logs
- Server logs to console
- Processing times displayed in web interface
- Error details in browser developer console

## Security

- **File Validation**: PDF MIME type checking
- **Size Limits**: 50MB maximum file size
- **Temporary Storage**: Files automatically cleaned up
- **No Persistence**: No long-term file storage
- **Local Processing**: All OCR processing done locally

## Performance

### Typical Processing Times
- **Small PDF** (1-5 pages): 2-10 seconds
- **Medium PDF** (6-20 pages): 15-45 seconds
- **Large PDF** (21+ pages): 1-3 minutes

### Optimization Features
- **Parallel Processing**: Multiple pages processed concurrently
- **Memory Management**: Automatic cleanup prevents memory leaks
- **Image Quality**: 300 DPI for optimal OCR accuracy
- **Fallback Processing**: English OCR if Vietnamese fails

## Support

For issues or questions:
1. Run `npm run verify` to check system setup
2. Check browser console for client-side errors
3. Review server logs for processing errors
4. Verify system dependencies are properly installed