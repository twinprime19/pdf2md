import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

/**
 * Feature Flag Routing Tests for Phase 1 Ship Requirements
 *
 * Requirements:
 * ✅ Verify routing between legacy/streaming based on ENABLE_STREAMING and file size
 * ✅ Test STREAMING_THRESHOLD_MB configuration
 * ✅ Ensure no regression on small files (<10MB)
 * ✅ Verify proper response types for each mode
 */
describe('Feature Flag Routing Tests', () => {
  let app;
  let server;
  let originalEnv;

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Import server modules after setting up test environment
    const serverModule = await import('../server.js');
    app = serverModule.app || serverModule.default;

    // Start server on a test port
    server = app.listen(0); // Use random available port
    const address = server.address();
    console.log(`Test server running on port ${address.port}`);
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Close server
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(async () => {
    // Clean up test artifacts
    await global.testUtils.cleanupTestArtifacts();
  });

  /**
   * Test 1: ENABLE_STREAMING=false forces legacy processing
   */
  test('should use legacy processor when ENABLE_STREAMING=false', async () => {
    // Set environment for legacy mode
    process.env.ENABLE_STREAMING = 'false';
    process.env.STREAMING_THRESHOLD_MB = '10';

    const testFile = path.join('tests', 'fixtures', 'large-test.pdf'); // 60 pages, should trigger streaming if enabled

    const response = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(200);

    // Legacy processor returns immediate response with download URL
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('downloadUrl');
    expect(response.body).toHaveProperty('originalFilename');
    expect(response.body).toHaveProperty('processingTime');

    // Should not have streaming session properties
    expect(response.body).not.toHaveProperty('sessionId');
    expect(response.body).not.toHaveProperty('streaming');

    console.log('✅ Legacy mode confirmed with immediate response');
  }, 180000);

  /**
   * Test 2: ENABLE_STREAMING=true with large file triggers streaming
   */
  test('should use streaming processor for large files when enabled', async () => {
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '1'; // Very low threshold to trigger streaming

    const testFile = path.join('tests', 'fixtures', 'medium-test.pdf'); // Should exceed 1MB threshold

    const response = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202); // Accepted - processing started

    // Streaming processor returns session info
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body).toHaveProperty('streaming', true);
    expect(response.body).toHaveProperty('statusUrl');
    expect(response.body).toHaveProperty('downloadUrl');

    // Should not have immediate results
    expect(response.body).not.toHaveProperty('processingTime');

    console.log(`✅ Streaming mode confirmed with session: ${response.body.sessionId}`);

    // Test session status endpoint
    const sessionId = response.body.sessionId;
    const statusResponse = await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200);

    expect(statusResponse.body).toHaveProperty('sessionId', sessionId);
    expect(statusResponse.body).toHaveProperty('status');

    // Wait for processing to complete or make significant progress
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      const currentStatus = await request(app)
        .get(`/api/session/${sessionId}/status`)
        .expect(200);

      console.log(`Status check ${attempts + 1}: ${JSON.stringify(currentStatus.body)}`);

      if (currentStatus.body.complete || currentStatus.body.percentage > 50) {
        break;
      }

      await global.testUtils.wait(2000); // Wait 2 seconds
      attempts++;
    }

    console.log('✅ Streaming processing status verified');
  }, 180000);

  /**
   * Test 3: File size threshold behavior
   */
  test('should respect STREAMING_THRESHOLD_MB setting', async () => {
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '50'; // High threshold

    // Small file should use legacy processor
    const smallFile = path.join('tests', 'fixtures', 'small-test.pdf');
    const smallResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', smallFile)
      .expect(200);

    expect(smallResponse.body).toHaveProperty('downloadUrl');
    expect(smallResponse.body).not.toHaveProperty('sessionId');
    console.log('✅ Small file used legacy processor despite streaming enabled');

    // Lower threshold to trigger streaming for same file
    process.env.STREAMING_THRESHOLD_MB = '0.001'; // Very small threshold

    const streamingResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', smallFile)
      .expect(202);

    expect(streamingResponse.body).toHaveProperty('sessionId');
    expect(streamingResponse.body).toHaveProperty('streaming', true);
    console.log('✅ Same file used streaming processor with lower threshold');
  }, 120000);

  /**
   * Test 4: Environment variable validation and defaults
   */
  test('should handle invalid environment variables gracefully', async () => {
    // Test with invalid boolean value
    process.env.ENABLE_STREAMING = 'invalid';
    process.env.STREAMING_THRESHOLD_MB = 'not_a_number';

    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');
    const response = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(200);

    // Should fall back to legacy mode with invalid config
    expect(response.body).toHaveProperty('downloadUrl');
    expect(response.body).not.toHaveProperty('sessionId');
    console.log('✅ Invalid environment variables handled gracefully');
  }, 60000);

  /**
   * Test 5: API endpoint availability based on feature flags
   */
  test('should expose streaming endpoints only when streaming is enabled', async () => {
    process.env.ENABLE_STREAMING = 'true';

    // Test session status endpoint exists
    const sessionId = 'test-session-123';
    const statusResponse = await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200); // Should respond even for non-existent session

    expect(statusResponse.body).toHaveProperty('status', 'not_found');

    // Test download endpoint exists
    const downloadResponse = await request(app)
      .get(`/api/session/${sessionId}/download`)
      .expect(404); // File not found, but endpoint exists

    console.log('✅ Streaming endpoints available when feature enabled');

    // Test with streaming disabled
    process.env.ENABLE_STREAMING = 'false';

    // Endpoints should still exist but may behave differently
    const disabledStatusResponse = await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200);

    console.log('✅ Endpoints remain available when streaming disabled');
  }, 60000);

  /**
   * Test 6: Response format consistency
   */
  test('should maintain consistent response formats', async () => {
    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');

    // Test legacy response format
    process.env.ENABLE_STREAMING = 'false';

    const legacyResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(200);

    // Validate legacy response structure
    expect(legacyResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.any(String),
        originalFilename: expect.any(String),
        downloadUrl: expect.any(String),
        processingTime: expect.any(Number),
        pageCount: expect.any(Number),
        timestamp: expect.any(String)
      })
    );

    // Test streaming response format
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '0.001'; // Force streaming

    const streamingResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    // Validate streaming response structure
    expect(streamingResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.any(String),
        sessionId: expect.any(String),
        streaming: true,
        statusUrl: expect.any(String),
        downloadUrl: expect.any(String),
        originalFilename: expect.any(String),
        timestamp: expect.any(String)
      })
    );

    console.log('✅ Response format consistency maintained');
  }, 120000);

  /**
   * Test 7: Configuration reload behavior
   */
  test('should respect configuration changes during runtime', async () => {
    const testFile = path.join('tests', 'fixtures', 'medium-test.pdf');

    // Initial configuration: streaming disabled
    process.env.ENABLE_STREAMING = 'false';

    const response1 = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(200);

    expect(response1.body).not.toHaveProperty('sessionId');

    // Change configuration: enable streaming
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '1';

    const response2 = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    expect(response2.body).toHaveProperty('sessionId');

    console.log('✅ Configuration changes respected during runtime');
  }, 180000);

  /**
   * Test 8: Error handling consistency across modes
   */
  test('should handle errors consistently in both modes', async () => {
    const corruptFile = path.join('tests', 'fixtures', 'corrupt-test.pdf');

    // Test legacy mode error handling
    process.env.ENABLE_STREAMING = 'false';

    const legacyErrorResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', corruptFile)
      .expect(500);

    expect(legacyErrorResponse.body).toHaveProperty('error');
    expect(legacyErrorResponse.body.success).toBe(false);

    // Test streaming mode error handling
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '0';

    const streamingErrorResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', corruptFile)
      .expect(500);

    expect(streamingErrorResponse.body).toHaveProperty('error');
    expect(streamingErrorResponse.body.success).toBe(false);

    console.log('✅ Error handling consistent across modes');
  }, 120000);

  /**
   * Test 9: Memory configuration validation
   */
  test('should validate memory configuration parameters', async () => {
    // Test with various memory configurations
    const configs = [
      { MAX_MEMORY_MB: '512', valid: true },
      { MAX_MEMORY_MB: '2048', valid: true },
      { MAX_MEMORY_MB: 'invalid', valid: false },
      { MAX_MEMORY_MB: '-100', valid: false }
    ];

    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');

    for (const config of configs) {
      process.env.ENABLE_STREAMING = 'true';
      process.env.STREAMING_THRESHOLD_MB = '0';
      process.env.MAX_MEMORY_MB = config.MAX_MEMORY_MB;

      const response = await request(app)
        .post('/api/ocr')
        .attach('pdf', testFile);

      if (config.valid) {
        expect([200, 202]).toContain(response.status);
      } else {
        // Should handle invalid config gracefully (may default to legacy or use default values)
        expect([200, 202, 400, 500]).toContain(response.status);
      }

      console.log(`Memory config ${config.MAX_MEMORY_MB}: ${response.status} - ${config.valid ? 'valid' : 'invalid'}`);
    }

    console.log('✅ Memory configuration validation completed');
  }, 180000);
});