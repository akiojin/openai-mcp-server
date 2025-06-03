import { CacheService } from '../../src/cache/cache-service.js';
import { CacheOptions } from '../../src/cache/interfaces.js';
import { ILogger } from '../../src/interfaces.js';

// モックロガー
const mockLogger: ILogger = {
  generateRequestId: jest.fn(() => 'test-request-id'),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  toolRequest: jest.fn(),
  toolResponse: jest.fn(),
  openaiRequest: jest.fn(),
  openaiResponse: jest.fn(),
  openaiError: jest.fn(),
};

describe('CacheService', () => {
  let cacheService: CacheService;
  let cacheOptions: CacheOptions;

  beforeEach(() => {
    cacheOptions = {
      defaultTtl: 1000,
      maxSize: 10,
      cleanupInterval: 0, // テスト中は自動クリーンアップを無効化
      enableLru: true,
    };
    cacheService = new CacheService(cacheOptions, mockLogger, true);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cacheService.dispose();
  });

  describe('Chat Completion キャッシュ', () => {
    test('Chat Completion結果をキャッシュと取得できる', () => {
      const model = 'gpt-4o';
      const messages = [{ role: 'user', content: 'Hello' }];
      const temperature = 0.7;
      const maxTokens = 1000;
      const result = { content: 'Hi there!', usage: { total_tokens: 10 }, model };

      // 最初はキャッシュに何もない
      expect(cacheService.getChatCompletion(model, messages, temperature, maxTokens)).toBeUndefined();

      // 結果をキャッシュに保存
      cacheService.setChatCompletion(model, messages, temperature, maxTokens, result);

      // キャッシュから取得できる
      const cached = cacheService.getChatCompletion(model, messages, temperature, maxTokens);
      expect(cached).toEqual(result);
    });

    test('異なるパラメータでは異なるキャッシュエントリを使用する', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result1 = { content: 'Response 1', model: 'gpt-4o' };
      const result2 = { content: 'Response 2', model: 'gpt-3.5-turbo' };

      cacheService.setChatCompletion('gpt-4o', messages, 0.7, 1000, result1);
      cacheService.setChatCompletion('gpt-3.5-turbo', messages, 0.7, 1000, result2);

      expect(cacheService.getChatCompletion('gpt-4o', messages, 0.7, 1000)).toEqual(result1);
      expect(cacheService.getChatCompletion('gpt-3.5-turbo', messages, 0.7, 1000)).toEqual(result2);
    });

    test('高い温度設定の場合はキャッシュしない', () => {
      const model = 'gpt-4o';
      const messages = [{ role: 'user', content: 'Hello' }];
      const temperature = 1.8; // 高い温度
      const maxTokens = 1000;
      const result = { content: 'Response', model };

      cacheService.setChatCompletion(model, messages, temperature, maxTokens, result);

      // 高い温度設定はキャッシュしないため、取得できない
      expect(cacheService.getChatCompletion(model, messages, temperature, maxTokens)).toBeUndefined();
    });

    test('カスタムTTLでキャッシュできる', async () => {
      const model = 'gpt-4o';
      const messages = [{ role: 'user', content: 'Hello' }];
      const temperature = 0.7;
      const maxTokens = 1000;
      const result = { content: 'Response', model };

      // 短いTTLでキャッシュ
      cacheService.setChatCompletion(model, messages, temperature, maxTokens, result, 100);

      // すぐには取得できる
      expect(cacheService.getChatCompletion(model, messages, temperature, maxTokens)).toEqual(result);

      // TTL経過後は取得できない
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cacheService.getChatCompletion(model, messages, temperature, maxTokens)).toBeUndefined();
    });
  });

  describe('Model List キャッシュ', () => {
    test('Model List結果をキャッシュと取得できる', () => {
      const result = {
        models: [
          { id: 'gpt-4o', created: '2024-01-01T00:00:00Z', owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', created: '2024-01-01T00:00:00Z', owned_by: 'openai' }
        ],
        count: 2
      };

      // 最初はキャッシュに何もない
      expect(cacheService.getModelList()).toBeUndefined();

      // 結果をキャッシュに保存
      cacheService.setModelList(result);

      // キャッシュから取得できる
      const cached = cacheService.getModelList();
      expect(cached).toEqual(result);
    });

    test('カスタムTTLでModel Listをキャッシュできる', async () => {
      const result = { models: [], count: 0 };

      // 短いTTLでキャッシュ
      cacheService.setModelList(result, 100);

      // すぐには取得できる
      expect(cacheService.getModelList()).toEqual(result);

      // TTL経過後は取得できない
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cacheService.getModelList()).toBeUndefined();
    });
  });

  describe('キャッシュ有効/無効制御', () => {
    test('キャッシュが無効の場合は何も保存・取得しない', () => {
      const disabledCacheService = new CacheService(cacheOptions, mockLogger, false);
      const model = 'gpt-4o';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Response', model };

      disabledCacheService.setChatCompletion(model, messages, 0.7, 1000, result);
      expect(disabledCacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();

      disabledCacheService.dispose();
    });

    test('実行時にキャッシュを無効化できる', () => {
      const model = 'gpt-4o';
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = { content: 'Response', model };

      // 最初は有効
      cacheService.setChatCompletion(model, messages, 0.7, 1000, result);
      expect(cacheService.getChatCompletion(model, messages, 0.7, 1000)).toEqual(result);

      // 無効化
      cacheService.setEnabled(false);
      expect(cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();

      // 再度有効化（キャッシュはクリアされている）
      cacheService.setEnabled(true);
      expect(cacheService.getChatCompletion(model, messages, 0.7, 1000)).toBeUndefined();
    });

    test('isEnabled メソッドで状態を確認できる', () => {
      expect(cacheService.isEnabled()).toBe(true);
      
      cacheService.setEnabled(false);
      expect(cacheService.isEnabled()).toBe(false);
      
      cacheService.setEnabled(true);
      expect(cacheService.isEnabled()).toBe(true);
    });
  });

  describe('汎用キャッシュ操作', () => {
    test('汎用のget/setメソッドが動作する', () => {
      cacheService.set('test-key', 'test-value');
      expect(cacheService.get('test-key')).toBe('test-value');
    });

    test('hasメソッドが正しく動作する', () => {
      cacheService.set('test-key', 'test-value');
      expect(cacheService.has('test-key')).toBe(true);
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    test('deleteメソッドが正しく動作する', () => {
      cacheService.set('test-key', 'test-value');
      expect(cacheService.delete('test-key')).toBe(true);
      expect(cacheService.get('test-key')).toBeUndefined();
      expect(cacheService.delete('nonexistent')).toBe(false);
    });

    test('sizeメソッドが正しい値を返す', () => {
      expect(cacheService.size()).toBe(0);
      
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      expect(cacheService.size()).toBe(2);
    });
  });

  describe('統計情報とメンテナンス', () => {
    test('統計情報を取得できる', () => {
      cacheService.set('key1', 'value1');
      cacheService.get('key1'); // ヒット
      cacheService.get('nonexistent'); // ミス

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    test('clearメソッドですべてのキャッシュを削除できる', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      expect(cacheService.size()).toBe(2);

      cacheService.clear();
      expect(cacheService.size()).toBe(0);
    });

    test('cleanupメソッドで期限切れアイテムを削除できる', async () => {
      cacheService.set('key1', 'value1', 100); // 短いTTL
      cacheService.set('key2', 'value2', 2000); // 長いTTL

      await new Promise(resolve => setTimeout(resolve, 150));

      cacheService.cleanup();
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('キー生成エラー時は警告ログを出力し、キャッシュしない', () => {
      // 循環参照のあるオブジェクトでエラーを発生させる
      const circularRef: any = { a: 1 };
      circularRef.self = circularRef;

      const messages = [{ role: 'user', content: 'Hello', data: circularRef }];

      cacheService.setChatCompletion('gpt-4o', messages, 0.7, 1000, { content: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error caching chat completion',
        expect.objectContaining({
          error: expect.any(String),
          model: 'gpt-4o',
          messageCount: 1,
        })
      );
    });

    test('キー生成エラー時の取得でも警告ログを出力する', () => {
      const circularRef: any = { a: 1 };
      circularRef.self = circularRef;
      const messages = [{ role: 'user', content: 'Hello', data: circularRef }];

      const result = cacheService.getChatCompletion('gpt-4o', messages, 0.7, 1000);

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error getting chat completion from cache',
        expect.objectContaining({
          error: expect.any(String),
          model: 'gpt-4o',
          messageCount: 1,
        })
      );
    });
  });
});