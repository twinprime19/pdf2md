export default {
  // Use ES modules
  preset: null,
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],

  // Test discovery
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'streaming-processor.js',
    'checkpoint-manager.js',
    'server.js',
    'ocr-processor.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Test execution
  testTimeout: 120000, // 2 minutes for OCR operations
  maxWorkers: 1, // Run tests sequentially for memory testing

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,

  // Output
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,

  // Transform configuration
  transform: {},

  // Module resolution
  moduleFileExtensions: ['js', 'json'],

  // ES Module support
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Test environment setup
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};