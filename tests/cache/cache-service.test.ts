import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CacheService } from '../../src/cache/cache-service.js';
import { CacheConfig } from '../../src/cache/interfaces.js';

describe('CacheService', () => {
  let cacheService: CacheService;
  let cacheConfig: CacheConfig;

  beforeEach(() => {
    cacheConfig = {
      enabled: true,
      ttl: 1000,
      maxSize: 10,
      strategy: 'LRU',
    };
    cacheService = new CacheService(cacheConfig);
  });

  afterEach(async () => {
    await cacheService.dispose();
  });

  describe('Chat Completion Cache', () => {
    it('should cache and retrieve chat completion results', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const temperature = 0.7;
      const maxTokens = 1000;
      const result = { content: 'Hi there!', usage: { total_tokens: 10 }, model };

      // Initially cache should be empty
      const cachedResult = await cacheService.getChatCompletion(model, messages, temperature, maxTokens);
      expect(cachedResult).toBeUndefined();

      // Save result to cache
      await cacheService.setChatCompletion(model, messages, temperature, maxTokens, result);

      // Retrieve from cache
      const retrieved = await cacheService.getChatCompletion(model, messages, temperature, maxTokens);
      expect(retrieved).toEqual(result);
    });

    it('should return different keys for different parameters', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result1 = { content: 'Response 1' };
      const result2 = { content: 'Response 2' };

      // Cache with different temperatures
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result1);
      await cacheService.setChatCompletion(model, messages, 0.8, 1000, result2);

      // Retrieve with specific temperature
      const retrieved1 = await cacheService.getChatCompletion(model, messages, 0.7, 1000);
      const retrieved2 = await cacheService.getChatCompletion(model, messages, 0.8, 1000);

      expect(retrieved1).toEqual(result1);
      expect(retrieved2).toEqual(result2);
    });

    it('should respect TTL for cached entries', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi there!' };

      // Cache with short TTL
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result, 100);

      // Should be available immediately
      let cached = await cacheService.getChatCompletion(model, messages, 0.7, 1000);
      expect(cached).toEqual(result);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      cached = await cacheService.getChatCompletion(model, messages, 0.7, 1000);
      expect(cached).toBeUndefined();
    });
  });

  describe('Model List Cache', () => {
    it('should cache and retrieve model list', async () => {
      const modelList = {
        models: [
          { id: 'gpt-4.1', created: '2024-01-01', owned_by: 'openai' },
          { id: 'gpt-4o', created: '2024-01-01', owned_by: 'openai' },
        ],
        count: 2,
      };

      // Initially empty
      let cached = await cacheService.getModelList();
      expect(cached).toBeUndefined();

      // Save to cache
      await cacheService.setModelList(modelList);

      // Retrieve from cache
      cached = await cacheService.getModelList();
      expect(cached).toEqual(modelList);
    });

    it('should use custom TTL for model list', async () => {
      const modelList = { models: [], count: 0 };

      // Set with custom TTL
      await cacheService.setModelList(modelList, 100);

      // Should be available
      let cached = await cacheService.getModelList();
      expect(cached).toEqual(modelList);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      cached = await cacheService.getModelList();
      expect(cached).toBeUndefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear all entries', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi' };
      const modelList = { models: [], count: 0 };

      // Add entries
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result);
      await cacheService.setModelList(modelList);

      // Verify they exist
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeDefined();
      expect(await cacheService.getModelList()).toBeDefined();

      // Clear cache
      await cacheService.clear();

      // Verify they're gone
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();
      expect(await cacheService.getModelList()).toBeUndefined();
    });

    it('should respect cache disabled setting', async () => {
      // Create service with cache disabled
      const disabledConfig: CacheConfig = {
        enabled: false,
        ttl: 1000,
        maxSize: 10,
        strategy: 'LRU',
      };
      const disabledService = new CacheService(disabledConfig);

      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi' };

      // Try to cache
      await disabledService.setChatCompletion(model, messages, 0.7, 1000, result);

      // Should not be cached
      const cached = await disabledService.getChatCompletion(model, messages, 0.7, 1000);
      expect(cached).toBeUndefined();

      await disabledService.dispose();
    });

    it('should toggle cache enabled state', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi' };

      // Cache should be enabled initially
      expect(cacheService.isEnabled()).toBe(true);

      // Add entry
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result);
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeDefined();

      // Disable cache
      cacheService.setEnabled(false);
      expect(cacheService.isEnabled()).toBe(false);

      // Should not return cached value when disabled
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();

      // Re-enable cache
      cacheService.setEnabled(true);
      expect(cacheService.isEnabled()).toBe(true);

      // Cached value should be available again
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeDefined();
    });

    it('should provide cache statistics', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi' };

      // Initial stats
      let stats = await cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);

      // Miss
      await cacheService.getChatCompletion(model, messages, 0.7, 1000);
      
      // Set
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result);
      
      // Hit
      await cacheService.getChatCompletion(model, messages, 0.7, 1000);

      stats = await cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should handle generic get/set operations', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // Set value
      await cacheService.set(key, value);

      // Get value
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);

      // Check existence
      expect(await cacheService.has(key)).toBe(true);

      // Delete value
      expect(await cacheService.delete(key)).toBe(true);
      expect(await cacheService.has(key)).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired entries', async () => {
      const model = 'gpt-4.1';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Hi' };

      // Add entry with short TTL
      await cacheService.setChatCompletion(model, messages, 0.7, 1000, result, 100);

      // Should exist
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Run cleanup
      await cacheService.cleanup();

      // Should be removed
      expect(await cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();
    });
  });
});