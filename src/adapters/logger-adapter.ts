import { ILogger } from '../interfaces.js';
import { Logger } from '../logger.js';

/**
 * ロガーのアダプター実装
 * 既存のLoggerクラスをILoggerインターフェースでラップ
 */
export class LoggerAdapter implements ILogger {
  private logger: Logger;

  constructor(logger?: Logger) {
    // 引数で渡されない場合は既存のシングルトンインスタンスを使用
    this.logger = logger || Logger.getInstance();
  }

  generateRequestId(): string {
    return this.logger.generateRequestId();
  }

  debug(message: string, context?: any): void {
    this.logger.debug(message, context);
  }

  info(message: string, context?: any): void {
    this.logger.info(message, context);
  }

  warn(message: string, context?: any): void {
    this.logger.warn(message, context);
  }

  error(message: string, context?: any): void {
    this.logger.error(message, context);
  }

  toolRequest(toolName: string, requestId: string, args?: unknown): void {
    this.logger.toolRequest(toolName, requestId, args);
  }

  toolResponse(
    toolName: string,
    requestId: string,
    success: boolean,
    duration: number,
    context?: any
  ): void {
    this.logger.toolResponse(toolName, requestId, success, duration, context);
  }

  openaiRequest(requestId: string, model: string, tokenCount?: number): void {
    this.logger.openaiRequest(requestId, model, tokenCount);
  }

  openaiResponse(
    requestId: string,
    model: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    duration: number
  ): void {
    this.logger.openaiResponse(requestId, model, usage, duration);
  }

  openaiError(
    requestId: string,
    model: string,
    error: Error,
    statusCode?: number,
    duration?: number
  ): void {
    this.logger.openaiError(requestId, model, error, statusCode, duration);
  }
}
