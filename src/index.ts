#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const server = new Server({
  name: 'openai-mcp-server',
  version: '0.1.0',
  description: 'OpenAI API MCP Server',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'chat_completion',
          description: 'Generate text using ChatGPT',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model to use (e.g., gpt-4o, gpt-4, gpt-3.5-turbo)',
                default: 'gpt-4o',
              },
              messages: {
                type: 'array',
                description: 'Chat history',
                items: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['system', 'user', 'assistant'],
                      description: 'Message role',
                    },
                    content: {
                      type: 'string',
                      description: 'Message content',
                    },
                  },
                  required: ['role', 'content'],
                },
              },
              temperature: {
                type: 'number',
                description: 'Sampling temperature (0-2)',
                default: 0.7,
                minimum: 0,
                maximum: 2,
              },
              max_tokens: {
                type: 'number',
                description: 'Maximum number of tokens',
                default: 1000,
              },
            },
            required: ['messages'],
          },
        },
        {
          name: 'list_models',
          description: 'List available OpenAI models',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'chat_completion': {
        const {
          model = 'gpt-4o',
          messages,
          temperature = 0.7,
          max_tokens = 1000,
        } = args as any;

        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        });

        return {
          result: {
            content: completion.choices[0]?.message?.content || '',
            usage: completion.usage,
            model: completion.model,
          },
        };
      }

      case 'list_models': {
        const models = await openai.models.list();
        const chatModels = models.data
          .filter(model => model.id.includes('gpt'))
          .map(model => ({
            id: model.id,
            created: new Date(model.created * 1000).toISOString(),
          }));

        return {
          result: {
            models: chatModels,
            count: chatModels.length,
          },
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      error: {
        code: 'TOOL_ERROR',
        message: errorMessage,
      },
    };
  }
});

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    console.error('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('OpenAI MCP Server is running...');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});