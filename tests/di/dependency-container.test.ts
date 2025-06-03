import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DependencyContainer } from '../../src/container/dependency-container.js';
import { MockOpenAIClient } from '../mocks/openai-mock.js';
import { MockLogger } from '../mocks/logger-mock.js';
import { MockConfigManager } from '../mocks/config-mock.js';
import { MockEnvironmentProvider } from '../mocks/environment-mock.js';

describe('DependencyContainer', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  afterEach(() => {
    container.reset();
  });

  describe('Dependency Injection', () => {
    it('should provide singleton instances', () => {
      const logger1 = container.getLogger();
      const logger2 = container.getLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should provide different instances after reset', () => {
      const logger1 = container.getLogger();
      container.reset();
      const logger2 = container.getLogger();
      
      expect(logger1).not.toBe(logger2);
    });

    it('should allow manual dependency injection', () => {
      const mockLogger = new MockLogger();
      container.setLogger(mockLogger);
      
      const logger = container.getLogger();
      expect(logger).toBe(mockLogger);
    });
  });

  describe('OpenAI Client', () => {
    it('should create OpenAI client with valid environment', () => {
      const mockEnv = new MockEnvironmentProvider({
        OPENAI_API_KEY: 'sk-test-key-1234567890abcdefghijklmnopqrstuvwxyz',
      });
      container.setEnvironmentProvider(mockEnv);
      
      expect(() => {
        container.getOpenAIClient();
      }).not.toThrow();
    });

    it('should throw error with invalid API key', () => {
      const mockEnv = new MockEnvironmentProvider({
        OPENAI_API_KEY: 'invalid-key',
      });
      container.setEnvironmentProvider(mockEnv);
      
      expect(() => {
        container.getOpenAIClient();
      }).toThrow('Invalid OpenAI API key format');
    });

    it('should allow mock OpenAI client injection', () => {
      const mockClient = new MockOpenAIClient();
      container.setOpenAIClient(mockClient);
      
      const client = container.getOpenAIClient();
      expect(client).toBe(mockClient);
    });
  });

  describe('Logger', () => {
    it('should provide logger instance', () => {
      const logger = container.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.generateRequestId).toBe('function');
      expect(typeof logger.info).toBe('function');
    });

    it('should allow mock logger injection', () => {
      const mockLogger = new MockLogger();
      container.setLogger(mockLogger);
      
      const logger = container.getLogger();
      expect(logger).toBe(mockLogger);
    });
  });

  describe('Config Manager', () => {
    it('should provide config manager instance', () => {
      const config = container.getConfigManager();
      expect(config).toBeDefined();
      expect(typeof config.get).toBe('function');
      expect(typeof config.getConfig).toBe('function');
    });

    it('should allow mock config manager injection', () => {
      const mockConfig = new MockConfigManager();
      container.setConfigManager(mockConfig);
      
      const config = container.getConfigManager();
      expect(config).toBe(mockConfig);
    });
  });

  describe('Environment Provider', () => {
    it('should provide environment provider instance', () => {
      const envProvider = container.getEnvironmentProvider();
      expect(envProvider).toBeDefined();
      expect(typeof envProvider.get).toBe('function');
      expect(typeof envProvider.getRequired).toBe('function');
    });

    it('should allow mock environment provider injection', () => {
      const mockEnv = new MockEnvironmentProvider();
      container.setEnvironmentProvider(mockEnv);
      
      const envProvider = container.getEnvironmentProvider();
      expect(envProvider).toBe(mockEnv);
    });
  });

  describe('Tool Handlers', () => {
    it('should provide default tool handlers', () => {
      const chatHandler = container.getToolHandler('chat_completion');
      const modelsHandler = container.getToolHandler('list_models');
      
      expect(chatHandler).toBeDefined();
      expect(modelsHandler).toBeDefined();
    });

    it('should return undefined for unknown tools', () => {
      const unknownHandler = container.getToolHandler('unknown_tool');
      expect(unknownHandler).toBeUndefined();
    });

    it('should allow custom tool handler registration', () => {
      const mockHandler = {
        execute: jest.fn().mockResolvedValue({ result: 'custom' }),
      };
      
      container.registerToolHandler('custom_tool', mockHandler);
      const handler = container.getToolHandler('custom_tool');
      
      expect(handler).toBe(mockHandler);
    });
  });

  describe('Container Reset', () => {
    it('should reset all dependencies', () => {
      // モック依存関係を設定
      const mockLogger = new MockLogger();
      const mockConfig = new MockConfigManager();
      const mockEnv = new MockEnvironmentProvider();
      const mockClient = new MockOpenAIClient();
      
      container.setLogger(mockLogger);
      container.setConfigManager(mockConfig);
      container.setEnvironmentProvider(mockEnv);
      container.setOpenAIClient(mockClient);
      
      // カスタムツールハンドラーを登録
      container.registerToolHandler('custom', { execute: jest.fn() });
      
      // リセット実行
      container.reset();
      
      // 新しいインスタンスが作成されることを確認
      const newLogger = container.getLogger();
      const newConfig = container.getConfigManager();
      const newEnv = container.getEnvironmentProvider();
      
      expect(newLogger).not.toBe(mockLogger);
      expect(newConfig).not.toBe(mockConfig);
      expect(newEnv).not.toBe(mockEnv);
      
      // カスタムツールハンドラーがクリアされることを確認
      const customHandler = container.getToolHandler('custom');
      expect(customHandler).toBeUndefined();
      
      // デフォルトツールハンドラーは再登録されることを確認
      const chatHandler = container.getToolHandler('chat_completion');
      expect(chatHandler).toBeDefined();
    });
  });
});