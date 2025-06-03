#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from './logger.js';
import { config } from './config.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const serverConfig = config.get('server');
const server = new Server(
  {
    name: serverConfig.name,
    version: serverConfig.version,
    description: serverConfig.description,
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
  const requestId = logger.generateRequestId();
  const startTime = Date.now();

  logger.toolRequest(name, requestId, args);

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

        const openaiConfig = config.get('openai');
        const {
          model = openaiConfig.defaultModel,
          messages,
          temperature = openaiConfig.defaultTemperature,
          max_tokens = openaiConfig.defaultMaxTokens,
        } = {
          model: typeof typedArgs.model === 'string' ? typedArgs.model : openaiConfig.defaultModel,
          messages: typedArgs.messages as ChatMessage[],
          temperature:
            typeof typedArgs.temperature === 'number'
              ? typedArgs.temperature
              : openaiConfig.defaultTemperature,
          max_tokens:
            typeof typedArgs.max_tokens === 'number'
              ? typedArgs.max_tokens
              : openaiConfig.defaultMaxTokens,
        };

        logger.openaiRequest(requestId, model);
        const apiStartTime = Date.now();

        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        });

        const apiDuration = Date.now() - apiStartTime;

        if (completion.usage) {
          logger.openaiResponse(requestId, completion.model, completion.usage, apiDuration);
        }

        const result = {
          content: completion.choices[0]?.message?.content || '',
          usage: completion.usage,
          model: completion.model,
        };

        logger.toolResponse(name, requestId, true, Date.now() - startTime, {
          model: completion.model,
          tokenUsage: completion.usage
            ? {
                prompt: completion.usage.prompt_tokens,
                completion: completion.usage.completion_tokens,
                total: completion.usage.total_tokens,
              }
            : undefined,
        });

        return { result };
      }

      case 'list_models': {
        logger.openaiRequest(requestId, 'models-list');
        const apiStartTime = Date.now();

        const models = await openai.models.list();
        const apiDuration = Date.now() - apiStartTime;

        const chatModels = models.data
          .filter(model => model.id.includes('gpt'))
          .map(model => ({
            id: model.id,
            created: new Date(model.created * 1000).toISOString(),
          }));

        logger.info('Models list retrieved', {
          requestId,
          count: chatModels.length,
          duration: apiDuration,
        });

        const result = {
          models: chatModels,
          count: chatModels.length,
        };

        logger.toolResponse(name, requestId, true, Date.now() - startTime);

        return { result };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    // Enhanced OpenAI API error handling
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status;

      logger.openaiError(requestId, name, error, statusCode, duration);
      logger.toolResponse(name, requestId, false, duration, {
        error: {
          code: `HTTP_${statusCode}`,
          message: error.message,
        },
      });

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
      logger.error('Tool request failed', {
        requestId,
        toolName: name,
        duration,
        error: {
          code: 'TOOL_ERROR',
          message: error.message,
          stack: error.stack,
        },
      });

      logger.toolResponse(name, requestId, false, duration, {
        error: {
          code: 'TOOL_ERROR',
          message: error.message,
        },
      });

      return {
        error: {
          code: 'TOOL_ERROR',
          message: error.message,
        },
      };
    }

    logger.error('Unknown error occurred', {
      requestId,
      toolName: name,
      duration,
    });

    logger.toolResponse(name, requestId, false, duration);

    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    };
  }
});

async function main() {
  logger.info('Starting OpenAI MCP Server', {
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
    logLevel: process.env.LOG_LEVEL || 'info',
  });

  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY environment variable is not set');
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    console.error('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('OpenAI MCP Server started successfully');
    console.error('OpenAI MCP Server is running...');
  } catch (error) {
    logger.error('Failed to start server', {
      error: {
        code: 'STARTUP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    throw error;
  }
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main().catch(error => {
  logger.error('Server startup failed', {
    error: {
      code: 'STARTUP_FAILURE',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
  console.error('Failed to start server:', error);
  process.exit(1);
});
