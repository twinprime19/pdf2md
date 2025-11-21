# Phase 5: Error Handling and Cleanup

## Objectives
- Implement comprehensive error handling
- Add process cleanup mechanisms
- Create startup and shutdown scripts
- Finalize production considerations

## Tasks

### 5.1 Enhanced Error Handling
```javascript
// Graceful error handling for OCR failures
const processWithRetry = async (func, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await func();
    } catch (error) {
      if (i === retries) throw error;
      console.log(`Attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

// Memory monitoring for large files
const checkMemoryUsage = () => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected:', usage);
  }
};
```

### 5.2 Process Cleanup and Shutdown
```javascript
// server.js - Add cleanup handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, cleaning up...`);

  // Close server
  server.close(async () => {
    try {
      // Clean up temp directories
      await fs.emptyDir(path.join(__dirname, 'uploads'));
      await fs.emptyDir(path.join(__dirname, 'temp'));

      console.log('Cleanup completed');
      process.exit(0);
    } catch (error) {
      console.error('Cleanup error:', error);
      process.exit(1);
    }
  });
}
```

### 5.3 Startup and Stop Scripts
```bash
#!/bin/bash
# start.sh
echo "Starting PDF OCR Application..."
export PORT=3847
npm start

# stop.sh
echo "Stopping PDF OCR Application..."
pkill -f "node.*server.js"
echo "Application stopped"
```

### 5.4 Input Validation and Sanitization
```javascript
// File validation middleware
const validatePdfFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  // Additional security checks
  const allowedMimeTypes = ['application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({ error: 'File too large' });
  }

  next();
};

// Sanitize filename for security
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};
```

### 5.5 Logging and Monitoring
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Log processing metrics
const logProcessingTime = (startTime, filename) => {
  const duration = Date.now() - startTime;
  logger.info('PDF processed', {
    filename,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  });
};
```

### 5.6 Configuration Management
```javascript
// config.js
module.exports = {
  server: {
    port: process.env.PORT || 3847,
    host: process.env.HOST || 'localhost'
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf'],
    uploadDir: './uploads',
    tempDir: './temp'
  },
  ocr: {
    language: 'vie',
    oem: 1,
    psm: 3,
    timeout: 60000 // 1 minute timeout
  }
};
```

### 5.7 Health Check and Monitoring
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Simple metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    requests_total: requestCounter,
    processing_errors: errorCounter,
    memory_usage: process.memoryUsage()
  });
});
```

### 5.8 Final Project Structure
```
pdf-ocr-app/
├── server.js              # Main server
├── config.js              # Configuration
├── package.json           # Dependencies
├── start.sh               # Startup script
├── stop.sh                # Stop script
├── README.md              # Usage instructions
├── public/                # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── uploads/               # Temp uploads (auto-cleanup)
├── temp/                  # Temp processing (auto-cleanup)
└── logs/                  # Application logs
```

## Acceptance Criteria
- Comprehensive error handling implemented
- Graceful shutdown with cleanup
- Input validation and sanitization
- Logging and monitoring in place
- Configuration management
- Health check endpoints
- Startup/stop scripts working
- Memory management for large files

## Production Considerations
- File size limits configured
- Timeout handling for long OCR operations
- Memory usage monitoring
- Security validation
- Proper error responses
- Log rotation strategy

## Final Testing
- Large PDF file handling
- Memory usage under load
- Error scenario recovery
- Graceful shutdown testing
- Security validation
- Performance monitoring

## Documentation Requirements
- README.md with setup instructions
- API documentation for endpoints
- Troubleshooting guide
- Configuration options

## Deployment Notes
- Vietnamese language pack installation
- Port configuration for deployment
- Environment variable setup
- Log file management
- Security considerations

This completes the implementation plan for a robust, production-ready PDF OCR application with Vietnamese text support.