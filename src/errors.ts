import OpenAI from 'openai';

export enum ErrorCode {
  // Authentication Errors
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Request Errors
  INVALID_REQUEST_ERROR = 'INVALID_REQUEST_ERROR',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',

  // Rate Limiting
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server Errors
  OPENAI_SERVER_ERROR = 'OPENAI_SERVER_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Tool Errors
  TOOL_ERROR = 'TOOL_ERROR',
  UNKNOWN_TOOL = 'UNKNOWN_TOOL',

  // System Errors
  STARTUP_ERROR = 'STARTUP_ERROR',
  STARTUP_FAILURE = 'STARTUP_FAILURE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',

  // General Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
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
  return error instanceof Error && 'status' in error && typeof (error as any).status === 'number';
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
