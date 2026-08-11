import { ImageGenerationProvider, GenerateImageParams, GeneratedImage, ProviderCapabilities } from './ImageGenerationProvider';

export class PerchanceImageProvider implements ImageGenerationProvider {
  name = 'Perchance (Online)';

  isAvailable(): boolean {
    return true; // Technically the service exists, but we handle its availability type in capabilities
  }

  getCapabilities(): ProviderCapabilities {
    return {
      textToImage: false,
      externalGenerator: true,
      directApi: false
    };
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    throw new Error('Perchance generation is hosted by Perchance and cannot be called directly from Joelizer.');
  }
}

export const perchanceProvider = new PerchanceImageProvider();
