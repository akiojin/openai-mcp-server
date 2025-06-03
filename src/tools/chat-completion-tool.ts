import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/index.js';
import { IToolHandler, ToolExecutionContext, ChatCompletionArgs } from '../interfaces.js';
import { mapOpenAIErrorToMCPError, isOpenAIError, ValidationError } from '../errors.js';

/**
 * チャット補完ツールのハンドラー
 */
export class ChatCompletionTool implements IToolHandler {
  async execute(args: any, context: ToolExecutionContext): Promise<any> {
    const { openaiClient, logger, config, cacheService } = context;

    // Input validation
    if (!args || typeof args !== 'object') {
      throw new ValidationError('Expected object', 'arguments', args);
    }

    // Type guard to ensure args has the expected shape
    if (!('messages' in args)) {
      throw new ValidationError('messages field is required', 'messages');
    }

    const typedArgs = args as unknown as ChatCompletionArgs;

    if (!Array.isArray(typedArgs.messages)) {
      throw new ValidationError('messages must be an array', 'messages', typedArgs.messages);
    }

    // Validate messages structure
    for (let index = 0; index < typedArgs.messages.length; index++) {
      const message = typedArgs.messages[index];
      if (!message || typeof message !== 'object') {
        throw new ValidationError('Each message must be an object', `messages[${index}]`, message);
      }
      if (!('role' in message) || typeof message.role !== 'string') {
        throw new ValidationError('role must be a string', `messages[${index}].role`, message);
      }
      if (!['system', 'user', 'assistant', 'function', 'tool'].includes(message.role)) {
        throw new ValidationError(
          'role must be one of: system, user, assistant, function, tool',
          `messages[${index}].role`,
          message.role
        );
      }
      if ('content' in message && message.content !== null && typeof message.content !== 'string') {
        throw new ValidationError(
          'content must be a string or null',
          `messages[${index}].content`,
          message.content
        );
      }
    }

    const openaiConfig = config.get('openai') as any;
    const model = typedArgs.model || openaiConfig.defaultModel;
    const messages = typedArgs.messages;
    const temperature = typedArgs.temperature ?? openaiConfig.defaultTemperature;
    const max_tokens = typedArgs.max_tokens ?? openaiConfig.defaultMaxTokens;

    // Validate temperature range
    if (temperature < 0 || temperature > 2) {
      throw new ValidationError('must be between 0 and 2', 'temperature', temperature);
    }

    // Validate max_tokens
    if (max_tokens < 1) {
      throw new ValidationError('must be at least 1', 'max_tokens', max_tokens);
    }

    // キャッシュから結果を取得を試行
    if (cacheService) {
      const cachedResult = await cacheService.getChatCompletion(
        model,
        messages,
        temperature,
        max_tokens
      );
      if (cachedResult) {
        logger.debug('Chat completion served from cache', {
          model,
          messageCount: messages.length,
          temperature,
          maxTokens: max_tokens,
        });
        return cachedResult;
      }
    }

    const requestId = logger.generateRequestId();
    logger.openaiRequest(requestId, model);
    const apiStartTime = Date.now();

    const completionParams: ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    try {
      const completion = await openaiClient.chat.completions.create(completionParams);

      const apiDuration = Date.now() - apiStartTime;

      if (completion.usage) {
        logger.openaiResponse(requestId, completion.model, completion.usage, apiDuration);
      }

      const result = {
        content: completion.choices[0]?.message?.content || '',
        usage: completion.usage,
        model: completion.model,
      };

      // 結果をキャッシュに保存
      if (cacheService) {
        await cacheService.setChatCompletion(model, messages, temperature, max_tokens, result);
      }

      return result;
    } catch (error) {
      const apiDuration = Date.now() - apiStartTime;

      if (isOpenAIError(error)) {
        const mcpError = mapOpenAIErrorToMCPError(error as any);
        logger.openaiError(requestId, model, error as Error, mcpError.statusCode, apiDuration);
        throw mcpError;
      }

      throw error;
    }
  }
}
