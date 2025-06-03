// Jest setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Mock console methods to reduce noise during testing
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Global test timeout
jest.setTimeout(10000);