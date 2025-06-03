import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyContainer } from '../../src/container/dependency-container.js';
import { MockOpenAIClient } from '../mocks/openai-mock.js';
import { MockLogger } from '../mocks/logger-mock.js';
import { MockConfigManager } from '../mocks/config-mock.js';
import { MockEnvironmentProvider } from '../mocks/environment-mock.js';
import { ToolExecutionContext } from '../../src/interfaces.js';

describe('Dependency Injection Integration', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  describe('End-to-End Tool Execution', () => {
    it('should execute chat completion tool with injected dependencies', async () => {
      // モック依存関係を設定
      const mockOpenAI = new MockOpenAIClient();
      const mockLogger = new MockLogger();
      const mockConfig = new MockConfigManager();
      const mockEnv = new MockEnvironmentProvider();

      container.setOpenAIClient(mockOpenAI);
      container.setLogger(mockLogger);
      container.setConfigManager(mockConfig);
      container.setEnvironmentProvider(mockEnv);

      // ツールハンドラーを取得
      const chatTool = container.getToolHandler('chat_completion');
      expect(chatTool).toBeDefined();

      // 実行コンテキストを構築
      const context: ToolExecutionContext = {
        openaiClient: container.getOpenAIClient(),
        logger: container.getLogger(),
        config: container.getConfigManager(),
        environmentProvider: container.getEnvironmentProvider(),
      };

      // ツールを実行
      const args = {
        messages: [{ role: 'user', content: 'Hello, world!' }],
      };

      const result = await chatTool!.execute(args, context);

      // 結果を検証
      expect(result).toBeDefined();
      expect(result.content).toBe('This is a mock response');
      expect(result.model).toBe('gpt-4o');

      // ログが記録されていることを確認
      expect(mockLogger.hasLogWithMessage('Tool request received')).toBe(true);
      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
      expect(mockLogger.hasLogWithMessage('OpenAI API response')).toBe(true);
    });

    it('should execute list models tool with injected dependencies', async () => {
      // モック依存関係を設定
      const mockOpenAI = new MockOpenAIClient();
      const mockLogger = new MockLogger();
      const mockConfig = new MockConfigManager();
      const mockEnv = new MockEnvironmentProvider();

      container.setOpenAIClient(mockOpenAI);
      container.setLogger(mockLogger);
      container.setConfigManager(mockConfig);
      container.setEnvironmentProvider(mockEnv);

      // ツールハンドラーを取得
      const modelsTool = container.getToolHandler('list_models');
      expect(modelsTool).toBeDefined();

      // 実行コンテキストを構築
      const context: ToolExecutionContext = {
        openaiClient: container.getOpenAIClient(),
        logger: container.getLogger(),
        config: container.getConfigManager(),
        environmentProvider: container.getEnvironmentProvider(),
      };

      // ツールを実行
      const result = await modelsTool!.execute({}, context);

      // 結果を検証
      expect(result).toBeDefined();
      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
      expect(result.count).toBe(result.models.length);

      // ログが記録されていることを確認
      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
      expect(mockLogger.hasLogWithMessage('Models list retrieved')).toBe(true);
    });
  });

  describe('Error Propagation', () => {
    it('should properly propagate errors through dependency chain', async () => {
      // エラーを発生させるモッククライアントを設定
      const mockOpenAI = new MockOpenAIClient();
      const apiError = new Error('Test API Error');
      (apiError as any).status = 500;
      mockOpenAI.setError(apiError);

      const mockLogger = new MockLogger();
      const mockConfig = new MockConfigManager();
      const mockEnv = new MockEnvironmentProvider();

      container.setOpenAIClient(mockOpenAI);
      container.setLogger(mockLogger);
      container.setConfigManager(mockConfig);
      container.setEnvironmentProvider(mockEnv);

      // ツールハンドラーを取得
      const chatTool = container.getToolHandler('chat_completion');
      expect(chatTool).toBeDefined();

      // 実行コンテキストを構築
      const context: ToolExecutionContext = {
        openaiClient: container.getOpenAIClient(),
        logger: container.getLogger(),
        config: container.getConfigManager(),
        environmentProvider: container.getEnvironmentProvider(),
      };

      // エラーが発生することを確認
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(chatTool!.execute(args, context)).rejects.toThrow('Test API Error');
    });
  });

  describe('Configuration Override', () => {
    it('should use custom configuration through DI', async () => {
      // カスタム設定を持つモック設定管理を作成
      const customConfig = {
        openai: {
          defaultModel: 'gpt-3.5-turbo',
          defaultTemperature: 0.3,
          defaultMaxTokens: 500,
        },
      };
      const mockConfig = new MockConfigManager(customConfig);

      const mockOpenAI = new MockOpenAIClient();
      const mockLogger = new MockLogger();
      const mockEnv = new MockEnvironmentProvider();

      container.setOpenAIClient(mockOpenAI);
      container.setLogger(mockLogger);
      container.setConfigManager(mockConfig);
      container.setEnvironmentProvider(mockEnv);

      // 設定が正しく注入されていることを確認
      const config = container.getConfigManager();
      const openaiConfig = config.get('openai') as any;
      
      expect(openaiConfig.defaultModel).toBe('gpt-3.5-turbo');
      expect(openaiConfig.defaultTemperature).toBe(0.3);
      expect(openaiConfig.defaultMaxTokens).toBe(500);
    });
  });

  describe('Dependency Isolation', () => {
    it('should isolate dependencies between different containers', () => {
      const container1 = new DependencyContainer();
      const container2 = new DependencyContainer();

      const mockLogger1 = new MockLogger();
      const mockLogger2 = new MockLogger();

      container1.setLogger(mockLogger1);
      container2.setLogger(mockLogger2);

      const logger1 = container1.getLogger();
      const logger2 = container2.getLogger();

      expect(logger1).toBe(mockLogger1);
      expect(logger2).toBe(mockLogger2);
      expect(logger1).not.toBe(logger2);

      // クリーンアップ
      container1.reset();
      container2.reset();
    });
  });

  describe('Lazy Initialization', () => {
    it('should initialize dependencies only when requested', () => {
      // まだ何も取得していない状態
      const container = new DependencyContainer();

      // 内部状態は非公開なので、動作を確認するために複数回取得して同じインスタンスかチェック
      const logger1 = container.getLogger();
      const logger2 = container.getLogger();
      
      expect(logger1).toBe(logger2); // 同じインスタンス（シングルトン）

      const config1 = container.getConfigManager();
      const config2 = container.getConfigManager();
      
      expect(config1).toBe(config2); // 同じインスタンス（シングルトン）

      // クリーンアップ
      container.reset();
    });
  });

  describe('Custom Tool Registration', () => {
    it('should support custom tool registration and execution', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({
          result: 'custom tool result',
        }),
      };

      container.registerToolHandler('custom_tool', mockTool);

      const tool = container.getToolHandler('custom_tool');
      expect(tool).toBe(mockTool);

      // モック実行コンテキストを作成
      const context: ToolExecutionContext = {
        openaiClient: container.getOpenAIClient(),
        logger: container.getLogger(),
        config: container.getConfigManager(),
        environmentProvider: container.getEnvironmentProvider(),
      };

      const result = await tool!.execute({ test: 'args' }, context);
      
      expect(mockTool.execute).toHaveBeenCalledWith({ test: 'args' }, context);
      expect(result.result).toBe('custom tool result');
    });
  });
});