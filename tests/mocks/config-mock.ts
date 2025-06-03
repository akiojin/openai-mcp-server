import { IConfigManager } from '../../src/interfaces.js';

/**
 * 設定管理のモック実装
 * テスト用に使用される
 */
export class MockConfigManager implements IConfigManager {
  private config: any;

  constructor(initialConfig?: any) {
    this.config = initialConfig || this.getDefaultConfig();
  }

  getConfig(): any {
    return { ...this.config };
  }

  get<T>(section: string): T {
    return { ...this.config[section] } as T;
  }

  updateConfig(updates: any): void {
    this.config = { ...this.config, ...updates };
  }

  reloadConfig(): void {
    // テスト用では何もしない
  }

  // テスト用ヘルパーメソッド
  setConfig(config: any): void {
    this.config = config;
  }

  reset(): void {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): any {
    return {
      server: {
        name: 'openai-mcp-server-test',
        version: '0.1.0',
        description: 'Test OpenAI API MCP Server',
      },
      openai: {
        defaultModel: 'gpt-4o',
        defaultTemperature: 0.7,
        defaultMaxTokens: 1000,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      logging: {
        level: 'info',
        enablePretty: false,
        enableFileLogging: false,
      },
      security: {
        enableApiKeyValidation: true,
        enableRateLimiting: false,
        maxRequestsPerMinute: 60,
        enableInputSanitization: true,
      },
      performance: {
        enableCaching: false,
        cacheExpiry: 300000,
        enableMetrics: false,
      },
    };
  }
}