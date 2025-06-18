import OpenAI from 'openai';

export enum ErrorCode {
  // Authentication Errors
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  // Request Errors
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',

  // Rate Limiting
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  // Server Errors
  OPENAI_SERVER_ERROR = 'OPENAI_SERVER_ERROR',

  // System Errors
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',

  // General Errors
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  statusCode?: number;
}

export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly statusCode?: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MCPError.prototype);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      stack: this.stack,
    };
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, field?: string, value?: unknown) {
    super(ErrorCode.INVALID_ARGUMENTS, message, field ? { field, value } : undefined);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends MCPError {
  constructor(message: string = 'Invalid authentication credentials') {
    super(ErrorCode.AUTHENTICATION_ERROR, message, undefined, 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends MCPError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(ErrorCode.RATE_LIMIT_ERROR, message, retryAfter ? { retryAfter } : undefined, 429);
    this.name = 'RateLimitError';
  }
}

export class OpenAIServerError extends MCPError {
  constructor(message: string, statusCode: number) {
    super(ErrorCode.OPENAI_SERVER_ERROR, message, undefined, statusCode);
    this.name = 'OpenAIServerError';
  }
}

export function isOpenAIError(error: unknown): error is InstanceType<typeof OpenAI.APIError> {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

export function mapOpenAIErrorToMCPError(error: InstanceType<typeof OpenAI.APIError>): MCPError {
  const statusCode = error.status;

  switch (statusCode) {
    case 401:
      return new AuthenticationError(
        'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.'
      );

    case 429:
      return new RateLimitError('OpenAI API rate limit exceeded. Please try again later.');

    case 400:
      return new ValidationError(`Invalid request to OpenAI API: ${error.message}`);

    case 500:
    case 502:
    case 503:
      return new OpenAIServerError('OpenAI API server error. Please try again later.', statusCode);

    default:
      return new MCPError(
        ErrorCode.OPENAI_API_ERROR,
        `OpenAI API error (${statusCode}): ${error.message}`,
        undefined,
        statusCode
      );
  }
}
