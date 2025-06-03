import { logger, LogContext } from '../src/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear any previous logs
    jest.clearAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = logger.generateRequestId();
      const id2 = logger.generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate UUIDs in correct format', () => {
      const id = logger.generateRequestId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(id).toMatch(uuidRegex);
    });
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      const message = 'Debug message';
      const context: LogContext = { requestId: 'test-123' };
      
      expect(() => {
        logger.debug(message, context);
      }).not.toThrow();
    });

    it('should log info messages', () => {
      const message = 'Info message';
      const context: LogContext = { requestId: 'test-123' };
      
      expect(() => {
        logger.info(message, context);
      }).not.toThrow();
    });

    it('should log warn messages', () => {
      const message = 'Warning message';
      const context: LogContext = { requestId: 'test-123' };
      
      expect(() => {
        logger.warn(message, context);
      }).not.toThrow();
    });

    it('should log error messages', () => {
      const message = 'Error message';
      const context: LogContext = { 
        requestId: 'test-123',
        error: {
          code: 'TEST_ERROR',
          message: 'Test error',
        }
      };
      
      expect(() => {
        logger.error(message, context);
      }).not.toThrow();
    });
  });

  describe('specialized logging methods', () => {
    it('should log tool requests', () => {
      const toolName = 'chat_completion';
      const requestId = 'test-req-123';
      const args = { model: 'gpt-4o', messages: [] };
      
      expect(() => {
        logger.toolRequest(toolName, requestId, args);
      }).not.toThrow();
    });

    it('should log tool responses', () => {
      const toolName = 'chat_completion';
      const requestId = 'test-req-123';
      const success = true;
      const duration = 1500;
      const context: LogContext = { model: 'gpt-4o' };
      
      expect(() => {
        logger.toolResponse(toolName, requestId, success, duration, context);
      }).not.toThrow();
    });

    it('should log OpenAI requests', () => {
      const requestId = 'test-req-123';
      const model = 'gpt-4o';
      const tokenCount = 100;
      
      expect(() => {
        logger.openaiRequest(requestId, model, tokenCount);
      }).not.toThrow();
    });

    it('should log OpenAI responses', () => {
      const requestId = 'test-req-123';
      const model = 'gpt-4o';
      const usage = { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 };
      const duration = 2000;
      
      expect(() => {
        logger.openaiResponse(requestId, model, usage, duration);
      }).not.toThrow();
    });

    it('should log OpenAI errors', () => {
      const requestId = 'test-req-123';
      const model = 'gpt-4o';
      const error = new Error('API Error');
      const statusCode = 429;
      const duration = 1000;
      
      expect(() => {
        logger.openaiError(requestId, model, error, statusCode, duration);
      }).not.toThrow();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = logger;
      const instance2 = logger;
      
      expect(instance1).toBe(instance2);
    });
  });
});