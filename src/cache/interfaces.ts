/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  strategy: 'LRU' | 'LFU' | 'FIFO';
}

/**
 * Cache interface for storing API responses
 */
export interface ICache<T = any> {
  /**
   * Get a value from cache
   */
  get(key: string): Promise<T | undefined>;

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a key from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Get the number of items in cache
   */
  size(): Promise<number>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  maxSize: number;
}

/**
 * Cache key generator interface
 */
export interface ICacheKeyGenerator {
  /**
   * Generate a cache key from request parameters
   */
  generateKey(params: Record<string, any>): string;
}
