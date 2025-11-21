# Large File Processing - Implementation Guide

## Executive Summary

**Problem**: Current implementation crashes with OOM errors on PDFs > 30 pages due to loading all pages into memory simultaneously (`Promise.all()` approach).

**Solution**: Streaming architecture that processes one page at a time, maintaining <1GB memory usage for files up to 50MB/1500 pages.

**Status**: ✅ Ready for implementation - ONE CRITICAL FIX REQUIRED
**Timeline**: 3 weeks (phased deployment with feature flags)
**Risk**: Low - Non-breaking changes, backward compatible

**CRITICAL FIX**: Frontend response handling in `app.js` lines 159-167 must detect JSON vs blob response

## Quick Start Setup

### Prerequisites
```bash
# Install missing dependencies
npm install uuid

# Create required directories
mkdir -p checkpoints
mkdir -p temp/sessions

# Update package.json start script to include memory management
# Add: --expose-gc flag for garbage collection control
```

### Environment Configuration
```env
# Add to .env file
ENABLE_STREAMING=false      # Feature flag for gradual rollout
CHECKPOINT_INTERVAL=10       # Pages between checkpoint saves
MAX_MEMORY_MB=1024          # Memory limit per session
CLEANUP_AGE_DAYS=7          # Checkpoint retention period
PORT=3847                   # Keep existing port configuration
```

## Implementation Phases

### Phase 1: Core Streaming (Week 1) - HIGH PRIORITY

#### New Files to Create

**1. `streaming-processor.js`**
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class StreamingProcessor {
  constructor(options = {}) {
    this.maxMemory = options.maxMemory || 1024 * 1024 * 1024; // 1GB
    this.checkpointInterval = options.checkpointInterval || 10;
  }

  async processStreamingPDF(pdfPath, sessionId, progressCallback) {
    const pageCount = await this.getPageCount(pdfPath);
    const checkpoint = await this.loadCheckpoint(sessionId) || { lastPage: 0 };
    const outputPath = `temp/sessions/${sessionId}.txt`;
    const textStream = fs.createWriteStream(outputPath);

    for (let page = checkpoint.lastPage + 1; page <= pageCount; page++) {
      // Extract single page
      const imagePath = await this.extractSinglePage(pdfPath, page, sessionId);

      // OCR the page
      const pageText = await this.ocrPage(imagePath);

      // Stream result immediately
      textStream.write(`--- Page ${page} ---\n${pageText}\n\n`);

      // Save checkpoint every N pages
      if (page % this.checkpointInterval === 0) {
        await this.saveCheckpoint(sessionId, page, pageCount);
      }

      // Cleanup and memory management
      await fs.unlink(imagePath);
      if (global.gc && process.memoryUsage().heapUsed > this.maxMemory * 0.8) {
        global.gc();
      }

      // Progress callback
      if (progressCallback) {
        progressCallback({
          page,
          total: pageCount,
          percentage: (page / pageCount) * 100
        });
      }
    }

    textStream.end();
    return outputPath;
  }

  async extractSinglePage(pdfPath, pageNumber, sessionId) {
    const outputPath = `temp/sessions/${sessionId}_page_${pageNumber}`;
    const command = `pdftoppm -jpeg -r 300 -f ${pageNumber} -l ${pageNumber} "${pdfPath}" "${outputPath}"`;
    await execAsync(command);
    return `${outputPath}-${pageNumber}.jpg`;
  }

  async getPageCount(pdfPath) {
    const command = `pdfinfo "${pdfPath}" | grep Pages | awk '{print $2}'`;
    const { stdout } = await execAsync(command);
    return parseInt(stdout.trim());
  }
}
```

**2. `checkpoint-manager.js`**
```javascript
import fs from 'fs/promises';
import path from 'path';

export class CheckpointManager {
  static async save(sessionId, data) {
    const checkpointPath = `checkpoints/${sessionId}.json`;
    const checkpoint = {
      sessionId,
      lastPage: data.lastPage,
      totalPages: data.totalPages,
      timestamp: Date.now()
    };

    // Atomic write with backup
    const tempPath = `${checkpointPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(checkpoint, null, 2));
    await fs.rename(tempPath, checkpointPath);
  }

  static async load(sessionId) {
    try {
      const checkpointPath = `checkpoints/${sessionId}.json`;
      const data = await fs.readFile(checkpointPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async cleanup(daysOld = 7) {
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    const files = await fs.readdir('checkpoints');

    for (const file of files) {
      const filePath = path.join('checkpoints', file);
      const stats = await fs.stat(filePath);
      if (Date.now() - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
      }
    }
  }
}
```

#### Modify `server.js`
```javascript
// Add to imports
import { StreamingProcessor } from './streaming-processor.js';
import { CheckpointManager } from './checkpoint-manager.js';

// Add feature flag routing
app.post('/api/ocr', upload.single('pdf'), async (req, res) => {
  const fileSize = req.file.size;
  const useStreaming = process.env.ENABLE_STREAMING === 'true' &&
                       (fileSize > 10 * 1024 * 1024); // >10MB

  if (useStreaming) {
    const processor = new StreamingProcessor();
    const sessionId = uuidv4();

    // Start processing in background
    processor.processStreamingPDF(req.file.path, sessionId, (progress) => {
      // Progress will be sent via SSE in Phase 2
      console.log(`Processing: ${progress.page}/${progress.total}`);
    });

    res.json({
      sessionId,
      message: 'Processing started',
      trackProgress: `/api/progress/${sessionId}`
    });
  } else {
    // Use existing processor for small files
    // ... existing code ...
  }
});
```

#### Testing Checklist - Phase 1
- [ ] Process 100-page PDF with memory <1GB
- [ ] Checkpoint saves every 10 pages
- [ ] Resume from checkpoint after interruption
- [ ] No regression on files <10MB
- [ ] Memory cleanup working (verify with `--expose-gc`)

### Phase 2: Progress Tracking (Week 2) - MEDIUM PRIORITY

#### Add SSE Endpoint to `server.js`
```javascript
// Store active progress emitters
const progressEmitters = new Map();

app.get('/api/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send progress updates
  const emitter = progressEmitters.get(sessionId) || new EventEmitter();
  progressEmitters.set(sessionId, emitter);

  emitter.on('progress', (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  emitter.on('complete', (data) => {
    res.write(`data: ${JSON.stringify({ ...data, complete: true })}\n\n`);
    res.end();
    progressEmitters.delete(sessionId);
  });

  // Cleanup on disconnect
  req.on('close', () => {
    emitter.removeAllListeners();
  });
});

// Add session status endpoint
app.get('/api/session/:sessionId/status', async (req, res) => {
  const checkpoint = await CheckpointManager.load(req.params.sessionId);
  res.json(checkpoint || { error: 'Session not found' });
});
```

#### REQUIRED: Update `public/app.js` Response Handling
```javascript
// Replace lines 159-167 in handleFormSubmit() with:
const response = await fetch('/api/ocr', { method: 'POST', body: formData });

if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Processing failed');
}

// CRITICAL FIX: Detect response type
const contentType = response.headers.get('content-type');

if (contentType && contentType.includes('application/json')) {
    // Streaming mode - handle session response
    const data = await response.json();
    if (data.sessionId) {
        hideProgress();
        showStreamingMessage(data);
        pollSessionStatus(data.sessionId, startTime);
        return;
    }
}

// Existing blob download logic continues...
const blob = await response.blob();
// ... rest unchanged
```

**Phase 2 Enhancement: Real-time Progress with SSE**
```javascript
function trackProgress(sessionId) {
  const eventSource = new EventSource(`/api/progress/${sessionId}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.complete) {
      eventSource.close();
      downloadResult(sessionId);
    } else {
      updateProgressUI(data);
    }
  };

  eventSource.onerror = () => {
    console.error('Progress tracking error');
    eventSource.close();
  };
}
```

#### Testing Checklist - Phase 2
- [ ] Real-time progress updates working
- [ ] SSE connection stable
- [ ] Progress bar updates smoothly
- [ ] Time estimates within 20% accuracy
- [ ] Cancel functionality works
- [ ] Session recovery from checkpoint

### Phase 3: Optimization (Week 3) - LOW PRIORITY

#### Enhanced Features
```javascript
// Add to streaming-processor.js
class TesseractPool {
  constructor(size = 3) {
    this.workers = [];
    this.available = [];
    this.queue = [];
    this.initializeWorkers(size);
  }

  async process(imagePath, config) {
    const worker = await this.getWorker();
    try {
      return await worker.recognize(imagePath, config);
    } finally {
      this.releaseWorker(worker);
    }
  }
}

// Adaptive OCR settings
const ocrConfigs = [
  { lang: 'vie+eng', oem: 1, psm: 3, dpi: 300 }, // Primary
  { lang: 'eng', oem: 1, psm: 6, dpi: 300 },     // Fallback 1
  { lang: 'vie', oem: 0, psm: 3, dpi: 200 }      // Fallback 2
];

async function ocrWithFallback(imagePath) {
  for (const config of ocrConfigs) {
    try {
      const result = await tesseract.recognize(imagePath, config);
      if (result.confidence > 0.7) return result.text;
    } catch (error) {
      console.warn(`OCR attempt failed with config:`, config);
    }
  }
  return '[OCR Failed - Manual review required]';
}
```

#### Testing Checklist - Phase 3
- [ ] 300-page PDFs process successfully
- [ ] Process pooling reduces time by 30%
- [ ] Fallback OCR configs work
- [ ] Memory stays under 1GB for concurrent processing
- [ ] 95% success rate on large files

## Technical Reference

### Core Data Structures
```javascript
// Checkpoint format
{
  sessionId: "uuid",
  lastPage: 150,
  totalPages: 300,
  timestamp: 1699920000000,
  processingTime: [2.1, 2.3, 1.9], // Per-page times for estimates
}

// Progress message format
{
  sessionId: "uuid",
  page: 45,
  total: 150,
  percentage: 30,
  estimatedTime: 240000, // ms remaining
  pagesPerMinute: 12
}
```

### Performance Targets
- **Memory**: <1GB peak for any file size
- **Speed**: 2-5 seconds per page
- **Success Rate**: 95% for files up to 50MB
- **Concurrent Sessions**: 3-5 within 2GB total

### API Endpoints
```
POST   /api/ocr                     # Main processing (with streaming flag)
GET    /api/progress/:sessionId     # SSE progress stream
GET    /api/session/:sessionId/status # Check session status
GET    /api/session/:sessionId/download # Download partial/complete results
DELETE /api/session/:sessionId      # Cancel processing
```

## Deployment & Rollback

### Feature Flag Strategy
```javascript
const useStreaming = (fileSize) => {
  if (!process.env.ENABLE_STREAMING) return false;

  // Gradual rollout
  if (fileSize < 10 * 1024 * 1024) return false;  // <10MB: existing
  if (fileSize < 30 * 1024 * 1024) return optional; // 10-30MB: user choice
  return true; // >30MB: mandatory streaming
};
```

### Rollback Procedures
1. **Immediate**: Set `ENABLE_STREAMING=false`
2. **Quick Fix**: Increase `MAX_MEMORY_MB` temporarily
3. **Fallback**: Route affected files to original processor
4. **Full Rollback**: `git revert` to previous tag

### Monitoring Metrics
```javascript
// Track these metrics post-deployment
{
  processingTime: [],      // Per page and total
  memoryUsage: [],        // Peak and average
  errorRates: [],         // By error type
  recoverySuccess: [],    // Checkpoint recovery rate
  completionRate: []      // Success vs failure ratio
}
```

## Testing Strategy

### Test File Generation
```javascript
// create-test-pdfs.js
generateTestPDF(50, 'test-50-pages.pdf');
generateTestPDF(100, 'test-100-pages.pdf');
generateTestPDF(300, 'test-300-pages.pdf');
```

### Critical Test Scenarios
1. **Memory Test**: Process 300-page PDF, verify heap < 1GB
2. **Recovery Test**: Kill at 50%, verify checkpoint resume
3. **Concurrent Test**: 3x 100-page PDFs simultaneously
4. **Error Test**: Corrupt pages, verify graceful handling
5. **Performance Test**: Verify 2-5 sec/page processing

## Post-Implementation Checklist

- [ ] Update README.md with streaming capabilities
- [ ] Document new API endpoints
- [ ] Add troubleshooting guide for large files
- [ ] Set up checkpoint cleanup cron job
- [ ] Configure monitoring dashboards
- [ ] Train support team on new features

## Success Criteria

**Phase 1 Ship Requirements:**
- ✅ 100-page PDF processes without OOM
- ✅ Memory usage consistently <1GB
- ✅ Checkpoint recovery works
- ✅ Frontend handles streaming vs immediate response correctly
- ✅ No regression on small files (<10MB)

**Phase 2-3 Enhancements:**
- ✅ Real-time progress updates via SSE
- ✅ 300-page PDFs process successfully
- ✅ Worker pool optimization

## Implementation Priority

**SHIP WITH PHASE 1 ONLY** - The one frontend fix makes the architecture complete and solves the OOM problem. Phases 2-3 are pure enhancements.