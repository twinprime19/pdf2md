#!/usr/bin/env node

import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Test PDF Generator for Streaming OCR Tests
 * Creates PDFs of different sizes to test memory management and streaming processor
 */
export class TestPDFGenerator {
  static async createTestPDFs() {
    const testSets = {
      small: { pages: 3, name: 'small-test.pdf' },
      medium: { pages: 15, name: 'medium-test.pdf' },
      large: { pages: 60, name: 'large-test.pdf' },
      extra_large: { pages: 120, name: 'extra-large-test.pdf' }
    };

    console.log('Creating test PDFs with different sizes...');

    for (const [type, config] of Object.entries(testSets)) {
      try {
        await this.createPDF(config.pages, config.name);
        console.log(`✅ Created ${type} PDF: ${config.name} (${config.pages} pages)`);
      } catch (error) {
        console.error(`❌ Failed to create ${type} PDF: ${error.message}`);
      }
    }
  }

  static async createPDF(pageCount, filename) {
    // Vietnamese text content for OCR testing
    const pageContent = `
    <div style="page-break-after: always; padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: #2c3e50;">Trang {{pageNumber}} - Test Document</h1>

      <div style="margin: 20px 0; font-size: 16px;">
        <p>Xin chào! Đây là trang số {{pageNumber}} của tài liệu thử nghiệm để kiểm tra khả năng nhận dạng văn bản tiếng Việt.</p>
        <p>Hệ thống OCR này có thể đọc được các ký tự đặc biệt như: ă, â, đ, ê, ô, ơ, ư và các dấu thanh điệu: á, à, ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ.</p>
        <p>Mixed English content on page {{pageNumber}}: This helps test dual-language recognition capabilities.</p>
        <p>Numbers and symbols: 123-456-7890, email@test.com, $100.50, 25% off, #hashtag</p>
        <p>Timestamp: {{timestamp}} | Memory Test Page {{pageNumber}} of {{totalPages}}</p>
      </div>

      <div style="margin: 20px 0; font-size: 14px; color: #666;">
        <p>This page is designed to test memory usage and streaming capabilities.</p>
        <p>Each page contains approximately the same amount of text to ensure consistent processing times.</p>
        <p>Page {{pageNumber}} generated at {{timestamp}} for comprehensive OCR testing.</p>
      </div>

      <div style="margin-top: 40px; border: 1px solid #ccc; padding: 15px;">
        <h3>Technical Information</h3>
        <ul>
          <li>Document Type: Multi-page PDF Test</li>
          <li>Current Page: {{pageNumber}}</li>
          <li>Total Pages: {{totalPages}}</li>
          <li>Language Mix: Vietnamese + English</li>
          <li>Generated: {{timestamp}}</li>
        </ul>
      </div>

      <div style="position: absolute; bottom: 20px; right: 20px; font-size: 12px;">
        Trang {{pageNumber}}/{{totalPages}} - Stream Test PDF
      </div>
    </div>`;

    const timestamp = new Date().toISOString();
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test Document - ${pageCount} Pages</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        .page {
            min-height: 100vh;
            position: relative;
        }
    </style>
</head>
<body>`;

    // Generate content for each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pageHTML = pageContent
        .replace(/\{\{pageNumber\}\}/g, pageNum)
        .replace(/\{\{totalPages\}\}/g, pageCount)
        .replace(/\{\{timestamp\}\}/g, timestamp);

      htmlContent += `<div class="page">${pageHTML}</div>`;
    }

    htmlContent += `
</body>
</html>`;

    const outputPath = path.join('tests', 'fixtures', filename);
    const htmlPath = path.join('tests', 'temp', `${filename}.html`);

    // Create HTML file
    await fs.writeFile(htmlPath, htmlContent);

    // Check for wkhtmltopdf availability
    try {
      await execAsync('which wkhtmltopdf');

      // Convert HTML to PDF using wkhtmltopdf
      const command = `wkhtmltopdf --page-size A4 --margin-top 20mm --margin-bottom 20mm --margin-left 20mm --margin-right 20mm "${htmlPath}" "${outputPath}"`;
      await execAsync(command);

      // Clean up HTML file
      await fs.unlink(htmlPath);

      return outputPath;
    } catch (error) {
      // Fallback: Try using system print-to-PDF (macOS)
      try {
        // macOS: Use built-in HTML to PDF conversion
        const command = `python3 -c "
import pdfkit
pdfkit.from_file('${htmlPath}', '${outputPath}')
"`;
        await execAsync(command);

        await fs.unlink(htmlPath);
        return outputPath;
      } catch (fallbackError) {
        await fs.unlink(htmlPath);
        throw new Error(`Could not create PDF. Please install wkhtmltopdf or pdfkit: ${error.message}`);
      }
    }
  }

  static async createCorruptPDF() {
    // Create a file that looks like a PDF but is corrupted
    const corruptData = '%PDF-1.4\n%CORRUPT DATA - NOT A VALID PDF\nThis is not a real PDF file';
    const filename = 'corrupt-test.pdf';
    const outputPath = path.join('tests', 'fixtures', filename);

    await fs.writeFile(outputPath, corruptData);
    return outputPath;
  }

  static async createEmptyPDF() {
    // Create a valid but empty PDF
    const emptyPDFContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids []
/Count 0
>>
endobj

xref
0 3
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
trailer
<<
/Size 3
/Root 1 0 R
>>
startxref
115
%%EOF`;

    const filename = 'empty-test.pdf';
    const outputPath = path.join('tests', 'fixtures', filename);

    await fs.writeFile(outputPath, emptyPDFContent);
    return outputPath;
  }

  // Get file stats for memory calculations
  static async getFileStats(filename) {
    const filepath = path.join('tests', 'fixtures', filename);
    try {
      const stats = await fs.stat(filepath);
      return {
        filename,
        size: stats.size,
        sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
        created: stats.birthtime
      };
    } catch (error) {
      return null;
    }
  }

  // Validate test files exist
  static async validateTestFiles() {
    const expectedFiles = [
      'small-test.pdf',
      'medium-test.pdf',
      'large-test.pdf',
      'extra-large-test.pdf',
      'corrupt-test.pdf',
      'empty-test.pdf'
    ];

    const validation = {};

    for (const file of expectedFiles) {
      validation[file] = await this.getFileStats(file);
    }

    return validation;
  }
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      // Ensure fixtures directory exists
      await fs.mkdir(path.join('tests', 'fixtures'), { recursive: true });
      await fs.mkdir(path.join('tests', 'temp'), { recursive: true });

      await TestPDFGenerator.createTestPDFs();
      await TestPDFGenerator.createCorruptPDF();
      await TestPDFGenerator.createEmptyPDF();

      console.log('\n📊 Test file validation:');
      const validation = await TestPDFGenerator.validateTestFiles();
      console.table(validation);

    } catch (error) {
      console.error('❌ Failed to create test PDFs:', error.message);
      process.exit(1);
    }
  })();
}