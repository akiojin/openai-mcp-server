import { ICache, CacheEntry, CacheConfig, CacheStats } from './interfaces.js';

/**
 * In-memory cache implementation with LRU eviction
 */
export class InMemoryCache<T = any> implements ICache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private stats: CacheStats;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      maxSize: config.maxSize,
    };
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    this.stats.hits++;
    return entry.value;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.config.ttl;
    const now = Date.now();

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      await this.evict();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + effectiveTtl,
      accessCount: 0,
      lastAccessedAt: now,
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    this.stats.size = this.cache.size;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);

    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }

    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Evict entries based on the configured strategy
   */
  private async evict(): Promise<void> {
    switch (this.config.strategy) {
      case 'LRU':
        await this.evictLRU();
        break;
      case 'LFU':
        await this.evictLFU();
        break;
      case 'FIFO':
        await this.evictFIFO();
        break;
      default:
        await this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccessTime) {
        oldestAccessTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Evict least frequently used entry
   */
  private async evictLFU(): Promise<void> {
    let leastUsedKey: string | null = null;
    let lowestAccessCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lowestAccessCount) {
        lowestAccessCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Evict first in, first out (oldest created)
   */
  private async evictFIFO(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestCreatedTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestCreatedTime) {
        oldestCreatedTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Clean up expired entries (can be called periodically)
   */
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
