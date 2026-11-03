/**
 * High-quality exports are rendered by a persistent Node/Remotion service.
 * Vercel functions cannot host this job queue or provide persistent staging.
 *
 * Set VITE_RENDER_SERVER_URL to the full HTTPS origin of the Node service.
 * No trailing slash, path, query parameters or credentials are permitted.
 * Same-origin is used when no dedicated service is configured.
 */
export function getRenderServerOrigin(): string {
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_RENDER_SERVER_URL?: string } }).env;
  const value = (viteEnv?.VITE_RENDER_SERVER_URL || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('invalid render backend URL');
    }
    // localhost HTTP supports development only. Public URLs must use HTTPS.
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('a remote render backend must use HTTPS');
    }
    return url.origin;
  } catch {
    throw new Error('VITE_RENDER_SERVER_URL must be a valid HTTPS origin (e.g. https://render.example.com).');
  }
}

export function renderApiUrl(path: string): string {
  return getRenderServerOrigin() + path;
}

export function resolveRenderAssetUrl(url: string): string {
  if (url.startsWith('/staged/')) {
    return getRenderServerOrigin() + url;
  }
  return url;
}
