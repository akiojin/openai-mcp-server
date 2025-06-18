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
        if (!args || !args.messages || !Array.isArray(args.messages)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'messages array is required',
              }),
            }],
          };
        }

        const completion = await openai.chat.completions.create({
          model: args.model || 'gpt-4.1',
          messages: args.messages,
          temperature: args.temperature || 0.7,
          max_tokens: args.max_tokens || 1000,
        } as any);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              content: completion.choices[0]?.message?.content || '',
              usage: completion.usage,
              model: completion.model,
            }),
          }],
        };
      }

      case 'list_models': {
        const modelsResponse = await openai.models.list();
        const models = modelsResponse.data || [];

        // ChatGPT関連モデルのみをフィルタリング
        const chatModels = models
          .filter(model =>
            model.id.includes('gpt') ||
            model.id.includes('o1') ||
            model.id.includes('o3')
          )
          .map(model => ({
            id: model.id,
            created: model.created,
          }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              models: chatModels,
              count: chatModels.length,
            }),
          }],
        };
      }

      case 'get_version': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              version: version,
            }),
          }],
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
        400: 'Bad Request - The request was invalid or cannot be served',
        401: 'Unauthorized - Invalid API key or authentication failed',
        403: 'Forbidden - The request is not allowed',
        404: 'Not Found - The requested resource does not exist',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error - OpenAI service error',
        502: 'Bad Gateway - OpenAI service is temporarily unavailable',
        503: 'Service Unavailable - OpenAI service is temporarily offline',
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

// サーバー起動
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