import crypto from 'node:crypto';
import { ICacheKeyGenerator } from './interfaces.js';

/**
 * Default cache key generator implementation
 */
export class CacheKeyGenerator implements ICacheKeyGenerator {
  /**
   * Generate a cache key from request parameters
   * Uses SHA-256 hash of sorted JSON string for consistent keys
   */
  generateKey(params: Record<string, any>): string {
    // Sort object keys for consistent hashing
    const sortedParams = this.sortObject(params);

    // Create a string representation
    const jsonString = JSON.stringify(sortedParams);

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256');
    hash.update(jsonString);

    return hash.digest('hex');
  }

  /**
   * Recursively sort object keys for consistent serialization
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = this.sortObject(obj[key]);
    }

    return sorted;
  }
}

/**
 * Specialized cache key generator for OpenAI requests
 */
export class OpenAICacheKeyGenerator extends CacheKeyGenerator {
  /**
   * Generate a cache key specifically for OpenAI API requests
   * Excludes certain fields that shouldn't affect caching
   */
  generateKey(params: Record<string, any>): string {
    // Create a copy to avoid modifying original
    const cacheableParams = { ...params };

    // Remove fields that shouldn't affect cache key
    delete cacheableParams.stream; // Streaming responses shouldn't be cached
    delete cacheableParams.user; // User ID might be for tracking only
    delete cacheableParams.logprobs; // Log probabilities don't affect response content

    // For chat completions, normalize messages
    if (cacheableParams.messages) {
      cacheableParams.messages = this.normalizeMessages(cacheableParams.messages);
    }

    return super.generateKey(cacheableParams);
  }

  /**
   * Normalize messages for consistent caching
   */
  private normalizeMessages(messages: any[]): any[] {
    return messages.map(msg => {
      const normalized: any = {
        role: msg.role,
        content: msg.content,
      };

      // Include function call if present
      if (msg.function_call) {
        normalized.function_call = msg.function_call;
      }

      // Include tool calls if present
      if (msg.tool_calls) {
        normalized.tool_calls = msg.tool_calls;
      }

      // Include name if present (for function messages)
      if (msg.name) {
        normalized.name = msg.name;
      }

      return normalized;
    });
  }
}
