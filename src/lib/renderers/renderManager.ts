import { VideoRenderer, RendererType } from './types';
import { ServerRemotionRenderer } from './ServerRemotionRenderer';
import { LocalFFmpegRenderer } from './LocalFFmpegRenderer';
import { BrowserFallbackRenderer } from './BrowserFallbackRenderer';

export async function getBestAvailableRenderer(preferred?: RendererType): Promise<VideoRenderer> {
  const serverRenderer = new ServerRemotionRenderer();
  const localRenderer = new LocalFFmpegRenderer();
  const browserRenderer = new BrowserFallbackRenderer();

  if (preferred === 'local') {
    if (await localRenderer.isAvailable()) return localRenderer;
  } else if (preferred === 'server') {
    if (await serverRenderer.isAvailable()) return serverRenderer;
  } else if (preferred === 'browser') {
    if (await browserRenderer.isAvailable()) return browserRenderer;
  }

  // Priority order: Server -> Local -> Browser
  if (await serverRenderer.isAvailable()) {
    return serverRenderer;
  }

  if (await localRenderer.isAvailable()) {
    return localRenderer;
  }

  return browserRenderer;
}
