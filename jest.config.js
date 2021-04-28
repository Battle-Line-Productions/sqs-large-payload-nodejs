module.exports = {
    roots: ['<rootDir>'],
    verbose: true,
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    globals: {
      'ts-jest': {
        diagnostics: false
      }
    },
    globalSetup: './global-setup.js',
    coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
    coverageDirectory: '.coverage',
    clearMocks: true,
    collectCoverageFrom: ['**/src/**/*.ts'],
    coveragePathIgnorePatterns: ['/node_modules/'],
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/node_modules/'],
    reporters: ['default']
  };