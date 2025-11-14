# PDF OCR Application

Professional Vietnamese text extraction tool for scanned PDF documents using Tesseract OCR with comprehensive language support.

## Features

### Core Functionality
- **Vietnamese + English OCR**: Dual-language recognition with automatic fallback
- **Large File Support**: Handle PDFs up to 50MB with efficient processing
- **Drag & Drop Interface**: Modern web interface with progress tracking
- **Stateless Processing**: No persistent storage, automatic cleanup
- **High-Quality Conversion**: 300 DPI image processing for optimal OCR accuracy
- **Formatted Output**: Downloadable .txt files with metadata and page separators

### Advanced Features
- **Fallback Mechanisms**: English-only processing if Vietnamese OCR fails
- **Session Isolation**: Concurrent file processing without conflicts
- **Real-time Progress**: Visual feedback during processing
- **Error Recovery**: Comprehensive error handling with user-friendly messages
- **System Verification**: Built-in dependency checking and setup validation

## Quick Start

### Prerequisites
```bash
# macOS with Homebrew
brew install node tesseract tesseract-lang poppler

# Ubuntu/Debian
sudo apt-get install nodejs tesseract-ocr tesseract-ocr-vie poppler-utils

# Verify installations
node --version          # Should be 18+
tesseract --list-langs  # Should include 'vie'
which pdftoppm          # Should show path to poppler
```

### Installation & Setup
```bash
# Install dependencies
npm install

# Verify system setup
npm run verify

# Start application
npm start
```

**Access**: Open http://localhost:3847 in your browser (opens automatically)

### Basic Usage
1. **Upload**: Drag & drop or browse for PDF files
2. **Process**: Click "Extract Text" to begin OCR processing
3. **Download**: Automatically receive formatted .txt file
4. **Repeat**: Process additional files or stop server with `npm run stop`

## System Architecture

### OCR Processing Pipeline
```
PDF Upload → Image Conversion → Text Extraction → File Generation → Download
     ↓              ↓               ↓               ↓             ↓
  Multer    →    pdftoppm    →   Tesseract   →   Metadata    →  Cleanup
 (50MB max)   (300 DPI JPEG)  (vie+eng/LSTM)   (+Headers)    (Auto)
```

### Core Technologies
- **Backend**: Node.js + Express.js with ES6 modules
- **OCR Engine**: Tesseract with LSTM neural networks
- **PDF Processing**: Poppler utilities (pdftoppm)
- **File Handling**: Multer middleware with validation
- **Frontend**: Vanilla JavaScript SPA with modern CSS

### Key Libraries
- **node-tesseract-ocr (^2.2.1)**: Primary OCR wrapper
- **express (^4.19.0)**: Web server framework
- **multer (^1.4.5-lts.1)**: File upload handling
- **poppler-utils**: System PDF processing tools

## Vietnamese Language Implementation

### OCR Configuration
```javascript
{
  lang: 'vie+eng',    // Vietnamese + English recognition
  oem: 1,             // LSTM OCR Engine Mode
  psm: 3,             // Automatic page segmentation
}
```

### Character Support
- **Diacritical marks**: á, à, ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ
- **Special characters**: ă, â, đ, ê, ô, ơ, ư
- **Mixed content**: Vietnamese text with English words/numbers
- **Fallback processing**: English-only if Vietnamese fails

## Configuration

### Server Settings
- **Port**: 3847 (configured to avoid conflicts)
- **Max File Size**: 50MB per upload
- **Processing**: Synchronous with automatic cleanup
- **Temporary Storage**: Session-based isolation

### OCR Settings
- **Image Quality**: 300 DPI for optimal accuracy
- **Processing Mode**: Parallel page processing
- **Language Priority**: Vietnamese → English fallback
- **Output Format**: UTF-8 text with metadata headers

## Scripts & Management

```bash
npm start           # Start server (opens browser automatically)
npm run dev         # Development mode with file watching
npm run stop        # Stop server and cleanup processes
npm run verify      # Verify system dependencies
./stop.sh           # Alternative stop script with cleanup
```

## File Structure
```
/
├── public/                 # Frontend assets
│   ├── index.html         # Main web interface
│   ├── app.js             # Client-side JavaScript
│   └── styles.css         # Modern responsive CSS
├── docs/                  # Comprehensive documentation
├── ocr-processor.js       # Core OCR processing logic
├── server.js              # Express server and API
├── verify-setup.js        # System dependency validation
├── package.json           # Node.js configuration
└── temp/                  # Temporary file storage (auto-created)
```

## Performance & Limits

### Processing Performance
- **Small PDFs** (1-5 pages): 2-10 seconds
- **Medium PDFs** (6-20 pages): 15-45 seconds
- **Large PDFs** (21+ pages): 1-3 minutes
- **Memory Usage**: ~200-500MB during processing

### File Constraints
- **Maximum Size**: 50MB upload limit
- **Supported Format**: PDF only (validated by MIME type)
- **Concurrent Processing**: Multiple files supported
- **Quality Requirements**: Clear scanned text for best results

## Troubleshooting

### Common Issues

**"Tesseract not found"**
```bash
brew install tesseract tesseract-lang
tesseract --version
```

**"Vietnamese language pack missing"**
```bash
tesseract --list-langs | grep vie
# If missing: brew reinstall tesseract-lang
```

**"Poppler utilities missing"**
```bash
brew install poppler
which pdftoppm
```

**"Port already in use"**
- Application uses port 3847 specifically to avoid conflicts
- Run `npm run stop` to cleanup any remaining processes

### System Verification
```bash
npm run verify  # Comprehensive dependency check
```

## Security & Privacy

- **File Validation**: PDF MIME type checking with size limits
- **Temporary Processing**: No persistent file storage
- **Automatic Cleanup**: All files deleted after processing
- **Local Processing**: No external API dependencies
- **Session Isolation**: Concurrent processing without conflicts

## Documentation

Comprehensive documentation available in `docs/`:
- **docs/README.md**: Detailed user guide
- **docs/codebase-summary.md**: Technical implementation details
- **docs/project-overview-pdr.md**: Requirements and specifications
- **docs/system-architecture.md**: Architecture documentation
- **docs/code-standards.md**: Development standards and patterns

## Support

For setup issues:
1. Run `npm run verify` for dependency validation
2. Check browser console for client-side errors
3. Review server logs for processing details
4. Ensure all system dependencies are properly installed

**Requirements**: Node.js 18+, Tesseract OCR + Vietnamese pack, Poppler utilities