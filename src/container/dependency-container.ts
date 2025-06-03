import {
  IDependencyContainer,
  IOpenAIClient,
  ILogger,
  IConfigManager,
  IEnvironmentProvider,
  ICacheService,
  IToolHandler,
} from '../interfaces.js';
import { OpenAIAdapter } from '../adapters/openai-adapter.js';
import { LoggerAdapter } from '../adapters/logger-adapter.js';
import { ConfigAdapter } from '../adapters/config-adapter.js';
import { EnvironmentProvider } from '../providers/environment-provider.js';
import { ChatCompletionTool } from '../tools/chat-completion-tool.js';
import { ListModelsTool } from '../tools/list-models-tool.js';
import { EnvironmentValidator } from '../env-validator.js';
import { CacheService } from '../cache/cache-service.js';
import { CacheConfig } from '../cache/interfaces.js';

/**
 * 依存性注入コンテナ
 * すべての依存関係を管理し、適切にインスタンスを提供する
 */
export class DependencyContainer implements IDependencyContainer {
  private openaiClient?: IOpenAIClient;
  private logger?: ILogger;
  private configManager?: IConfigManager;
  private environmentProvider?: IEnvironmentProvider;
  private cacheService?: ICacheService;
  private toolHandlers: Map<string, IToolHandler> = new Map();

  constructor() {
    this.initializeToolHandlers();
  }

  /**
   * OpenAI クライアントのインスタンスを取得
   */
  getOpenAIClient(): IOpenAIClient {
    if (!this.openaiClient) {
      const envProvider = this.getEnvironmentProvider();

      // APIキーの取得
      const apiKey = envProvider.get('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('Environment validation failed: OPENAI_API_KEY is required');
      }

      // API キー形式の検証
      if (!EnvironmentValidator.validateApiKey(apiKey)) {
        const sanitizedKey = EnvironmentValidator.sanitizeApiKeyForLogging(apiKey);
        throw new Error(`Invalid OpenAI API key format: ${sanitizedKey}`);
      }

      this.openaiClient = new OpenAIAdapter(apiKey);
    }
    return this.openaiClient;
  }

  /**
   * ロガーのインスタンスを取得
   */
  getLogger(): ILogger {
    if (!this.logger) {
      this.logger = new LoggerAdapter();
    }
    return this.logger;
  }

  /**
   * 設定管理のインスタンスを取得
   */
  getConfigManager(): IConfigManager {
    if (!this.configManager) {
      this.configManager = new ConfigAdapter();
    }
    return this.configManager;
  }

  /**
   * 環境変数プロバイダーのインスタンスを取得
   */
  getEnvironmentProvider(): IEnvironmentProvider {
    if (!this.environmentProvider) {
      this.environmentProvider = new EnvironmentProvider();
    }
    return this.environmentProvider;
  }

  /**
   * キャッシュサービスのインスタンスを取得
   */
  getCacheService(): ICacheService {
    if (!this.cacheService) {
      const config = this.getConfigManager();

      // キャッシュ設定を取得
      const cacheConfig = config.get('cache') as any;
      const performanceConfig = config.get('performance') as any;

      const cacheOptions: CacheConfig = {
        enabled: cacheConfig?.enabled !== false && performanceConfig?.enableCaching !== false,
        ttl: cacheConfig?.ttl || performanceConfig?.cacheExpiry || 300000, // 5分
        maxSize: cacheConfig?.maxSize || 1000,
        strategy: cacheConfig?.strategy || 'LRU',
      };

      this.cacheService = new CacheService(cacheOptions);
    }
    return this.cacheService;
  }

  /**
   * ツールハンドラーを取得
   */
  getToolHandler(toolName: string): IToolHandler | undefined {
    return this.toolHandlers.get(toolName);
  }

  /**
   * ツールハンドラーを登録
   */
  registerToolHandler(toolName: string, handler: IToolHandler): void {
    this.toolHandlers.set(toolName, handler);
  }

  /**
   * 依存関係を手動で設定（主にテスト用）
   */
  setOpenAIClient(client: IOpenAIClient): void {
    this.openaiClient = client;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  setConfigManager(configManager: IConfigManager): void {
    this.configManager = configManager;
  }

  setEnvironmentProvider(environmentProvider: IEnvironmentProvider): void {
    this.environmentProvider = environmentProvider;
  }

  setCacheService(cacheService: ICacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * デフォルトのツールハンドラーを初期化
   */
  private initializeToolHandlers(): void {
    this.registerToolHandler('chat_completion', new ChatCompletionTool());
    this.registerToolHandler('list_models', new ListModelsTool());
  }

  /**
   * コンテナをリセット（主にテスト用）
   */
  async reset(): Promise<void> {
    // キャッシュサービスを破棄
    if (this.cacheService) {
      await this.cacheService.dispose();
    }

    this.openaiClient = undefined;
    this.logger = undefined;
    this.configManager = undefined;
    this.environmentProvider = undefined;
    this.cacheService = undefined;
    this.toolHandlers.clear();
    this.initializeToolHandlers();
  }
}
