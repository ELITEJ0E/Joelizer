export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  amount?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  source: string;
  width: number;
  height: number;
}

export interface ProviderCapabilities {
  textToImage: boolean;
  externalGenerator: boolean;
  directApi: boolean;
}

export interface ImageGenerationProvider {
  name: string;
  isAvailable(): boolean;
  getCapabilities(): ProviderCapabilities;
  generateImages(params: GenerateImageParams): Promise<GeneratedImage[]>;
}
