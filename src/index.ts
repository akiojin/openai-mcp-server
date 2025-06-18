#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
          'Generate images using gpt-image-1 model. Returns URLs for generated images. REQUIRED TRIGGER PHRASES: "Generate image", "Create image", "Draw", "Picture of", "Image of", "GPT-image".',
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
        // 引数の検証
        if (!args || !args.messages || !Array.isArray(args.messages)) {
          return {
            error: {
              code: 'INVALID_ARGUMENTS',
              message: 'messages array is required',
            },
          };
        }

        // APIリクエスト
        const completion = await openai.chat.completions.create({
          model: args.model || 'gpt-4.1',
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 1000,
        } as any);

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
        // 引数の検証
        if (!args || !args.prompt) {
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
          const requestBody: any = {
            prompt: args.prompt,
            model: args.model || 'gpt-image-1',
            n: args.n || 1,
            size: args.size || '1024x1024',
            response_format: 'url', // URL形式を明示的に指定
          };

          // オプションパラメータ
          if (args.quality) {
            requestBody.quality = args.quality;
          }

          // backgroundパラメータがある場合は追加
          if (args.background) {
            (requestBody as any).background = args.background;
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
            const errorData = (await response.json()) as any;
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

          const data = (await response.json()) as any;

          // URL形式の画像を返す
          const urls: string[] = [];
          const images = data.data || [];

          for (const imageData of images) {
            if (imageData.url) {
              urls.push(imageData.url);
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  urls: urls,
                  count: urls.length,
                }),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message || 'Image generation failed',
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
  } catch (error: any) {
    // OpenAI APIエラーのハンドリング
    if (error?.status) {
      const statusMessages: Record<number, string> = {
        401: 'Invalid API key',
        429: 'Rate limit exceeded',
        500: 'OpenAI API error',
        503: 'OpenAI service unavailable',
      };

      return {
        error: {
          code: `OPENAI_ERROR_${error.status}`,
          message: statusMessages[error.status] || error.message || 'OpenAI API error',
        },
      };
    }

    // その他のエラー
    return {
      error: {
        code: 'TOOL_ERROR',
        message: error.message || 'An error occurred',
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
