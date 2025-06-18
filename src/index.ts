#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { ImageGenerationTool } from './tools/image-generation-tool.js';

dotenv.config();

// OpenAI API キーの確認
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// OpenAIクライアントの初期化
const openai = new OpenAI({ apiKey });

// ツールの初期化
const imageGenerationTool = new ImageGenerationTool(openai);

// サーバーの初期化
const server = new Server(
  {
    name: 'openai-mcp-server',
    version: '0.1.0',
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
          'Generate images using GPT-image-1 model. **IMPORTANT: Use only when explicitly requested.** REQUIRED TRIGGER PHRASES: "Generate image", "Create image", "Draw", "Picture of", "Image of", "GPT-image".',
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
                'Size of the generated images. Must be one of "256x256", "512x512", "1024x1024", "1792x1024", or "1024x1792". Default is "1024x1024".',
              enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
              default: '1024x1024',
            },
            quality: {
              type: 'string',
              description: 'Quality of the image. "standard" or "hd". Default is "standard".',
              enum: ['standard', 'hd'],
              default: 'standard',
            },
            style: {
              type: 'string',
              description:
                'Style of the generated images. Can be "vivid" or "natural". Default is "vivid".',
              enum: ['vivid', 'natural'],
              default: 'vivid',
            },
          },
          required: ['prompt'],
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
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: {
                      code: 'INVALID_ARGUMENTS',
                      message: 'messages array is required',
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // APIリクエスト
        const completion = await openai.chat.completions.create({
          model: args.model || 'gpt-4.1',
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 1000,
        } as any);

        // MCPが期待する形式に変換
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  content: completion.choices[0]?.message?.content || '',
                  usage: completion.usage,
                  model: completion.model,
                },
                null,
                2
              ),
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

        // MCPが期待する形式に変換
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  models: chatModels,
                  count: chatModels.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'generate_image': {
        try {
          // 引数の検証
          if (!args || !args.prompt) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      error: {
                        code: 'INVALID_ARGUMENTS',
                        message: 'prompt is required',
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }

          const result = await imageGenerationTool.execute(args as any);

          // MCPが期待する形式に変換
          return {
            content: result.images.map(image => ({
              type: 'text',
              text: JSON.stringify(
                {
                  url: image.url,
                  revised_prompt: image.revised_prompt,
                  created: result.created,
                },
                null,
                2
              ),
            })),
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: {
                      code: 'INVALID_ARGUMENTS',
                      message: error.message,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: {
                    code: 'UNKNOWN_TOOL',
                    message: `Unknown tool: ${name}`,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
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
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: {
                  code: `OPENAI_ERROR_${error.status}`,
                  message: statusMessages[error.status] || error.message || 'OpenAI API error',
                },
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // その他のエラー
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: 'TOOL_ERROR',
                message: error.message || 'An error occurred',
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
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
