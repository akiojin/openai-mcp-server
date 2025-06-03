import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CacheKeyGenerator, OpenAICacheKeyGenerator } from '../../src/cache/cache-key-generator.js';

describe('CacheKeyGenerator', () => {
  describe('Base CacheKeyGenerator', () => {
    let generator: CacheKeyGenerator;

    beforeEach(() => {
      generator = new CacheKeyGenerator();
    });

    it('should generate consistent keys for same parameters', () => {
      const params = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000,
      };

      const key1 = generator.generateKey(params);
      const key2 = generator.generateKey(params);

      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA-256 produces 64 character hex string
    });

    it('should generate different keys for different parameters', () => {
      const params1 = { model: 'gpt-4.1', temperature: 0.7 };
      const params2 = { model: 'gpt-4.1', temperature: 0.8 };
      const params3 = { model: 'gpt-4o', temperature: 0.7 };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);
      const key3 = generator.generateKey(params3);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('should handle nested objects consistently', () => {
      const params1 = {
        config: { temperature: 0.7, model: 'gpt-4.1' },
        messages: [{ role: 'user', content: 'test' }],
      };
      const params2 = {
        messages: [{ role: 'user', content: 'test' }],
        config: { model: 'gpt-4.1', temperature: 0.7 },
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).toBe(key2); // Same content, different order
    });

    it('should handle arrays correctly', () => {
      const params1 = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      };
      const params2 = {
        messages: [
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'Hello' },
        ],
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).not.toBe(key2); // Different order in array
    });
  });

  describe('OpenAICacheKeyGenerator', () => {
    let generator: OpenAICacheKeyGenerator;

    beforeEach(() => {
      generator = new OpenAICacheKeyGenerator();
    });

    it('should generate consistent keys for chat completions', () => {
      const params = {
        type: 'chat',
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000,
      };

      const key1 = generator.generateKey(params);
      const key2 = generator.generateKey(params);

      expect(key1).toBe(key2);
    });

    it('should exclude streaming parameter from key', () => {
      const params1 = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };
      const params2 = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).toBe(key2); // Stream parameter should be ignored
    });

    it('should exclude user parameter from key', () => {
      const params1 = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        user: 'user123',
      };
      const params2 = {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        user: 'user456',
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).toBe(key2); // User parameter should be ignored
    });

    it('should normalize messages for consistent caching', () => {
      const params1 = {
        messages: [
          { role: 'user', content: 'Hello', extra: 'ignored' },
        ],
      };
      const params2 = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).toBe(key2); // Extra properties should be ignored unless recognized
    });

    it('should include function call in message normalization', () => {
      const params1 = {
        messages: [
          { role: 'assistant', content: 'Hello', function_call: { name: 'test' } },
        ],
      };
      const params2 = {
        messages: [
          { role: 'assistant', content: 'Hello' },
        ],
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).not.toBe(key2); // Function call should affect the key
    });

    it('should include tool calls in message normalization', () => {
      const params1 = {
        messages: [
          { role: 'assistant', content: 'Hello', tool_calls: [{ id: '1', type: 'function' }] },
        ],
      };
      const params2 = {
        messages: [
          { role: 'assistant', content: 'Hello' },
        ],
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).not.toBe(key2); // Tool calls should affect the key
    });

    it('should include name in message normalization for function messages', () => {
      const params1 = {
        messages: [
          { role: 'function', content: 'Result', name: 'my_function' },
        ],
      };
      const params2 = {
        messages: [
          { role: 'function', content: 'Result', name: 'other_function' },
        ],
      };

      const key1 = generator.generateKey(params1);
      const key2 = generator.generateKey(params2);

      expect(key1).not.toBe(key2); // Function name should affect the key
    });
  });
});