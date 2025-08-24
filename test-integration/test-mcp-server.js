#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// テスト結果を格納
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// カラーコード
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// テスト用のユーティリティ関数
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    log(`  ✓ ${name}`, colors.green);
  } else {
    testResults.failed++;
    log(`  ✗ ${name}`, colors.red);
    if (details) {
      log(`    ${details}`, colors.red);
    }
  }
}

// MCPサーバーとの通信
class MCPClient {
  constructor() {
    this.server = null;
    this.buffer = '';
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    const serverPath = join(dirname(__dirname), 'dist', 'index.js');
    
    if (!existsSync(serverPath)) {
      throw new Error(`Server not found at ${serverPath}. Run 'npm run build' first.`);
    }

    this.server = spawn('node', [serverPath], {
      env: { ...process.env },
      stdio: 'pipe'
    });

    this.server.stdout.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      
      lines.forEach(line => {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(message);
          } catch (e) {
            // JSON以外の出力は無視
          }
        }
      });
    });

    this.server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    // 初期化
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });
  }

  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    }
  }

  async sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');

      // タイムアウト設定
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 90000); // 90秒のタイムアウト（画像生成は最大1分程度かかる）
    });
  }

  async stop() {
    if (this.server) {
      this.server.stdin.end();
      await new Promise(resolve => {
        this.server.on('close', resolve);
        setTimeout(resolve, 1000);
      });
    }
  }
}

// テストの実行
async function runTests() {
  const client = new MCPClient();
  
  try {
    log('Starting MCP Server Integration Tests...', colors.yellow);
    log('=====================================\n');

    await client.start();
    log('Server started successfully\n');

    // Test 1: ツール一覧の取得
    log('Test: List Tools');
    try {
      const toolsResponse = await client.sendRequest('tools/list', {});
      const tools = toolsResponse.result?.tools || [];
      logTest('Should return tool list', tools.length > 0);
      logTest('Should include generate_image tool', 
        tools.some(t => t.name === 'generate_image'));
      logTest('Should include chat_completion tool', 
        tools.some(t => t.name === 'chat_completion'));
    } catch (error) {
      logTest('List tools request', false, error.message);
    }

    // Test 2: バージョン情報の取得
    log('\nTest: Get Version');
    try {
      const versionResponse = await client.sendRequest('tools/call', {
        name: 'get_version',
        arguments: {}
      });
      const content = versionResponse.result?.content?.[0]?.text;
      const versionData = content ? JSON.parse(content) : null;
      logTest('Should return version info', !!versionData?.version);
    } catch (error) {
      logTest('Get version request', false, error.message);
    }

    // Test 3: Chat Completion (parallel for all models)
    log('\nTest: Chat Completion (All Models - Parallel)');
    const testModels = ['gpt-4o-mini', 'gpt-4.1', 'gpt-5', 'gpt-5-mini'];
    
    const modelTests = testModels.map(async (model) => {
      try {
        const chatResponse = await client.sendRequest('tools/call', {
          name: 'chat_completion',
          arguments: {
            model: model,
            messages: [
              { role: 'user', content: 'Reply with exactly: TEST_OK' }
            ],
            temperature: 0,
            max_tokens: 10
          }
        });
        const chatContent = chatResponse.result?.content?.[0]?.text;
        const chatData = chatContent ? JSON.parse(chatContent) : null;
        
        return {
          model,
          success: !!chatData?.content,
          hasTestOK: chatData?.content?.includes('TEST_OK'),
          content: chatData?.content || null,
          error: null
        };
      } catch (error) {
        return {
          model,
          success: false,
          hasTestOK: false,
          content: null,
          error: error.message
        };
      }
    });
    
    const results = await Promise.all(modelTests);
    
    results.forEach(result => {
      if (result.error) {
        logTest(`${result.model}: Chat completion`, false, result.error);
      } else {
        logTest(`${result.model}: Chat completion`, result.success);
        if (result.success) {
          logTest(`${result.model}: Returns TEST_OK`, result.hasTestOK);
        }
      }
    });

    // Test 4: 画像生成テスト（デフォルトはスキップ、INCLUDE_IMAGE_TESTSで有効化）
    const includeImageTests = process.env.INCLUDE_IMAGE_TESTS === 'true';
    
    if (!includeImageTests) {
      log('\nTest: Generate Image - SKIPPED (use npm run test:integration:all to include)');
    } else {
      log('\nTest: Generate Image (Basic)');
      try {
        const imageResponse = await client.sendRequest('tools/call', {
          name: 'generate_image',
          arguments: {
            prompt: 'A simple test image'
          }
        });
        const content = imageResponse.result?.content?.[0]?.text;
        const imageData = content ? JSON.parse(content) : null;
        
        console.log('Image generation response:', JSON.stringify(imageData, null, 2));
        
        if (imageData?.error) {
          logTest('Should generate image without error', false, imageData.error);
        } else {
          logTest('Should generate image', !!imageData);
          logTest('Should return file paths', imageData?.file_paths?.length > 0, 
            `Got: ${JSON.stringify(imageData)}`)
        }
      } catch (error) {
        logTest('Generate image request', false, error.message);
      }
    }

    // Test 5: エラーハンドリング（プロンプトなし）
    log('\nTest: Error Handling');
    try {
      const errorResponse = await client.sendRequest('tools/call', {
        name: 'generate_image',
        arguments: {}
      });
      const content = errorResponse.result?.content?.[0]?.text;
      const errorData = content ? JSON.parse(content) : null;
      logTest('Should handle missing prompt error', errorData?.error === 'prompt is required');
    } catch (error) {
      logTest('Error handling test', false, error.message);
    }

    // テスト結果のサマリー
    log('\n=====================================');
    log(`Total Tests: ${testResults.passed + testResults.failed}`);
    log(`Passed: ${testResults.passed}`, colors.green);
    log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? colors.red : colors.green);
    
    await client.stop();
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\nFatal error: ${error.message}`, colors.red);
    await client.stop();
    process.exit(1);
  }
}

// APIキーのチェック
if (!process.env.OPENAI_API_KEY) {
  log('Error: OPENAI_API_KEY environment variable is required', colors.red);
  process.exit(1);
}

// テスト実行
runTests().catch(error => {
  log(`Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});