#!/usr/bin/env node

// Simple test script to create a PDF with Vietnamese text for testing
// This creates a basic PDF using HTML to PDF conversion

import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const testContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
        h1 { color: #2c3e50; }
        .vietnamese { font-size: 16px; margin: 20px 0; }
        .english { font-size: 14px; margin: 20px 0; color: #666; }
    </style>
</head>
<body>
    <h1>Test Document - Tài liệu thử nghiệm</h1>

    <div class="vietnamese">
        <p>Xin chào! Đây là một tài liệu thử nghiệm để kiểm tra khả năng nhận dạng văn bản tiếng Việt.</p>
        <p>Hệ thống OCR này có thể đọc được các ký tự đặc biệt như: ă, â, đ, ê, ô, ơ, ư.</p>
        <p>Các dấu thanh điệu: á, à, ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ.</p>
    </div>

    <div class="english">
        <p>Hello! This is a test document to verify Vietnamese text recognition capabilities.</p>
        <p>Mixed content with numbers: 123, 456, 789 and special characters: @#$%^&*()</p>
        <p>Date: November 10, 2024 | Time: 12:00 PM</p>
    </div>

    <div class="vietnamese">
        <p>Kết thúc tài liệu thử nghiệm. Cảm ơn bạn đã sử dụng!</p>
    </div>
</body>
</html>
`;

async function createTestPDF() {
    try {
        // Create HTML file
        await fs.writeFile('/tmp/test-content.html', testContent);

        // Convert to PDF using system tools (if available)
        try {
            // Try using wkhtmltopdf if available
            await execAsync('which wkhtmltopdf');
            await execAsync('wkhtmltopdf /tmp/test-content.html test-vietnamese.pdf');
            console.log('✅ Test PDF created: test-vietnamese.pdf');
        } catch (e) {
            // Fallback: create a simple text file instead
            const textContent = `Test Document - Tài liệu thử nghiệm

Xin chào! Đây là một tài liệu thử nghiệm để kiểm tra khả năng nhận dạng văn bản tiếng Việt.
Hệ thống OCR này có thể đọc được các ký tự đặc biệt như: ă, â, đ, ê, ô, ơ, ư.
Các dấu thanh điệu: á, à, ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ.

Hello! This is a test document to verify Vietnamese text recognition capabilities.
Mixed content with numbers: 123, 456, 789 and special characters: @#$%^&*()
Date: November 10, 2024 | Time: 12:00 PM

Kết thúc tài liệu thử nghiệm. Cảm ơn bạn đã sử dụng!`;

            await fs.writeFile('test-content.txt', textContent);
            console.log('📝 Test text file created: test-content.txt');
            console.log('💡 To test OCR, you can manually create a PDF from this content or use an existing PDF file.');
        }

        // Clean up
        await fs.unlink('/tmp/test-content.html');

    } catch (error) {
        console.error('❌ Error creating test content:', error.message);
    }
}

createTestPDF();