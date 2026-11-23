export default {
  testEnvironment: 'node',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, diagnostics: false }] },
  globalSetup: './test/jest-global-setup.ts',
  globalTeardown: './test/jest-global-teardown.ts',
  setupFilesAfterEnv: ['./test/jest-setup.ts'],
  passWithNoTests: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/jest-'],
  testMatch: ['**/test/**/*-test.ts'],
};
