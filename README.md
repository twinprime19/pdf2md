# PDF OCR Application

Professional Vietnamese text extraction tool for scanned PDF documents using Tesseract OCR with comprehensive language support.

## Features

### Core Functionality
- **Vietnamese + English OCR**: Dual-language recognition with automatic fallback
- **Large File Support**: Handle PDFs up to 50MB with streaming architecture
- **Streaming Processing**: Memory-efficient processing for 300+ page documents
- **Drag & Drop Interface**: Modern web interface with real-time progress tracking
- **Intelligent Routing**: Auto-selects legacy or streaming processor based on file size
- **Checkpoint Recovery**: Resume processing from interruption points
- **High-Quality Conversion**: 300 DPI image processing for optimal OCR accuracy
- **Formatted Output**: Downloadable .txt files with metadata and page separators

### Advanced Features
- **Streaming Architecture**: Process large files with <1GB memory usage
- **Feature Flag System**: Gradual rollout with ENABLE_STREAMING configuration
- **Fallback Mechanisms**: English-only processing if Vietnamese OCR fails
- **Session Management**: Concurrent file processing with checkpoint isolation
- **Real-time Progress**: Visual feedback with session status tracking
- **Error Recovery**: Comprehensive error handling with automatic retry logic
- **Memory Management**: Automatic garbage collection and resource optimization
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

### Environment Variables
```bash
# Core Server Settings
PORT=3847                          # Application port

# Streaming Feature Control
ENABLE_STREAMING=false             # Enable streaming processor (Phase 1)
STREAMING_THRESHOLD_MB=10          # File size threshold for streaming mode

# Memory & Performance
MAX_MEMORY_MB=1024                 # Maximum memory per session
CHECKPOINT_INTERVAL=10             # Pages processed before checkpoint save
ENABLE_GC=false                    # Enable garbage collection (dev only)

# Maintenance & Cleanup
CHECKPOINT_RETENTION_DAYS=7        # Checkpoint file retention period
LOG_LEVEL=info                     # Logging verbosity: debug|info|warn|error
```

### Server Settings
- **Port**: 3847 (configured to avoid conflicts)
- **Max File Size**: 50MB per upload
- **Processing Mode**: Intelligent routing (Legacy <10MB, Streaming ≥10MB)
- **Memory Limit**: <1GB per session with automatic management
- **Checkpoint System**: Recovery support with configurable intervals
- **Session Management**: Isolated temporary storage with automatic cleanup

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
npm test            # Run comprehensive test suite
npm run test:memory # Memory usage validation tests
npm run test:phase1 # Phase 1 streaming implementation tests
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
├── ocr-processor.js       # Legacy OCR processing logic
├── streaming-processor.js # Streaming processor for large files
├── checkpoint-manager.js  # Checkpoint persistence and recovery
├── server.js              # Express server with intelligent routing
├── verify-setup.js        # System dependency validation
├── package.json           # Node.js configuration
├── .env                   # Environment configuration
├── temp/                  # Temporary file storage (auto-created)
└── checkpoints/           # Checkpoint storage (auto-created)
```

## Performance & Limits

### Processing Performance

#### Legacy Mode (Files <10MB)
- **Small PDFs** (1-5 pages): 2-10 seconds
- **Medium PDFs** (6-20 pages): 15-45 seconds
- **Memory Usage**: ~200-500MB during processing

#### Streaming Mode (Files ≥10MB)
- **Large PDFs** (21-100 pages): Linear time scaling, ~30-45s per 10 pages
- **Extra Large PDFs** (100-300+ pages): Consistent performance, checkpoint recovery
- **Memory Usage**: <1GB consistently, regardless of file size
- **Resumable**: Continue from last checkpoint on interruption

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