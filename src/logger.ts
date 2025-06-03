import { pino, type Logger as PinoLogger } from 'pino';
import { randomUUID } from 'crypto';

export interface LogContext {
  requestId?: string;
  toolName?: string;
  userId?: string;
  model?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  count?: number;
  args?: unknown;
  version?: string;
  nodeVersion?: string;
  logLevel?: string;
  success?: boolean;
  configPath?: string;
  source?: string;
  updates?: unknown;
}

export class Logger {
  private logger: PinoLogger;
  private static instance: Logger;

  private constructor() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV !== 'production';

    this.logger = pino({
      level: logLevel,
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      formatters: {
        level: (label: string) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        service: 'openai-mcp-server',
        version: process.env.npm_package_version || '0.1.0',
      },
    });
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public generateRequestId(): string {
    return randomUUID();
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug({ ...context }, message);
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info({ ...context }, message);
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn({ ...context }, message);
  }

  public error(message: string, context?: LogContext): void {
    this.logger.error({ ...context }, message);
  }

  public toolRequest(toolName: string, requestId: string, args?: unknown): void {
    this.info('Tool request received', {
      requestId,
      toolName,
      args: typeof args === 'object' ? JSON.stringify(args) : args,
    });
  }

  public toolResponse(
    toolName: string,
    requestId: string,
    success: boolean,
    duration: number,
    context?: LogContext
  ): void {
    const level = success ? 'info' : 'error';
    const message = success ? 'Tool request completed' : 'Tool request failed';

    this.logger[level](
      {
        requestId,
        toolName,
        duration,
        success,
        ...context,
      },
      message
    );
  }

  public openaiRequest(requestId: string, model: string, tokenCount?: number): void {
    this.info('OpenAI API request', {
      requestId,
      model,
      tokenUsage: tokenCount ? { prompt: tokenCount, completion: 0, total: tokenCount } : undefined,
    });
  }

  public openaiResponse(
    requestId: string,
    model: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    duration: number
  ): void {
    this.info('OpenAI API response', {
      requestId,
      model,
      duration,
      tokenUsage: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      },
    });
  }

  public openaiError(
    requestId: string,
    model: string,
    error: Error,
    statusCode?: number,
    duration?: number
  ): void {
    this.error('OpenAI API error', {
      requestId,
      model,
      duration,
      error: {
        code: statusCode ? `HTTP_${statusCode}` : 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
      },
    });
  }
}

export const logger = Logger.getInstance();
export default logger;
