import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { StreamingProcessor } from '../streaming-processor.js';
import { CheckpointManager } from '../checkpoint-manager.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Checkpoint Recovery Tests for Phase 1 Ship Requirements
 *
 * Requirements:
 * ✅ Checkpoint recovery works after interruption
 * ✅ Atomic checkpoint saves prevent corruption
 * ✅ Resume from exact page where interrupted
 * ✅ Output file integrity maintained across interruptions
 */
describe('Checkpoint Recovery Tests', () => {
  let processor;
  let testSessionId;

  beforeAll(async () => {
    await fs.mkdir('temp/sessions', { recursive: true });
    await fs.mkdir('checkpoints', { recursive: true });
  });

  beforeEach(() => {
    processor = new StreamingProcessor({
      maxMemory: 1024 * 1024 * 1024,
      checkpointInterval: 3 // Frequent checkpoints for testing
    });
    testSessionId = global.testUtils.generateTestSessionId();
  });

  afterEach(async () => {
    try {
      await CheckpointManager.removeSession(testSessionId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test 1: Basic Checkpoint Creation and Recovery
   * Verify checkpoints are created and can be loaded
   */
  test('should create and load checkpoints correctly', async () => {
    const mediumPDF = path.join('tests', 'fixtures', 'medium-test.pdf');
    const pageCount = await processor.getPageCount(mediumPDF);

    console.log(`Testing checkpoint creation for ${pageCount}-page document`);

    let checkpointsSaved = 0;
    let lastCheckpointPage = 0;

    const progressCallback = (progress) => {
      if (progress.page % processor.checkpointInterval === 0) {
        checkpointsSaved++;
        lastCheckpointPage = progress.page;
      }
    };

    // Start processing
    const outputPath = await processor.processStreamingPDF(mediumPDF, testSessionId, progressCallback);

    // Verify checkpoints were created
    expect(checkpointsSaved).toBeGreaterThan(0);
    console.log(`Created ${checkpointsSaved} checkpoints during processing`);

    // Load final checkpoint
    const finalCheckpoint = await CheckpointManager.load(testSessionId);
    expect(finalCheckpoint).toBeTruthy();
    expect(finalCheckpoint.sessionId).toBe(testSessionId);
    expect(finalCheckpoint.lastPage).toBe(pageCount);
    expect(finalCheckpoint.totalPages).toBe(pageCount);
    expect(finalCheckpoint.complete).toBe(true);

    // Verify output file exists and has content
    const outputStats = await fs.stat(outputPath);
    expect(outputStats.size).toBeGreaterThan(0);
  }, 120000);

  /**
   * Test 2: Interruption and Resume Simulation
   * Simulate interruption at 50% and verify resume works
   */
  test('should resume processing from checkpoint after interruption', async () => {
    const largePDF = path.join('tests', 'fixtures', 'large-test.pdf');
    const pageCount = await processor.getPageCount(largePDF);
    const interruptAt = Math.floor(pageCount * 0.5); // Stop at 50%

    console.log(`Simulating interruption at page ${interruptAt} of ${pageCount}`);

    // Phase 1: Process until interruption point
    let pagesProcessed = 0;
    const progressCallback1 = (progress) => {
      pagesProcessed = progress.page;
      if (progress.page >= interruptAt) {
        // Simulate interruption by throwing error
        throw new Error('SIMULATED_INTERRUPTION');
      }
    };

    // First processing attempt - should be interrupted
    let interruptionOccurred = false;
    try {
      await processor.processStreamingPDF(largePDF, testSessionId, progressCallback1);
    } catch (error) {
      if (error.message === 'SIMULATED_INTERRUPTION') {
        interruptionOccurred = true;
        console.log(`Successfully simulated interruption at page ${pagesProcessed}`);
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    expect(interruptionOccurred).toBe(true);
    expect(pagesProcessed).toBeGreaterThanOrEqual(interruptAt);

    // Verify checkpoint exists from first attempt
    const checkpointAfterInterruption = await CheckpointManager.load(testSessionId);
    expect(checkpointAfterInterruption).toBeTruthy();
    expect(checkpointAfterInterruption.lastPage).toBeGreaterThan(0);
    expect(checkpointAfterInterruption.complete).toBe(false);

    console.log(`Checkpoint saved at page ${checkpointAfterInterruption.lastPage}`);

    // Verify partial output file exists
    const partialOutputPath = `temp/sessions/${testSessionId}.txt`;
    const partialStats = await fs.stat(partialOutputPath);
    expect(partialStats.size).toBeGreaterThan(0);

    // Read partial output to verify content
    const partialContent = await fs.readFile(partialOutputPath, 'utf8');
    expect(partialContent).toContain('OCR Extraction Results');
    expect(partialContent).toContain(`Page 1`);

    // Phase 2: Resume processing from checkpoint
    const processor2 = new StreamingProcessor({
      maxMemory: 1024 * 1024 * 1024,
      checkpointInterval: 3
    });

    let resumeStartPage = 0;
    let finalPage = 0;

    const progressCallback2 = (progress) => {
      if (resumeStartPage === 0) {
        resumeStartPage = progress.page;
      }
      finalPage = progress.page;
    };

    const finalOutputPath = await processor2.processStreamingPDF(largePDF, testSessionId, progressCallback2);

    // Verify resume started from correct page
    expect(resumeStartPage).toBe(checkpointAfterInterruption.lastPage + 1);
    expect(finalPage).toBe(pageCount);

    console.log(`Resumed from page ${resumeStartPage}, completed at page ${finalPage}`);

    // Verify final checkpoint
    const finalCheckpoint = await CheckpointManager.load(testSessionId);
    expect(finalCheckpoint.complete).toBe(true);
    expect(finalCheckpoint.lastPage).toBe(pageCount);

    // Verify final output file integrity
    const finalStats = await fs.stat(finalOutputPath);
    expect(finalStats.size).toBeGreaterThan(partialStats.size);

    const finalContent = await fs.readFile(finalOutputPath, 'utf8');
    expect(finalContent).toContain(`Page 1`); // Start content preserved
    expect(finalContent).toContain(`Page ${pageCount}`); // End content added

    // Count pages in output to ensure all were processed
    const pageMatches = finalContent.match(/--- Page \d+ ---/g);
    expect(pageMatches).toBeTruthy();
    expect(pageMatches.length).toBe(pageCount);

    console.log(`✅ Recovery completed: ${pageMatches.length} pages in final output`);
  }, 300000); // 5 minute timeout for full recovery test

  /**
   * Test 3: Atomic Checkpoint Saves
   * Verify checkpoint saves are atomic and don't corrupt on interruption
   */
  test('should save checkpoints atomically without corruption', async () => {
    const mediumPDF = path.join('tests', 'fixtures', 'medium-test.pdf');

    // Monitor checkpoint file during processing
    const checkpointPath = path.join('checkpoints', `${testSessionId}.json`);
    const tempCheckpointPath = `${checkpointPath}.tmp`;

    let checkpointsValidated = 0;

    const progressCallback = async (progress) => {
      if (progress.page % processor.checkpointInterval === 0) {
        // Small delay to allow checkpoint write to complete
        await global.testUtils.wait(10);

        // Verify no temporary file remains (atomic operation completed)
        try {
          await fs.access(tempCheckpointPath);
          throw new Error('Temporary checkpoint file should not exist after write');
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error; // Re-throw unexpected errors
          }
          // ENOENT is expected - temp file cleaned up
        }

        // Verify checkpoint file is valid JSON
        try {
          const checkpointData = await fs.readFile(checkpointPath, 'utf8');
          const checkpoint = JSON.parse(checkpointData);

          expect(checkpoint.sessionId).toBe(testSessionId);
          expect(checkpoint.lastPage).toBe(progress.page);
          expect(typeof checkpoint.timestamp).toBe('number');

          checkpointsValidated++;
          console.log(`Validated checkpoint at page ${progress.page}`);
        } catch (error) {
          throw new Error(`Corrupted checkpoint at page ${progress.page}: ${error.message}`);
        }
      }
    };

    await processor.processStreamingPDF(mediumPDF, testSessionId, progressCallback);

    expect(checkpointsValidated).toBeGreaterThan(0);
    console.log(`✅ Validated ${checkpointsValidated} atomic checkpoint saves`);
  }, 120000);

  /**
   * Test 4: Output File Integrity Across Resume
   * Verify output file maintains integrity when resuming
   */
  test('should maintain output file integrity during resume', async () => {
    const mediumPDF = path.join('tests', 'fixtures', 'medium-test.pdf');
    const pageCount = await processor.getPageCount(mediumPDF);
    const stopAt = Math.floor(pageCount / 2);

    // First processing - stop halfway
    let processed = 0;
    const progressCallback1 = (progress) => {
      processed = progress.page;
      if (progress.page >= stopAt) {
        throw new Error('STOP_HALFWAY');
      }
    };

    try {
      await processor.processStreamingPDF(mediumPDF, testSessionId, progressCallback1);
    } catch (error) {
      if (error.message !== 'STOP_HALFWAY') {
        throw error;
      }
    }

    // Read partial output
    const outputPath = `temp/sessions/${testSessionId}.txt`;
    const partialContent = await fs.readFile(outputPath, 'utf8');
    const partialLines = partialContent.split('\n').length;

    console.log(`Partial output has ${partialLines} lines after processing ${processed} pages`);

    // Resume processing
    const processor2 = new StreamingProcessor({
      maxMemory: 1024 * 1024 * 1024,
      checkpointInterval: 3
    });

    await processor2.processStreamingPDF(mediumPDF, testSessionId, () => {});

    // Read final output
    const finalContent = await fs.readFile(outputPath, 'utf8');
    const finalLines = finalContent.split('\n').length;

    console.log(`Final output has ${finalLines} lines after full processing`);

    // Verify integrity
    expect(finalLines).toBeGreaterThan(partialLines);
    expect(finalContent.startsWith(partialContent.substring(0, 500))).toBe(true); // First 500 chars should be preserved

    // Verify no duplicate headers or corruption
    const headers = finalContent.match(/OCR Extraction Results \(Streaming\)/g);
    expect(headers).toBeTruthy();
    expect(headers.length).toBe(1); // Should only have one header

    // Verify all pages are present and in order
    for (let i = 1; i <= pageCount; i++) {
      expect(finalContent).toContain(`--- Page ${i} ---`);
    }

    console.log('✅ Output file integrity maintained across resume');
  }, 180000);

  /**
   * Test 5: Multiple Interruption Recovery
   * Test recovery through multiple interruptions
   */
  test('should handle multiple interruptions and recoveries', async () => {
    const largePDF = path.join('tests', 'fixtures', 'large-test.pdf');
    const pageCount = await processor.getPageCount(largePDF);
    const interruptions = [
      Math.floor(pageCount * 0.2),
      Math.floor(pageCount * 0.5),
      Math.floor(pageCount * 0.8)
    ];

    console.log(`Testing multiple interruptions at pages: ${interruptions.join(', ')} of ${pageCount}`);

    let currentInterruption = 0;
    let totalResumeAttempts = 0;

    for (let attempt = 0; attempt < interruptions.length + 1; attempt++) {
      const currentProcessor = new StreamingProcessor({
        maxMemory: 1024 * 1024 * 1024,
        checkpointInterval: 2
      });

      const progressCallback = (progress) => {
        if (currentInterruption < interruptions.length && progress.page >= interruptions[currentInterruption]) {
          currentInterruption++;
          throw new Error(`INTERRUPTION_${currentInterruption}`);
        }
      };

      try {
        const outputPath = await currentProcessor.processStreamingPDF(largePDF, testSessionId, progressCallback);

        // If we reach here, processing completed successfully
        console.log(`✅ Processing completed after ${totalResumeAttempts} interruptions`);

        // Verify final output
        const finalContent = await fs.readFile(outputPath, 'utf8');
        const pageMatches = finalContent.match(/--- Page \d+ ---/g);
        expect(pageMatches).toBeTruthy();
        expect(pageMatches.length).toBe(pageCount);

        break; // Exit loop - processing complete
      } catch (error) {
        if (error.message.startsWith('INTERRUPTION_')) {
          totalResumeAttempts++;
          console.log(`Interruption ${currentInterruption} occurred, attempting resume...`);

          // Verify checkpoint exists
          const checkpoint = await CheckpointManager.load(testSessionId);
          expect(checkpoint).toBeTruthy();
          expect(checkpoint.lastPage).toBeGreaterThan(0);
          console.log(`Checkpoint found at page ${checkpoint.lastPage}`);

          // Continue to next attempt
          continue;
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }

    expect(totalResumeAttempts).toBe(interruptions.length);
    console.log(`✅ Successfully recovered from ${totalResumeAttempts} interruptions`);
  }, 300000);

  /**
   * Test 6: Checkpoint Cleanup and Lifecycle
   * Test checkpoint cleanup after completion
   */
  test('should manage checkpoint lifecycle correctly', async () => {
    const smallPDF = path.join('tests', 'fixtures', 'small-test.pdf');

    // Process to completion
    await processor.processStreamingPDF(smallPDF, testSessionId, () => {});

    // Verify checkpoint exists and is marked complete
    let checkpoint = await CheckpointManager.load(testSessionId);
    expect(checkpoint).toBeTruthy();
    expect(checkpoint.complete).toBe(true);

    // Test checkpoint update functionality
    const updateSuccess = await CheckpointManager.update(testSessionId, {
      customField: 'test-data',
      errorCount: 0
    });
    expect(updateSuccess).toBe(true);

    // Verify update was applied
    checkpoint = await CheckpointManager.load(testSessionId);
    expect(checkpoint.customField).toBe('test-data');
    expect(checkpoint.errorCount).toBe(0);

    // Test session removal
    const removeSuccess = await CheckpointManager.removeSession(testSessionId);
    expect(removeSuccess).toBe(true);

    // Verify checkpoint and output file are removed
    const checkpointAfterRemoval = await CheckpointManager.load(testSessionId);
    expect(checkpointAfterRemoval).toBeNull();

    const outputPath = `temp/sessions/${testSessionId}.txt`;
    try {
      await fs.access(outputPath);
      throw new Error('Output file should have been removed');
    } catch (error) {
      expect(error.code).toBe('ENOENT');
    }

    console.log('✅ Checkpoint lifecycle managed correctly');
  }, 60000);
});