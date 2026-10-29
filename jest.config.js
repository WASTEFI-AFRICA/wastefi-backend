module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // The Stellar SDK's CommonJS build requires a few ESM-only packages. Node 22
    // loads them natively, but Jest does not, so compile just those to CommonJS.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    // Also matches copies nested under another package's node_modules.
    '/node_modules/(?!(?:.*/node_modules/)?(?:uint8array-extras|@exodus/bytes|@noble/ed25519|@noble/hashes)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Thresholds sit just below the measured coverage so that coverage cannot
  // silently regress. Measured at 22.9% statements, 12.4% branches, 14.9%
  // functions and 23.3% lines. Raise these as tests are added.
  coverageThreshold: {
    global: {
      branches: 11,
      functions: 13,
      lines: 21,
      statements: 21,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
