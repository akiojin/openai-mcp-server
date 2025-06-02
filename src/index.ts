#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const server = new Server(
  {
    name: 'openai-mcp-server',
    version: '0.1.0',
    description: 'OpenAI API MCP Server',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'chat_completion',
        description:
          'Generate text responses using OpenAI ChatGPT models. **IMPORTANT: This tool should ONLY be used when users explicitly include trigger phrases in their request.** REQUIRED TRIGGER PHRASES: "Ask ChatGPT:", "GPT:", "OpenAI:", "Hey ChatGPT!", or "Use OpenAI to". Do NOT use this tool for general questions without these explicit triggers. This tool enables conversations, content creation, translation, summarization, and advanced reasoning tasks using GPT-4o, GPT-4, or GPT-3.5-turbo models.',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description:
                'OpenAI model to use for text generation. Choose "gpt-4o" for best quality and multimodal support, "gpt-4" for high-quality reasoning, or "gpt-3.5-turbo" for faster and cost-effective responses. Default is "gpt-4o".',
              default: 'gpt-4o',
            },
            messages: {
              type: 'array',
              description:
                'Conversation history as an array of message objects. Each message must have a "role" (system/user/assistant) and "content" (the actual text). System messages set behavior, user messages are inputs, assistant messages are previous AI responses. Maintain conversation context by including relevant prior messages.',
              items: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['system', 'user', 'assistant'],
                    description:
                      'Role of the message sender: "system" for instructions/context, "user" for human input, "assistant" for AI responses',
                  },
                  content: {
                    type: 'string',
                    description:
                      'The actual text content of the message. For system messages, provide instructions or context. For user messages, include the question or prompt. For assistant messages, include previous AI responses.',
                  },
                },
                required: ['role', 'content'],
              },
            },
            temperature: {
              type: 'number',
              description:
                'Controls randomness in the response (0.0 to 2.0). Lower values (0.0-0.3) produce more focused, deterministic outputs ideal for factual questions. Medium values (0.4-0.8) balance creativity and consistency. Higher values (0.9-2.0) increase creativity and randomness for creative writing tasks. Default: 0.7',
              default: 0.7,
              minimum: 0,
              maximum: 2,
            },
            max_tokens: {
              type: 'number',
              description:
                'Maximum number of tokens (words/word pieces) to generate in the response. Controls response length. Typical values: 100-300 for short answers, 500-1000 for medium responses, 1500+ for long-form content. Note: actual response may be shorter if the model naturally concludes. Default: 1000',
              default: 1000,
            },
          },
          required: ['messages'],
        },
      },
      {
        name: 'list_models',
        description:
          'Retrieve a comprehensive list of all available OpenAI language models. **IMPORTANT: This tool should ONLY be used when users explicitly request model information.** REQUIRED TRIGGER PHRASES: "What OpenAI models are available?", "List GPT models", "Show me OpenAI models", "Which ChatGPT models can I use?", or similar explicit model listing requests. Do NOT use this tool unless the user specifically asks about available models.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'chat_completion': {
        // Input validation
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments: Expected object');
        }

        const typedArgs = args as Record<string, unknown>;

        if (!Array.isArray(typedArgs.messages)) {
          throw new Error('Invalid arguments: messages must be an array');
        }

        // Validate messages structure
        for (const message of typedArgs.messages) {
          if (!message || typeof message !== 'object') {
            throw new Error('Invalid message: Each message must be an object');
          }
          const msg = message as Record<string, unknown>;
          if (typeof msg.role !== 'string' || !['system', 'user', 'assistant'].includes(msg.role)) {
            throw new Error('Invalid message: role must be "system", "user", or "assistant"');
          }
          if (typeof msg.content !== 'string') {
            throw new Error('Invalid message: content must be a string');
          }
        }

        const {
          model = 'gpt-4o',
          messages,
          temperature = 0.7,
          max_tokens = 1000,
        } = {
          model: typeof typedArgs.model === 'string' ? typedArgs.model : 'gpt-4o',
          messages: typedArgs.messages as ChatMessage[],
          temperature: typeof typedArgs.temperature === 'number' ? typedArgs.temperature : 0.7,
          max_tokens: typeof typedArgs.max_tokens === 'number' ? typedArgs.max_tokens : 1000,
        };

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
    // Enhanced OpenAI API error handling
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;

      switch (statusCode) {
        case 401:
          return {
            error: {
              code: 'AUTHENTICATION_ERROR',
              message:
                'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.',
            },
          };
        case 429:
          return {
            error: {
              code: 'RATE_LIMIT_ERROR',
              message: 'OpenAI API rate limit exceeded. Please try again later.',
            },
          };
        case 400:
          return {
            error: {
              code: 'INVALID_REQUEST_ERROR',
              message: `Invalid request to OpenAI API: ${error.message}`,
            },
          };
        case 500:
        case 502:
        case 503:
          return {
            error: {
              code: 'OPENAI_SERVER_ERROR',
              message: 'OpenAI API server error. Please try again later.',
            },
          };
        default:
          return {
            error: {
              code: 'OPENAI_API_ERROR',
              message: `OpenAI API error (${statusCode}): ${error.message}`,
            },
          };
      }
    }

    if (error instanceof Error) {
      return {
        error: {
          code: 'TOOL_ERROR',
          message: error.message,
        },
      };
    }

    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
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

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
