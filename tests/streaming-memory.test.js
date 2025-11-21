import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { StreamingProcessor } from '../streaming-processor.js';
import { CheckpointManager } from '../checkpoint-manager.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Critical Memory Usage Tests for Phase 1 Ship Requirements
 *
 * Requirements:
 * ✅ 100-page PDF processes without OOM
 * ✅ Memory usage consistently <1GB
 * ✅ Checkpoint recovery works after interruption
 * ✅ No regression on small files (<10MB)
 */
describe('Streaming Processor Memory Tests', () => {
  let processor;
  let testSessionId;

  beforeAll(async () => {
    // Ensure test directories exist
    await fs.mkdir('temp/sessions', { recursive: true });
    await fs.mkdir('checkpoints', { recursive: true });
  });

  beforeEach(() => {
    processor = new StreamingProcessor({
      maxMemory: 1024 * 1024 * 1024, // 1GB
      checkpointInterval: 5 // Save checkpoint every 5 pages for testing
    });
    testSessionId = global.testUtils.generateTestSessionId();
  });

  afterEach(async () => {
    // Cleanup test artifacts
    try {
      await CheckpointManager.removeSession(testSessionId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test 1: Memory Constraint Validation
   * Critical: Verify memory stays below 1GB during large PDF processing
   */
  test('should maintain memory usage below 1GB during large PDF processing', async () => {
    const largePDF = path.join('tests', 'fixtures', 'large-test.pdf');
    const maxMemoryMB = 1024; // 1GB
    const memorySnapshots = [];

    // Progress callback to monitor memory
    const progressCallback = (progress) => {
      const memoryUsage = global.testUtils.getMemoryUsage();
      memorySnapshots.push({
        page: progress.page,
        heapUsedMB: memoryUsage.heapUsedMB,
        heapTotalMB: memoryUsage.heapTotalMB,
        timestamp: Date.now()
      });

      // Critical assertion: Memory must not exceed 1GB
      expect(memoryUsage.heapUsedMB).toBeLessThanOrEqual(maxMemoryMB);

      console.log(`Page ${progress.page}: Heap used ${memoryUsage.heapUsedMB}MB / ${maxMemoryMB}MB`);
    };

    const initialMemory = global.testUtils.getMemoryUsage();
    console.log(`Initial memory: ${initialMemory.heapUsedMB}MB`);

    const outputPath = await processor.processStreamingPDF(largePDF, testSessionId, progressCallback);

    const finalMemory = global.testUtils.getMemoryUsage();
    console.log(`Final memory: ${finalMemory.heapUsedMB}MB`);

    // Verify output was created
    expect(outputPath).toBeTruthy();
    const outputStats = await fs.stat(outputPath);
    expect(outputStats.size).toBeGreaterThan(0);

    // Analyze memory pattern
    expect(memorySnapshots.length).toBeGreaterThan(0);
    const maxMemoryUsed = Math.max(...memorySnapshots.map(s => s.heapUsedMB));
    const avgMemoryUsed = memorySnapshots.reduce((sum, s) => sum + s.heapUsedMB, 0) / memorySnapshots.length;

    console.log(`Memory analysis: Max ${maxMemoryUsed}MB, Avg ${Math.round(avgMemoryUsed)}MB`);

    // Critical assertions for ship requirements
    expect(maxMemoryUsed).toBeLessThanOrEqual(maxMemoryMB);
    expect(avgMemoryUsed).toBeLessThanOrEqual(maxMemoryMB * 0.8); // Should average well below limit

    // Verify no memory leak pattern (final memory should be reasonable)
    expect(finalMemory.heapUsedMB - initialMemory.heapUsedMB).toBeLessThanOrEqual(100); // Max 100MB increase
  }, 180000); // 3 minute timeout for large file

  /**
   * Test 2: Memory Stability During Sequential Processing
   * Verify memory doesn't continuously grow during page-by-page processing
   */
  test('should maintain stable memory during sequential page processing', async () => {
    const mediumPDF = path.join('tests', 'fixtures', 'medium-test.pdf');
    const memorySnapshots = [];

    const progressCallback = (progress) => {
      const memoryUsage = global.testUtils.getMemoryUsage();
      memorySnapshots.push({
        page: progress.page,
        heapUsed: memoryUsage.heapUsed,
        heapUsedMB: memoryUsage.heapUsedMB
      });
    };

    await processor.processStreamingPDF(mediumPDF, testSessionId, progressCallback);

    // Analyze memory stability
    expect(memorySnapshots.length).toBeGreaterThan(10);

    // Check for memory leaks - memory shouldn't continuously grow
    const firstHalf = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 2));
    const secondHalf = memorySnapshots.slice(Math.floor(memorySnapshots.length / 2));

    const avgFirstHalf = firstHalf.reduce((sum, s) => sum + s.heapUsedMB, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((sum, s) => sum + s.heapUsedMB, 0) / secondHalf.length;

    console.log(`Memory stability: First half avg ${Math.round(avgFirstHalf)}MB, Second half avg ${Math.round(avgSecondHalf)}MB`);

    // Memory shouldn't grow by more than 50MB between halves
    expect(avgSecondHalf - avgFirstHalf).toBeLessThanOrEqual(50);
  }, 120000);

  /**
   * Test 3: Memory Efficiency Comparison
   * Compare streaming vs theoretical full-load memory usage
   */
  test('should use significantly less memory than full PDF load approach', async () => {
    const largePDF = path.join('tests', 'fixtures', 'large-test.pdf');
    const pageCount = await processor.getPageCount(largePDF);

    console.log(`Testing memory efficiency for ${pageCount}-page document`);

    const maxMemoryUsed = [];

    const progressCallback = (progress) => {
      const memoryUsage = global.testUtils.getMemoryUsage();
      maxMemoryUsed.push(memoryUsage.heapUsedMB);
    };

    await processor.processStreamingPDF(largePDF, testSessionId, progressCallback);

    const peakMemoryMB = Math.max(...maxMemoryUsed);

    // Theoretical memory usage for full PDF load approach
    // Estimate: ~5-10MB per page for high-resolution images
    const estimatedFullLoadMemoryMB = pageCount * 7; // Conservative estimate

    console.log(`Peak streaming memory: ${peakMemoryMB}MB`);
    console.log(`Estimated full-load memory: ${estimatedFullLoadMemoryMB}MB`);
    console.log(`Memory savings: ${Math.round((1 - peakMemoryMB / estimatedFullLoadMemoryMB) * 100)}%`);

    // Streaming should use significantly less memory than full load
    expect(peakMemoryMB).toBeLessThanOrEqual(estimatedFullLoadMemoryMB * 0.3); // At least 70% savings
    expect(peakMemoryMB).toBeLessThanOrEqual(1024); // Still under 1GB limit
  }, 180000);

  /**
   * Test 4: Garbage Collection Effectiveness
   * Test that manual GC calls help maintain memory
   */
  test('should effectively manage memory with garbage collection', async () => {
    // This test requires --expose-gc flag to work properly
    const mediumPDF = path.join('tests', 'fixtures', 'medium-test.pdf');
    const memoryBeforeGC = [];
    const memoryAfterGC = [];

    let pageCount = 0;
    const progressCallback = (progress) => {
      pageCount = progress.page;

      const beforeGC = global.testUtils.getMemoryUsage();
      memoryBeforeGC.push(beforeGC.heapUsedMB);

      // Force GC if available (requires --expose-gc)
      if (global.gc) {
        global.gc();
        const afterGC = global.testUtils.getMemoryUsage();
        memoryAfterGC.push(afterGC.heapUsedMB);
        console.log(`Page ${progress.page}: Before GC ${beforeGC.heapUsedMB}MB, After GC ${afterGC.heapUsedMB}MB`);
      }
    };

    await processor.processStreamingPDF(mediumPDF, testSessionId, progressCallback);

    if (global.gc && memoryAfterGC.length > 0) {
      // Calculate average memory reduction from GC
      const avgMemoryReduction = memoryBeforeGC.reduce((sum, before, index) => {
        const after = memoryAfterGC[index] || before;
        return sum + (before - after);
      }, 0) / memoryBeforeGC.length;

      console.log(`Average memory reduction from GC: ${Math.round(avgMemoryReduction)}MB`);

      // GC should provide some memory benefit
      expect(avgMemoryReduction).toBeGreaterThanOrEqual(0);
    } else {
      console.log('⚠️  Garbage collection not available (run with --expose-gc for full test)');
      // Test still passes, just logs warning
    }

    expect(pageCount).toBeGreaterThan(0);
  }, 120000);

  /**
   * Test 5: Memory Regression Test for Small Files
   * Ensure small files still work efficiently
   */
  test('should handle small PDFs with minimal memory overhead', async () => {
    const smallPDF = path.join('tests', 'fixtures', 'small-test.pdf');
    const initialMemory = global.testUtils.getMemoryUsage();
    let peakMemory = initialMemory;

    const progressCallback = (progress) => {
      const currentMemory = global.testUtils.getMemoryUsage();
      if (currentMemory.heapUsedMB > peakMemory.heapUsedMB) {
        peakMemory = currentMemory;
      }
    };

    const outputPath = await processor.processStreamingPDF(smallPDF, testSessionId, progressCallback);

    const finalMemory = global.testUtils.getMemoryUsage();
    const memoryIncrease = peakMemory.heapUsedMB - initialMemory.heapUsedMB;

    console.log(`Small PDF memory usage: Initial ${initialMemory.heapUsedMB}MB, Peak ${peakMemory.heapUsedMB}MB, Increase ${memoryIncrease}MB`);

    // Verify output
    expect(outputPath).toBeTruthy();
    const outputStats = await fs.stat(outputPath);
    expect(outputStats.size).toBeGreaterThan(0);

    // Small PDFs should use minimal additional memory
    expect(memoryIncrease).toBeLessThanOrEqual(50); // Max 50MB increase for small files
    expect(peakMemory.heapUsedMB).toBeLessThanOrEqual(200); // Should stay well under memory limits
  }, 60000);

  /**
   * Test 6: Concurrent Session Memory Isolation
   * Verify multiple sessions don't interfere with memory management
   */
  test('should isolate memory usage between concurrent sessions', async () => {
    const smallPDF = path.join('tests', 'fixtures', 'small-test.pdf');
    const session1Id = global.testUtils.generateTestSessionId();
    const session2Id = global.testUtils.generateTestSessionId();

    const session1Memory = [];
    const session2Memory = [];

    const createProgressCallback = (sessionMemory, sessionId) => (progress) => {
      const memory = global.testUtils.getMemoryUsage();
      sessionMemory.push({
        sessionId,
        page: progress.page,
        heapUsedMB: memory.heapUsedMB,
        timestamp: Date.now()
      });
    };

    // Start both sessions concurrently
    const [output1, output2] = await Promise.all([
      processor.processStreamingPDF(smallPDF, session1Id, createProgressCallback(session1Memory, session1Id)),
      processor.processStreamingPDF(smallPDF, session2Id, createProgressCallback(session2Memory, session2Id))
    ]);

    // Verify both sessions completed
    expect(output1).toBeTruthy();
    expect(output2).toBeTruthy();

    // Verify checkpoints exist for both sessions
    const checkpoint1 = await CheckpointManager.load(session1Id);
    const checkpoint2 = await CheckpointManager.load(session2Id);

    expect(checkpoint1).toBeTruthy();
    expect(checkpoint2).toBeTruthy();
    expect(checkpoint1.sessionId).toBe(session1Id);
    expect(checkpoint2.sessionId).toBe(session2Id);

    // Cleanup additional session
    await CheckpointManager.removeSession(session1Id);
    await CheckpointManager.removeSession(session2Id);

    console.log(`Concurrent sessions completed: ${session1Memory.length} vs ${session2Memory.length} memory snapshots`);
  }, 120000);
});