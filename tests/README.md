# Streaming PDF Processor Test Suite

Comprehensive test suite for Phase 1 streaming PDF processor implementation, validating all critical ship requirements.

## Quick Start

```bash
# Install test dependencies (if not already done)
npm install

# Create test PDF files
node tests/create-test-files.js

# Run Phase 1 ship validation
npm run test:phase1

# Run memory-focused tests
npm run test:memory

# Run all tests
npm test
```

## Test Files

### Core Test Suites
- `streaming-memory.test.js` - Memory usage validation (<1GB requirement)
- `checkpoint-recovery.test.js` - Interruption and resume testing
- `feature-flag-routing.test.js` - Legacy vs streaming mode routing
- `streaming-api-integration.test.js` - End-to-end API workflow testing
- `error-handling.test.js` - Error scenarios and graceful degradation
- `cleanup-tests.test.js` - Resource management and cleanup

### Test Utilities
- `setup.js` - Global test configuration and utilities
- `create-test-files.js` - Test PDF generation
- `run-memory-tests.js` - Memory-focused test runner with GC
- `phase1-validation.js` - Ship requirements validation script

### Test Fixtures
- `fixtures/small-test.pdf` - 3 pages (legacy regression testing)
- `fixtures/medium-test.pdf` - 25 pages (checkpoint testing)
- `fixtures/large-test.pdf` - 60 pages (memory stress testing)
- `fixtures/corrupt-test.pdf` - Invalid PDF (error testing)
- `fixtures/empty-test.pdf` - Zero pages (edge case testing)

## Phase 1 Ship Requirements

| Requirement | Test Coverage |
|------------|---------------|
| ✅ 100-page PDF processes without OOM | `streaming-memory.test.js` |
| ✅ Memory usage consistently <1GB | Real-time monitoring + violations |
| ✅ Checkpoint recovery after interruption | `checkpoint-recovery.test.js` |
| ✅ Frontend streaming vs immediate response | `streaming-api-integration.test.js` |
| ✅ No regression on small files | Performance comparison tests |

## Test Commands

```bash
# Ship readiness validation
npm run test:phase1           # Complete Phase 1 validation

# Memory testing
npm run test:memory           # Memory tests with --expose-gc
npm run test:streaming        # Streaming-specific tests

# API testing
npm run test:integration      # API endpoint integration tests

# Development
npm run test:watch           # Watch mode for development
npm run test:coverage        # Generate coverage report
```

## Memory Testing

Memory tests run with `--expose-gc` flag for accurate garbage collection testing:

```bash
# Manual memory test execution
node --expose-gc tests/run-memory-tests.js

# Jest with memory monitoring
NODE_OPTIONS='--experimental-vm-modules --expose-gc' npm test
```

**Memory Constraints:**
- Hard limit: 1GB heap usage
- Monitoring: Real-time memory snapshots
- Violations: Automatic test failure if exceeded
- Cleanup: Verified after each test

## Test Scenarios

### Memory Stress Testing
- Large PDF processing (60 pages)
- Memory stability during sequential processing
- Concurrent session isolation
- Garbage collection effectiveness

### Checkpoint Recovery
- Mid-process interruption simulation
- Resume from exact page location
- Multiple interruption handling
- Output file integrity preservation

### Error Handling
- Corrupt PDF graceful failure
- OCR failure page-level fallback
- Resource cleanup after errors
- Clear error message validation

### API Integration
- Complete upload→status→download workflow
- Session management and concurrent handling
- Response format consistency
- Performance validation

## Configuration

Jest configuration in `jest.config.js`:

```javascript
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 120000, // 2 minutes for OCR
  maxWorkers: 1,      // Sequential for memory accuracy
  verbose: true,
  forceExit: true
};
```

## Test Environment

**Requirements:**
- Node.js 18+ with ES modules support
- System tools: `pdftoppm`, `pdfinfo` (for PDF processing)
- Memory: Minimum 2GB RAM for test execution
- Disk: 100MB free space for test artifacts

**Environment Variables:**
```bash
# Enable streaming for tests
ENABLE_STREAMING=true
STREAMING_THRESHOLD_MB=0.001

# Memory configuration
MAX_MEMORY_MB=1024
CHECKPOINT_INTERVAL=5
```

## Troubleshooting

### Common Issues

**Jest ES Module Errors:**
```bash
# Ensure NODE_OPTIONS is set
export NODE_OPTIONS='--experimental-vm-modules'
npm test
```

**Memory Test Failures:**
```bash
# Run with garbage collection enabled
node --expose-gc tests/run-memory-tests.js
```

**Missing Test Files:**
```bash
# Regenerate test PDFs
node tests/create-test-files.js
```

**PDF Processing Errors:**
```bash
# Verify system dependencies
npm run verify
```

### Memory Debugging

Monitor memory usage during tests:

```bash
# Enable memory debugging
NODE_OPTIONS='--expose-gc --inspect' npm run test:memory

# Check memory patterns
npm run test:memory | grep "Memory"
```

### Test Isolation

Each test cleans up its artifacts:

```bash
# Manual cleanup if needed
rm -rf temp/test_*
rm -rf checkpoints/test_*
rm -rf tests/temp/*
```

## Coverage Targets

- **Lines:** 75%
- **Functions:** 75%
- **Branches:** 70%
- **Statements:** 75%

Critical components have higher coverage requirements:
- `streaming-processor.js`: >85%
- `checkpoint-manager.js`: >80%

## Continuous Integration

For CI environments:

```bash
# Install with test dependencies
npm ci

# Generate test files
node tests/create-test-files.js

# Run validation without interactive features
NODE_OPTIONS='--experimental-vm-modules --expose-gc' npm run test:phase1

# Generate coverage for reporting
npm run test:coverage
```

**CI Requirements:**
- Memory limit: 1GB+ for test environment
- Timeout: 10 minutes for full suite
- Node flags: `--experimental-vm-modules --expose-gc`