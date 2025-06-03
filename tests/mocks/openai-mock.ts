import { IOpenAIClient } from '../../src/interfaces.js';
import type { 
  ChatCompletion, 
  ModelsPage, 
  ChatCompletionCreateParamsNonStreaming 
} from 'openai/resources/index.js';

/**
 * OpenAI クライアントのモック実装
 * テスト用に使用される
 */
export class MockOpenAIClient implements IOpenAIClient {
  private shouldThrowError = false;
  private mockError: Error | null = null;
  private mockChatResponse: ChatCompletion | null = null;
  private mockModelsResponse: ModelsPage | null = null;

  constructor() {
    // デフォルトのモックレスポンス
    this.mockChatResponse = this.createDefaultChatResponse();
    this.mockModelsResponse = this.createDefaultModelsResponse();
  }

  // モック設定メソッド
  setError(error: Error): void {
    this.shouldThrowError = true;
    this.mockError = error;
  }

  setChatResponse(response: ChatCompletion): void {
    this.mockChatResponse = response;
    this.shouldThrowError = false;
  }

  setModelsResponse(response: ModelsPage): void {
    this.mockModelsResponse = response;
    this.shouldThrowError = false;
  }

  reset(): void {
    this.shouldThrowError = false;
    this.mockError = null;
    this.mockChatResponse = this.createDefaultChatResponse();
    this.mockModelsResponse = this.createDefaultModelsResponse();
  }

  // インターフェース実装
  get chat() {
    return {
      completions: {
        create: async (params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> => {
          if (this.shouldThrowError && this.mockError) {
            throw this.mockError;
          }
          
          if (!this.mockChatResponse) {
            throw new Error('No mock response set');
          }

          // モデル名をリクエストパラメータから設定
          this.mockChatResponse.model = params.model;
          
          return this.mockChatResponse;
        },
      },
    };
  }

  get models() {
    return {
      list: async (): Promise<ModelsPage> => {
        if (this.shouldThrowError && this.mockError) {
          throw this.mockError;
        }
        
        if (!this.mockModelsResponse) {
          throw new Error('No mock models response set');
        }
        
        return this.mockModelsResponse;
      },
    };
  }

  // デフォルトレスポンス作成
  private createDefaultChatResponse(): ChatCompletion {
    return {
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4.1',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response',
            refusal: null,
          },
          logprobs: null,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      system_fingerprint: 'test-fingerprint',
    };
  }

  private createDefaultModelsResponse(): ModelsPage {
    const mockPage = {
      object: 'list',
      data: [
        {
          id: 'gpt-4.1',
          object: 'model',
          created: 1735862400,
          owned_by: 'openai',
        },
        {
          id: 'gpt-4.1-mini',
          object: 'model',
          created: 1735862400,
          owned_by: 'openai',
        },
        {
          id: 'gpt-4.1-nano',
          object: 'model',
          created: 1735862400,
          owned_by: 'openai',
        },
        {
          id: 'gpt-4o',
          object: 'model',
          created: 1715731200,
          owned_by: 'openai',
        },
        {
          id: 'o1',
          object: 'model',
          created: 1726185600,
          owned_by: 'openai',
        },
        {
          id: 'o1-pro',
          object: 'model',
          created: 1733433600,
          owned_by: 'openai',
        },
        {
          id: 'o3',
          object: 'model',
          created: 1744569600,
          owned_by: 'openai',
        },
        {
          id: 'o4-mini',
          object: 'model',
          created: 1744569600,
          owned_by: 'openai',
        },
      ],
    } as ModelsPage;
    return mockPage;
  }
}