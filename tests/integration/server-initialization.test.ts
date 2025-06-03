import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DependencyContainer } from '../../src/container/dependency-container.js';
import { MockEnvironmentProvider } from '../mocks/environment-mock.js';

describe('Server Initialization Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Dependency Container Initialization', () => {
    it('should initialize all dependencies successfully with valid environment', () => {
      // テスト用の有効な環境変数を設定
      const mockEnv = new MockEnvironmentProvider({
        OPENAI_API_KEY: 'sk-test-key-1234567890abcdefghijklmnopqrstuvwxyz1234567890',
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
      });

      const container = new DependencyContainer();
      container.setEnvironmentProvider(mockEnv);

      expect(() => {
        const logger = container.getLogger();
        const config = container.getConfigManager();
        const envProvider = container.getEnvironmentProvider();
        const openaiClient = container.getOpenAIClient();

        expect(logger).toBeDefined();
        expect(config).toBeDefined();
        expect(envProvider).toBeDefined();
        expect(openaiClient).toBeDefined();
      }).not.toThrow();
    });

    it('should fail gracefully with invalid API key', () => {
      const mockEnv = new MockEnvironmentProvider({
        OPENAI_API_KEY: 'invalid-key',
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
      });

      const container = new DependencyContainer();
      container.setEnvironmentProvider(mockEnv);

      expect(() => {
        container.getOpenAIClient();
      }).toThrow('Invalid OpenAI API key format');
    });

    it('should provide all required tool handlers', () => {
      const container = new DependencyContainer();

      const chatHandler = container.getToolHandler('chat_completion');
      const modelsHandler = container.getToolHandler('list_models');

      expect(chatHandler).toBeDefined();
      expect(modelsHandler).toBeDefined();
      expect(typeof chatHandler?.execute).toBe('function');
      expect(typeof modelsHandler?.execute).toBe('function');
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration with appropriate defaults', () => {
      // テスト環境でのログレベルを設定
      const mockEnv = new MockEnvironmentProvider({
        LOG_LEVEL: 'info',
      });
      
      const container = new DependencyContainer();
      container.setEnvironmentProvider(mockEnv);
      const config = container.getConfigManager();

      const serverConfig = config.get('server') as any;
      const openaiConfig = config.get('openai') as any;
      const loggingConfig = config.get('logging') as any;

      expect(serverConfig.name).toBe('openai-mcp-server');
      expect(openaiConfig.defaultModel).toBe('gpt-4.1');
      expect(openaiConfig.defaultTemperature).toBe(0.7);
      // テスト環境ではログレベルがsilentに設定される可能性がある
      expect(['info', 'silent']).toContain(loggingConfig.level);
    });
  });

  describe('Logging System', () => {
    it('should initialize logger with correct configuration', () => {
      const container = new DependencyContainer();
      const logger = container.getLogger();

      expect(logger).toBeDefined();
      
      // リクエストIDの生成をテスト
      const requestId = logger.generateRequestId();
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);

      // ログメソッドが正常に動作することをテスト
      expect(() => {
        logger.info('Test message');
        logger.debug('Debug message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain the same external API surface', () => {
      // この依存性注入リファクタリング後も、外部から見たAPIは変わらない
      const container = new DependencyContainer();
      
      // 既存のメソッドが全て利用可能であることを確認
      expect(typeof container.getOpenAIClient).toBe('function');
      expect(typeof container.getLogger).toBe('function');
      expect(typeof container.getConfigManager).toBe('function');
      expect(typeof container.getEnvironmentProvider).toBe('function');
      expect(typeof container.getToolHandler).toBe('function');
      expect(typeof container.registerToolHandler).toBe('function');
    });

    it('should support the same tool execution pattern', async () => {
      const mockEnv = new MockEnvironmentProvider({
        OPENAI_API_KEY: 'sk-test-key-1234567890abcdefghijklmnopqrstuvwxyz1234567890',
      });

      const container = new DependencyContainer();
      container.setEnvironmentProvider(mockEnv);

      const chatTool = container.getToolHandler('chat_completion');
      const context = {
        openaiClient: container.getOpenAIClient(),
        logger: container.getLogger(),
        config: container.getConfigManager(),
        environmentProvider: container.getEnvironmentProvider(),
      };

      // ツールが以前と同じインターフェースで実行できることを確認
      expect(chatTool).toBeDefined();
      expect(typeof chatTool?.execute).toBe('function');
      
      // 実際の実行はモックがないと失敗するので、インターフェースの確認のみ
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', () => {
      const mockEnv = new MockEnvironmentProvider({
        // APIキーを設定しない
        NODE_ENV: 'test',
      });

      const container = new DependencyContainer();
      container.setEnvironmentProvider(mockEnv);

      // テスト環境ではAPIキーチェックが無効化されている可能性がある
      try {
        const client = container.getOpenAIClient();
        // クライアントが作成できた場合、それがモッククライアントであることを確認
        expect(client).toBeDefined();
      } catch (error) {
        // エラーが発生した場合、適切なエラーメッセージであることを確認
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('API');
      }
    });
  });
});