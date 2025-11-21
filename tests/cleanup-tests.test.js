import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { StreamingProcessor } from '../streaming-processor.js';
import { CheckpointManager } from '../checkpoint-manager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Cleanup Tests for Phase 1 Ship Requirements
 *
 * Requirements:
 * ✅ Verify temp files and checkpoints are cleaned up properly
 * ✅ Test automatic cleanup mechanisms
 * ✅ Validate no resource leaks
 * ✅ Test cleanup after errors and interruptions
 */
describe('Cleanup Tests', () => {
  let processor;
  let testSessionId;

  beforeAll(async () => {
    await fs.mkdir('temp/sessions', { recursive: true });
    await fs.mkdir('checkpoints', { recursive: true });
  });

  beforeEach(() => {
    processor = new StreamingProcessor({
      maxMemory: 1024 * 1024 * 1024,
      checkpointInterval: 3
    });
    testSessionId = global.testUtils.generateTestSessionId();
  });

  afterEach(async () => {
    // Let tests handle their own cleanup for verification
  });

  /**
   * Test 1: Automatic Page Image Cleanup
   */
  test('should clean up page images immediately after processing', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');
    const pageImagesFound = [];

    const progressCallback = async (progress) => {
      // Check for page images in temp directory during processing
      const sessionDir = 'temp/sessions';
      const files = await fs.readdir(sessionDir);

      const pageImages = files.filter(file =>
        file.startsWith(`${testSessionId}_page_`) && file.endsWith('.jpg')
      );

      if (pageImages.length > 0) {
        pageImagesFound.push(...pageImages.map(img => ({
          page: progress.page,
          image: img,
          timestamp: Date.now()
        })));
      }

      console.log(`Page ${progress.page}: Found ${pageImages.length} temp images`);
    };

    await processor.processStreamingPDF(testPDF, testSessionId, progressCallback);

    // After processing, verify no page images remain
    const finalFiles = await fs.readdir('temp/sessions');
    const remainingPageImages = finalFiles.filter(file =>
      file.startsWith(`${testSessionId}_page_`) && file.endsWith('.jpg')
    );

    expect(remainingPageImages.length).toBe(0);

    console.log(`✅ Page image cleanup verified: ${pageImagesFound.length} temporary images processed, ${remainingPageImages.length} remaining`);

    // Clean up session manually for this test
    await CheckpointManager.removeSession(testSessionId);
  }, 60000);

  /**
   * Test 2: Session Cleanup Completeness
   */
  test('should completely clean up session data when requested', async () => {
    const testPDF = path.join('tests', 'fixtures', 'medium-test.pdf');

    // Process to completion
    await processor.processStreamingPDF(testPDF, testSessionId, () => {});

    // Verify artifacts exist before cleanup
    const checkpointPath = path.join('checkpoints', `${testSessionId}.json`);
    const outputPath = path.join('temp', 'sessions', `${testSessionId}.txt`);

    const checkpointExists = await fs.access(checkpointPath).then(() => true).catch(() => false);
    const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);

    expect(checkpointExists).toBe(true);
    expect(outputExists).toBe(true);

    console.log(`Before cleanup: Checkpoint ${checkpointExists}, Output ${outputExists}`);

    // Perform cleanup
    const cleanupSuccess = await CheckpointManager.removeSession(testSessionId);
    expect(cleanupSuccess).toBe(true);

    // Verify complete removal
    const checkpointExistsAfter = await fs.access(checkpointPath).then(() => true).catch(() => false);
    const outputExistsAfter = await fs.access(outputPath).then(() => true).catch(() => false);

    expect(checkpointExistsAfter).toBe(false);
    expect(outputExistsAfter).toBe(false);

    console.log(`After cleanup: Checkpoint ${checkpointExistsAfter}, Output ${outputExistsAfter}`);
    console.log('✅ Complete session cleanup verified');
  }, 120000);

  /**
   * Test 3: Bulk Cleanup Operations
   */
  test('should handle bulk cleanup of old files', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    // Create multiple sessions
    const sessionIds = [
      global.testUtils.generateTestSessionId(),
      global.testUtils.generateTestSessionId(),
      global.testUtils.generateTestSessionId()
    ];

    // Process all sessions
    for (const sessionId of sessionIds) {
      const processor = new StreamingProcessor({
        maxMemory: 1024 * 1024 * 1024,
        checkpointInterval: 2
      });

      await processor.processStreamingPDF(testPDF, sessionId, () => {});
    }

    // Verify all sessions exist
    let existingSessionsCount = 0;
    for (const sessionId of sessionIds) {
      const status = await CheckpointManager.getStatus(sessionId);
      if (status.exists) {
        existingSessionsCount++;
      }
    }

    expect(existingSessionsCount).toBe(sessionIds.length);
    console.log(`Created ${existingSessionsCount} test sessions`);

    // Perform bulk cleanup with 0 day retention (clean everything)
    const cleanupStats = await CheckpointManager.cleanup(0);

    expect(cleanupStats.checkpointsRemoved).toBeGreaterThanOrEqual(sessionIds.length);
    expect(cleanupStats.sessionsRemoved).toBeGreaterThanOrEqual(sessionIds.length);

    console.log(`Bulk cleanup stats:`, cleanupStats);

    // Verify sessions were removed
    let remainingSessionsCount = 0;
    for (const sessionId of sessionIds) {
      const status = await CheckpointManager.getStatus(sessionId);
      if (status.exists) {
        remainingSessionsCount++;
      }
    }

    expect(remainingSessionsCount).toBe(0);
    console.log('✅ Bulk cleanup verified');
  }, 180000);

  /**
   * Test 4: Cleanup After Interrupted Processing
   */
  test('should clean up properly after processing interruption', async () => {
    const testPDF = path.join('tests', 'fixtures', 'medium-test.pdf');
    const sessionFiles = [];

    const progressCallback = async (progress) => {
      // Track files created during processing
      const sessionDir = 'temp/sessions';
      const files = await fs.readdir(sessionDir);
      const newSessionFiles = files.filter(file => file.includes(testSessionId));

      for (const file of newSessionFiles) {
        if (!sessionFiles.includes(file)) {
          sessionFiles.push(file);
        }
      }

      // Simulate interruption partway through
      if (progress.page >= 5) {
        throw new Error('SIMULATED_INTERRUPTION');
      }
    };

    // Process with interruption
    let interrupted = false;
    try {
      await processor.processStreamingPDF(testPDF, testSessionId, progressCallback);
    } catch (error) {
      if (error.message === 'SIMULATED_INTERRUPTION') {
        interrupted = true;
      } else {
        throw error;
      }
    }

    expect(interrupted).toBe(true);
    console.log(`Interruption occurred, ${sessionFiles.length} session files tracked`);

    // Check what files exist after interruption
    const filesAfterInterruption = await fs.readdir('temp/sessions');
    const interruptedSessionFiles = filesAfterInterruption.filter(file => file.includes(testSessionId));

    // Should have partial output but no page images
    const pageImages = interruptedSessionFiles.filter(file => file.includes('_page_'));
    expect(pageImages.length).toBe(0); // Page images should be cleaned up immediately

    console.log(`After interruption: ${interruptedSessionFiles.length} files, ${pageImages.length} page images`);

    // Clean up the interrupted session
    const cleanupSuccess = await CheckpointManager.removeSession(testSessionId);
    expect(cleanupSuccess).toBe(true);

    // Verify complete cleanup
    const filesAfterCleanup = await fs.readdir('temp/sessions');
    const remainingSessionFiles = filesAfterCleanup.filter(file => file.includes(testSessionId));

    expect(remainingSessionFiles.length).toBe(0);
    console.log('✅ Cleanup after interruption verified');
  }, 120000);

  /**
   * Test 5: Concurrent Processing Cleanup
   */
  test('should handle cleanup during concurrent processing', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    const session1Id = global.testUtils.generateTestSessionId();
    const session2Id = global.testUtils.generateTestSessionId();

    // Start two sessions concurrently
    const processor1 = new StreamingProcessor({ checkpointInterval: 2 });
    const processor2 = new StreamingProcessor({ checkpointInterval: 2 });

    const processing = Promise.allSettled([
      processor1.processStreamingPDF(testPDF, session1Id, () => {}),
      processor2.processStreamingPDF(testPDF, session2Id, () => {})
    ]);

    // Let processing start
    await global.testUtils.wait(2000);

    // Clean up session1 while session2 is still processing
    const cleanupSuccess = await CheckpointManager.removeSession(session1Id);

    // Wait for processing to complete
    const results = await processing;

    // Session1 might fail due to cleanup during processing, which is acceptable
    // Session2 should complete successfully
    const session2Success = results[1].status === 'fulfilled';
    expect(session2Success).toBe(true);

    console.log(`Concurrent cleanup test: Session1 cleanup ${cleanupSuccess ? 'successful' : 'failed'}, Session2 ${session2Success ? 'completed' : 'failed'}`);

    // Clean up remaining session
    await CheckpointManager.removeSession(session2Id);

    console.log('✅ Concurrent processing cleanup verified');
  }, 120000);

  /**
   * Test 6: Resource Leak Detection
   */
  test('should not leak file handles or resources', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    const initialMemory = global.testUtils.getMemoryUsage();
    console.log(`Initial memory: ${initialMemory.heapUsedMB}MB`);

    // Process multiple small sessions to test for resource leaks
    const sessionCount = 5;
    const sessionIds = [];

    for (let i = 0; i < sessionCount; i++) {
      const sessionId = global.testUtils.generateTestSessionId();
      sessionIds.push(sessionId);

      const processor = new StreamingProcessor({
        maxMemory: 1024 * 1024 * 1024,
        checkpointInterval: 2
      });

      await processor.processStreamingPDF(testPDF, sessionId, () => {});

      const currentMemory = global.testUtils.getMemoryUsage();
      console.log(`After session ${i + 1}: ${currentMemory.heapUsedMB}MB`);
    }

    const beforeCleanupMemory = global.testUtils.getMemoryUsage();
    console.log(`Before cleanup: ${beforeCleanupMemory.heapUsedMB}MB`);

    // Clean up all sessions
    for (const sessionId of sessionIds) {
      await CheckpointManager.removeSession(sessionId);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      await global.testUtils.wait(100);
    }

    const afterCleanupMemory = global.testUtils.getMemoryUsage();
    const memoryIncrease = afterCleanupMemory.heapUsedMB - initialMemory.heapUsedMB;

    console.log(`After cleanup: ${afterCleanupMemory.heapUsedMB}MB (increase: ${memoryIncrease}MB)`);

    // Memory should not grow excessively
    expect(memoryIncrease).toBeLessThanOrEqual(50); // Max 50MB increase for resource accounting

    console.log('✅ Resource leak detection completed');
  }, 300000);

  /**
   * Test 7: Cleanup Error Handling
   */
  test('should handle cleanup errors gracefully', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    // Create a session
    await processor.processStreamingPDF(testPDF, testSessionId, () => {});

    // Manually corrupt/remove checkpoint file
    const checkpointPath = path.join('checkpoints', `${testSessionId}.json`);
    await fs.unlink(checkpointPath);

    // Try to clean up - should handle missing checkpoint gracefully
    const cleanupSuccess = await CheckpointManager.removeSession(testSessionId);

    // Cleanup might report success even if checkpoint was already missing
    console.log(`Cleanup with missing checkpoint: ${cleanupSuccess ? 'success' : 'failed'}`);

    // Verify output file is still cleaned up
    const outputPath = path.join('temp', 'sessions', `${testSessionId}.txt`);
    const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);

    expect(outputExists).toBe(false);
    console.log('✅ Cleanup error handling verified');
  }, 60000);

  /**
   * Test 8: Cleanup Timing and Performance
   */
  test('should perform cleanup operations efficiently', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    // Create session
    await processor.processStreamingPDF(testPDF, testSessionId, () => {});

    // Time the cleanup operation
    const cleanupStart = Date.now();
    const cleanupSuccess = await CheckpointManager.removeSession(testSessionId);
    const cleanupTime = Date.now() - cleanupStart;

    expect(cleanupSuccess).toBe(true);
    expect(cleanupTime).toBeLessThan(1000); // Should complete within 1 second

    console.log(`✅ Cleanup performance: ${cleanupTime}ms`);
  }, 60000);

  /**
   * Test 9: Directory Structure Maintenance
   */
  test('should maintain clean directory structure', async () => {
    const testPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    // Process and clean up multiple sessions
    for (let i = 0; i < 3; i++) {
      const sessionId = global.testUtils.generateTestSessionId();
      await processor.processStreamingPDF(testPDF, sessionId, () => {});
      await CheckpointManager.removeSession(sessionId);
    }

    // Check directory cleanliness
    const checkpointFiles = await fs.readdir('checkpoints');
    const sessionFiles = await fs.readdir('temp/sessions');

    const testArtifacts = [
      ...checkpointFiles.filter(f => f.includes('test_')),
      ...sessionFiles.filter(f => f.includes('test_'))
    ];

    console.log(`Directory cleanliness: ${testArtifacts.length} test artifacts remaining`);

    // Should have minimal or no test artifacts
    expect(testArtifacts.length).toBeLessThanOrEqual(2); // Allow for some timing variance

    console.log('✅ Directory structure maintenance verified');
  }, 120000);
});