import { CacheKeyGenerator } from '../../src/cache/cache-key-generator.js';

describe('CacheKeyGenerator', () => {
  let generator: CacheKeyGenerator;

  beforeEach(() => {
    generator = new CacheKeyGenerator();
  });

  describe('Chat Completion キー生成', () => {
    test('同じパラメータで同じキーを生成する', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7, 1000);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^chat_completion:/);
    });

    test('異なるパラメータで異なるキーを生成する', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-3.5-turbo', messages, 0.7, 1000);
      const key3 = generator.generateChatCompletionKey('gpt-4o', messages, 0.8, 1000);
      const key4 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7, 1500);
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
    });

    test('メッセージの順序が異なると異なるキーを生成する', () => {
      const messages1 = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];
      const messages2 = [
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Hello' }
      ];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages1, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-4o', messages2, 0.7, 1000);
      
      expect(key1).not.toBe(key2);
    });

    test('メッセージ内容の空白の違いを正規化する', () => {
      const messages1 = [{ role: 'user', content: 'Hello world' }];
      const messages2 = [{ role: 'user', content: '  Hello world  ' }];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages1, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-4o', messages2, 0.7, 1000);
      
      expect(key1).toBe(key2);
    });

    test('温度パラメータの小数点精度を正規化する', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-4o', messages, 0.7000001, 1000);
      
      expect(key1).toBe(key2);
    });

    test('追加のメッセージプロパティを考慮する', () => {
      const messages1 = [{ role: 'user', content: 'Hello' }];
      const messages2 = [{ role: 'user', content: 'Hello', name: 'John' }];
      
      const key1 = generator.generateChatCompletionKey('gpt-4o', messages1, 0.7, 1000);
      const key2 = generator.generateChatCompletionKey('gpt-4o', messages2, 0.7, 1000);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Model List キー生成', () => {
    test('同じ日付で同じキーを生成する', () => {
      const key1 = generator.generateModelListKey();
      const key2 = generator.generateModelListKey();
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^models_list:/);
    });

    test('日付が変わると異なるキーを生成する', () => {
      // 現在の日付のキーを生成
      const key1 = generator.generateModelListKey();
      
      // Date.prototype.toISOString をモック
      const originalDate = Date.prototype.toISOString;
      Date.prototype.toISOString = jest.fn(() => '2024-01-02T00:00:00.000Z');
      
      const key2 = generator.generateModelListKey();
      
      // モックを復元
      Date.prototype.toISOString = originalDate;
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('汎用キー生成', () => {
    test('オブジェクトから一貫したキーを生成する', () => {
      const params = { model: 'gpt-4o', temperature: 0.7, tokens: 1000 };
      
      const key1 = generator.generateKey('test', params);
      const key2 = generator.generateKey('test', params);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^test:/);
    });

    test('プロパティの順序に関係なく同じキーを生成する', () => {
      const params1 = { model: 'gpt-4o', temperature: 0.7, tokens: 1000 };
      const params2 = { tokens: 1000, model: 'gpt-4o', temperature: 0.7 };
      
      const key1 = generator.generateKey('test', params1);
      const key2 = generator.generateKey('test', params2);
      
      expect(key1).toBe(key2);
    });

    test('ネストしたオブジェクトを正しく処理する', () => {
      const params1 = {
        model: 'gpt-4o',
        config: { temperature: 0.7, maxTokens: 1000 }
      };
      const params2 = {
        model: 'gpt-4o',
        config: { maxTokens: 1000, temperature: 0.7 }
      };
      
      const key1 = generator.generateKey('test', params1);
      const key2 = generator.generateKey('test', params2);
      
      expect(key1).toBe(key2);
    });

    test('配列の順序を保持する', () => {
      const params1 = { items: [1, 2, 3] };
      const params2 = { items: [3, 2, 1] };
      
      const key1 = generator.generateKey('test', params1);
      const key2 = generator.generateKey('test', params2);
      
      expect(key1).not.toBe(key2);
    });

    test('null と undefined を正しく処理する', () => {
      const params1 = { value: null };
      const params2 = { value: undefined };
      const params3 = {};
      
      const key1 = generator.generateKey('test', params1);
      const key2 = generator.generateKey('test', params2);
      const key3 = generator.generateKey('test', params3);
      
      expect(key1).toBe(key2); // null と undefined は同じに扱われる
      expect(key1).not.toBe(key3); // プロパティがないのとは異なる
    });
  });

  describe('キーの妥当性', () => {
    test('生成されたキーが妥当な形式である', () => {
      const key = generator.generateChatCompletionKey(
        'gpt-4o',
        [{ role: 'user', content: 'Hello' }],
        0.7,
        1000
      );
      
      expect(CacheKeyGenerator.isValidCacheKey(key)).toBe(true);
    });

    test('長すぎるキーは無効とする', () => {
      const longKey = 'a'.repeat(600);
      expect(CacheKeyGenerator.isValidCacheKey(longKey)).toBe(false);
    });

    test('無効な文字を含むキーは無効とする', () => {
      const invalidKey = 'test:key with spaces';
      expect(CacheKeyGenerator.isValidCacheKey(invalidKey)).toBe(false);
    });
  });

  describe('キャッシュ可能性判定', () => {
    test('通常のリクエストはキャッシュ可能', () => {
      const args = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000
      };
      
      expect(CacheKeyGenerator.shouldCache(args)).toBe(true);
    });

    test('ストリーミングが有効な場合はキャッシュしない', () => {
      const args = {
        stream: true,
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      expect(CacheKeyGenerator.shouldCache(args)).toBe(false);
    });

    test('関数呼び出しが含まれる場合はキャッシュしない', () => {
      const args = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        functions: [{ name: 'test_function' }]
      };
      
      expect(CacheKeyGenerator.shouldCache(args)).toBe(false);
    });

    test('高い温度設定の場合はキャッシュしない', () => {
      const args = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.8
      };
      
      expect(CacheKeyGenerator.shouldCache(args)).toBe(false);
    });

    test('ツール使用が含まれる場合はキャッシュしない', () => {
      const args = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ type: 'function', function: { name: 'test' } }]
      };
      
      expect(CacheKeyGenerator.shouldCache(args)).toBe(false);
    });
  });
});