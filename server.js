import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { processPDF, generateTextFile } from './ocr-processor.js';
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

// OCR processing endpoint
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

    // Process PDF and extract text
    const result = await processPDF(tempPath, 'temp');

    if (!result.text || result.text.trim().length === 0) {
      return res.status(400).json({
        error: 'No text found in PDF. Make sure the PDF contains readable text or images with text.'
      });
    }

    // Generate text file for download
    const textFilePath = await generateTextFile(result.text, originalname, 'temp');
    tempFilesToCleanup.push(textFilePath);

    // Send the text file
    res.download(textFilePath, path.basename(textFilePath), (err) => {
      if (err) {
        console.error('Download error:', err);
      }

      // Cleanup temp files after download
      setTimeout(async () => {
        for (const filePath of tempFilesToCleanup) {
          try {
            await fs.unlink(filePath);
          } catch (cleanupError) {
            console.warn(`Cleanup warning: ${cleanupError.message}`);
          }
        }
      }, 1000);
    });

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