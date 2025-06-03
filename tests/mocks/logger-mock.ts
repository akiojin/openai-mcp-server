import { ILogger } from '../../src/interfaces.js';

/**
 * ロガーのモック実装
 * テスト用に使用される
 */
export class MockLogger implements ILogger {
  public logs: Array<{ level: string; message: string; context?: any }> = [];

  generateRequestId(): string {
    return `mock-req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  debug(message: string, context?: any): void {
    this.logs.push({ level: 'debug', message, context });
  }

  info(message: string, context?: any): void {
    this.logs.push({ level: 'info', message, context });
  }

  warn(message: string, context?: any): void {
    this.logs.push({ level: 'warn', message, context });
  }

  error(message: string, context?: any): void {
    this.logs.push({ level: 'error', message, context });
  }

  toolRequest(toolName: string, requestId: string, args?: unknown): void {
    this.logs.push({
      level: 'info',
      message: 'Tool request received',
      context: { toolName, requestId, args },
    });
  }

  toolResponse(
    toolName: string,
    requestId: string,
    success: boolean,
    duration: number,
    context?: any
  ): void {
    this.logs.push({
      level: success ? 'info' : 'error',
      message: success ? 'Tool request completed' : 'Tool request failed',
      context: { toolName, requestId, success, duration, ...context },
    });
  }

  openaiRequest(requestId: string, model: string, tokenCount?: number): void {
    this.logs.push({
      level: 'info',
      message: 'OpenAI API request',
      context: { requestId, model, tokenCount },
    });
  }

  openaiResponse(
    requestId: string,
    model: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    duration: number
  ): void {
    this.logs.push({
      level: 'info',
      message: 'OpenAI API response',
      context: { requestId, model, usage, duration },
    });
  }

  openaiError(
    requestId: string,
    model: string,
    error: Error,
    statusCode?: number,
    duration?: number
  ): void {
    this.logs.push({
      level: 'error',
      message: 'OpenAI API error',
      context: { requestId, model, error: error.message, statusCode, duration },
    });
  }

  // テスト用ヘルパーメソッド
  clearLogs(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): Array<{ level: string; message: string; context?: any }> {
    return this.logs.filter(log => log.level === level);
  }

  getLogsByMessage(message: string): Array<{ level: string; message: string; context?: any }> {
    return this.logs.filter(log => log.message.includes(message));
  }

  hasLogWithMessage(message: string): boolean {
    return this.logs.some(log => log.message.includes(message));
  }
}