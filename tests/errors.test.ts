import { describe, it, expect } from '@jest/globals';
import {
  ErrorCode,
  MCPError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  OpenAIServerError,
  isOpenAIError,
  mapOpenAIErrorToMCPError,
} from '../src/errors';

describe('Error Classes', () => {
  describe('MCPError', () => {
    it('should create error with code and message', () => {
      const error = new MCPError(ErrorCode.TOOL_ERROR, 'Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MCPError);
      expect(error.code).toBe(ErrorCode.TOOL_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('MCPError');
    });

    it('should include details and status code', () => {
      const details = { field: 'test', value: 123 };
      const error = new MCPError(ErrorCode.INVALID_REQUEST_ERROR, 'Bad request', details, 400);
      
      expect(error.details).toEqual(details);
      expect(error.statusCode).toBe(400);
    });

    it('should convert to JSON', () => {
      const error = new MCPError(ErrorCode.UNKNOWN_ERROR, 'Unknown', { test: true }, 500);
      const json = error.toJSON();
      
      expect(json).toHaveProperty('code', ErrorCode.UNKNOWN_ERROR);
      expect(json).toHaveProperty('message', 'Unknown');
      expect(json).toHaveProperty('details', { test: true });
      expect(json).toHaveProperty('statusCode', 500);
      expect(json).toHaveProperty('stack');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error without field', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(MCPError);
      expect(error.constructor.name).toBe('ValidationError');
      expect(error.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
    });

    it('should create validation error with field and value', () => {
      const error = new ValidationError('Invalid temperature', 'temperature', 5);
      
      expect(error.details).toEqual({ field: 'temperature', value: 5 });
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(MCPError);
      expect(error.constructor.name).toBe('AuthenticationError');
      expect(error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      expect(error.message).toBe('Invalid authentication credentials');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('API key expired');
      
      expect(error.message).toBe('API key expired');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with default message', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(MCPError);
      expect(error.constructor.name).toBe('RateLimitError');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
    });

    it('should include retry after information', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error.message).toBe('Too many requests');
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('OpenAIServerError', () => {
    it('should create OpenAI server error', () => {
      const error = new OpenAIServerError('Service unavailable', 503);
      
      expect(error).toBeInstanceOf(MCPError);
      expect(error.constructor.name).toBe('OpenAIServerError');
      expect(error.code).toBe(ErrorCode.OPENAI_SERVER_ERROR);
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.name).toBe('OpenAIServerError');
    });
  });
});

describe('Error Utilities', () => {
  describe('isOpenAIError', () => {
    it('should identify OpenAI API errors', () => {
      const mockOpenAIError = new Error('API Error');
      (mockOpenAIError as any).status = 400;
      
      expect(isOpenAIError(mockOpenAIError)).toBe(true);
    });

    it('should reject non-OpenAI errors', () => {
      expect(isOpenAIError(new Error('Regular error'))).toBe(false);
      expect(isOpenAIError('not an error')).toBe(false);
      expect(isOpenAIError(null)).toBe(false);
      expect(isOpenAIError(undefined)).toBe(false);
    });

    it('should reject errors without status property', () => {
      const error = new Error('No status');
      expect(isOpenAIError(error)).toBe(false);
    });

    it('should reject errors with non-numeric status', () => {
      const error = new Error('Invalid status');
      (error as any).status = 'not a number';
      expect(isOpenAIError(error)).toBe(false);
    });
  });

  describe('mapOpenAIErrorToMCPError', () => {
    function createMockOpenAIError(status: number, message: string): any {
      const error = new Error(message);
      (error as any).status = status;
      return error;
    }

    it('should map 401 to AuthenticationError', () => {
      const openAIError = createMockOpenAIError(401, 'Unauthorized');
      const mcpError = mapOpenAIErrorToMCPError(openAIError);
      
      expect(mcpError).toBeInstanceOf(MCPError);
      expect(mcpError.name).toBe('AuthenticationError');
      expect(mcpError.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
      expect(mcpError.statusCode).toBe(401);
    });

    it('should map 429 to RateLimitError', () => {
      const openAIError = createMockOpenAIError(429, 'Rate limited');
      const mcpError = mapOpenAIErrorToMCPError(openAIError);
      
      expect(mcpError).toBeInstanceOf(MCPError);
      expect(mcpError.name).toBe('RateLimitError');
      expect(mcpError.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
      expect(mcpError.statusCode).toBe(429);
    });

    it('should map 400 to ValidationError', () => {
      const openAIError = createMockOpenAIError(400, 'Invalid request');
      const mcpError = mapOpenAIErrorToMCPError(openAIError);
      
      expect(mcpError).toBeInstanceOf(MCPError);
      expect(mcpError.name).toBe('ValidationError');
      expect(mcpError.code).toBe(ErrorCode.INVALID_ARGUMENTS);
      expect(mcpError.message).toContain('Invalid request');
    });

    it('should map 500/502/503 to OpenAIServerError', () => {
      const statuses = [500, 502, 503];
      
      statuses.forEach(status => {
        const openAIError = createMockOpenAIError(status, 'Server error');
        const mcpError = mapOpenAIErrorToMCPError(openAIError);
        
        expect(mcpError).toBeInstanceOf(MCPError);
        expect(mcpError.name).toBe('OpenAIServerError');
        expect(mcpError.code).toBe(ErrorCode.OPENAI_SERVER_ERROR);
        expect(mcpError.statusCode).toBe(status);
      });
    });

    it('should map unknown status to generic MCPError', () => {
      const openAIError = createMockOpenAIError(418, "I'm a teapot");
      const mcpError = mapOpenAIErrorToMCPError(openAIError);
      
      expect(mcpError).toBeInstanceOf(MCPError);
      expect(mcpError.code).toBe(ErrorCode.OPENAI_API_ERROR);
      expect(mcpError.statusCode).toBe(418);
      expect(mcpError.message).toContain('418');
      expect(mcpError.message).toContain("I'm a teapot");
    });
  });
});

describe('ErrorCode Enum', () => {
  it('should have all expected error codes', () => {
    const expectedCodes = [
      'AUTHENTICATION_ERROR',
      'INVALID_API_KEY',
      'INVALID_REQUEST_ERROR',
      'INVALID_ARGUMENTS',
      'RATE_LIMIT_ERROR',
      'OPENAI_SERVER_ERROR',
      'TOOL_ERROR',
      'UNKNOWN_TOOL',
      'STARTUP_ERROR',
      'ENVIRONMENT_ERROR',
      'UNKNOWN_ERROR',
      'OPENAI_API_ERROR',
    ];

    expectedCodes.forEach(code => {
      expect(ErrorCode).toHaveProperty(code);
    });
  });
});