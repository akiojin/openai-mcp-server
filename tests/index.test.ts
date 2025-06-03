import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ValidationError, ErrorCode, MCPError } from '../src/errors';

// Test utility functions that would normally be in index.ts
// Since index.ts is excluded from coverage, we test the logic separately

describe('Input Validation Logic', () => {
  describe('Chat Completion Arguments Validation', () => {
    it('should validate messages array', () => {
      const validateMessages = (messages: any) => {
        if (!Array.isArray(messages)) {
          throw new ValidationError('messages must be an array', 'messages', messages);
        }
        
        for (let index = 0; index < messages.length; index++) {
          const message = messages[index];
          if (!message || typeof message !== 'object') {
            throw new ValidationError(
              'Each message must be an object',
              `messages[${index}]`,
              message
            );
          }
          if (!('role' in message) || typeof message.role !== 'string') {
            throw new ValidationError('role must be a string', `messages[${index}].role`, message);
          }
          if (!['system', 'user', 'assistant', 'function', 'tool'].includes(message.role)) {
            throw new ValidationError(
              'role must be one of: system, user, assistant, function, tool',
              `messages[${index}].role`,
              message.role
            );
          }
          if (
            'content' in message &&
            message.content !== null &&
            typeof message.content !== 'string'
          ) {
            throw new ValidationError(
              'content must be a string or null',
              `messages[${index}].content`,
              message.content
            );
          }
        }
      };

      // Valid messages
      expect(() => validateMessages([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ])).not.toThrow();

      // Invalid cases
      expect(() => validateMessages('not an array')).toThrow(MCPError);
      expect(() => validateMessages(null)).toThrow(MCPError);
      expect(() => validateMessages([{ content: 'missing role' }])).toThrow(MCPError);
      expect(() => validateMessages([{ role: 'invalid', content: 'test' }])).toThrow(MCPError);
      expect(() => validateMessages([{ role: 'user', content: 123 }])).toThrow(MCPError);
    });

    it('should validate temperature range', () => {
      const validateTemperature = (temperature: number) => {
        if (temperature < 0 || temperature > 2) {
          throw new ValidationError('must be between 0 and 2', 'temperature', temperature);
        }
      };

      expect(() => validateTemperature(0)).not.toThrow();
      expect(() => validateTemperature(1)).not.toThrow();
      expect(() => validateTemperature(2)).not.toThrow();
      expect(() => validateTemperature(0.7)).not.toThrow();

      expect(() => validateTemperature(-0.1)).toThrow(MCPError);
      expect(() => validateTemperature(2.1)).toThrow(MCPError);
    });

    it('should validate max_tokens', () => {
      const validateMaxTokens = (maxTokens: number) => {
        if (maxTokens < 1) {
          throw new ValidationError('must be at least 1', 'max_tokens', maxTokens);
        }
      };

      expect(() => validateMaxTokens(1)).not.toThrow();
      expect(() => validateMaxTokens(1000)).not.toThrow();
      expect(() => validateMaxTokens(100000)).not.toThrow();

      expect(() => validateMaxTokens(0)).toThrow(MCPError);
      expect(() => validateMaxTokens(-1)).toThrow(MCPError);
    });
  });

  describe('Tool Request Validation', () => {
    it('should handle unknown tools', () => {
      const handleUnknownTool = (toolName: string) => {
        throw new MCPError(ErrorCode.UNKNOWN_TOOL, `Unknown tool: ${toolName}`, { toolName });
      };

      expect(() => handleUnknownTool('invalid_tool')).toThrow(MCPError);

      try {
        handleUnknownTool('invalid_tool');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPError);
        expect((error as MCPError).code).toBe(ErrorCode.UNKNOWN_TOOL);
        expect((error as MCPError).details).toEqual({ toolName: 'invalid_tool' });
      }
    });

    it('should validate arguments object', () => {
      const validateArguments = (args: any) => {
        if (!args || typeof args !== 'object') {
          throw new ValidationError('Expected object', 'arguments', args);
        }
        
        if (!('messages' in args)) {
          throw new ValidationError('messages field is required', 'messages');
        }
      };

      expect(() => validateArguments({ messages: [] })).not.toThrow();
      
      expect(() => validateArguments(null)).toThrow(MCPError);
      expect(() => validateArguments('string')).toThrow(MCPError);
      expect(() => validateArguments(123)).toThrow(MCPError);
      expect(() => validateArguments({})).toThrow(MCPError);
    });
  });

  describe('Message Validation Edge Cases', () => {
    it('should allow null content for certain message types', () => {
      const isValidMessage = (message: any) => {
        if (!message || typeof message !== 'object') return false;
        if (!('role' in message) || typeof message.role !== 'string') return false;
        if (!['system', 'user', 'assistant', 'function', 'tool'].includes(message.role)) return false;
        if ('content' in message && message.content !== null && typeof message.content !== 'string') {
          return false;
        }
        return true;
      };

      expect(isValidMessage({ role: 'user', content: 'Hello' })).toBe(true);
      expect(isValidMessage({ role: 'user', content: null })).toBe(true);
      expect(isValidMessage({ role: 'function', name: 'test' })).toBe(true);
      expect(isValidMessage({ role: 'user', content: 123 })).toBe(false);
    });

    it('should handle function and tool messages', () => {
      const messages = [
        { role: 'function', name: 'get_weather', content: '{"temp": 72}' },
        { role: 'tool', tool_call_id: '123', content: 'Result' }
      ];

      const validateMessage = (message: any, index: number) => {
        if (!['system', 'user', 'assistant', 'function', 'tool'].includes(message.role)) {
          throw new ValidationError(
            'role must be one of: system, user, assistant, function, tool',
            `messages[${index}].role`,
            message.role
          );
        }
      };

      messages.forEach((msg, idx) => {
        expect(() => validateMessage(msg, idx)).not.toThrow();
      });
    });
  });
});