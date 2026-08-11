import { ImageGenerationProvider, GenerateImageParams, GeneratedImage, ProviderCapabilities } from './ImageGenerationProvider';

export class PollinationsImageProvider implements ImageGenerationProvider {
  name = 'Pollinations (Headless)';

  isAvailable(): boolean {
    return true;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      textToImage: true,
      externalGenerator: false,
      directApi: true
    };
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    const { prompt, aspectRatio, amount = 1 } = params;
    
    // Convert aspect ratio to dimensions
    let width = 1080;
    let height = 1080;
    
    if (aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
    } else if (aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    } else if (aspectRatio === '4:5') {
      width = 1080;
      height = 1350;
    }
    
    const results: GeneratedImage[] = [];
    
    for (let i = 0; i < amount; i++) {
      const seed = Math.floor(Math.random() * 1000000000);
      const encodedPrompt = encodeURIComponent(prompt);
      
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      
      try {
        // Fetch to ensure generation completes and we can cache the response/check for errors
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to generate image: ${response.statusText}`);
        }
        
        results.push({
          id: `pollinations-${Date.now()}-${i}`,
          url,
          prompt,
          source: 'pollinations',
          width,
          height
        });
      } catch (err) {
        throw new Error('Network error or provider unavailable while generating image.');
      }
    }
    
    return results;
  }
}

export const pollinationsProvider = new PollinationsImageProvider();
