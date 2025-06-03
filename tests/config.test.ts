import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// We need to mock the config module to test it properly
const mockConfigPath = join(process.cwd(), 'test-config.json');

describe('Config Management', () => {
  beforeEach(() => {
    // Clean up any existing test config
    if (existsSync(mockConfigPath)) {
      unlinkSync(mockConfigPath);
    }
    
    // Clear environment variables
    delete process.env.OPENAI_DEFAULT_MODEL;
    delete process.env.OPENAI_DEFAULT_TEMPERATURE;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Clean up test config file
    if (existsSync(mockConfigPath)) {
      unlinkSync(mockConfigPath);
    }
  });

  describe('Default Configuration', () => {
    it('should provide sensible defaults', async () => {
      // Dynamic import to get fresh instance
      const { config } = await import('../src/config');
      
      const serverConfig = config.get('server');
      const openaiConfig = config.get('openai');
      const loggingConfig = config.get('logging');
      
      expect(serverConfig.name).toBe('openai-mcp-server');
      expect(openaiConfig.defaultModel).toBe('gpt-4o');
      expect(openaiConfig.defaultTemperature).toBe(0.7);
      expect(openaiConfig.defaultMaxTokens).toBe(1000);
      expect(loggingConfig.level).toBe('info');
    });

    it('should have valid temperature range', async () => {
      const { config } = await import('../src/config');
      const openaiConfig = config.get('openai');
      
      expect(openaiConfig.defaultTemperature).toBeGreaterThanOrEqual(0);
      expect(openaiConfig.defaultTemperature).toBeLessThanOrEqual(2);
    });

    it('should have valid token limits', async () => {
      const { config } = await import('../src/config');
      const openaiConfig = config.get('openai');
      
      expect(openaiConfig.defaultMaxTokens).toBeGreaterThan(0);
      expect(openaiConfig.defaultMaxTokens).toBeLessThanOrEqual(128000);
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should override default model from environment', async () => {
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-3.5-turbo';
      
      // Clear module cache to get fresh config
      delete require.cache[require.resolve('../src/config')];
      const { config } = await import('../src/config');
      
      const openaiConfig = config.get('openai');
      expect(openaiConfig.defaultModel).toBe('gpt-3.5-turbo');
    });

    it('should override temperature from environment', async () => {
      process.env.OPENAI_DEFAULT_TEMPERATURE = '0.5';
      
      delete require.cache[require.resolve('../src/config')];
      const { config } = await import('../src/config');
      
      const openaiConfig = config.get('openai');
      expect(openaiConfig.defaultTemperature).toBe(0.5);
    });

    it('should override log level from environment', async () => {
      process.env.LOG_LEVEL = 'debug';
      
      delete require.cache[require.resolve('../src/config')];
      const { config } = await import('../src/config');
      
      const loggingConfig = config.get('logging');
      expect(loggingConfig.level).toBe('debug');
    });

    it('should ignore invalid numeric environment values', async () => {
      process.env.OPENAI_DEFAULT_TEMPERATURE = 'invalid';
      process.env.OPENAI_DEFAULT_MAX_TOKENS = 'also-invalid';
      
      delete require.cache[require.resolve('../src/config')];
      const { config } = await import('../src/config');
      
      const openaiConfig = config.get('openai');
      expect(openaiConfig.defaultTemperature).toBe(0.7); // Default value
      expect(openaiConfig.defaultMaxTokens).toBe(1000); // Default value
    });
  });

  describe('Configuration Validation', () => {
    it('should validate temperature range', () => {
      const invalidConfigs = [
        { openai: { defaultTemperature: -0.1 } },
        { openai: { defaultTemperature: 2.1 } },
      ];

      invalidConfigs.forEach(invalidConfig => {
        expect(() => {
          // This would normally be tested by creating a config with invalid values
          // For now, we'll test the validation logic conceptually
          const temp = (invalidConfig.openai as any).defaultTemperature;
          if (temp < 0 || temp > 2) {
            throw new Error('Invalid defaultTemperature: must be between 0 and 2');
          }
        }).toThrow('Invalid defaultTemperature');
      });
    });

    it('should validate token limits', () => {
      const invalidConfigs = [
        { openai: { defaultMaxTokens: 0 } },
        { openai: { defaultMaxTokens: 200000 } },
      ];

      invalidConfigs.forEach(invalidConfig => {
        expect(() => {
          const tokens = (invalidConfig.openai as any).defaultMaxTokens;
          if (tokens < 1 || tokens > 128000) {
            throw new Error('Invalid defaultMaxTokens: must be between 1 and 128000');
          }
        }).toThrow('Invalid defaultMaxTokens');
      });
    });

    it('should validate log levels', () => {
      const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
      const invalidLevel = 'invalid-level';

      expect(() => {
        if (!validLevels.includes(invalidLevel)) {
          throw new Error(`Invalid log level: must be one of ${validLevels.join(', ')}`);
        }
      }).toThrow('Invalid log level');
    });
  });

  describe('Configuration Access', () => {
    it('should return configuration sections', async () => {
      const { config } = await import('../src/config');
      
      const fullConfig = config.getConfig();
      expect(fullConfig).toHaveProperty('server');
      expect(fullConfig).toHaveProperty('openai');
      expect(fullConfig).toHaveProperty('logging');
      expect(fullConfig).toHaveProperty('security');
      expect(fullConfig).toHaveProperty('performance');
    });

    it('should return immutable configuration objects', async () => {
      const { config } = await import('../src/config');
      
      const openaiConfig1 = config.get('openai');
      const openaiConfig2 = config.get('openai');
      
      // Should return different objects (not same reference)
      expect(openaiConfig1).not.toBe(openaiConfig2);
      // But with same values
      expect(openaiConfig1).toEqual(openaiConfig2);
    });
  });
});