#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Simple test file generator for PDF streaming tests
 * Creates mock PDFs and test artifacts for comprehensive testing
 */
export class TestFileGenerator {
  static async createAllTestFiles() {
    await this.ensureDirectories();
    await this.createTextBasedPDFs();
    await this.createCorruptPDF();
    await this.createEmptyPDF();

    console.log('✅ All test files created successfully');
    return await this.validateTestFiles();
  }

  static async ensureDirectories() {
    const dirs = ['tests/fixtures', 'tests/temp'];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // Create text-based PDFs that can be used for testing
  // These simulate different file sizes for memory testing
  static async createTextBasedPDFs() {
    const configs = [
      { name: 'small-test.pdf', pages: 3, size: 'small' },
      { name: 'medium-test.pdf', pages: 25, size: 'medium' },
      { name: 'large-test.pdf', pages: 60, size: 'large' }
    ];

    for (const config of configs) {
      await this.createMockPDF(config.name, config.pages);
      console.log(`✅ Created ${config.size} test PDF: ${config.name} (${config.pages} pages)`);
    }
  }

  // Create a simplified PDF-like file for testing
  // This creates a file that pdftoppm and pdfinfo can work with
  static async createMockPDF(filename, pageCount) {
    // Create a very simple PDF structure
    const pdfHeader = '%PDF-1.4\n';

    // Create basic PDF objects
    let pdfContent = pdfHeader;
    let objectCount = 1;
    let xrefTable = [];

    // Catalog object
    const catalogOffset = pdfContent.length;
    pdfContent += `${objectCount} 0 obj\n<< /Type /Catalog /Pages ${objectCount + 1} 0 R >>\nendobj\n`;
    xrefTable.push(catalogOffset);
    objectCount++;

    // Pages object
    const pagesOffset = pdfContent.length;
    let pageRefs = '';
    for (let i = 0; i < pageCount; i++) {
      pageRefs += `${objectCount + i + 1} 0 R `;
    }
    pdfContent += `${objectCount} 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj\n`;
    xrefTable.push(pagesOffset);
    objectCount++;

    // Page objects
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pageOffset = pdfContent.length;
      const contentStreamRef = objectCount + pageCount;

      pdfContent += `${objectCount} 0 obj\n`;
      pdfContent += `<< /Type /Page /Parent 2 0 R /Contents ${contentStreamRef} 0 R`;
      pdfContent += ` /MediaBox [0 0 612 792] >>\nendobj\n`;
      xrefTable.push(pageOffset);
      objectCount++;
    }

    // Content streams for each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const contentOffset = pdfContent.length;
      const content = `BT /F1 12 Tf 50 700 Td (Test Page ${pageNum} - Vietnamese OCR Test) Tj ET`;
      const contentLength = content.length;

      pdfContent += `${objectCount} 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`;
      xrefTable.push(contentOffset);
      objectCount++;
    }

    // Cross-reference table
    const xrefOffset = pdfContent.length;
    pdfContent += 'xref\n';
    pdfContent += `0 ${objectCount}\n`;
    pdfContent += '0000000000 65535 f \n';

    for (const offset of xrefTable) {
      pdfContent += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }

    // Trailer
    pdfContent += 'trailer\n';
    pdfContent += `<< /Size ${objectCount} /Root 1 0 R >>\n`;
    pdfContent += 'startxref\n';
    pdfContent += `${xrefOffset}\n`;
    pdfContent += '%%EOF\n';

    const filepath = path.join('tests', 'fixtures', filename);
    await fs.writeFile(filepath, pdfContent);

    return filepath;
  }

  static async createCorruptPDF() {
    const corruptContent = '%PDF-1.4\nCORRUPT DATA - NOT A VALID PDF\nThis is intentionally broken for testing';
    const filepath = path.join('tests', 'fixtures', 'corrupt-test.pdf');
    await fs.writeFile(filepath, corruptContent);
    console.log('✅ Created corrupt PDF for error testing');
    return filepath;
  }

  static async createEmptyPDF() {
    // Create a valid PDF with zero pages
    const emptyPDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj

xref
0 3
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
trailer
<< /Size 3 /Root 1 0 R >>
startxref
115
%%EOF`;

    const filepath = path.join('tests', 'fixtures', 'empty-test.pdf');
    await fs.writeFile(filepath, emptyPDF);
    console.log('✅ Created empty PDF for edge case testing');
    return filepath;
  }

  static async validateTestFiles() {
    const expectedFiles = [
      'small-test.pdf',
      'medium-test.pdf',
      'large-test.pdf',
      'corrupt-test.pdf',
      'empty-test.pdf'
    ];

    const validation = {};

    for (const filename of expectedFiles) {
      const filepath = path.join('tests', 'fixtures', filename);
      try {
        const stats = await fs.stat(filepath);
        validation[filename] = {
          exists: true,
          size: stats.size,
          sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
          created: stats.birthtime
        };
      } catch (error) {
        validation[filename] = {
          exists: false,
          error: error.message
        };
      }
    }

    return validation;
  }

  // Test if the created PDFs can be processed by our tools
  static async testPDFCompatibility() {
    const testResults = {};
    const testFiles = ['small-test.pdf', 'medium-test.pdf', 'large-test.pdf'];

    for (const filename of testFiles) {
      const filepath = path.join('tests', 'fixtures', filename);
      const results = {
        file: filename,
        pdfinfo: false,
        pdftoppm: false
      };

      // Test pdfinfo
      try {
        const { stdout } = await execAsync(`pdfinfo "${filepath}"`);
        results.pdfinfo = stdout.includes('Pages:');
      } catch (error) {
        results.pdfinfoError = error.message;
      }

      // Test pdftoppm
      try {
        const testOutput = `/tmp/test_${Date.now()}`;
        await execAsync(`pdftoppm -jpeg -f 1 -l 1 "${filepath}" "${testOutput}"`);
        results.pdftoppm = true;

        // Cleanup test output
        try {
          await execAsync(`rm -f ${testOutput}*.jpg`);
        } catch {}
      } catch (error) {
        results.pdftoppmerror = error.message;
      }

      testResults[filename] = results;
    }

    return testResults;
  }
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      console.log('🔧 Creating test files...');
      const validation = await TestFileGenerator.createAllTestFiles();

      console.log('\n📊 Test file validation:');
      console.table(validation);

      console.log('\n🧪 Testing PDF compatibility with system tools...');
      const compatibility = await TestFileGenerator.testPDFCompatibility();
      console.table(compatibility);

    } catch (error) {
      console.error('❌ Failed to create test files:', error.message);
      process.exit(1);
    }
  })();
}