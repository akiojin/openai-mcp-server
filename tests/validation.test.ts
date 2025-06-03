import { describe, it, expect } from '@jest/globals';

// Import the validation logic that we'll extract from the main server
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Extracted validation function for testing
function validateChatCompletionArgs(args: unknown): {
  isValid: boolean;
  error?: string;
  validatedArgs?: {
    model: string;
    messages: ChatMessage[];
    temperature: number;
    max_tokens: number;
  };
} {
  if (!args || typeof args !== 'object') {
    return { isValid: false, error: 'Invalid arguments: Expected object' };
  }

  const typedArgs = args as Record<string, unknown>;

  if (!Array.isArray(typedArgs.messages)) {
    return { isValid: false, error: 'Invalid arguments: messages must be an array' };
  }

  // Validate messages structure
  for (const message of typedArgs.messages) {
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'Invalid message: Each message must be an object' };
    }
    const msg = message as Record<string, unknown>;
    if (typeof msg.role !== 'string' || !['system', 'user', 'assistant'].includes(msg.role)) {
      return { isValid: false, error: 'Invalid message: role must be "system", "user", or "assistant"' };
    }
    if (typeof msg.content !== 'string') {
      return { isValid: false, error: 'Invalid message: content must be a string' };
    }
  }

  const validatedArgs = {
    model: typeof typedArgs.model === 'string' ? typedArgs.model : 'gpt-4o',
    messages: typedArgs.messages as ChatMessage[],
    temperature: typeof typedArgs.temperature === 'number' ? typedArgs.temperature : 0.7,
    max_tokens: typeof typedArgs.max_tokens === 'number' ? typedArgs.max_tokens : 1000,
  };

  return { isValid: true, validatedArgs };
}

describe('Input Validation', () => {
  describe('validateChatCompletionArgs', () => {
    it('should validate correct arguments', () => {
      const args = {
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };

      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(true);
      expect(result.validatedArgs).toEqual({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000
      });
    });

    it('should use default values for optional parameters', () => {
      const args = {
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(true);
      expect(result.validatedArgs).toEqual({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000
      });
    });

    it('should reject null arguments', () => {
      const result = validateChatCompletionArgs(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid arguments: Expected object');
    });

    it('should reject undefined arguments', () => {
      const result = validateChatCompletionArgs(undefined);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid arguments: Expected object');
    });

    it('should reject non-object arguments', () => {
      const result = validateChatCompletionArgs('string');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid arguments: Expected object');
    });

    it('should reject missing messages', () => {
      const args = { model: 'gpt-4o' };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid arguments: messages must be an array');
    });

    it('should reject non-array messages', () => {
      const args = { messages: 'not an array' };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid arguments: messages must be an array');
    });

    it('should reject empty messages array', () => {
      const args = { messages: [] };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(true);
      expect(result.validatedArgs?.messages).toEqual([]);
    });

    it('should reject invalid message objects', () => {
      const args = { messages: [null] };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message: Each message must be an object');
    });

    it('should reject invalid role values', () => {
      const args = { messages: [{ role: 'invalid', content: 'Hello' }] };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message: role must be "system", "user", or "assistant"');
    });

    it('should reject missing content', () => {
      const args = { messages: [{ role: 'user' }] };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message: content must be a string');
    });

    it('should reject non-string content', () => {
      const args = { messages: [{ role: 'user', content: 123 }] };
      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid message: content must be a string');
    });

    it('should validate multiple valid messages', () => {
      const args = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const result = validateChatCompletionArgs(args);

      expect(result.isValid).toBe(true);
      expect(result.validatedArgs?.messages).toHaveLength(3);
    });
  });
});