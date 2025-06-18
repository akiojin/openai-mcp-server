import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface OpenAIConfig {
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface LoggingConfig {
  level: string;
  enablePretty: boolean;
  enableFileLogging: boolean;
  logFile?: string;
}

export interface SecurityConfig {
  enableApiKeyValidation: boolean;
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  enableInputSanitization: boolean;
}

export interface ServerConfig {
  server: {
    name: string;
    version: string;
    description: string;
  };
  openai: OpenAIConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
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
    const finalConfig = this.deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      this.deepMerge(loadedConfig, envOverrides)
    ) as unknown as ServerConfig;

    // Validate configuration
    this.validateConfig(finalConfig);

    logger.info('Configuration initialized', {
      source: Object.keys(loadedConfig).length > 0 ? 'file+env' : 'default+env',
    });

    return finalConfig;
  }

  private getEnvironmentOverrides(): DeepPartial<ServerConfig> {
    const overrides: DeepPartial<ServerConfig> = {};

    // OpenAI settings
    const openaiOverrides: Partial<OpenAIConfig> = {};
    if (process.env.OPENAI_DEFAULT_MODEL) {
      openaiOverrides.defaultModel = process.env.OPENAI_DEFAULT_MODEL;
    }
    if (process.env.OPENAI_DEFAULT_TEMPERATURE) {
      const temp = parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE);
      if (!isNaN(temp)) {
        openaiOverrides.defaultTemperature = temp;
      }
    }
    if (process.env.OPENAI_DEFAULT_MAX_TOKENS) {
      const tokens = parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS, 10);
      if (!isNaN(tokens)) {
        openaiOverrides.defaultMaxTokens = tokens;
      }
    }
    if (Object.keys(openaiOverrides).length > 0) {
      overrides.openai = openaiOverrides as Partial<OpenAIConfig>;
    }

    // Logging settings
    const loggingOverrides: Partial<LoggingConfig> = {};
    if (process.env.LOG_LEVEL) {
      loggingOverrides.level = process.env.LOG_LEVEL;
    }
    if (process.env.LOG_FILE) {
      loggingOverrides.enableFileLogging = true;
      loggingOverrides.logFile = process.env.LOG_FILE;
    }
    if (Object.keys(loggingOverrides).length > 0) {
      overrides.logging = loggingOverrides as Partial<LoggingConfig>;
    }

    // Security settings
    const securityOverrides: Partial<SecurityConfig> = {};
    if (process.env.ENABLE_RATE_LIMITING) {
      securityOverrides.enableRateLimiting = process.env.ENABLE_RATE_LIMITING === 'true';
    }
    if (Object.keys(securityOverrides).length > 0) {
      overrides.security = securityOverrides as Partial<SecurityConfig>;
    }

    return overrides;
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

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
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
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

  public updateConfig(updates: DeepPartial<ServerConfig>): void {
    const newConfig = this.deepMerge(
      this.config as unknown as Record<string, unknown>,
      updates as Record<string, unknown>
    ) as unknown as ServerConfig;
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
