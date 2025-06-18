import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletion,
  ModelsPage,
} from 'openai/resources/index.js';
import type { ImagesResponse } from 'openai/resources/images.js';
import type { ImageGenerateParams } from 'openai/resources/images.js';
import type { CacheStats } from './cache/interfaces.js';

/**
 * 依存性注入パターンのためのインターフェース定義
 */

/**
 * OpenAI APIクライアントのインターフェース
 */
export interface IOpenAIClient {
  chat: {
    completions: {
      create(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
    };
  };
  models: {
    list(): Promise<ModelsPage>;
  };
  images: {
    generate(params: ImageGenerateParams): Promise<ImagesResponse>;
  };
}

/**
 * ロガーのインターフェース
 */
export interface ILogger {
  generateRequestId(): string;
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
  toolRequest(toolName: string, requestId: string, args?: unknown): void;
  toolResponse(
    toolName: string,
    requestId: string,
    success: boolean,
    duration: number,
    context?: any
  ): void;
  openaiRequest(requestId: string, model: string, tokenCount?: number): void;
  openaiResponse(
    requestId: string,
    model: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    duration: number
  ): void;
  openaiError(
    requestId: string,
    model: string,
    error: Error,
    statusCode?: number,
    duration?: number
  ): void;
}

/**
 * 設定管理のインターフェース
 */
export interface IConfigManager {
  getConfig(): any;
  get<T>(section: string): T;
  updateConfig(updates: any): void;
  reloadConfig(): void;
}

/**
 * 環境変数管理のインターフェース
 */
export interface IEnvironmentProvider {
  get(key: string): string | undefined;
  getRequired(key: string): string;
  getAll(): Record<string, string>;
}

/**
 * キャッシュサービスのインターフェース
 */
export interface ICacheService {
  getChatCompletion(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number
  ): Promise<any | undefined>;
  setChatCompletion(
    model: string,
    messages: any[],
    temperature: number,
    maxTokens: number,
    result: any,
    ttl?: number
  ): Promise<void>;
  getModelList(): Promise<any | undefined>;
  setModelList(result: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  cleanup(): Promise<void>;
  dispose(): Promise<void>;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  get(key: string): Promise<any | undefined>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}

/**
 * チャット補完のリクエストパラメータ
 */
export interface ChatCompletionArgs {
  model?: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * ツール実行のコンテキスト
 */
export interface ToolExecutionContext {
  openaiClient: IOpenAIClient;
  logger: ILogger;
  config: IConfigManager;
  environmentProvider: IEnvironmentProvider;
  cacheService?: ICacheService;
}

/**
 * MCP ツールハンドラーのインターフェース
 */
export interface IToolHandler {
  execute(args: any, context: ToolExecutionContext): Promise<any>;
}

/**
 * 依存性注入コンテナのインターフェース
 */
export interface IDependencyContainer {
  getOpenAIClient(): IOpenAIClient;
  getLogger(): ILogger;
  getConfigManager(): IConfigManager;
  getEnvironmentProvider(): IEnvironmentProvider;
  getCacheService(): ICacheService;
  getToolHandler(toolName: string): IToolHandler | undefined;
  registerToolHandler(toolName: string, handler: IToolHandler): void;
}
