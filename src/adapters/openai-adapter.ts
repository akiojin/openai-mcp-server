import OpenAI from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletion,
  ModelsPage,
} from 'openai/resources/index.js';
import { IOpenAIClient } from '../interfaces.js';

/**
 * OpenAI クライアントのアダプター実装
 * 実際のOpenAIクライアントをIOpenAIClientインターフェースでラップ
 */
export class OpenAIAdapter implements IOpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string, options?: ConstructorParameters<typeof OpenAI>[0]) {
    this.client = new OpenAI({
      apiKey,
      ...options,
    });
  }

  get chat() {
    return {
      completions: {
        create: (params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> => {
          return this.client.chat.completions.create(params);
        },
      },
    };
  }

  get models() {
    return {
      list: (): Promise<ModelsPage> => {
        return this.client.models.list();
      },
    };
  }

  /**
   * 内部のOpenAIクライアントインスタンスを取得
   * 必要に応じて直接アクセスするため
   */
  getInternalClient(): OpenAI {
    return this.client;
  }
}
