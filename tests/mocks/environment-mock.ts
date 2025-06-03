import { IEnvironmentProvider } from '../../src/interfaces.js';

/**
 * 環境変数プロバイダーのモック実装
 * テスト用に使用される
 */
export class MockEnvironmentProvider implements IEnvironmentProvider {
  private env: Record<string, string>;

  constructor(env: Record<string, string> = {}) {
    this.env = {
      // デフォルトのテスト環境変数
      OPENAI_API_KEY: 'sk-test-key-1234567890abcdefghijklmnopqrstuvwxyz',
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      ...env,
    };
  }

  get(key: string): string | undefined {
    return this.env[key];
  }

  getRequired(key: string): string {
    const value = this.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  getAll(): Record<string, string> {
    return { ...this.env };
  }

  // テスト用ヘルパーメソッド
  set(key: string, value: string): void {
    this.env[key] = value;
  }

  unset(key: string): void {
    delete this.env[key];
  }

  reset(env?: Record<string, string>): void {
    this.env = env || {
      OPENAI_API_KEY: 'sk-test-key-1234567890abcdefghijklmnopqrstuvwxyz',
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
    };
  }

  clear(): void {
    this.env = {};
  }
}