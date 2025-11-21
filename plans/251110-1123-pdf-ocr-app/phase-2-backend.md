# Phase 2: Backend Server with File Upload

## Objectives
- Create Express server with file upload capability
- Configure Multer for PDF handling
- Set up basic routing structure
- Implement temporary file management

## Tasks

### 2.1 Express Server Setup
```javascript
// server.js basic structure
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3847; // Random port
```

### 2.2 Multer Configuration
```javascript
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'), false);
    }
  }
});
```

### 2.3 Static File Serving
```javascript
app.use(express.static('public'));
app.use(express.json());
```

### 2.4 Route Implementation
- `GET /` - Serve main page
- `POST /upload` - Handle PDF upload
- `GET /health` - Health check endpoint

### 2.5 File Cleanup Utilities
```javascript
// Cleanup function for temporary files
const cleanupFiles = async (files) => {
  for (const file of files) {
    try {
      await fs.remove(file);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
};
```

### 2.6 Error Handling Middleware
```javascript
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'File upload error' });
  }
  res.status(500).json({ error: 'Server error' });
});
```

## Acceptance Criteria
- Express server runs on configured port
- PDF file upload endpoint functional
- File size and type validation working
- Static file serving operational
- Basic error handling implemented
- Temporary file cleanup utility ready

## Key Files
- `server.js` - Complete server implementation
- Route handlers for upload and health check
- Multer configuration for PDF files
- Error handling middleware

## Testing
- Server starts without errors
- Upload endpoint accepts PDF files
- Rejects non-PDF files
- File size limits enforced
- Static files served correctly

## Next Phase
Proceed to Phase 3: PDF Processing and OCR Integration