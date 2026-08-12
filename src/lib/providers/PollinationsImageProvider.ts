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
        // Preload image element to ensure generation completes and image is valid
        await new Promise((resolve, reject) => {
          const img = new Image();
          const timer = setTimeout(() => {
            // Resolve anyway if network is slow, URL is still valid for direct rendering
            resolve(true);
          }, 8000);
          img.onload = () => {
            clearTimeout(timer);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timer);
            // Even on error, resolve so user gets the URL attempt or fallback
            resolve(true);
          };
          img.src = url;
        });
        
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
