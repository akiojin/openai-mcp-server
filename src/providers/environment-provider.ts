import { IEnvironmentProvider } from '../interfaces.js';

/**
 * 環境変数へのアクセスを抽象化するプロバイダー
 * テスト時にはモック実装と置き換え可能
 */
export class EnvironmentProvider implements IEnvironmentProvider {
  private env: Record<string, string>;

  constructor(env: Record<string, string> = process.env as Record<string, string>) {
    this.env = env;
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
}
