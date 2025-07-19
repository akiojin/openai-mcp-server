#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

// 環境変数チェック
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// バージョン情報
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// OpenAIクライアント
const openai = new OpenAI({ apiKey });

// MCPサーバー
const server = new Server(
  {
    name: packageJson.name,
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール定義
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'chat_completion',
      description: 'Generate text responses using OpenAI ChatGPT models',
      inputSchema: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                content: { type: 'string' },
              },
              required: ['role', 'content'],
            },
            description: 'Conversation history as message objects',
          },
          model: {
            type: 'string',
            description: 'OpenAI model to use',
            default: 'gpt-4.1',
          },
          temperature: {
            type: 'number',
            description: 'Controls randomness (0.0-2.0)',
            default: 0.7,
          },
          max_tokens: {
            type: 'number',
            description: 'Maximum tokens to generate',
            default: 1000,
          },
        },
        required: ['messages'],
      },
    },
    {
      name: 'list_models',
      description: 'Retrieve available OpenAI models',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'generate_image',
      description: 'Generate images using gpt-image-1 model',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'A text description of the desired image(s)',
          },
          model: {
            type: 'string',
            description: 'The model to use for image generation',
            default: 'gpt-image-1',
          },
          n: {
            type: 'number',
            description: 'Number of images to generate (1-10)',
            default: 1,
          },
          size: {
            type: 'string',
            description: 'Size of the generated images',
            default: '1024x1024',
            enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
          },
          quality: {
            type: 'string',
            description: 'Quality of the image',
            default: 'standard',
            enum: ['standard', 'hd'],
          },
          background: {
            type: 'string',
            description: 'Background type',
            default: 'opaque',
            enum: ['opaque', 'transparent'],
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'get_version',
      description: 'Get the version number of this MCP server',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// ツール実行
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'chat_completion': {
        if (!args?.messages || !Array.isArray(args.messages)) {
          return {
            error: { code: 'INVALID_ARGUMENTS', message: 'messages array is required' },
          };
        }

        const completion = await openai.chat.completions.create({
          model: (args.model as string) || 'gpt-4.1',
          messages: args.messages as any[],
          temperature: (args.temperature as number) ?? 0.7,
          max_tokens: (args.max_tokens as number) ?? 1000,
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
        const modelsResponse = await openai.models.list();
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
              text: JSON.stringify({ models: chatModels, count: chatModels.length }),
            },
          ],
        };
      }

      case 'generate_image': {
        if (!args?.prompt) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'prompt is required' }),
              },
            ],
          };
        }

        try {
          const response = await openai.images.generate({
            prompt: args.prompt as string,
            model: (args.model as string) || 'gpt-image-1',
            n: (args.n as number) || 1,
            size: (args.size as any) || '1024x1024',
            quality: (args.quality as any) || 'standard',
            response_format: 'b64_json',
          });

          const filePaths = [];
          const timestamp = Date.now();

          if (response.data) {
            for (let i = 0; i < response.data.length; i++) {
              const imageData = response.data[i];
              if (imageData.b64_json) {
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const fileName = `openai_generated_image_${timestamp}_${i + 1}.png`;
                const filePath = join(tmpdir(), fileName);
                writeFileSync(filePath, buffer);
                filePaths.push(filePath);
              }
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ file_paths: filePaths, count: filePaths.length }),
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
                version: packageJson.version,
                name: packageJson.name,
                description: packageJson.description,
              }),
            },
          ],
        };
      }

      default:
        return {
          error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` },
        };
    }
  } catch (error) {
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
      return {
        error: {
          code: `OPENAI_ERROR_${error.status}`,
          message: statusMessages[error.status] || 'OpenAI API error',
        },
      };
    }

    return {
      error: {
        code: 'TOOL_ERROR',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
    };
  }
});

// サーバー起動
async function main() {
  console.error('Starting OpenAI MCP Server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenAI MCP Server running');
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
