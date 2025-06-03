# 依存性注入パターンの実装

## 概要

OpenAI MCP サーバーにおいて、テスタビリティと保守性を向上させるために依存性注入（Dependency Injection: DI）パターンを実装しました。

## 実装内容

### 1. インターフェース層の作成

以下のインターフェースを定義しました：

- `IOpenAIClient`: OpenAI APIクライアントの抽象化
- `ILogger`: ログシステムの抽象化  
- `IConfigManager`: 設定管理の抽象化
- `IEnvironmentProvider`: 環境変数アクセスの抽象化
- `IToolHandler`: ツールハンドラーの抽象化
- `IDependencyContainer`: 依存性注入コンテナの抽象化

### 2. アダプターパターンの実装

既存のコンポーネントをインターフェースに適合させるアダプターを作成しました：

- `OpenAIAdapter`: OpenAI SDKのラッパー
- `LoggerAdapter`: 既存ロガーのラッパー
- `ConfigAdapter`: 既存設定管理のラッパー

### 3. プロバイダーの実装

- `EnvironmentProvider`: 環境変数へのアクセスを抽象化

### 4. ツールハンドラーの分離

ツール固有のロジックを独立したハンドラーに分離しました：

- `ChatCompletionTool`: チャット補完ツール
- `ListModelsTool`: モデル一覧ツール

### 5. 依存性注入コンテナ

すべての依存関係を管理する`DependencyContainer`を実装しました。

## ファイル構成

```text
src/
├── interfaces.ts                     # インターフェース定義
├── container/
│   └── dependency-container.ts      # DIコンテナ
├── adapters/
│   ├── openai-adapter.ts           # OpenAIアダプター
│   ├── logger-adapter.ts           # ロガーアダプター
│   └── config-adapter.ts           # 設定アダプター
├── providers/
│   └── environment-provider.ts     # 環境変数プロバイダー
└── tools/
    ├── chat-completion-tool.ts     # チャット補完ツール
    └── list-models-tool.ts         # モデル一覧ツール

tests/
├── mocks/                          # テスト用モック
│   ├── openai-mock.ts
│   ├── logger-mock.ts
│   ├── config-mock.ts
│   └── environment-mock.ts
├── di/
│   └── dependency-container.test.ts
├── tools/
│   ├── chat-completion-tool.test.ts
│   └── list-models-tool.test.ts
└── integration/
    ├── di-integration.test.ts
    └── server-initialization.test.ts
```

## 使用方法

### 基本的な使用

```typescript
import { DependencyContainer } from './container/dependency-container.js';

// コンテナを初期化
const container = new DependencyContainer();

// 依存関係を取得
const logger = container.getLogger();
const config = container.getConfigManager();
const openaiClient = container.getOpenAIClient();

// ツールハンドラーを取得
const chatTool = container.getToolHandler('chat_completion');
```

### テストでの使用

```typescript
import { DependencyContainer } from './container/dependency-container.js';
import { MockOpenAIClient } from '../tests/mocks/openai-mock.js';

// テスト用コンテナ
const container = new DependencyContainer();

// モックを注入
const mockClient = new MockOpenAIClient();
container.setOpenAIClient(mockClient);

// テスト実行
const tool = container.getToolHandler('chat_completion');
const result = await tool.execute(args, context);
```

### カスタムツールの登録

```typescript
const customTool = {
  execute: async (args, context) => {
    // カスタムツールの実装
    return { result: 'custom response' };
  }
};

container.registerToolHandler('custom_tool', customTool);
```

## 利点

### テスタビリティの向上

- 各コンポーネントが独立してテスト可能
- モックオブジェクトの簡単な注入
- ユニットテストの分離性向上

### 保守性の向上

- 疎結合なアーキテクチャ
- 単一責任原則の遵守
- 変更の影響範囲の局所化

### 拡張性の向上

- 新しいツールの追加が容易
- 異なる実装への切り替えが可能
- プラグインアーキテクチャへの発展可能性

## 後方互換性

- 既存の外部APIは変更なし
- 既存の設定ファイルは引き続き使用可能
- 環境変数による設定は継続サポート

## パフォーマンス

- シングルトンパターンによる効率的なインスタンス管理
- 遅延初期化による起動時間の最適化
- メモリ使用量の最小化

## セキュリティ

- 環境変数の適切な検証
- APIキーの安全な管理
- エラー情報の適切なマスキング

## 今後の拡張可能性

1. **設定の動的変更**: ランタイムでの設定変更サポート
2. **プラグインシステム**: 外部ツールの動的読み込み
3. **マルチテナント対応**: テナント毎の依存関係分離
4. **メトリクス収集**: 依存関係レベルでの監視
5. **トランザクション管理**: データベース等のトランザクション対応

## 開発ガイドライン

### 新しい依存関係の追加

1. インターフェースを`interfaces.ts`に定義
2. 実装クラスを適切なディレクトリに配置
3. DIコンテナにファクトリメソッドを追加
4. モック実装をテスト用に作成
5. ユニットテストを作成

### テストの作成

1. モックオブジェクトを使用
2. 依存関係を明示的に注入
3. 各機能を独立してテスト
4. 統合テストで全体フローを確認

## トラブルシューティング

### 初期化エラー

- 環境変数の設定を確認
- APIキーの形式を確認
- 設定ファイルの構文を確認

### テストエラー

- モックの設定を確認
- 依存関係の注入順序を確認
- 非同期処理の適切な待機を確認
