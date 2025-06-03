import { ICacheService } from '../interfaces.js';
import { ICache, CacheConfig, CacheStats } from './interfaces.js';
import { InMemoryCache } from './in-memory-cache.js';
import { OpenAICacheKeyGenerator } from './cache-key-generator.js';

/**
 * Cache service implementation for OpenAI API responses
 */
export class CacheService implements ICacheService {
  private cache: ICache;
  private keyGenerator: OpenAICacheKeyGenerator;
  private config: CacheConfig;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new InMemoryCache(config);
    this.keyGenerator = new OpenAICacheKeyGenerator();

    // Start periodic cleanup if cache is enabled
    if (config.enabled) {
      this.startCleanup();
    }
  }

  async getChatCompletion(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number
  ): Promise<any | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }

    const key = this.generateChatKey(model, messages, temperature, maxTokens);
    return this.cache.get(key);
  }

  async setChatCompletion(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number,
    result: any,
    ttl?: number
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateChatKey(model, messages, temperature, maxTokens);
    return this.cache.set(key, result, ttl);
  }

  async getModelList(): Promise<any | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }

    const key = 'models:list';
    return this.cache.get(key);
  }

  async setModelList(result: any, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = 'models:list';
    // Model list has a longer default TTL (1 hour)
    const effectiveTtl = ttl ?? 3600000;
    return this.cache.set(key, result, effectiveTtl);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    return this.cache.clear();
  }

  async getStats(): Promise<CacheStats> {
    return this.cache.getStats();
  }

  async get(key: string): Promise<any | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }
    return this.cache.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    return this.cache.set(key, value, ttl);
  }

  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }
    return this.cache.has(key);
  }

  async size(): Promise<number> {
    return this.cache.size();
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (enabled) {
      this.startCleanup();
    } else {
      this.stopCleanup();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async cleanup(): Promise<void> {
    if (this.cache instanceof InMemoryCache) {
      await this.cache.cleanupExpired();
    }
  }

  async dispose(): Promise<void> {
    this.stopCleanup();
    await this.cache.clear();
  }

  /**
   * Generate cache key for chat completion requests
   */
  private generateChatKey(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number
  ): string {
    return this.keyGenerator.generateKey({
      type: 'chat',
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 300000);
  }

  /**
   * Stop periodic cleanup
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}
