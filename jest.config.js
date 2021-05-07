module.exports = {
    roots: ['<rootDir>'],
    verbose: true,
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },
    coverageThreshold: {
      global: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
      }
    },
    globals: {
      'ts-jest': {
        diagnostics: false
      }
    },
    coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
    coverageDirectory: '.coverage',
    clearMocks: true,
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', "!src/**/index.ts"],
    coveragePathIgnorePatterns: ['/node_modules/'],
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/node_modules/'],
    reporters: ['default']
  };
