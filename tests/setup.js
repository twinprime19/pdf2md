import fs from 'fs/promises';
import path from 'path';

// Global test setup
beforeAll(async () => {
  // Ensure required directories exist
  const directories = [
    'temp',
    'temp/sessions',
    'checkpoints',
    'tests/fixtures',
    'tests/temp'
  ];

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Clean up any existing test artifacts
  await cleanupTestArtifacts();

  console.log('Test environment setup completed');
});

afterAll(async () => {
  // Cleanup test artifacts
  await cleanupTestArtifacts();
  console.log('Test environment cleanup completed');
});

// Helper function to cleanup test artifacts
export async function cleanupTestArtifacts() {
  const cleanupPaths = [
    'tests/temp',
    'temp/test_*',
    'checkpoints/test_*'
  ];

  for (const cleanupPath of cleanupPaths) {
    try {
      if (cleanupPath.includes('*')) {
        // Handle glob patterns
        const dir = path.dirname(cleanupPath);
        const pattern = path.basename(cleanupPath).replace('*', '');

        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.startsWith(pattern)) {
            await fs.unlink(path.join(dir, file));
          }
        }
      } else {
        // Handle direct paths
        const stat = await fs.stat(cleanupPath);
        if (stat.isDirectory()) {
          await fs.rmdir(cleanupPath, { recursive: true });
        } else {
          await fs.unlink(cleanupPath);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Global timeout configuration for tests
jest.setTimeout(120000); // 2 minutes for OCR operations

// Global test utilities
global.testUtils = {
  cleanupTestArtifacts,

  // Memory monitoring helper
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024)
    };
  },

  // Wait helper for async operations
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Generate unique session ID for tests
  generateTestSessionId() {
    return `test_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
};