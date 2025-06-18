#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  quality?: string;
  background?: string;
  [key: string]: unknown;
}

interface ImageGenerationResponse {
  data: Array<{ b64_json?: string }>;
}

interface OpenAIErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

// package.jsonからバージョン情報を読み込む
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const version = packageJson.version;

dotenv.config();

// OpenAI API キーの確認
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// OpenAIクライアントの初期化
const openai = new OpenAI({ apiKey });

// サーバーの初期化
const server = new Server(
  {
    name: 'openai-mcp-server',
    version: version,
    description: 'A simple MCP server for OpenAI API integration',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール一覧のハンドラー
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'chat_completion',
        description:
          'Generate text responses using OpenAI ChatGPT models. **IMPORTANT: This tool should ONLY be used when users explicitly include trigger phrases in their request.** REQUIRED TRIGGER PHRASES: "Ask ChatGPT:", "GPT:", "OpenAI:", "Hey ChatGPT!", or "Use OpenAI to". Do NOT use this tool for general questions without these explicit triggers.',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description:
                'OpenAI model to use. Choose "gpt-4.1" for best coding, "gpt-4.1-mini" for faster/cheaper, "o1" for reasoning, "o3" for advanced reasoning. Default is "gpt-4.1".',
              default: 'gpt-4.1',
            },
            messages: {
              type: 'array',
              description: 'Conversation history as message objects with role and content.',
              items: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['system', 'user', 'assistant'],
                  },
                  content: {
                    type: 'string',
                  },
                },
                required: ['role', 'content'],
              },
            },
            temperature: {
              type: 'number',
              description: 'Controls randomness (0.0-2.0). Default: 0.7',
              default: 0.7,
              minimum: 0,
              maximum: 2,
            },
            max_tokens: {
              type: 'number',
              description: 'Maximum tokens to generate. Default: 1000',
              default: 1000,
            },
          },
          required: ['messages'],
        },
      },
      {
        name: 'list_models',
        description:
          'Retrieve available OpenAI models. **IMPORTANT: Use only when explicitly requested.** REQUIRED TRIGGER PHRASES: "What OpenAI models", "List GPT models", "Show OpenAI models".',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'generate_image',
        description:
          'Generate images using gpt-image-1 model. Returns file paths for generated images saved in temporary directory. REQUIRED TRIGGER PHRASES: "Generate image", "Create image", "Draw", "Picture of", "Image of", "GPT-image".',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description:
                'A text description of the desired image(s). Maximum length is 1000 characters.',
            },
            model: {
              type: 'string',
              description: 'The model to use for image generation. Default is "gpt-image-1".',
              default: 'gpt-image-1',
            },
            n: {
              type: 'number',
              description: 'Number of images to generate. Must be between 1 and 10. Default is 1.',
              default: 1,
              minimum: 1,
              maximum: 10,
            },
            size: {
              type: 'string',
              description:
                'Size of the generated images. Must be one of "1024x1024", "1024x1536", "1536x1024", or "auto". Default is "1024x1024".',
              default: '1024x1024',
              enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
            },
            quality: {
              type: 'string',
              description:
                'Quality of the image. "low", "medium", "high", or "auto". Default is "auto".',
              default: 'auto',
              enum: ['low', 'medium', 'high', 'auto'],
            },
            background: {
              type: 'string',
              description: 'Background type. "opaque" or "transparent". Default is "opaque".',
              default: 'opaque',
              enum: ['opaque', 'transparent'],
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'get_version',
        description: 'Get the version number of this MCP server.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// ツール実行のハンドラー
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'chat_completion': {
        const chatArgs = args as {
          messages?: unknown;
          model?: string;
          temperature?: number;
          max_tokens?: number;
        };
        // 引数の検証
        if (!chatArgs || !chatArgs.messages || !Array.isArray(chatArgs.messages)) {
          return {
            error: {
              code: 'INVALID_ARGUMENTS',
              message: 'messages array is required',
            },
          };
        }

        // APIリクエスト
        const completion = await openai.chat.completions.create({
          model: chatArgs.model || 'gpt-4.1',
          messages: chatArgs.messages,
          temperature: chatArgs.temperature ?? 0.7,
          max_tokens: chatArgs.max_tokens ?? 1000,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                content: completion.choices[0]?.message?.content || '',
                usage: completion.usage,
                model: completion.model,
              }),
            },
          ],
        };
      }

      case 'list_models': {
        // モデル一覧を取得
        const modelsResponse = await openai.models.list();

        // ChatGPT関連モデルのみフィルタリング
        const chatModels = modelsResponse.data
          .filter(
            model =>
              model.id.includes('gpt') ||
              model.id.includes('o1') ||
              model.id.includes('o3') ||
              model.id.includes('o4')
          )
          .map(model => ({
            id: model.id,
            created: new Date(model.created * 1000).toISOString(),
            owned_by: model.owned_by,
          }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                models: chatModels,
                count: chatModels.length,
              }),
            },
          ],
        };
      }

      case 'generate_image': {
        const imageArgs = args as {
          prompt?: string;
          model?: string;
          n?: number;
          size?: string;
          quality?: string;
          background?: string;
        };
        // 引数の検証
        if (!imageArgs || !imageArgs.prompt) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'prompt is required',
                }),
              },
            ],
          };
        }

        try {
          // 直接HTTPリクエストでOpenAI APIを呼び出す
          const url = 'https://api.openai.com/v1/images/generations';
          const requestBody: ImageGenerationRequest = {
            prompt: imageArgs.prompt,
            model: imageArgs.model || 'gpt-image-1',
            n: imageArgs.n || 1,
            size: imageArgs.size || '1024x1024',
          };

          // オプションパラメータ
          if (imageArgs.quality) {
            requestBody.quality = imageArgs.quality;
          }

          // backgroundパラメータがある合は追加
          if (imageArgs.background) {
            requestBody.background = imageArgs.background;
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = (await response.json()) as OpenAIErrorResponse;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: errorData.error?.message || 'Image generation failed',
                  }),
                },
              ],
            };
          }

          const data = (await response.json()) as ImageGenerationResponse;

          // Base64形式の画像をテンポラリファイルに保存
          const filePaths: string[] = [];
          const images = data.data || [];
          const timestamp = Date.now();

          for (let i = 0; i < images.length; i++) {
            const imageData = images[i];
            if (imageData.b64_json) {
              // Base64をBufferに変換
              const buffer = Buffer.from(imageData.b64_json, 'base64');

              // テンポラリディレクトリにファイルを保存
              const fileName = `openai_generated_image_${timestamp}_${i + 1}.png`;
              const filePath = join(tmpdir(), fileName);

              writeFileSync(filePath, buffer);
              filePaths.push(filePath);
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  file_paths: filePaths,
                  count: filePaths.length,
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : 'Image generation failed',
                }),
              },
            ],
          };
        }
      }

      case 'get_version': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                version: version,
              }),
            },
          ],
        };
      }

      default:
        return {
          error: {
            code: 'UNKNOWN_TOOL',
            message: `Unknown tool: ${name}`,
          },
        };
    }
  } catch (error) {
    // OpenAI APIエラーのハンドリング
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
    ) {
      const statusMessages: Record<number, string> = {
        401: 'Invalid API key',
        429: 'Rate limit exceeded',
        500: 'OpenAI API error',
        503: 'OpenAI service unavailable',
      };

      const errorMessage =
        'message' in error && typeof error.message === 'string'
          ? error.message
          : 'OpenAI API error';

      return {
        error: {
          code: `OPENAI_ERROR_${error.status}`,
          message: statusMessages[error.status] || errorMessage,
        },
      };
    }

    // その他のエラー
    return {
      error: {
        code: 'TOOL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    };
  }
});

// サーバーの起動
async function main() {
  console.error('Starting OpenAI MCP Server...');

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('OpenAI MCP Server is running');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.error('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Shutting down...');
  process.exit(0);
});

main().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
