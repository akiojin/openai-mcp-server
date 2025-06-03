import { IConfigManager } from '../interfaces.js';
import { ConfigManager } from '../config.js';

/**
 * 設定管理のアダプター実装
 * 既存のConfigManagerクラスをIConfigManagerインターフェースでラップ
 */
export class ConfigAdapter implements IConfigManager {
  private configManager: ConfigManager;

  constructor(configManager?: ConfigManager) {
    // 引数で渡されない場合は既存のシングルトンインスタンスを使用
    this.configManager = configManager || ConfigManager.getInstance();
  }

  getConfig(): any {
    return this.configManager.getConfig();
  }

  get<T>(section: string): T {
    return this.configManager.get(section as any);
  }

  updateConfig(updates: any): void {
    this.configManager.updateConfig(updates);
  }

  reloadConfig(): void {
    this.configManager.reloadConfig();
  }
}
