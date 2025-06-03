import { describe, it, expect, beforeEach } from '@jest/globals';
import { ListModelsTool } from '../../src/tools/list-models-tool.js';
import { MockOpenAIClient } from '../mocks/openai-mock.js';
import { MockLogger } from '../mocks/logger-mock.js';
import { MockConfigManager } from '../mocks/config-mock.js';
import { MockEnvironmentProvider } from '../mocks/environment-mock.js';
import { ToolExecutionContext } from '../../src/interfaces.js';

describe('ListModelsTool', () => {
  let tool: ListModelsTool;
  let context: ToolExecutionContext;
  let mockOpenAI: MockOpenAIClient;
  let mockLogger: MockLogger;
  let mockConfig: MockConfigManager;
  let mockEnv: MockEnvironmentProvider;

  beforeEach(() => {
    tool = new ListModelsTool();
    mockOpenAI = new MockOpenAIClient();
    mockLogger = new MockLogger();
    mockConfig = new MockConfigManager();
    mockEnv = new MockEnvironmentProvider();

    context = {
      openaiClient: mockOpenAI,
      logger: mockLogger,
      config: mockConfig,
      environmentProvider: mockEnv,
    };
  });

  describe('Valid Execution', () => {
    it('should execute successfully and return models list', async () => {
      const result = await tool.execute({}, context);

      expect(result).toBeDefined();
      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
      expect(result.count).toBe(result.models.length);
    });

    it('should filter and format models correctly', async () => {
      const result = await tool.execute({}, context);

      // すべてのモデルがGPTモデルまたはo1モデルであることを確認
      result.models.forEach((model: any) => {
        expect(
          model.id.includes('gpt') || model.id.includes('o1')
        ).toBe(true);
      });

      // モデルが正しいフォーマットであることを確認
      result.models.forEach((model: any) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('created');
        expect(model).toHaveProperty('owned_by');
        expect(typeof model.id).toBe('string');
        expect(typeof model.created).toBe('string');
        expect(typeof model.owned_by).toBe('string');
      });
    });

    it('should include expected models', async () => {
      const result = await tool.execute({}, context);

      const modelIds = result.models.map((model: any) => model.id);
      expect(modelIds).toContain('gpt-4o');
      expect(modelIds).toContain('gpt-4');
      expect(modelIds).toContain('gpt-3.5-turbo');
    });

    it('should convert timestamps correctly', async () => {
      const result = await tool.execute({}, context);

      result.models.forEach((model: any) => {
        expect(model.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(new Date(model.created).getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('API Error');
      (apiError as any).status = 500;
      mockOpenAI.setError(apiError);

      await expect(tool.execute({}, context)).rejects.toThrow('API Error');
    });
  });

  describe('Logging', () => {
    it('should log API request', async () => {
      await tool.execute({}, context);

      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
      
      const requestLogs = mockLogger.getLogsByMessage('OpenAI API request');
      expect(requestLogs.length).toBe(1);
      expect(requestLogs[0].context.model).toBe('models-list');
    });

    it('should log successful retrieval', async () => {
      await tool.execute({}, context);

      expect(mockLogger.hasLogWithMessage('Models list retrieved')).toBe(true);
      
      const retrievalLogs = mockLogger.getLogsByMessage('Models list retrieved');
      expect(retrievalLogs.length).toBe(1);
      expect(retrievalLogs[0].context.count).toBeGreaterThan(0);
      expect(retrievalLogs[0].context.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Arguments Handling', () => {
    it('should work with empty arguments', async () => {
      const result = await tool.execute({}, context);
      expect(result).toBeDefined();
    });

    it('should work with null arguments', async () => {
      const result = await tool.execute(null, context);
      expect(result).toBeDefined();
    });

    it('should work with undefined arguments', async () => {
      const result = await tool.execute(undefined, context);
      expect(result).toBeDefined();
    });

    it('should ignore unexpected arguments', async () => {
      const args = {
        unexpectedProperty: 'value',
        anotherProperty: 123,
      };
      
      const result = await tool.execute(args, context);
      expect(result).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', async () => {
      const result = await tool.execute({}, context);

      expect(result).toHaveProperty('models');
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBe(result.models.length);
    });

    it('should handle empty models list', async () => {
      // モックで空のリストを設定
      mockOpenAI.setModelsResponse({
        object: 'list',
        data: [],
      } as any);

      const result = await tool.execute({}, context);

      expect(result.models).toEqual([]);
      expect(result.count).toBe(0);
    });
  });
});