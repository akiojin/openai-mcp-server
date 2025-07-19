# テストガイド

このドキュメントでは、OpenAI MCPサーバーのテスト方法について説明します。

## 前提条件

- Node.js 18以上
- OpenAI APIキー（環境変数 `OPENAI_API_KEY` に設定）
- npm または yarn

## MCP Inspectorを使用した手動テスト

MCP Inspectorは、MCPサーバーを対話的にテストするための公式ツールです。

### インストール

```bash
npm install -g @modelcontextprotocol/inspector
```

### 基本的な使用方法

1. **サーバーのビルド**

```bash
npm run build
```

2. **MCP Inspectorでサーバーを起動**

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

これにより、ブラウザが開き、対話的なUIでMCPサーバーをテストできます。

3. **CLIモードでの使用**

特定のツールを直接呼び出す場合：

```bash
# ツール一覧を表示
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list

# generate_imageツールを呼び出し
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/call --tool-name generate_image --params '{"prompt": "A beautiful sunset"}'
```

### generate_image機能のテスト例

1. MCP Inspectorを起動
2. 左側のツールリストから `generate_image` を選択
3. パラメータを入力：
   - prompt: "A beautiful sunset over mountains"
   - size: "1024x1024"
   - quality: "standard"
4. "Call Tool" ボタンをクリック
5. 生成された画像ファイルのパスが返される

## ユニットテスト

```bash
# テストの実行
npm test

# カバレッジ付きテスト
npm run test:coverage
```

## 統合テスト

統合テストスクリプトは `test-integration/` ディレクトリにあります。

```bash
# 統合テストの実行
npm run test:integration
```

## トラブルシューティング

### エラー: "Unknown parameter: 'response_format'"

このエラーは、特定のモデルでサポートされていないパラメータを使用した場合に発生します。
最新のコードではこの問題は修正されています。

### エラー: "Invalid API key"

環境変数 `OPENAI_API_KEY` が正しく設定されているか確認してください：

```bash
echo $OPENAI_API_KEY
```

### 画像が生成されない

- APIキーに画像生成の権限があるか確認
- 使用しているモデルが画像生成をサポートしているか確認
- プロンプトが適切な長さと内容であるか確認

## 継続的インテグレーション（CI）

GitHub Actionsでの自動テストは `.github/workflows/` で設定されています。
プルリクエスト時に自動的にテストが実行されます。