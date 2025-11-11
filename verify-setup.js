#!/usr/bin/env node

// Verification script to check if all dependencies are properly installed

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const checks = [
  {
    name: 'Node.js version',
    command: 'node --version',
    validator: (output) => {
      return output.trim().startsWith('v') && output.includes('24');
    }
  },
  {
    name: 'Tesseract installation',
    command: 'tesseract --version',
    validator: (output) => output.includes('tesseract')
  },
  {
    name: 'Vietnamese language pack',
    command: 'tesseract --list-langs',
    validator: (output) => output.includes('vie')
  },
  {
    name: 'Poppler installation',
    command: 'which pdftocairo',
    validator: (output) => output.includes('pdftocairo')
  },
  {
    name: 'Temp directory',
    command: null,
    validator: async () => {
      try {
        await fs.access('temp');
        return true;
      } catch {
        await fs.mkdir('temp', { recursive: true });
        return true;
      }
    }
  }
];

async function runVerification() {
  console.log('🔍 Verifying PDF OCR setup...\\n');

  let allPassed = true;

  for (const check of checks) {
    process.stdout.write(`Checking ${check.name}... `);

    try {
      let result;
      if (check.command) {
        const { stdout } = await execAsync(check.command);
        result = await check.validator(stdout);
      } else {
        result = await check.validator();
      }

      if (result) {
        console.log('✅ OK');
      } else {
        console.log('❌ FAILED');
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('\\n' + '='.repeat(50));

  if (allPassed) {
    console.log('🎉 All checks passed! Your PDF OCR app is ready to use.');
    console.log('\\nTo start the server: npm start');
    console.log('To stop the server: npm run stop');
  } else {
    console.log('❌ Some checks failed. Please review the errors above.');
    console.log('\\nCommon solutions:');
    console.log('- Install Node.js 18+: https://nodejs.org/');
    console.log('- Install Tesseract: brew install tesseract tesseract-lang');
    console.log('- Install Poppler: brew install poppler');
  }

  process.exit(allPassed ? 0 : 1);
}

runVerification().catch(console.error);