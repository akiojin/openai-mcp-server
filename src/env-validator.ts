import { logger } from './logger.js';
import { ErrorCode, MCPError } from './errors.js';

export interface EnvironmentConfig {
  OPENAI_API_KEY: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  OPENAI_DEFAULT_MODEL?: string;
  OPENAI_DEFAULT_TEMPERATURE?: string;
  OPENAI_DEFAULT_MAX_TOKENS?: string;
}

export class EnvironmentValidator {
  private static readonly OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9]{20,}$/;
  private static readonly VALID_LOG_LEVELS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
  ];
  private static readonly VALID_NODE_ENVS = ['development', 'production', 'test'];

  static validate(): EnvironmentConfig {
    const errors: string[] = [];

    // Required environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      errors.push('OPENAI_API_KEY is required but not set');
    }

    // Optional environment variables with validation
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv && !this.VALID_NODE_ENVS.includes(nodeEnv)) {
      logger.warn(`Invalid NODE_ENV value: ${nodeEnv}. Using default.`);
    }

    const logLevel = process.env.LOG_LEVEL;
    if (logLevel && !this.VALID_LOG_LEVELS.includes(logLevel)) {
      errors.push(
        `Invalid LOG_LEVEL: ${logLevel}. Must be one of: ${this.VALID_LOG_LEVELS.join(', ')}`
      );
    }

    const temperature = process.env.OPENAI_DEFAULT_TEMPERATURE;
    if (temperature) {
      const tempValue = parseFloat(temperature);
      if (isNaN(tempValue) || tempValue < 0 || tempValue > 2) {
        errors.push('OPENAI_DEFAULT_TEMPERATURE must be a number between 0 and 2');
      }
    }

    const maxTokens = process.env.OPENAI_DEFAULT_MAX_TOKENS;
    if (maxTokens) {
      const tokensValue = parseInt(maxTokens, 10);
      if (isNaN(tokensValue) || tokensValue < 1 || tokensValue > 128000) {
        errors.push('OPENAI_DEFAULT_MAX_TOKENS must be a number between 1 and 128000');
      }
    }

    // If there are any errors, throw an exception
    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      throw new MCPError(ErrorCode.ENVIRONMENT_ERROR, errorMessage, { errors });
    }

    logger.info('Environment validation passed', {
      args: {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        hasApiKey: !!apiKey,
      },
    });

    return {
      OPENAI_API_KEY: apiKey!,
      NODE_ENV: nodeEnv,
      LOG_LEVEL: logLevel,
      OPENAI_DEFAULT_MODEL: process.env.OPENAI_DEFAULT_MODEL,
      OPENAI_DEFAULT_TEMPERATURE: temperature,
      OPENAI_DEFAULT_MAX_TOKENS: maxTokens,
    };
  }

  static validateApiKey(apiKey: string): boolean {
    // Basic validation - check if it starts with 'sk-' and has reasonable length
    // Note: OpenAI API keys can have different formats, so we're being permissive
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check for common patterns
    if (apiKey.startsWith('sk-') && apiKey.length > 20) {
      return true;
    }

    // Also accept org-specific keys
    if (apiKey.startsWith('sk-proj-') && apiKey.length > 20) {
      return true;
    }

    return false;
  }

  static sanitizeApiKeyForLogging(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }

    const prefix = apiKey.substring(0, 7);
    const suffix = apiKey.substring(apiKey.length - 4);
    const masked = '*'.repeat(Math.max(0, apiKey.length - 11));

    return `${prefix}${masked}${suffix}`;
  }
}
