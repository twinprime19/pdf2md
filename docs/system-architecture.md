# System Architecture

## Architecture Overview

**Pattern**: Three-layer architecture with stateless processing
**Deployment**: Self-contained Node.js application
**Communication**: HTTP REST API with file upload/download

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐    System Calls    ┌─────────────────┐
│   Web Browser   │◄─────────────── │   Express.js    │◄─────────────────── │  OCR Pipeline   │
│   (Frontend)    │                 │   (Backend)     │                     │  (Processing)   │
└─────────────────┘                 └─────────────────┘                     └─────────────────┘
         │                                   │                                       │
         │                                   │                                       │
    Static Files                      Temporary Storage                    System Dependencies
     (HTML/CSS/JS)                       (temp/)                          (Tesseract/Poppler)
```

## Component Architecture

### Frontend Layer (`/public`)

#### Web Interface (`index.html`)
- **Purpose**: Single-page application for file upload and download
- **Framework**: Vanilla HTML5 with semantic markup
- **Features**:
  - Drag-and-drop file upload zone
  - File validation feedback
  - Progress indication
  - Download management
- **Responsive**: Mobile-friendly design with CSS Grid/Flexbox

#### Client Logic (`app.js`)
- **Purpose**: File handling, API communication, and UI state management
- **Architecture**: Event-driven with modular functions
- **Key Features**:
  - File validation (type, size)
  - FormData construction for file upload
  - Blob handling for file download
  - Progress simulation and error handling
- **State Management**: Simple variables for file selection and processing status

#### Styling (`styles.css`)
- **Purpose**: Visual design and user interaction feedback
- **Architecture**: Component-based CSS with BEM-like naming
- **Features**: Drag-and-drop visual states, progress animations, responsive layout

### Backend Layer (`/server.js`)

#### HTTP Server
```javascript
Express.js Application
├── Static File Middleware (public/)
├── Multer File Upload Middleware
├── CORS and Security Headers
└── Error Handling Middleware
```

#### API Endpoints
- **`GET /`**: Serve static frontend application
- **`GET /health`**: System health check
- **`POST /api/ocr`**: PDF processing endpoint
  - File upload via multipart/form-data
  - Validation (type, size)
  - OCR processing invocation
  - File download response

#### Middleware Stack
```javascript
app.use(express.static('public'))     // Static files
app.use('/api/ocr', upload.single())  // File upload
app.use(errorHandler)                 // Error handling
```

### Processing Layer (`/ocr-processor.js`)

#### PDF Processing Pipeline
```
PDF Input → PDF-to-Images → OCR Processing → Text Assembly → File Output
```

#### Core Modules

**PDF to Images Converter**
```javascript
pdfToImages(pdfPath, outputDir)
├── System call: pdftoppm -jpeg -r 300
├── JPEG image generation (300 DPI)
├── File path collection and sorting
└── Return image file array
```

**OCR Text Extractor**
```javascript
extractTextFromImage(imagePath)
├── Tesseract configuration (vie+eng, OEM 1, PSM 3)
├── Primary OCR attempt (Vietnamese)
├── Fallback OCR attempt (English)
└── Return cleaned text
```

**PDF Processor**
```javascript
processPDF(pdfPath, tempDir)
├── Create session-specific image directory
├── Convert PDF to images
├── Parallel OCR processing of all images
├── Text assembly with page separators
├── Cleanup temporary images
└── Return combined text with metadata
```

## Data Flow Architecture

### Upload Flow
```
1. User selects PDF file in browser
2. Client validates file (type, size)
3. FormData object created with file
4. HTTP POST to /api/ocr endpoint
5. Multer middleware stores file in temp/
6. Server calls processPDF function
7. OCR pipeline processes file
8. Text file generated in temp/
9. File sent as download response
10. Temporary files cleaned up
```

### Processing Flow
```
PDF File (temp/input.pdf)
    ↓
PDF-to-Images Conversion (pdftoppm)
    ↓
Image Files (temp/images_[session]/page-*.jpg)
    ↓
Parallel OCR Processing (Tesseract)
    ↓
Text Array (one per page)
    ↓
Text Assembly (page separators + metadata)
    ↓
Output File (temp/[filename]_ocr_[timestamp].txt)
    ↓
Download Response + Cleanup
```

### Error Handling Flow
```
Error Occurred
    ↓
Log Error Details
    ↓
Cleanup Temporary Files
    ↓
Return HTTP Error Response
    ↓
Client Displays User-Friendly Message
```

## Storage Architecture

### Temporary File Management
```
temp/
├── [uploaded-file-id].pdf          # Original uploaded file
├── images_[session-id]/             # Session-specific image directory
│   ├── page-01.jpg                  # Converted PDF pages
│   ├── page-02.jpg
│   └── ...
└── [filename]_ocr_[timestamp].txt   # Generated output file
```

#### Lifecycle Management
- **Creation**: Multer creates uploaded file, OCR processor creates images
- **Processing**: Files read during OCR processing
- **Cleanup**: Automatic deletion after download or on error
- **Session Isolation**: Unique directories prevent file conflicts

### Memory Management
- **Streaming**: Large files processed page-by-page
- **Cleanup**: Immediate file deletion after use
- **Limits**: 50MB upload limit prevents memory exhaustion
- **Concurrent Processing**: Multiple requests handled independently

## System Integration Architecture

### External Dependencies

#### System Binaries
```
Tesseract OCR Engine
├── Core Engine: Text recognition
├── Language Data: Vietnamese (vie) + English (eng)
├── Configuration: OEM 1 (LSTM), PSM 3 (Auto segmentation)
└── Invocation: node-tesseract-ocr wrapper

Poppler Utilities
├── pdftoppm: PDF to image conversion
├── Configuration: JPEG output, 300 DPI
├── System Integration: Command line execution
└── Error Handling: Exit code and stderr monitoring
```

#### Node.js Ecosystem
```
Express.js Framework
├── HTTP Server: Request/response handling
├── Middleware: File upload, static files, error handling
└── Security: CORS, input validation

Multer Middleware
├── File Upload: Multipart form parsing
├── Storage: Temporary file management
├── Validation: File type and size limits
└── Security: Filename sanitization
```

## Security Architecture

### Input Validation
- **File Type**: MIME type checking (application/pdf)
- **File Size**: 50MB maximum limit
- **File Content**: PDF structure validation via poppler
- **Upload Path**: Sanitized temporary filenames

### File Isolation
- **Temporary Storage**: Isolated temp/ directory
- **Session Separation**: Unique subdirectories per processing session
- **Access Control**: No persistent storage, immediate cleanup
- **Path Security**: Absolute path handling, no relative path traversal

### Error Security
- **Information Disclosure**: Generic error messages to users
- **Logging**: Detailed errors logged server-side only
- **Cleanup**: Guaranteed file cleanup on errors
- **Resource Limits**: Processing timeouts and memory limits

## Performance Architecture

### Scalability Design
- **Stateless Processing**: No session state, horizontal scaling ready
- **Concurrent Requests**: Independent processing pipelines
- **Resource Management**: Automatic cleanup prevents resource leaks
- **Load Distribution**: Multiple instances can run on different ports

### Optimization Strategies
- **Image Resolution**: 300 DPI balance of quality vs speed
- **Parallel Processing**: Concurrent page processing
- **Memory Efficiency**: Stream processing, immediate cleanup
- **Caching**: No caching (stateless design)

### Performance Monitoring
```
Metrics Collected:
├── Processing Time: Total OCR pipeline duration
├── File Size: Input file size tracking
├── Page Count: Number of pages processed
├── Memory Usage: Peak memory during processing
└── Error Rate: Failed processing attempts
```

## Deployment Architecture

### Development Environment
```
Local Machine
├── Node.js Runtime (18+)
├── System Dependencies (Tesseract, Poppler)
├── NPM Dependencies (Express, Multer, etc.)
└── Verification Script (npm run verify)
```

### Production Considerations
- **Process Management**: PM2 or similar for production
- **Resource Limits**: Memory and CPU constraints
- **Log Management**: Structured logging and rotation
- **Health Monitoring**: `/health` endpoint for load balancer checks
- **Graceful Shutdown**: SIGINT handler for cleanup

### Configuration Management
```
Environment Variables:
├── PORT: Server port (default 3847)
├── TEMP_DIR: Temporary directory path
├── MAX_FILE_SIZE: Upload size limit
└── OCR_LANGUAGES: Tesseract language configuration
```

## Monitoring and Observability

### Logging Strategy
- **Request Logging**: File upload and processing events
- **Error Logging**: Detailed error context and stack traces
- **Performance Logging**: Processing times and resource usage
- **Security Logging**: Invalid upload attempts and security events

### Health Checks
- **Application Health**: `/health` endpoint with system status
- **Dependency Health**: Tesseract and poppler availability
- **Resource Health**: Memory usage and temp directory space
- **Processing Health**: Success/failure rate monitoring