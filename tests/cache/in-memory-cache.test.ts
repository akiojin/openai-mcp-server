import { InMemoryCache } from '../../src/cache/in-memory-cache.js';
import { CacheConfig } from '../../src/cache/interfaces.js';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;
  const config: CacheConfig = {
    enabled: true,
    ttl: 1000, // 1 second for testing
    maxSize: 3,
    strategy: 'LRU'
  };

  beforeEach(() => {
    cache = new InMemoryCache(config);
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.delete('key1')).toBe(true);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.size()).toBe(0);
    });

    it('should return correct size', async () => {
      expect(await cache.size()).toBe(0);
      await cache.set('key1', 'value1');
      expect(await cache.size()).toBe(1);
      await cache.set('key2', 'value2');
      expect(await cache.size()).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', 100); // 100ms TTL
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      
      // Wait for default TTL expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when max size reached', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Cache is now full (maxSize = 3)
      expect(await cache.size()).toBe(3);
      
      // Access key1 to make it recently used
      await cache.get('key1');
      
      // Add new entry, should evict key2 (least recently used)
      await cache.set('key4', 'value4');
      
      expect(await cache.has('key1')).toBe(true);  // Recently accessed
      expect(await cache.has('key2')).toBe(false); // Should be evicted
      expect(await cache.has('key3')).toBe(true);  // Still present
      expect(await cache.has('key4')).toBe(true);  // Newly added
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('nonexistent'); // miss
      await cache.delete('key1');
      
      const stats = await cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.maxSize).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      await cache.set('key1', 'value1', 100); // 100ms TTL
      await cache.set('key2', 'value2', 1000); // 1s TTL
      
      expect(await cache.size()).toBe(2);
      
      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cleaned = await cache.cleanupExpired();
      expect(cleaned).toBe(1);
      expect(await cache.size()).toBe(1);
      expect(await cache.has('key2')).toBe(true);
    });
  });

  describe('different eviction strategies', () => {
    it('should use LFU eviction strategy', async () => {
      const lfuConfig: CacheConfig = { ...config, strategy: 'LFU' };
      const lfuCache = new InMemoryCache(lfuConfig);
      
      await lfuCache.set('key1', 'value1');
      await lfuCache.set('key2', 'value2');
      await lfuCache.set('key3', 'value3');
      
      // Access key1 multiple times
      await lfuCache.get('key1');
      await lfuCache.get('key1');
      
      // Access key2 once
      await lfuCache.get('key2');
      
      // key3 has never been accessed, should be evicted
      await lfuCache.set('key4', 'value4');
      
      expect(await lfuCache.has('key1')).toBe(true);  // Most frequently used
      expect(await lfuCache.has('key2')).toBe(true);  // Used once
      expect(await lfuCache.has('key3')).toBe(false); // Never used, evicted
      expect(await lfuCache.has('key4')).toBe(true);  // Newly added
    });

    it('should use FIFO eviction strategy', async () => {
      const fifoConfig: CacheConfig = { ...config, strategy: 'FIFO' };
      const fifoCache = new InMemoryCache(fifoConfig);
      
      await fifoCache.set('key1', 'value1'); // First in
      await fifoCache.set('key2', 'value2');
      await fifoCache.set('key3', 'value3');
      
      // Access key1 to make it recently used (shouldn't matter for FIFO)
      await fifoCache.get('key1');
      
      // Add new entry, should evict key1 (first in, first out)
      await fifoCache.set('key4', 'value4');
      
      expect(await fifoCache.has('key1')).toBe(false); // First in, first out
      expect(await fifoCache.has('key2')).toBe(true);
      expect(await fifoCache.has('key3')).toBe(true);
      expect(await fifoCache.has('key4')).toBe(true);
    });
  });
});