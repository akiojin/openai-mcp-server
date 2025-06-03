import { IToolHandler, ToolExecutionContext } from '../interfaces.js';

/**
 * モデル一覧ツールのハンドラー
 */
export class ListModelsTool implements IToolHandler {
  async execute(args: any, context: ToolExecutionContext): Promise<any> {
    const { openaiClient, logger, cacheService } = context;

    // キャッシュから結果を取得を試行
    if (cacheService) {
      const cachedResult = await cacheService.getModelList();
      if (cachedResult) {
        logger.debug('Model list served from cache', {
          modelCount: cachedResult.models?.length || 0,
        });
        return cachedResult;
      }
    }

    const requestId = logger.generateRequestId();
    logger.openaiRequest(requestId, 'models-list');
    const apiStartTime = Date.now();

    const modelsResponse = await openaiClient.models.list();
    const apiDuration = Date.now() - apiStartTime;

    const chatModels = modelsResponse.data
      .filter(model => model.id.includes('gpt') || model.id.includes('o1'))
      .map(model => ({
        id: model.id,
        created: new Date(model.created * 1000).toISOString(),
        owned_by: model.owned_by,
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

    // 結果をキャッシュに保存（モデルリストは長期間キャッシュ）
    if (cacheService) {
      const modelListTtl = 24 * 60 * 60 * 1000; // 24時間
      await cacheService.setModelList(result, modelListTtl);
    }

    return result;
  }
}
