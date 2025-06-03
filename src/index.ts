#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ErrorCode, MCPError, mapOpenAIErrorToMCPError, isOpenAIError } from './errors.js';
import { DependencyContainer } from './container/dependency-container.js';
import { ToolExecutionContext } from './interfaces.js';

dotenv.config();

// 依存性注入コンテナを初期化
const container = new DependencyContainer();

// 依存関係を取得
let logger: ReturnType<typeof container.getLogger>;
let config: ReturnType<typeof container.getConfigManager>;
let openaiClient: ReturnType<typeof container.getOpenAIClient>;
let cacheService: ReturnType<typeof container.getCacheService>;

try {
  logger = container.getLogger();
  config = container.getConfigManager();
  openaiClient = container.getOpenAIClient();
  cacheService = container.getCacheService();
} catch (error) {
  // 初期化エラー時の対応
  console.error('Failed to initialize dependencies:', error);
  process.exit(1);
}

const serverConfig = config.get('server') as any;
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
    // ツールハンドラーを取得
    const toolHandler = container.getToolHandler(name);
    if (!toolHandler) {
      throw new MCPError(ErrorCode.UNKNOWN_TOOL, `Unknown tool: ${name}`, { toolName: name });
    }

    // ツール実行コンテキストを構築
    const context: ToolExecutionContext = {
      openaiClient,
      logger,
      config,
      environmentProvider: container.getEnvironmentProvider(),
      cacheService,
    };

    // ツールを実行
    const result = await toolHandler.execute(args, context);

    logger.toolResponse(name, requestId, true, Date.now() - startTime, {
      model: result.model,
      tokenUsage: result.usage
        ? {
            prompt: result.usage.prompt_tokens,
            completion: result.usage.completion_tokens,
            total: result.usage.total_tokens,
          }
        : undefined,
    });

    return { result };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Enhanced error handling
    if (isOpenAIError(error)) {
      const mcpError = mapOpenAIErrorToMCPError(error as any);
      logger.openaiError(requestId, name, error as Error, mcpError.statusCode, duration);
      logger.toolResponse(name, requestId, false, duration);

      return {
        error: {
          code: mcpError.code,
          message: mcpError.message,
        },
      };
    }

    if (error instanceof MCPError) {
      logger.error('MCP error occurred', {
        requestId,
        toolName: name,
        duration,
        ...error.toJSON(),
      });

      logger.toolResponse(name, requestId, false, duration);

      return {
        error: {
          code: error.code,
          message: error.message,
        },
      };
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
  const envProvider = container.getEnvironmentProvider();

  logger.info('Starting OpenAI MCP Server', {
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
    logLevel: envProvider.get('LOG_LEVEL') || 'info',
    args: {
      environment: envProvider.get('NODE_ENV') || 'development',
    },
  });

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
  cacheService.dispose();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  cacheService.dispose();
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
