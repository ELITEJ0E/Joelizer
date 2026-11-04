import { VideoRenderer, RendererType } from './types';
import { ServerRemotionRenderer } from './ServerRemotionRenderer';
import { LocalFFmpegRenderer } from './LocalFFmpegRenderer';
import { BrowserFallbackRenderer } from './BrowserFallbackRenderer';
import { OfflineWebCodecsRenderer } from './OfflineWebCodecsRenderer';

export async function getBestAvailableRenderer(preferred?: RendererType): Promise<VideoRenderer> {
  const serverRenderer = new ServerRemotionRenderer();
  const localRenderer = new LocalFFmpegRenderer();
  const browserRenderer = new BrowserFallbackRenderer();
  const offlineRenderer = new OfflineWebCodecsRenderer();

  if (preferred === 'offline') {
    if (await offlineRenderer.isAvailable()) return offlineRenderer;
    throw new Error('Smooth MP4 encoding is unavailable in this browser. Try an up-to-date Google Chrome or Microsoft Edge.');
  } else if (preferred === 'local') {
    if (await localRenderer.isAvailable()) return localRenderer;
  } else if (preferred === 'server') {
    if (await serverRenderer.isAvailable()) return serverRenderer;
    throw new Error('Frame-accurate background-safe MP4 export is unavailable. Configure a persistent Node render service (VITE_RENDER_SERVER_URL) or run Joelizer on a local Node server. Browser export is a foreground-only fallback.');
  } else if (preferred === 'browser') {
    if (await browserRenderer.isAvailable()) return browserRenderer;
  }

  // Priority order: independent server -> deterministic offline WebCodecs -> browser.
  if (await serverRenderer.isAvailable()) {
    return serverRenderer;
  }

  if (await offlineRenderer.isAvailable()) return offlineRenderer;

  if (await localRenderer.isAvailable()) {
    return localRenderer;
  }

  return browserRenderer;
}
