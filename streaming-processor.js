import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import tesseract from 'node-tesseract-ocr';

const execAsync = promisify(exec);

/**
 * Streaming PDF processor that handles large files without memory exhaustion
 * Processes one page at a time with checkpoint support and memory management
 */
export class StreamingProcessor {
  constructor(options = {}) {
    this.maxMemory = options.maxMemory || 1024 * 1024 * 1024; // 1GB default
    this.checkpointInterval = options.checkpointInterval || 10;
  }

  /**
   * Process PDF using streaming architecture
   * @param {string} pdfPath - Path to PDF file
   * @param {string} sessionId - Unique session identifier
   * @param {Function} progressCallback - Progress update callback
   * @returns {Promise<string>} Path to output text file
   */
  async processStreamingPDF(pdfPath, sessionId, progressCallback) {
    const pageCount = await this.getPageCount(pdfPath);
    const checkpoint = await this.loadCheckpoint(sessionId) || { lastPage: 0 };
    const outputPath = `temp/sessions/${sessionId}.txt`;

    // Initialize output file or append to existing
    let textStream;
    if (checkpoint.lastPage === 0) {
      // New processing - create file with header
      textStream = await fs.open(outputPath, 'w');
      const header = `OCR Extraction Results (Streaming)\n`;
      const separator = `${'='.repeat(50)}\n`;
      const metadata = `Processing started: ${new Date().toLocaleString()}\nTotal pages: ${pageCount}\nSession: ${sessionId}\n\n`;
      await textStream.write(header + separator + metadata + separator);
    } else {
      // Resume processing - append to existing file
      textStream = await fs.open(outputPath, 'a');
    }

    try {
      for (let page = checkpoint.lastPage + 1; page <= pageCount; page++) {
        console.log(`Processing page ${page}/${pageCount}...`);

        // Extract single page to image
        const imagePath = await this.extractSinglePage(pdfPath, page, sessionId);

        // OCR the page with fallback support
        const pageText = await this.ocrPage(imagePath);

        // Write result immediately to file
        const pageHeader = `--- Page ${page} ---\n`;
        const pageContent = pageText.trim().length > 0 ? pageText : '[No text detected]';
        await textStream.write(`${pageHeader}${pageContent}\n\n`);

        // Save checkpoint every N pages
        if (page % this.checkpointInterval === 0) {
          await this.saveCheckpoint(sessionId, page, pageCount);
        }

        // Cleanup page image immediately
        try {
          await fs.unlink(imagePath);
        } catch (error) {
          console.warn(`Failed to cleanup ${imagePath}: ${error.message}`);
        }

        // Memory management - force garbage collection if available
        if (global.gc && process.memoryUsage().heapUsed > this.maxMemory * 0.8) {
          console.log('Memory threshold reached, forcing garbage collection');
          global.gc();
        }

        // Progress callback
        if (progressCallback) {
          progressCallback({
            page,
            total: pageCount,
            percentage: Math.round((page / pageCount) * 100),
            sessionId,
            memoryUsage: process.memoryUsage().heapUsed
          });
        }
      }

      // Mark processing as complete
      await this.saveCheckpoint(sessionId, pageCount, pageCount, true);

    } finally {
      await textStream.close();
    }

    return outputPath;
  }

  /**
   * Extract single page from PDF as image
   * @param {string} pdfPath - Path to PDF file
   * @param {number} pageNumber - Page number to extract (1-based)
   * @param {string} sessionId - Session identifier for unique naming
   * @returns {Promise<string>} Path to extracted image
   */
  async extractSinglePage(pdfPath, pageNumber, sessionId) {
    const outputPath = `temp/sessions/${sessionId}_page_${pageNumber}`;
    const command = `pdftoppm -jpeg -r 300 -f ${pageNumber} -l ${pageNumber} "${pdfPath}" "${outputPath}"`;

    try {
      await execAsync(command);
      return `${outputPath}-${pageNumber.toString().padStart(3, '0')}.jpg`;
    } catch (error) {
      throw new Error(`Failed to extract page ${pageNumber}: ${error.message}`);
    }
  }

  /**
   * Perform OCR on single page with fallback support
   * @param {string} imagePath - Path to image file
   * @returns {Promise<string>} Extracted text
   */
  async ocrPage(imagePath) {
    const primaryConfig = {
      lang: 'vie+eng', // Vietnamese + English for mixed content
      oem: 1,          // LSTM OCR Engine Mode
      psm: 3,          // Fully automatic page segmentation
    };

    try {
      const text = await tesseract.recognize(imagePath, primaryConfig);
      return text.trim();
    } catch (error) {
      // Fallback to English if Vietnamese fails
      console.warn(`Vietnamese OCR failed for ${imagePath}, trying English...`);
      try {
        const fallbackConfig = { ...primaryConfig, lang: 'eng' };
        const text = await tesseract.recognize(imagePath, fallbackConfig);
        return text.trim();
      } catch (fallbackError) {
        console.error(`All OCR attempts failed for ${imagePath}: ${fallbackError.message}`);
        return `[OCR Failed for this page - Error: ${fallbackError.message}]`;
      }
    }
  }

  /**
   * Get total page count from PDF
   * @param {string} pdfPath - Path to PDF file
   * @returns {Promise<number>} Total number of pages
   */
  async getPageCount(pdfPath) {
    try {
      const command = `pdfinfo "${pdfPath}" | grep Pages | awk '{print $2}'`;
      const { stdout } = await execAsync(command);
      const pageCount = parseInt(stdout.trim());

      if (isNaN(pageCount) || pageCount <= 0) {
        throw new Error('Could not determine page count or PDF has no pages');
      }

      return pageCount;
    } catch (error) {
      throw new Error(`Failed to get page count: ${error.message}`);
    }
  }

  /**
   * Save checkpoint data
   * @param {string} sessionId - Session identifier
   * @param {number} lastPage - Last processed page
   * @param {number} totalPages - Total pages in document
   * @param {boolean} complete - Whether processing is complete
   */
  async saveCheckpoint(sessionId, lastPage, totalPages, complete = false) {
    const checkpoint = {
      sessionId,
      lastPage,
      totalPages,
      complete,
      timestamp: Date.now()
    };

    const checkpointPath = `checkpoints/${sessionId}.json`;
    const tempPath = `${checkpointPath}.tmp`;

    try {
      // Atomic write with temporary file
      await fs.writeFile(tempPath, JSON.stringify(checkpoint, null, 2));
      await fs.rename(tempPath, checkpointPath);
      console.log(`Checkpoint saved: page ${lastPage}/${totalPages}`);
    } catch (error) {
      console.error(`Failed to save checkpoint: ${error.message}`);
    }
  }

  /**
   * Load checkpoint data
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Checkpoint data or null if not found
   */
  async loadCheckpoint(sessionId) {
    try {
      const checkpointPath = `checkpoints/${sessionId}.json`;
      const data = await fs.readFile(checkpointPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // No checkpoint found - normal for new sessions
      return null;
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Session status information
   */
  async getSessionStatus(sessionId) {
    const checkpoint = await this.loadCheckpoint(sessionId);

    if (!checkpoint) {
      return { status: 'not_found' };
    }

    const status = {
      sessionId: checkpoint.sessionId,
      lastPage: checkpoint.lastPage,
      totalPages: checkpoint.totalPages,
      percentage: Math.round((checkpoint.lastPage / checkpoint.totalPages) * 100),
      complete: checkpoint.complete || false,
      timestamp: checkpoint.timestamp
    };

    // Check if output file exists
    const outputPath = `temp/sessions/${sessionId}.txt`;
    try {
      await fs.access(outputPath);
      status.hasOutput = true;
      status.outputPath = outputPath;
    } catch {
      status.hasOutput = false;
    }

    return status;
  }
}

/**
 * Cleanup old checkpoint files
 * @param {number} daysOld - Number of days old to consider for cleanup
 */
export async function cleanupCheckpoints(daysOld = 7) {
  const maxAge = daysOld * 24 * 60 * 60 * 1000;

  try {
    const files = await fs.readdir('checkpoints');

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join('checkpoints', file);
      const stats = await fs.stat(filePath);

      if (Date.now() - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old checkpoint: ${file}`);
      }
    }
  } catch (error) {
    console.warn(`Checkpoint cleanup warning: ${error.message}`);
  }
}