import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';

/**
 * Streaming API Integration Tests for Phase 1 Ship Requirements
 *
 * Requirements:
 * ✅ Test all new endpoints (/api/session/*/status, /download, etc.)
 * ✅ Verify proper session management
 * ✅ Test concurrent session handling
 * ✅ Validate download functionality
 */
describe('Streaming API Integration Tests', () => {
  let app;
  let server;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };

    // Enable streaming for these tests
    process.env.ENABLE_STREAMING = 'true';
    process.env.STREAMING_THRESHOLD_MB = '0'; // Force all files to use streaming

    const serverModule = await import('../server.js');
    app = serverModule.app || serverModule.default;

    server = app.listen(0);
    const address = server.address();
    console.log(`Test server running on port ${address.port}`);
  });

  afterAll(async () => {
    process.env = originalEnv;
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(async () => {
    await global.testUtils.cleanupTestArtifacts();
  });

  /**
   * Test 1: Complete Streaming Workflow
   * Test the full workflow from upload to download
   */
  test('should handle complete streaming workflow from upload to download', async () => {
    const testFile = path.join('tests', 'fixtures', 'medium-test.pdf');

    // Step 1: Upload and start processing
    const uploadResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    expect(uploadResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        sessionId: expect.any(String),
        streaming: true,
        statusUrl: expect.any(String),
        downloadUrl: expect.any(String)
      })
    );

    const sessionId = uploadResponse.body.sessionId;
    console.log(`Started processing session: ${sessionId}`);

    // Step 2: Monitor progress via status endpoint
    let attempts = 0;
    let currentStatus = null;
    const maxAttempts = 60; // 2 minutes max wait

    while (attempts < maxAttempts) {
      const statusResponse = await request(app)
        .get(`/api/session/${sessionId}/status`)
        .expect(200);

      currentStatus = statusResponse.body;
      console.log(`Status check ${attempts + 1}: ${currentStatus.percentage}% complete`);

      expect(currentStatus).toEqual(
        expect.objectContaining({
          sessionId: sessionId,
          status: expect.stringMatching(/^(in_progress|completed)$/),
          percentage: expect.any(Number),
          exists: true
        })
      );

      if (currentStatus.complete || currentStatus.status === 'completed') {
        break;
      }

      await global.testUtils.wait(2000);
      attempts++;
    }

    expect(currentStatus.complete || currentStatus.status === 'completed').toBe(true);
    console.log(`Processing completed in ${attempts} status checks`);

    // Step 3: Download the result
    const downloadResponse = await request(app)
      .get(`/api/session/${sessionId}/download`)
      .expect(200)
      .expect('Content-Type', 'text/plain; charset=utf-8');

    expect(downloadResponse.text).toContain('OCR Extraction Results');
    expect(downloadResponse.text).toContain('--- Page 1 ---');
    expect(downloadResponse.headers['content-disposition']).toMatch(/attachment; filename=/);

    console.log(`✅ Complete workflow verified - downloaded ${downloadResponse.text.length} characters`);
  }, 300000);

  /**
   * Test 2: Session Status Endpoint Behavior
   */
  test('should provide accurate session status information', async () => {
    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');

    const uploadResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    const sessionId = uploadResponse.body.sessionId;

    // Test status during processing
    const statusResponse = await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200);

    expect(statusResponse.body).toEqual(
      expect.objectContaining({
        sessionId: sessionId,
        exists: true,
        status: expect.stringMatching(/^(in_progress|completed)$/),
        percentage: expect.any(Number),
        lastPage: expect.any(Number),
        totalPages: expect.any(Number),
        timestamp: expect.any(Number)
      })
    );

    // Verify percentage is valid
    expect(statusResponse.body.percentage).toBeGreaterThanOrEqual(0);
    expect(statusResponse.body.percentage).toBeLessThanOrEqual(100);

    // Verify page counts are logical
    expect(statusResponse.body.lastPage).toBeGreaterThanOrEqual(0);
    expect(statusResponse.body.lastPage).toBeLessThanOrEqual(statusResponse.body.totalPages);
    expect(statusResponse.body.totalPages).toBeGreaterThan(0);

    console.log(`Status verification: ${JSON.stringify(statusResponse.body, null, 2)}`);
  }, 120000);

  /**
   * Test 3: Non-existent Session Handling
   */
  test('should handle non-existent session requests gracefully', async () => {
    const fakeSessionId = 'non-existent-session-123';

    // Test status for non-existent session
    const statusResponse = await request(app)
      .get(`/api/session/${fakeSessionId}/status`)
      .expect(200);

    expect(statusResponse.body).toEqual({
      status: 'not_found',
      sessionId: fakeSessionId,
      exists: false
    });

    // Test download for non-existent session
    const downloadResponse = await request(app)
      .get(`/api/session/${fakeSessionId}/download`)
      .expect(404);

    expect(downloadResponse.body).toHaveProperty('error');
    expect(downloadResponse.body.error).toContain('not found');

    console.log('✅ Non-existent session handling verified');
  }, 30000);

  /**
   * Test 4: Concurrent Session Management
   */
  test('should handle multiple concurrent sessions', async () => {
    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');
    const concurrentSessions = 3;

    // Start multiple sessions concurrently
    const uploadPromises = Array(concurrentSessions).fill().map(() =>
      request(app)
        .post('/api/ocr')
        .attach('pdf', testFile)
        .expect(202)
    );

    const uploadResponses = await Promise.all(uploadPromises);

    // Verify all sessions have unique IDs
    const sessionIds = uploadResponses.map(res => res.body.sessionId);
    const uniqueSessionIds = [...new Set(sessionIds)];
    expect(uniqueSessionIds.length).toBe(concurrentSessions);

    console.log(`Started ${concurrentSessions} concurrent sessions: ${sessionIds.join(', ')}`);

    // Monitor all sessions
    const statusPromises = sessionIds.map(sessionId =>
      request(app)
        .get(`/api/session/${sessionId}/status`)
        .expect(200)
    );

    const statusResponses = await Promise.all(statusPromises);

    // Verify all sessions are being processed independently
    for (let i = 0; i < statusResponses.length; i++) {
      const status = statusResponses[i].body;
      expect(status.sessionId).toBe(sessionIds[i]);
      expect(status.exists).toBe(true);
      expect(['in_progress', 'completed']).toContain(status.status);
    }

    // Wait for all sessions to complete
    let completed = 0;
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (completed < concurrentSessions && Date.now() - startTime < maxWaitTime) {
      const currentStatusPromises = sessionIds.map(sessionId =>
        request(app).get(`/api/session/${sessionId}/status`).expect(200)
      );

      const currentStatuses = await Promise.all(currentStatusPromises);
      completed = currentStatuses.filter(res => res.body.complete).length;

      console.log(`Concurrent progress: ${completed}/${concurrentSessions} sessions completed`);

      if (completed < concurrentSessions) {
        await global.testUtils.wait(3000);
      }
    }

    expect(completed).toBe(concurrentSessions);

    // Test downloading from all sessions
    const downloadPromises = sessionIds.map(sessionId =>
      request(app)
        .get(`/api/session/${sessionId}/download`)
        .expect(200)
    );

    const downloadResponses = await Promise.all(downloadPromises);

    // Verify all downloads successful
    downloadResponses.forEach(res => {
      expect(res.text).toContain('OCR Extraction Results');
      expect(res.text.length).toBeGreaterThan(100);
    });

    console.log(`✅ ${concurrentSessions} concurrent sessions completed successfully`);
  }, 300000);

  /**
   * Test 5: Download Endpoint Features
   */
  test('should provide proper download functionality', async () => {
    const testFile = path.join('tests', 'fixtures', 'medium-test.pdf');
    const originalFilename = 'medium-test.pdf';

    const uploadResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    const sessionId = uploadResponse.body.sessionId;

    // Wait for processing to complete
    let completed = false;
    let attempts = 0;

    while (!completed && attempts < 60) {
      const statusResponse = await request(app)
        .get(`/api/session/${sessionId}/status`)
        .expect(200);

      completed = statusResponse.body.complete;

      if (!completed) {
        await global.testUtils.wait(2000);
        attempts++;
      }
    }

    expect(completed).toBe(true);

    // Test download
    const downloadResponse = await request(app)
      .get(`/api/session/${sessionId}/download`)
      .expect(200);

    // Verify content type
    expect(downloadResponse.headers['content-type']).toBe('text/plain; charset=utf-8');

    // Verify content disposition
    const contentDisposition = downloadResponse.headers['content-disposition'];
    expect(contentDisposition).toMatch(/attachment; filename=/);
    expect(contentDisposition).toContain('.txt');

    // Verify content structure
    const content = downloadResponse.text;
    expect(content).toContain('OCR Extraction Results (Streaming)');
    expect(content).toContain('='.repeat(50));
    expect(content).toContain('Processing started:');
    expect(content).toContain(`Session: ${sessionId}`);

    // Verify page content
    const pageMatches = content.match(/--- Page \d+ ---/g);
    expect(pageMatches).toBeTruthy();
    expect(pageMatches.length).toBeGreaterThan(0);

    console.log(`✅ Download verified: ${content.length} characters, ${pageMatches.length} pages`);

    // Test multiple downloads of same session
    const secondDownloadResponse = await request(app)
      .get(`/api/session/${sessionId}/download`)
      .expect(200);

    expect(secondDownloadResponse.text).toBe(content);
    console.log('✅ Multiple downloads return consistent content');
  }, 180000);

  /**
   * Test 6: Session List and Management
   */
  test('should provide session management capabilities', async () => {
    // Create a test session
    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');

    const uploadResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    const sessionId = uploadResponse.body.sessionId;

    // Test session exists in status
    const statusResponse = await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200);

    expect(statusResponse.body.exists).toBe(true);

    // Wait for completion if needed
    let attempts = 0;
    while (!statusResponse.body.complete && attempts < 30) {
      await global.testUtils.wait(2000);
      const currentStatus = await request(app)
        .get(`/api/session/${sessionId}/status`)
        .expect(200);

      if (currentStatus.body.complete) {
        break;
      }
      attempts++;
    }

    console.log(`✅ Session ${sessionId} management verified`);
  }, 120000);

  /**
   * Test 7: Error Recovery in API
   */
  test('should handle API errors gracefully', async () => {
    // Test with corrupt PDF
    const corruptFile = path.join('tests', 'fixtures', 'corrupt-test.pdf');

    const errorResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', corruptFile)
      .expect(500);

    expect(errorResponse.body).toHaveProperty('error');
    expect(errorResponse.body.success).toBe(false);

    // Test with empty PDF
    const emptyFile = path.join('tests', 'fixtures', 'empty-test.pdf');

    const emptyResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', emptyFile)
      .expect(500);

    expect(emptyResponse.body).toHaveProperty('error');
    expect(emptyResponse.body.success).toBe(false);

    console.log('✅ Error handling in API verified');
  }, 60000);

  /**
   * Test 8: API Response Time and Performance
   */
  test('should respond to API calls within reasonable time', async () => {
    const testFile = path.join('tests', 'fixtures', 'small-test.pdf');

    // Test upload response time
    const uploadStart = Date.now();
    const uploadResponse = await request(app)
      .post('/api/ocr')
      .attach('pdf', testFile)
      .expect(202);

    const uploadTime = Date.now() - uploadStart;
    console.log(`Upload response time: ${uploadTime}ms`);

    expect(uploadTime).toBeLessThan(5000); // Should respond within 5 seconds

    const sessionId = uploadResponse.body.sessionId;

    // Test status response time
    const statusStart = Date.now();
    await request(app)
      .get(`/api/session/${sessionId}/status`)
      .expect(200);

    const statusTime = Date.now() - statusStart;
    console.log(`Status response time: ${statusTime}ms`);

    expect(statusTime).toBeLessThan(1000); // Status should be very fast

    console.log('✅ API response times within acceptable limits');
  }, 30000);
});