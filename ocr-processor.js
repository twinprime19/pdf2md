import { exec } from 'child_process';
import { promisify } from 'util';
import tesseract from 'node-tesseract-ocr';
import fs from 'fs/promises';
import path from 'path';
import { VietnameseOCRCleaner } from './cleaner.service.js';

const execAsync = promisify(exec);

/**
 * Convert PDF to images using system poppler
 * @param {string} pdfPath - Path to PDF file
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<string[]>} Array of image file paths
 */
export async function pdfToImages(pdfPath, outputDir) {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    // Use pdftoppm (from poppler) to convert PDF to images
    const outputPrefix = path.join(outputDir, 'page');
    const command = `pdftoppm -jpeg -r 300 "${pdfPath}" "${outputPrefix}"`;

    console.log(`Running: ${command}`);
    await execAsync(command);

    // Find all generated images
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(outputDir, file))
      .sort();

    console.log(`Converted PDF to ${imageFiles.length} images`);
    return imageFiles;
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
}

/**
 * Extract text from image using Tesseract OCR with Vietnamese support
 * @param {string} imagePath - Path to image file
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromImage(imagePath) {
  const config = {
    lang: 'vie+eng', // Vietnamese + English for better mixed content support
    oem: 1, // LSTM OCR Engine Mode
    psm: 3, // Fully automatic page segmentation, but no OSD
  };

  try {
    const text = await tesseract.recognize(imagePath, config);
    return text.trim();
  } catch (error) {
    // Fallback to English if Vietnamese fails
    console.warn(`Vietnamese OCR failed for ${imagePath}, trying English...`);
    try {
      const fallbackConfig = { ...config, lang: 'eng' };
      const text = await tesseract.recognize(imagePath, fallbackConfig);
      return text.trim();
    } catch (fallbackError) {
      throw new Error(`OCR failed: ${fallbackError.message}`);
    }
  }
}

/**
 * Process entire PDF: convert to images, extract text, and clean Vietnamese OCR output
 * @param {string} pdfPath - Path to PDF file
 * @param {string} tempDir - Temporary directory for processing
 * @returns {Promise<{original: string, cleaned: string, metadata: object, pages: number, processingTime: number, ocrTime: number, cleaningTime: number}>}
 */
export async function processPDF(pdfPath, tempDir) {
  const startTime = Date.now();

  try {
    // Create unique subdirectory for this processing session
    const sessionId = Date.now().toString();
    const imageDir = path.join(tempDir, `images_${sessionId}`);
    await fs.mkdir(imageDir, { recursive: true });

    console.log(`Processing PDF: ${pdfPath}`);

    // Step 1: Convert PDF to images
    const imagePaths = await pdfToImages(pdfPath, imageDir);

    if (imagePaths.length === 0) {
      throw new Error('No pages found in PDF');
    }

    // Step 2: OCR each image
    const textPromises = imagePaths.map((imagePath, index) => {
      console.log(`Processing page ${index + 1}/${imagePaths.length}...`);
      return extractTextFromImage(imagePath);
    });

    const textResults = await Promise.all(textPromises);

    // Step 3: Combine all text with page separators
    const combinedText = textResults
      .map((text, index) => {
        if (text.length === 0) {
          return `[Page ${index + 1}: No text detected]`;
        }
        return `--- Page ${index + 1} ---\n${text}`;
      })
      .join('\n\n');

    const ocrTime = Date.now() - startTime;

    // Step 4: Clean the OCR text using VietnameseOCRCleaner
    const cleaningStartTime = Date.now();
    let cleaned = combinedText;
    let cleaningMetadata = null;

    try {
      const cleaner = new VietnameseOCRCleaner({
        aggressiveCleaning: false,
        preserveCodes: true,
        fixStructure: true,
        detectDocumentType: true
      });

      const cleaningResult = cleaner.clean(combinedText);
      cleaned = cleaningResult.cleaned;
      cleaningMetadata = cleaningResult.metadata;

      console.log(`Text cleaning completed`);
      console.log(`Document type detected: ${cleaningMetadata.documentType}`);
      console.log(`Changes made: ${cleaningMetadata.changesCount}`);
      console.log(`Confidence: ${cleaningMetadata.confidence}`);
    } catch (cleaningError) {
      console.warn(`Text cleaning failed, using original text: ${cleaningError.message}`);
      cleaned = combinedText; // Fallback to original if cleaning fails
      cleaningMetadata = {
        error: cleaningError.message,
        documentType: 'unknown',
        changesCount: 0,
        confidence: 0
      };
    }

    const cleaningTime = Date.now() - cleaningStartTime;

    // Step 5: Cleanup images
    await cleanupDirectory(imageDir);

    const totalProcessingTime = Date.now() - startTime;

    console.log(`Total processing completed in ${totalProcessingTime}ms`);
    console.log(`  - OCR time: ${ocrTime}ms`);
    console.log(`  - Cleaning time: ${cleaningTime}ms`);
    console.log(`Processed ${imagePaths.length} pages`);
    console.log(`Original text length: ${combinedText.length} characters`);
    console.log(`Cleaned text length: ${cleaned.length} characters`);

    return {
      original: combinedText,
      cleaned: cleaned,
      metadata: cleaningMetadata,
      pages: imagePaths.length,
      processingTime: totalProcessingTime,
      ocrTime: ocrTime,
      cleaningTime: cleaningTime
    };

  } catch (error) {
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

/**
 * Clean up temporary directory
 * @param {string} dirPath - Directory to clean up
 */
export async function cleanupDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    await Promise.all(files.map(file => fs.unlink(path.join(dirPath, file))));
    await fs.rmdir(dirPath);
    console.log(`Cleaned up directory: ${dirPath}`);
  } catch (error) {
    console.warn(`Cleanup warning: ${error.message}`);
  }
}

/**
 * Generate text file for download
 * @param {string} text - Text content
 * @param {string} originalFilename - Original PDF filename
 * @param {string} tempDir - Temporary directory
 * @returns {Promise<string>} Path to generated text file
 */
export async function generateTextFile(text, originalFilename, tempDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFilename = path.parse(originalFilename).name;
  const textFilename = `${baseFilename}_ocr_${timestamp}.txt`;
  const textFilePath = path.join(tempDir, textFilename);

  const header = `OCR Extraction Results\n`;
  const separator = `${'='.repeat(50)}\n`;
  const metadata = `Original File: ${originalFilename}\nExtracted: ${new Date().toLocaleString()}\nLanguage: Vietnamese + English\n\n`;

  const content = header + separator + metadata + separator + text;

  await fs.writeFile(textFilePath, content, 'utf-8');
  console.log(`Generated text file: ${textFilePath}`);

  return textFilePath;
}