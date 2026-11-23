/** Keep high-resolution routing free-first without ever dropping pixel dimensions. */
export type HighResEngine = 'offline' | 'server';
export type PreferredExportEngine = HighResEngine | 'browser';

/** A connected server is optional; the user's browser can render a 4K MP4. */
export function selectHighResolutionEngine(
  preferred: PreferredExportEngine,
  freeBrowserAvailable: boolean,
  serverAvailable: boolean
): HighResEngine | null {
  if (preferred === 'server' && serverAvailable) return 'server';
  if (freeBrowserAvailable) return 'offline';
  if (serverAvailable) return 'server';
  return null;
}
