/**
 * Test setup file
 * Sets environment variables and mocks for testing
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock console to reduce noise during tests (optional)
// Uncomment if you want quieter tests:
// global.console = {
//     ...console,
//     log: jest.fn(),
//     debug: jest.fn(),
//     info: jest.fn(),
// };

// Increase timeout for slow tests
jest.setTimeout(10000);
