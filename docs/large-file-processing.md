# Large File Processing Guide

## Overview

This guide covers the streaming architecture implementation for processing large PDF files (300+ pages) without memory crashes. The streaming processor solves critical OOM (Out of Memory) issues that occur with traditional batch processing approaches.

## Problem Statement

### Before Streaming (Legacy Mode)
- **Memory Issue**: Promise.all() loads all pages into memory simultaneously
- **Memory Usage**: 5.5GB+ for 300-page documents
- **Practical Limit**: ~30 pages before memory crashes occur
- **Processing Pattern**: All pages → OCR → Combine results

### After Streaming (Phase 1 Solution)
- **Memory Efficient**: Page-by-page processing with immediate cleanup
- **Memory Usage**: <1GB consistently regardless of file size
- **Scalability**: Supports 300+ pages without crashes
- **Processing Pattern**: One page → OCR → Write → Cleanup → Next page

## Architecture Overview

### Intelligent Routing System
```javascript
// Automatic processor selection based on file size
if (fileSize >= STREAMING_THRESHOLD_MB && ENABLE_STREAMING) {
  return streamingProcessor.processStreamingPDF(pdfPath, sessionId);
} else {
  return legacyProcessor.processPDF(pdfPath);
}
```

### Key Components
1. **StreamingProcessor** (`streaming-processor.js`): Core streaming logic
2. **CheckpointManager** (`checkpoint-manager.js`): Recovery and persistence
3. **Server Routing** (`server.js`): Feature flag and endpoint management
4. **Frontend Updates** (`public/app.js`): JSON vs blob response handling

## Configuration

### Environment Variables
```bash
# Feature Control
ENABLE_STREAMING=false             # Phase 1: Gradual rollout (default: false)
STREAMING_THRESHOLD_MB=10          # Files ≥10MB use streaming mode

# Performance Tuning
MAX_MEMORY_MB=1024                 # Memory limit per session
CHECKPOINT_INTERVAL=10             # Save checkpoint every N pages
ENABLE_GC=false                    # Force garbage collection (dev only)

# Maintenance
CHECKPOINT_RETENTION_DAYS=7        # Auto-cleanup expired checkpoints
LOG_LEVEL=info                     # Logging: debug|info|warn|error
```

### Rollout Strategy
1. **Phase 1**: ENABLE_STREAMING=false (ship ready, manual enablement)
2. **Phase 2**: ENABLE_STREAMING=true with monitoring
3. **Phase 3**: Remove legacy processor after validation

## Usage Guide

### Small Files (<10MB) - Legacy Mode
```bash
# Automatic routing to legacy processor
# - Fast processing with Promise.all()
# - Memory usage: ~200-500MB
# - Immediate blob download response
```

### Large Files (≥10MB) - Streaming Mode
```bash
# Automatic routing to streaming processor
# - Page-by-page processing
# - Memory usage: <1GB consistently
# - Session-based progress tracking
# - JSON response with download URL
```

## Performance Characteristics

### Memory Usage Comparison

| File Size | Pages | Legacy Mode | Streaming Mode |
|-----------|-------|-------------|----------------|
| 5MB | 20 pages | ~300MB | ~300MB |
| 15MB | 60 pages | ~1.2GB ⚠️ | ~800MB ✅ |
| 30MB | 120 pages | ~3.8GB ⚠️ | ~900MB ✅ |
| 50MB | 300 pages | ~5.5GB 💥 | ~1GB ✅ |

### Processing Time

| File Size | Legacy Mode | Streaming Mode |
|-----------|-------------|----------------|
| Small (1-5 pages) | 2-10 seconds | 2-10 seconds |
| Medium (6-20 pages) | 15-45 seconds | 20-50 seconds |
| Large (21-100 pages) | Memory crash 💥 | 2-4 minutes ✅ |
| Extra Large (100+ pages) | Not supported | Linear scaling ✅ |

## API Endpoints

### Legacy Mode Endpoints
```http
POST /api/ocr
Content-Type: multipart/form-data
Response: application/octet-stream (blob download)
```

### Streaming Mode Endpoints
```http
POST /api/ocr/streaming
Content-Type: multipart/form-data
Response: application/json

GET /api/session/:sessionId/status
Response: { "status": "processing", "progress": 45, "totalPages": 100 }

GET /api/download/:sessionId
Response: application/octet-stream (text file download)

GET /api/sessions
Response: [{ "sessionId": "...", "status": "complete", ... }]
```

## Checkpoint System

### Checkpoint Data Structure
```json
{
  "sessionId": "uuid-v4",
  "lastPage": 45,
  "totalPages": 100,
  "complete": false,
  "timestamp": 1699123456789,
  "processingTimes": [2.3, 1.8, 2.1, ...],
  "errorCount": 0,
  "lastError": null
}
```

### Recovery Process
1. **Session Creation**: Generate unique session ID
2. **Checkpoint Check**: Load existing checkpoint if available
3. **Resume Point**: Start from `lastPage + 1`
4. **Progress Tracking**: Update checkpoint every N pages
5. **Completion**: Mark session as complete when done

### Storage Locations
```
checkpoints/
├── [session-id].json              # Checkpoint data
└── ...

temp/sessions/
├── [session-id].txt               # Streaming output file
└── ...
```

## Error Handling & Recovery

### Common Scenarios

#### Memory Pressure
```javascript
// Automatic garbage collection when enabled
if (global.gc && ENABLE_GC) {
  global.gc();
}
```

#### Processing Interruption
```javascript
// Resume from checkpoint
const checkpoint = await CheckpointManager.load(sessionId);
const startPage = checkpoint ? checkpoint.lastPage + 1 : 1;
```

#### Page Processing Failure
```javascript
// Continue processing with error tracking
checkpoint.errorCount++;
checkpoint.lastError = error.message;
await CheckpointManager.save(sessionId, checkpoint);
```

## Testing & Validation

### Available Test Commands
```bash
npm test                    # Comprehensive test suite (48+ tests)
npm run test:memory         # Memory usage validation
npm run test:phase1         # Phase 1 implementation validation
```

### Test Coverage
- ✅ Basic functionality (upload, processing, download)
- ✅ Memory management (<1GB limit validation)
- ✅ Checkpoint persistence and recovery
- ✅ Error handling and cleanup
- ✅ Session management and progress tracking
- ✅ Feature flag behavior
- ✅ Edge cases (interruptions, large files)

## Monitoring & Debugging

### Logging
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Monitor memory usage
node --expose-gc server.js
```

### Key Metrics to Monitor
1. **Memory Usage**: Should stay <1GB per session
2. **Processing Time**: Linear scaling with page count
3. **Checkpoint Size**: Gradual growth in checkpoints/ directory
4. **Error Rate**: Failed page processing attempts
5. **Session Duration**: Time from start to completion

### Common Issues

#### High Memory Usage
```bash
# Check if garbage collection is enabled
ENABLE_GC=true npm start

# Reduce checkpoint interval
CHECKPOINT_INTERVAL=5
```

#### Slow Processing
```bash
# Check OCR configuration
tesseract --list-langs | grep vie

# Verify system dependencies
npm run verify
```

#### Failed Sessions
```bash
# Check checkpoint data
ls checkpoints/
cat checkpoints/[session-id].json

# Review error logs
LOG_LEVEL=debug npm start
```

## Advanced Configuration

### Memory Optimization
```bash
# Fine-tune memory limits
MAX_MEMORY_MB=512              # Reduce for constrained environments
MAX_MEMORY_MB=2048             # Increase for high-performance systems
```

### Performance Tuning
```bash
# Adjust checkpoint frequency
CHECKPOINT_INTERVAL=5          # More frequent saves (slower, more resilient)
CHECKPOINT_INTERVAL=20         # Less frequent saves (faster, less resilient)
```

### Development Mode
```bash
# Enable all debugging features
ENABLE_STREAMING=true
ENABLE_GC=true
LOG_LEVEL=debug
CHECKPOINT_INTERVAL=2
```

## Deployment Recommendations

### Production Settings
```bash
ENABLE_STREAMING=false         # Phase 1: Manual enablement for testing
STREAMING_THRESHOLD_MB=10      # Conservative threshold
MAX_MEMORY_MB=1024             # Standard memory limit
CHECKPOINT_INTERVAL=10         # Balanced checkpoint frequency
LOG_LEVEL=info                 # Production logging
```

### Gradual Rollout Plan
1. **Week 1**: Deploy with ENABLE_STREAMING=false, test manual enablement
2. **Week 2**: Enable streaming for specific large files, monitor performance
3. **Week 3**: Full enablement with monitoring and fallback capability
4. **Month 2**: Phase 2 implementation with enhanced UI

## Troubleshooting Guide

### Streaming Not Working
1. Check `ENABLE_STREAMING=true` in .env
2. Verify file size exceeds `STREAMING_THRESHOLD_MB`
3. Review server logs for feature flag routing

### Memory Still High
1. Confirm streaming mode is active (check logs)
2. Enable garbage collection with `ENABLE_GC=true`
3. Reduce `MAX_MEMORY_MB` if needed

### Checkpoints Not Saving
1. Verify checkpoints/ directory exists and is writable
2. Check disk space for checkpoint storage
3. Review error logs for permission issues

### Session Recovery Failing
1. Check checkpoint file integrity (`cat checkpoints/[session].json`)
2. Verify temp/sessions/ directory structure
3. Clear corrupted checkpoints manually

This guide provides comprehensive coverage of the Phase 1 streaming implementation, enabling confident deployment and operation of the large file processing capabilities.