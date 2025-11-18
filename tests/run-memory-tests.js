#!/usr/bin/env node

/**
 * Memory-focused test runner for streaming PDF processor
 * Runs with --expose-gc for proper garbage collection testing
 * Validates Phase 1 Ship Requirements with real memory constraints
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const MEMORY_LIMIT_MB = 1024; // 1GB heap limit
const TEST_TIMEOUT_MS = 600000; // 10 minutes

class MemoryTestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      memoryViolations: 0,
      tests: []
    };
  }

  async runMemoryTests() {
    console.log('🧪 Starting Memory-focused Tests for Streaming PDF Processor');
    console.log(`📊 Memory limit: ${MEMORY_LIMIT_MB}MB`);
    console.log(`⏱️  Timeout: ${TEST_TIMEOUT_MS / 1000}s`);
    console.log('=' * 60);

    const testSuites = [
      {
        name: 'Memory Usage Validation',
        pattern: 'streaming-memory.test.js',
        critical: true
      },
      {
        name: 'Checkpoint Recovery',
        pattern: 'checkpoint-recovery.test.js',
        critical: true
      },
      {
        name: 'Error Handling',
        pattern: 'error-handling.test.js',
        critical: false
      },
      {
        name: 'Cleanup Tests',
        pattern: 'cleanup-tests.test.js',
        critical: false
      }
    ];

    for (const suite of testSuites) {
      console.log(`\n🔬 Running ${suite.name}...`);
      const result = await this.runTestSuite(suite);
      this.results.tests.push(result);

      if (result.success) {
        this.results.passed++;
        console.log(`✅ ${suite.name}: PASSED`);
      } else {
        this.results.failed++;
        console.log(`❌ ${suite.name}: FAILED`);

        if (suite.critical) {
          console.log(`💥 Critical test failed: ${suite.name}`);
          console.log('🛑 Stopping execution due to critical failure');
          break;
        }
      }

      // Memory check
      if (result.maxMemoryMB > MEMORY_LIMIT_MB) {
        this.results.memoryViolations++;
        console.log(`⚠️  Memory limit exceeded: ${result.maxMemoryMB}MB > ${MEMORY_LIMIT_MB}MB`);
      }
    }

    this.printSummary();
    return this.results;
  }

  async runTestSuite(suite) {
    const testFile = path.join('tests', suite.pattern);

    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      let maxMemory = 0;
      let success = false;

      // Run Jest with memory monitoring
      const jestProcess = spawn('node', [
        '--expose-gc',
        '--max-old-space-size=' + MEMORY_LIMIT_MB,
        'node_modules/.bin/jest',
        testFile,
        '--verbose',
        '--no-cache',
        '--maxWorkers=1'
      ], {
        env: { ...process.env, NODE_OPTIONS: '--expose-gc' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Monitor memory usage
      const memoryMonitor = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const heapMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        if (heapMB > maxMemory) {
          maxMemory = heapMB;
        }
      }, 1000);

      jestProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      jestProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      jestProcess.on('close', (code) => {
        clearInterval(memoryMonitor);

        const duration = Date.now() - startTime;
        success = code === 0;

        // Parse Jest output for test details
        const testResults = this.parseJestOutput(output);

        resolve({
          suite: suite.name,
          pattern: suite.pattern,
          success,
          code,
          duration,
          maxMemoryMB: maxMemory,
          output,
          testResults
        });
      });

      // Timeout handling
      setTimeout(() => {
        jestProcess.kill('SIGKILL');
        clearInterval(memoryMonitor);

        resolve({
          suite: suite.name,
          pattern: suite.pattern,
          success: false,
          code: -1,
          duration: TEST_TIMEOUT_MS,
          maxMemoryMB: maxMemory,
          output: output + '\n\n[TIMEOUT AFTER ' + (TEST_TIMEOUT_MS / 1000) + 's]',
          testResults: { passed: 0, failed: 0, timeout: true }
        });
      }, TEST_TIMEOUT_MS);
    });
  }

  parseJestOutput(output) {
    const results = { passed: 0, failed: 0, skipped: 0, tests: [] };

    // Parse Jest test results
    const testLines = output.split('\n').filter(line =>
      line.includes('✓') || line.includes('✗') || line.includes('○')
    );

    testLines.forEach(line => {
      if (line.includes('✓')) {
        results.passed++;
        const testName = line.replace(/.*✓/, '').trim();
        results.tests.push({ name: testName, status: 'passed' });
      } else if (line.includes('✗')) {
        results.failed++;
        const testName = line.replace(/.*✗/, '').trim();
        results.tests.push({ name: testName, status: 'failed' });
      } else if (line.includes('○')) {
        results.skipped++;
        const testName = line.replace(/.*○/, '').trim();
        results.tests.push({ name: testName, status: 'skipped' });
      }
    });

    return results;
  }

  printSummary() {
    console.log('\n' + '=' * 60);
    console.log('📋 MEMORY TEST EXECUTION SUMMARY');
    console.log('=' * 60);

    console.log(`\n📊 Overall Results:`);
    console.log(`  ✅ Passed: ${this.results.passed}`);
    console.log(`  ❌ Failed: ${this.results.failed}`);
    console.log(`  ⚠️  Memory Violations: ${this.results.memoryViolations}`);

    console.log(`\n🧠 Memory Analysis:`);
    let totalMaxMemory = 0;
    let memoryTests = 0;

    for (const test of this.results.tests) {
      if (test.maxMemoryMB > 0) {
        totalMaxMemory += test.maxMemoryMB;
        memoryTests++;
      }

      console.log(`  ${test.suite}: ${test.maxMemoryMB}MB peak (${test.success ? 'PASS' : 'FAIL'})`);
    }

    if (memoryTests > 0) {
      const avgMemory = Math.round(totalMaxMemory / memoryTests);
      console.log(`  Average Peak Memory: ${avgMemory}MB`);
    }

    console.log(`\n⏱️  Performance Summary:`);
    for (const test of this.results.tests) {
      const durationSec = Math.round(test.duration / 1000);
      console.log(`  ${test.suite}: ${durationSec}s`);
    }

    // Determine if Phase 1 ship requirements are met
    const shipReady = this.evaluateShipReadiness();
    console.log(`\n🚀 Phase 1 Ship Status: ${shipReady.ready ? 'READY' : 'NOT READY'}`);

    if (!shipReady.ready) {
      console.log('❌ Blocking Issues:');
      shipReady.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    console.log('\n' + '=' * 60);
  }

  evaluateShipReadiness() {
    const issues = [];
    let ready = true;

    // Check critical failures
    if (this.results.failed > 0) {
      issues.push(`${this.results.failed} test suite(s) failed`);
      ready = false;
    }

    // Check memory violations
    if (this.results.memoryViolations > 0) {
      issues.push(`${this.results.memoryViolations} memory limit violation(s)`);
      ready = false;
    }

    // Check if any critical tests failed
    const criticalTests = this.results.tests.filter(t =>
      t.suite.includes('Memory') || t.suite.includes('Checkpoint')
    );

    const failedCritical = criticalTests.filter(t => !t.success);
    if (failedCritical.length > 0) {
      issues.push(`Critical tests failed: ${failedCritical.map(t => t.suite).join(', ')}`);
      ready = false;
    }

    return { ready, issues };
  }
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      console.log('🔧 Preparing test environment...');

      // Ensure test files exist
      const TestFileGenerator = (await import('./create-test-files.js')).TestFileGenerator;
      await TestFileGenerator.createAllTestFiles();

      const runner = new MemoryTestRunner();
      const results = await runner.runMemoryTests();

      // Exit with appropriate code
      const exitCode = results.failed > 0 || results.memoryViolations > 0 ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error('💥 Test runner failed:', error.message);
      process.exit(1);
    }
  })();
}