import 'jest';

// Global test configuration
jest.setTimeout(10000);

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
