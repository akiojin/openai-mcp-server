import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ImageGenerationTool, ImageGenerationArgs } from '../../src/tools/image-generation-tool.js';
import { MockOpenAIClient } from '../mocks/openai-mock.js';

describe('ImageGenerationTool', () => {
  let tool: ImageGenerationTool;
  let mockOpenAI: MockOpenAIClient;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    mockOpenAI = new MockOpenAIClient();
    tool = new ImageGenerationTool(mockOpenAI as any);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error when args is null or undefined', async () => {
      await expect(tool.execute(null as any)).rejects.toThrow('prompt is required');
      await expect(tool.execute(undefined as any)).rejects.toThrow('prompt is required');
    });

    it('should throw error when prompt is missing', async () => {
      const args: Partial<ImageGenerationArgs> = {};
      await expect(tool.execute(args as ImageGenerationArgs)).rejects.toThrow('prompt is required');
    });

    it('should throw error when prompt is empty string', async () => {
      const args: ImageGenerationArgs = { prompt: '' };
      await expect(tool.execute(args)).rejects.toThrow('prompt is required');
    });

    it('should throw error when prompt exceeds 1000 characters', async () => {
      const longPrompt = 'a'.repeat(1001);
      const args: ImageGenerationArgs = { prompt: longPrompt };
      await expect(tool.execute(args)).rejects.toThrow('prompt must be 1000 characters or less');
    });

    it('should accept prompt with exactly 1000 characters', async () => {
      const exactPrompt = 'a'.repeat(1000);
      const args: ImageGenerationArgs = { prompt: exactPrompt };
      
      console.log('Testing prompt with exactly 1000 characters:', exactPrompt.substring(0, 50) + '...');
      
      const result = await tool.execute(args);
      expect(result).toBeDefined();
      expect(result.images).toHaveLength(1);
      
      console.log('Result:', result);
    });
  });

  describe('Valid Execution - Basic Cases', () => {
    it('should execute successfully with basic prompt (default parameters)', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'A beautiful sunset over the ocean',
      };

      console.log('Testing basic image generation with prompt:', args.prompt);

      const result = await tool.execute(args);

      expect(result).toBeDefined();
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe('https://example.com/generated-image-1.png');
      expect(result.images[0].revised_prompt).toBe('A beautiful landscape with mountains and a lake');
      expect(result.created).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      console.log('Basic generation result:', result);
    });

    it('should handle all parameters specified', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'A futuristic city skyline at night',
        model: 'gpt-image-1',
        n: 2,
        size: '1792x1024',
        quality: 'hd',
        style: 'vivid',
      };

      console.log('Testing full parameter specification:', args);

      // Custom mock response for multiple images
      mockOpenAI.setImagesResponse({
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            url: 'https://example.com/futuristic-city-1.png',
            revised_prompt: 'A stunning futuristic city skyline at night with neon lights',
          },
          {
            url: 'https://example.com/futuristic-city-2.png',
            revised_prompt: 'A vibrant futuristic city skyline at night with flying cars',
          },
        ],
      });

      const result = await tool.execute(args);

      expect(result).toBeDefined();
      expect(result.images).toHaveLength(2);
      expect(result.images[0].url).toBe('https://example.com/futuristic-city-1.png');
      expect(result.images[1].url).toBe('https://example.com/futuristic-city-2.png');

      console.log('Full parameter result:', result);
    });
  });

  describe('Multiple Images Generation', () => {
    it('should generate multiple images when n > 1', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'Abstract art with geometric shapes',
        n: 3,
      };

      console.log('Testing multiple image generation (n=3):', args.prompt);

      // Mock response for 3 images
      mockOpenAI.setImagesResponse({
        created: Math.floor(Date.now() / 1000),
        data: [
          { url: 'https://example.com/abstract-1.png', revised_prompt: 'Abstract geometric art piece 1' },
          { url: 'https://example.com/abstract-2.png', revised_prompt: 'Abstract geometric art piece 2' },
          { url: 'https://example.com/abstract-3.png', revised_prompt: 'Abstract geometric art piece 3' },
        ],
      });

      const result = await tool.execute(args);

      expect(result.images).toHaveLength(3);
      result.images.forEach((image, index) => {
        expect(image.url).toBe(`https://example.com/abstract-${index + 1}.png`);
        expect(image.revised_prompt).toContain('Abstract geometric art piece');
      });

      console.log('Multiple images result:', result);
    });
  });

  describe('Different Sizes', () => {
    const sizes: Array<'256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'> = [
      '256x256',
      '512x512', 
      '1024x1024',
      '1792x1024',
      '1024x1792'
    ];

    sizes.forEach(size => {
      it(`should generate image with size ${size}`, async () => {
        const args: ImageGenerationArgs = {
          prompt: `Landscape image for ${size} format`,
          size,
        };

        console.log(`Testing ${size} image generation:`, args.prompt);

        const result = await tool.execute(args);

        expect(result).toBeDefined();
        expect(result.images).toHaveLength(1);
        expect(result.images[0].url).toBeDefined();

        console.log(`${size} result:`, result);
      });
    });
  });

  describe('Quality Options', () => {
    it('should generate standard quality image', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'Portrait of a person reading a book',
        quality: 'standard',
      };

      console.log('Testing standard quality:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      
      console.log('Standard quality result:', result);
    });

    it('should generate HD quality image', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'High-detail nature photography',
        quality: 'hd',
      };

      console.log('Testing HD quality:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      
      console.log('HD quality result:', result);
    });
  });

  describe('Style Options', () => {
    it('should generate vivid style image', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'Colorful tropical beach scene',
        style: 'vivid',
      };

      console.log('Testing vivid style:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      
      console.log('Vivid style result:', result);
    });

    it('should generate natural style image', async () => {
      const args: ImageGenerationArgs = {
        prompt: 'Realistic mountain landscape',
        style: 'natural',
      };

      console.log('Testing natural style:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      
      console.log('Natural style result:', result);
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API 401 error', async () => {
      const apiError = new Error('Authentication failed');
      (apiError as any).status = 401;
      mockOpenAI.setError(apiError);

      const args: ImageGenerationArgs = {
        prompt: 'Test image for error handling',
      };

      console.log('Testing 401 error handling:', args.prompt);

      await expect(tool.execute(args)).rejects.toThrow('Authentication failed');
    });

    it('should handle OpenAI API 429 rate limit error', async () => {
      const apiError = new Error('Rate limit exceeded');
      (apiError as any).status = 429;
      mockOpenAI.setError(apiError);

      const args: ImageGenerationArgs = {
        prompt: 'Test image for rate limit',
      };

      console.log('Testing 429 rate limit error:', args.prompt);

      await expect(tool.execute(args)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle OpenAI API 500 server error', async () => {
      const apiError = new Error('Internal server error');
      (apiError as any).status = 500;
      mockOpenAI.setError(apiError);

      const args: ImageGenerationArgs = {
        prompt: 'Test image for server error',
      };

      console.log('Testing 500 server error:', args.prompt);

      await expect(tool.execute(args)).rejects.toThrow('Internal server error');
    });

    it('should handle OpenAI API 503 service unavailable', async () => {
      const apiError = new Error('Service temporarily unavailable');
      (apiError as any).status = 503;
      mockOpenAI.setError(apiError);

      const args: ImageGenerationArgs = {
        prompt: 'Test image for service unavailable',
      };

      console.log('Testing 503 service unavailable:', args.prompt);

      await expect(tool.execute(args)).rejects.toThrow('Service temporarily unavailable');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response data array', async () => {
      mockOpenAI.setImagesResponse({
        created: Math.floor(Date.now() / 1000),
        data: [],
      });

      const args: ImageGenerationArgs = {
        prompt: 'Test for empty response',
      };

      console.log('Testing empty response data:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(0);
      
      console.log('Empty response result:', result);
    });

    it('should handle response with missing URL', async () => {
      mockOpenAI.setImagesResponse({
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            revised_prompt: 'Generated image without URL',
          } as any,
        ],
      });

      const args: ImageGenerationArgs = {
        prompt: 'Test for missing URL',
      };

      console.log('Testing missing URL:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBeUndefined();
      expect(result.images[0].revised_prompt).toBe('Generated image without URL');
      
      console.log('Missing URL result:', result);
    });

    it('should handle response with missing revised_prompt', async () => {
      mockOpenAI.setImagesResponse({
        created: Math.floor(Date.now() / 1000),
        data: [
          {
            url: 'https://example.com/no-prompt.png',
          } as any,
        ],
      });

      const args: ImageGenerationArgs = {
        prompt: 'Test for missing revised prompt',
      };

      console.log('Testing missing revised prompt:', args.prompt);

      const result = await tool.execute(args);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe('https://example.com/no-prompt.png');
      expect(result.images[0].revised_prompt).toBeUndefined();
      
      console.log('Missing revised prompt result:', result);
    });
  });

  describe('Console Output Verification', () => {
    it('should verify console.log calls are captured', () => {
      console.log('Test console output');
      expect(consoleSpy).toHaveBeenCalledWith('Test console output');
    });
  });
});