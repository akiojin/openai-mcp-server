import { describe, it, expect, beforeEach } from '@jest/globals';
import { ChatCompletionTool } from '../../src/tools/chat-completion-tool.js';
import { MockOpenAIClient } from '../mocks/openai-mock.js';
import { MockLogger } from '../mocks/logger-mock.js';
import { MockConfigManager } from '../mocks/config-mock.js';
import { MockEnvironmentProvider } from '../mocks/environment-mock.js';
import { ToolExecutionContext } from '../../src/interfaces.js';
import { ValidationError } from '../../src/errors.js';

describe('ChatCompletionTool', () => {
  let tool: ChatCompletionTool;
  let context: ToolExecutionContext;
  let mockOpenAI: MockOpenAIClient;
  let mockLogger: MockLogger;
  let mockConfig: MockConfigManager;
  let mockEnv: MockEnvironmentProvider;

  beforeEach(() => {
    tool = new ChatCompletionTool();
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

  describe('Input Validation', () => {
    it('should throw error for null/undefined arguments', async () => {
      await expect(tool.execute(null, context)).rejects.toThrow(ValidationError);
      await expect(tool.execute(undefined, context)).rejects.toThrow(ValidationError);
    });

    it('should throw error for non-object arguments', async () => {
      await expect(tool.execute('invalid', context)).rejects.toThrow(ValidationError);
      await expect(tool.execute(123, context)).rejects.toThrow(ValidationError);
    });

    it('should throw error when messages field is missing', async () => {
      const args = { model: 'gpt-4o' };
      await expect(tool.execute(args, context)).rejects.toThrow(ValidationError);
    });

    it('should throw error when messages is not an array', async () => {
      const args = { messages: 'not an array' };
      await expect(tool.execute(args, context)).rejects.toThrow(ValidationError);
    });

    it('should validate message structure', async () => {
      const invalidMessages = [
        [null], // null message
        [{}], // missing role
        [{ role: 'invalid' }], // invalid role
        [{ role: 'user', content: 123 }], // invalid content type
      ];

      for (const messages of invalidMessages) {
        const args = { messages };
        await expect(tool.execute(args, context)).rejects.toThrow(ValidationError);
      }
    });

    it('should validate temperature range', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: -0.1, // invalid temperature
      };
      
      await expect(tool.execute(args, context)).rejects.toThrow(ValidationError);
    });

    it('should validate max_tokens', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 0, // invalid token count
      };
      
      await expect(tool.execute(args, context)).rejects.toThrow(ValidationError);
    });
  });

  describe('Valid Execution', () => {
    it('should execute successfully with valid arguments', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
      };

      const result = await tool.execute(args, context);

      expect(result).toBeDefined();
      expect(result.content).toBe('This is a mock response');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage).toBeDefined();
    });

    it('should use default values from config', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await tool.execute(args, context);

      // モックの確認
      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
    });

    it('should override defaults with provided arguments', async () => {
      const args = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        max_tokens: 500,
      };

      const result = await tool.execute(args, context);

      expect(result.model).toBe('gpt-3.5-turbo');
    });

    it('should handle different message roles', async () => {
      const args = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      };

      const result = await tool.execute(args, context);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('API Rate Limit');
      (apiError as any).status = 429;
      mockOpenAI.setError(apiError);

      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(tool.execute(args, context)).rejects.toThrow();
    });

    it('should log OpenAI requests and responses', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await tool.execute(args, context);

      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
      expect(mockLogger.hasLogWithMessage('OpenAI API response')).toBe(true);
    });

    it('should log errors when they occur', async () => {
      const apiError = new Error('API Error');
      mockOpenAI.setError(apiError);

      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      try {
        await tool.execute(args, context);
      } catch (error) {
        // Expected to throw
      }

      expect(mockLogger.hasLogWithMessage('OpenAI API request')).toBe(true);
    });
  });

  describe('Token Usage Tracking', () => {
    it('should return usage information', async () => {
      const args = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await tool.execute(args, context);

      expect(result.usage).toBeDefined();
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(5);
      expect(result.usage.total_tokens).toBe(15);
    });
  });
});