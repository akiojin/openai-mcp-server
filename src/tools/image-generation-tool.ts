import OpenAI from 'openai';

export interface ImageGenerationArgs {
  prompt: string;
  model?: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface ImageGenerationResult {
  images: Array<{
    url?: string;
    revised_prompt?: string;
  }>;
  created: string;
}

export class ImageGenerationTool {
  constructor(private openai: OpenAI) {}

  async execute(args: ImageGenerationArgs): Promise<ImageGenerationResult> {
    // 引数の検証
    if (!args || !args.prompt) {
      throw new Error('prompt is required');
    }

    // プロンプトの長さチェック
    if (typeof args.prompt === 'string' && args.prompt.length > 1000) {
      throw new Error('prompt must be 1000 characters or less');
    }

    // 画像生成パラメータ
    const imageParams: OpenAI.Images.ImageGenerateParams = {
      model: args.model || 'gpt-image-1',
      prompt: args.prompt,
      n: args.n || 1,
      size: args.size || '1024x1024',
    };

    // オプションパラメータ
    if (args.quality) {
      imageParams.quality = args.quality;
    }
    if (args.style) {
      imageParams.style = args.style;
    }

    // 画像生成APIを呼び出し
    const response = await this.openai.images.generate(imageParams);

    return {
      images:
        response.data?.map(image => ({
          url: image.url,
          revised_prompt: image.revised_prompt,
        })) || [],
      created: new Date().toISOString(),
    };
  }
}
