import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnvironmentValidator } from '../src/env-validator';
import { ErrorCode, MCPError } from '../src/errors';

describe('EnvironmentValidator', () => {
  // Save original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('should pass validation with valid environment', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      
      const config = EnvironmentValidator.validate();
      
      expect(config.OPENAI_API_KEY).toBe('sk-test123456789012345678901234567890');
      // NODE_ENV might be set by test environment
      expect(config.NODE_ENV).toBeDefined();
      // LOG_LEVEL might be set by test environment (e.g. 'silent')
      // Just ensure it's a valid value if defined
      if (config.LOG_LEVEL) {
        expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).toContain(config.LOG_LEVEL);
      }
    });

    it('should fail validation without API key', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => EnvironmentValidator.validate()).toThrow(MCPError);
      
      try {
        EnvironmentValidator.validate();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect((error as MCPError).code).toBe(ErrorCode.ENVIRONMENT_ERROR);
        expect((error as MCPError).message).toContain('OPENAI_API_KEY is required');
      }
    });

    it('should validate NODE_ENV values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.NODE_ENV = 'production';
      
      const config = EnvironmentValidator.validate();
      expect(config.NODE_ENV).toBe('production');
    });

    it('should warn for invalid NODE_ENV but not fail', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.NODE_ENV = 'invalid-env';
      
      // Should not throw
      const config = EnvironmentValidator.validate();
      expect(config.NODE_ENV).toBe('invalid-env');
    });

    it('should validate LOG_LEVEL values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.LOG_LEVEL = 'debug';
      
      const config = EnvironmentValidator.validate();
      expect(config.LOG_LEVEL).toBe('debug');
    });

    it('should fail for invalid LOG_LEVEL', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.LOG_LEVEL = 'invalid-level';
      
      expect(() => EnvironmentValidator.validate()).toThrow(MCPError);
      
      try {
        EnvironmentValidator.validate();
      } catch (error) {
        expect((error as MCPError).message).toContain('Invalid LOG_LEVEL');
      }
    });

    it('should validate temperature values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.OPENAI_DEFAULT_TEMPERATURE = '1.5';
      
      const config = EnvironmentValidator.validate();
      expect(config.OPENAI_DEFAULT_TEMPERATURE).toBe('1.5');
    });

    it('should fail for invalid temperature values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      
      // Test invalid values
      const invalidTemps = ['2.5', '-0.5', 'not-a-number'];
      
      invalidTemps.forEach(temp => {
        process.env.OPENAI_DEFAULT_TEMPERATURE = temp;
        
        expect(() => EnvironmentValidator.validate()).toThrow(MCPError);
        
        try {
          EnvironmentValidator.validate();
        } catch (error) {
          expect((error as MCPError).message).toContain('OPENAI_DEFAULT_TEMPERATURE must be a number between 0 and 2');
        }
        
        delete process.env.OPENAI_DEFAULT_TEMPERATURE;
      });
    });

    it('should validate max tokens values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.OPENAI_DEFAULT_MAX_TOKENS = '1000';
      
      const config = EnvironmentValidator.validate();
      expect(config.OPENAI_DEFAULT_MAX_TOKENS).toBe('1000');
    });

    it('should fail for invalid max tokens values', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      
      // Test invalid values
      const invalidTokens = ['0', '150000', 'not-a-number'];
      
      invalidTokens.forEach(tokens => {
        process.env.OPENAI_DEFAULT_MAX_TOKENS = tokens;
        
        expect(() => EnvironmentValidator.validate()).toThrow(MCPError);
        
        try {
          EnvironmentValidator.validate();
        } catch (error) {
          expect((error as MCPError).message).toContain('OPENAI_DEFAULT_MAX_TOKENS must be a number between 1 and 128000');
        }
        
        delete process.env.OPENAI_DEFAULT_MAX_TOKENS;
      });
    });

    it('should handle multiple validation errors', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.LOG_LEVEL = 'invalid';
      process.env.OPENAI_DEFAULT_TEMPERATURE = '3';
      
      try {
        EnvironmentValidator.validate();
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        const mcpError = error as MCPError;
        expect(mcpError.message).toContain('OPENAI_API_KEY is required');
        expect(mcpError.message).toContain('Invalid LOG_LEVEL');
        expect(mcpError.message).toContain('OPENAI_DEFAULT_TEMPERATURE');
        expect(mcpError.details?.errors).toHaveLength(3);
      }
    });
  });

  describe('validateApiKey', () => {
    it('should validate standard API keys', () => {
      expect(EnvironmentValidator.validateApiKey('sk-abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(EnvironmentValidator.validateApiKey('sk-' + 'x'.repeat(48))).toBe(true);
    });

    it('should validate project-specific API keys', () => {
      expect(EnvironmentValidator.validateApiKey('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(EnvironmentValidator.validateApiKey('sk-proj-' + 'x'.repeat(48))).toBe(true);
    });

    it('should reject invalid API keys', () => {
      expect(EnvironmentValidator.validateApiKey('')).toBe(false);
      expect(EnvironmentValidator.validateApiKey('invalid-key')).toBe(false);
      expect(EnvironmentValidator.validateApiKey('sk-')).toBe(false);
      expect(EnvironmentValidator.validateApiKey('sk-short')).toBe(false);
      expect(EnvironmentValidator.validateApiKey('not-an-api-key')).toBe(false);
      expect(EnvironmentValidator.validateApiKey(null as any)).toBe(false);
      expect(EnvironmentValidator.validateApiKey(undefined as any)).toBe(false);
      expect(EnvironmentValidator.validateApiKey(123 as any)).toBe(false);
    });
  });

  describe('sanitizeApiKeyForLogging', () => {
    it('should sanitize standard API keys', () => {
      const key = 'sk-abcdefghijklmnopqrstuvwxyz123456';
      const sanitized = EnvironmentValidator.sanitizeApiKeyForLogging(key);
      
      expect(sanitized).toMatch(/^sk-abcd.*3456$/);
      expect(sanitized).toContain('*');
      expect(sanitized.length).toBe(key.length);
    });

    it('should sanitize project-specific API keys', () => {
      const key = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
      const sanitized = EnvironmentValidator.sanitizeApiKeyForLogging(key);
      
      expect(sanitized).toMatch(/^sk-proj.*3456$/);
      expect(sanitized).toContain('*');
    });

    it('should handle short keys', () => {
      expect(EnvironmentValidator.sanitizeApiKeyForLogging('')).toBe('***');
      expect(EnvironmentValidator.sanitizeApiKeyForLogging('short')).toBe('***');
      expect(EnvironmentValidator.sanitizeApiKeyForLogging('1234567')).toBe('***');
    });

    it('should handle edge cases', () => {
      const key = 'sk-exactly8chars';
      const sanitized = EnvironmentValidator.sanitizeApiKeyForLogging(key);
      
      expect(sanitized).toMatch(/^sk-exac.*hars$/);
      expect(sanitized).toContain('*');
    });
  });

  describe('Environment configurations', () => {
    it('should support all valid log levels', () => {
      const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      
      validLogLevels.forEach(level => {
        process.env.LOG_LEVEL = level;
        const config = EnvironmentValidator.validate();
        expect(config.LOG_LEVEL).toBe(level);
      });
    });

    it('should support all valid NODE_ENV values', () => {
      const validEnvs = ['development', 'production', 'test'];
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      
      validEnvs.forEach(env => {
        process.env.NODE_ENV = env;
        const config = EnvironmentValidator.validate();
        expect(config.NODE_ENV).toBe(env);
      });
    });

    it('should handle optional model configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test123456789012345678901234567890';
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4';
      
      const config = EnvironmentValidator.validate();
      expect(config.OPENAI_DEFAULT_MODEL).toBe('gpt-4');
    });
  });
});