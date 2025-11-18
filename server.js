import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { processPDF, generateTextFile } from './ocr-processor.js';
import { StreamingProcessor } from './streaming-processor.js';
import { CheckpointManager } from './checkpoint-manager.js';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Multer configuration for file uploads
const upload = multer({
  dest: 'temp/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Serve static files from public directory
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// OCR processing endpoint with intelligent routing
app.post('/api/ocr', upload.single('pdf'), async (req, res) => {
  let tempFilesToCleanup = [];

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { originalname, size, path: tempPath } = req.file;
    tempFilesToCleanup.push(tempPath);

    console.log(`Processing file: ${originalname}`);
    console.log(`File size: ${size} bytes`);

    // Feature flag configuration
    const enableStreaming = process.env.ENABLE_STREAMING === 'true';
    const streamingThreshold = parseInt(process.env.STREAMING_THRESHOLD_MB || '10') * 1024 * 1024; // Default 10MB

    // Determine processing method based on file size and configuration
    const useStreaming = enableStreaming && size > streamingThreshold;

    if (useStreaming) {
      console.log('Using streaming processor for large file');

      // Generate unique session ID
      const sessionId = uuidv4();

      // Initialize streaming processor
      const processor = new StreamingProcessor({
        maxMemory: parseInt(process.env.MAX_MEMORY_MB || '1024') * 1024 * 1024,
        checkpointInterval: parseInt(process.env.CHECKPOINT_INTERVAL || '10')
      });

      // Start background processing
      setImmediate(async () => {
        try {
          const outputPath = await processor.processStreamingPDF(tempPath, sessionId, (progress) => {
            console.log(`Progress: ${progress.page}/${progress.total} (${progress.percentage}%) - Memory: ${Math.round(progress.memoryUsage / 1024 / 1024)}MB`);
          });

          console.log(`Streaming processing completed: ${sessionId}`);

          // Cleanup original PDF after processing
          try {
            await fs.unlink(tempPath);
          } catch (cleanupError) {
            console.warn(`Cleanup warning: ${cleanupError.message}`);
          }
        } catch (error) {
          console.error(`Streaming processing failed for ${sessionId}:`, error);

          // Save error in checkpoint for status tracking
          await CheckpointManager.update(sessionId, {
            lastError: error.message,
            errorCount: 1
          });
        }
      });

      // Return session info for tracking
      return res.json({
        sessionId,
        streaming: true,
        message: 'Large file processing started',
        statusEndpoint: `/api/session/${sessionId}/status`,
        downloadEndpoint: `/api/session/${sessionId}/download`,
        filename: originalname,
        fileSize: size
      });

    } else {
      console.log('Using legacy processor for small file');

      // Use original processing for small files
      const result = await processPDF(tempPath, 'temp');

      if (!result.original || result.original.trim().length === 0) {
        return res.status(400).json({
          error: 'No text found in PDF. Make sure the PDF contains readable text or images with text.'
        });
      }

      // Return JSON with both original and cleaned text
      res.json({
        original: result.original,
        cleaned: result.cleaned,
        metadata: {
          documentType: result.metadata.documentType,
          changesCount: result.metadata.changesCount,
          totalCorrections: result.metadata.totalCorrections || 0,  // NEW: Accurate count
          confidence: result.metadata.confidence,
          originalLength: result.metadata.originalLength,
          cleanedLength: result.metadata.cleanedLength,
          reduction: result.metadata.reduction,
          changes: result.metadata.changes || []
        },
        pages: result.pages,
        processingTime: result.processingTime,
        ocrTime: result.ocrTime,
        cleaningTime: result.cleaningTime,
        filename: originalname
      });

      // Cleanup temp files after response sent
      setTimeout(async () => {
        for (const filePath of tempFilesToCleanup) {
          try {
            await fs.unlink(filePath);
          } catch (cleanupError) {
            console.warn(`Cleanup warning: ${cleanupError.message}`);
          }
        }
      }, 1000);
    }

  } catch (error) {
    console.error('OCR processing error:', error);

    // Cleanup on error
    for (const filePath of tempFilesToCleanup) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn(`Cleanup warning: ${cleanupError.message}`);
      }
    }

    res.status(500).json({
      error: error.message || 'OCR processing failed'
    });
  }
});

// Session status endpoint
app.get('/api/session/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = await CheckpointManager.getStatus(sessionId);

    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// Session download endpoint
app.get('/api/session/:sessionId/download', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = await CheckpointManager.getStatus(sessionId);

    if (!status.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!status.hasOutput) {
      return res.status(404).json({ error: 'No output file available' });
    }

    const outputPath = status.outputPath;
    const filename = `${sessionId}_ocr_result.txt`;

    // Stream the file for download
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Session management endpoint (for cleanup/cancel)
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const removed = await CheckpointManager.removeSession(sessionId);

    if (removed) {
      res.json({ message: 'Session removed successfully' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Session removal error:', error);
    res.status(500).json({ error: 'Failed to remove session' });
  }
});

// List all sessions (for debugging/monitoring)
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await CheckpointManager.listSessions();
    const stats = await CheckpointManager.getStatistics();

    res.json({
      sessions,
      statistics: stats
    });
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`PDF OCR Server running on http://localhost:${PORT}`);
  console.log(`Upload endpoint: POST /api/ocr`);
  console.log(`Max file size: 50MB`);
  console.log(`Temp directory: ${path.resolve('temp')}`);
});

// Cleanup temp files on server shutdown
process.on('SIGINT', async () => {
  console.log('\\nShutting down server...');
  try {
    const tempDir = 'temp';
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file));
    }
    console.log('Cleaned up temporary files');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
  process.exit(0);
});