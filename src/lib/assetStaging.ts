import { getRenderServerOrigin, renderApiUrl } from './renderBackend';
/**
 * AssetStaging Layer
 * Uploads local Blobs, Files, and blob: URLs to /api/stage-asset
 * to receive a stable, compact server-renderable URL (e.g. /staged/filename.mp3).
 * This eliminates 413 Payload Too Large errors and enables headless Remotion rendering.
 */

function getCleanExtension(type: string, name?: string, fallback: string = 'mp3'): string {
  if (name && name.includes('.')) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext && ext.length >= 2 && ext.length <= 5) return ext;
  }
  if (!type) return fallback;
  const clean = type.toLowerCase().split(';')[0].trim();
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov'
  };
  return map[clean] || clean.split('/')[1] || fallback;
}

export async function stageAssetIfNeeded(
  source: string | File | Blob | null | undefined,
  fallbackName: string = 'media'
): Promise<string | null> {
  if (!source) return null;

  try {
    // 1. If source is already a renderable HTTP/HTTPS URL or staged path
    if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/staged/')) {
        return source;
      }
      // The dedicated render service must receive local API assets as real
      // files, not references to endpoints hosted on the Vercel frontend.
      if (getRenderServerOrigin() && source.startsWith('/') && !source.startsWith('//')) {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`Cannot fetch render asset ${source}: HTTP ${response.status}`);
        const blob = await response.blob();
        const extension = getCleanExtension(blob.type, source.split('?')[0], 'bin');
        return await uploadFileToStaging(
          new File([blob], `${fallbackName}.${extension}`, { type: blob.type }),
          fallbackName
        );
      }
      // Relative paths that are static assets
      if (!source.startsWith('blob:') && !source.startsWith('data:')) {
        return source;
      }

      // Convert blob: or data: URL to Blob for upload
      try {
        const res = await fetch(source);
        const blob = await res.blob();
        const ext = getCleanExtension(blob.type, undefined, fallbackName.includes('audio') ? 'mp3' : 'jpg');
        const file = new File([blob], `${fallbackName}.${ext}`, { type: blob.type || 'audio/mpeg' });
        return await uploadFileToStaging(file, fallbackName);
      } catch (e) {
        throw new Error(`Unable to upload local media to the render server: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. If source is a File or Blob object
    if (source && typeof source === 'object' && ('type' in source || 'size' in source)) {
      return await uploadFileToStaging(source as Blob, fallbackName);
    }
  } catch (err) {
    throw new Error(`Media staging failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

async function uploadFileToStaging(fileOrBlob: Blob | File, defaultName = 'media'): Promise<string> {
  const isAudio = defaultName.includes('audio') || (fileOrBlob.type && fileOrBlob.type.startsWith('audio/'));
  const ext = getCleanExtension(fileOrBlob.type, fileOrBlob instanceof File ? fileOrBlob.name : undefined, isAudio ? 'mp3' : 'bin');
  const filename = fileOrBlob instanceof File && fileOrBlob.name 
    ? fileOrBlob.name 
    : `${defaultName}.${ext}`;

  const formData = new FormData();
  formData.append('file', fileOrBlob, filename);

  const res = await fetch(renderApiUrl('/api/stage-asset'), {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Failed to stage asset on server (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.url || !data.url.startsWith('/staged/')) {
    throw new Error(data.error || 'Server did not return staged asset URL');
  }

  return data.url;
}
