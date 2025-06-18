import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

export interface ServerConfig {
  server: {
    name: string;
    version: string;
    description: string;
  };
  openai: {
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  logging: {
    level: string;
    enablePretty: boolean;
    enableFileLogging: boolean;
    logFile?: string;
  };
  security: {
    enableApiKeyValidation: boolean;
    enableRateLimiting: boolean;
    maxRequestsPerMinute: number;
    enableInputSanitization: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheExpiry: number;
    enableMetrics: boolean;
  };
}

const DEFAULT_CONFIG: ServerConfig = {
  server: {
    name: 'openai-mcp-server',
    version: '0.1.0',
    description: 'OpenAI API MCP Server',
  },
  openai: {
    defaultModel: 'gpt-4.1',
    defaultTemperature: 0.7,
    defaultMaxTokens: 1000,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  logging: {
    level: 'info',
    enablePretty: process.env.NODE_ENV !== 'production',
    enableFileLogging: false,
    logFile: undefined,
  },
  security: {
    enableApiKeyValidation: true,
    enableRateLimiting: false,
    maxRequestsPerMinute: 60,
    enableInputSanitization: true,
  },
  performance: {
    enableCaching: false,
    cacheExpiry: 300000, // 5 minutes
    enableMetrics: false,
  },
};

export class ConfigManager {
  private config: ServerConfig;
  public static instance: ConfigManager | null;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): ServerConfig {
    const configPaths = [
      join(process.cwd(), 'config.json'),
      join(process.cwd(), 'config', 'default.json'),
      join(process.cwd(), 'src', 'config', 'default.json'),
    ];

    let loadedConfig: Partial<ServerConfig> = {};

    // Try to load config from file
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const configFile = readFileSync(configPath, 'utf-8');
          loadedConfig = JSON.parse(configFile);
          logger.info('Configuration loaded from file', { configPath });
          break;
        } catch (error) {
          logger.warn('Failed to load config file', {
            configPath,
            error: {
              code: 'CONFIG_LOAD_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    }

    // Merge with environment variables
    const envOverrides = this.getEnvironmentOverrides();

    // Deep merge: DEFAULT_CONFIG <- loadedConfig <- envOverrides
    const finalConfig = this.deepMerge(DEFAULT_CONFIG, this.deepMerge(loadedConfig, envOverrides));

    // Validate configuration
    this.validateConfig(finalConfig);

    logger.info('Configuration initialized', {
      source: Object.keys(loadedConfig).length > 0 ? 'file+env' : 'default+env',
    });

    return finalConfig;
  }

  private getEnvironmentOverrides(): Partial<ServerConfig> {
    const overrides: Partial<ServerConfig> = {};

    // OpenAI settings
    if (process.env.OPENAI_DEFAULT_MODEL) {
      if (!overrides.openai) overrides.openai = {};
      overrides.openai.defaultModel = process.env.OPENAI_DEFAULT_MODEL;
    }
    if (process.env.OPENAI_DEFAULT_TEMPERATURE) {
      const temp = parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE);
      if (!isNaN(temp)) {
        if (!overrides.openai) overrides.openai = {};
        overrides.openai.defaultTemperature = temp;
      }
    }
    if (process.env.OPENAI_DEFAULT_MAX_TOKENS) {
      const tokens = parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS, 10);
      if (!isNaN(tokens)) {
        if (!overrides.openai) overrides.openai = {};
        overrides.openai.defaultMaxTokens = tokens;
      }
    }

    // Logging settings
    if (process.env.LOG_LEVEL) {
      if (!overrides.logging) overrides.logging = {};
      overrides.logging.level = process.env.LOG_LEVEL;
    }
    if (process.env.LOG_FILE) {
      if (!overrides.logging) overrides.logging = {};
      overrides.logging.enableFileLogging = true;
      overrides.logging.logFile = process.env.LOG_FILE;
    }

    // Security settings
    if (process.env.ENABLE_RATE_LIMITING) {
      if (!overrides.security) overrides.security = {};
      overrides.security.enableRateLimiting = process.env.ENABLE_RATE_LIMITING === 'true';
    }

    return overrides;
  }

  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target } as T;

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }

    return result;
  }

  private validateConfig(config: ServerConfig): void {
    // Validate OpenAI settings
    if (config.openai.defaultTemperature < 0 || config.openai.defaultTemperature > 2) {
      throw new Error('Invalid defaultTemperature: must be between 0 and 2');
    }
    if (config.openai.defaultMaxTokens < 1 || config.openai.defaultMaxTokens > 128000) {
      throw new Error('Invalid defaultMaxTokens: must be between 1 and 128000');
    }
    if (config.openai.timeout < 1000) {
      throw new Error('Invalid timeout: must be at least 1000ms');
    }

    // Validate logging settings
    const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
    if (!validLogLevels.includes(config.logging.level)) {
      throw new Error(`Invalid log level: must be one of ${validLogLevels.join(', ')}`);
    }

    // Validate security settings
    if (config.security.maxRequestsPerMinute < 1 || config.security.maxRequestsPerMinute > 10000) {
      throw new Error('Invalid maxRequestsPerMinute: must be between 1 and 10000');
    }

    // Validate performance settings
    if (config.performance.cacheExpiry < 1000) {
      throw new Error('Invalid cacheExpiry: must be at least 1000ms');
    }
  }

  public getConfig(): ServerConfig {
    return { ...this.config };
  }

  public get<K extends keyof ServerConfig>(section: K): ServerConfig[K] {
    return { ...this.config[section] };
  }

  public updateConfig(updates: Partial<ServerConfig>): void {
    const newConfig = this.deepMerge(this.config, updates);
    this.validateConfig(newConfig);
    this.config = newConfig;

    logger.info('Configuration updated', { updates });
  }

  public reloadConfig(): void {
    this.config = this.loadConfig();
    logger.info('Configuration reloaded');
  }
}

export const config = ConfigManager.getInstance();
export default config;
