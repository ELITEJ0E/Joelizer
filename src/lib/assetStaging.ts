/**
 * AssetStaging Layer
 * Uploads local Blobs, Files, and blob: URLs to /api/stage-asset
 * to receive a stable, compact server-renderable URL (e.g. /staged/filename.mp4).
 * This eliminates 413 Payload Too Large errors when sending export project JSON.
 */

export async function stageAssetIfNeeded(
  source: string | File | Blob | null | undefined,
  fallbackName: string = 'media'
): Promise<string | null> {
  if (!source) return null;

  // 1. If source is already a renderable HTTP/HTTPS URL or staged path
  if (typeof source === 'string') {
    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/staged/')) {
      return source;
    }
    // Relative paths that are static assets
    if (!source.startsWith('blob:') && !source.startsWith('data:')) {
      return source;
    }

    // Convert blob: or data: URL to Blob for upload
    try {
      const res = await fetch(source);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1]?.split(';')[0] || 'bin';
      const file = new File([blob], `${fallbackName}.${ext}`, { type: blob.type });
      return await uploadFileToStaging(file, fallbackName);
    } catch (e) {
      console.warn('[AssetStaging] Failed to fetch blob URL for staging:', source, e);
      return source;
    }
  }

  // 2. If source is a File or Blob object
  if (source && typeof source === 'object' && ('type' in source || 'size' in source)) {
    return await uploadFileToStaging(source as Blob, fallbackName);
  }

  return null;
}

async function uploadFileToStaging(fileOrBlob: Blob | File, defaultName = 'media'): Promise<string> {
  const formData = new FormData();
  const ext = fileOrBlob.type.split('/')[1]?.split(';')[0] || 'bin';
  const filename = fileOrBlob instanceof File ? fileOrBlob.name : `${defaultName}.${ext}`;
  formData.append('file', fileOrBlob, filename);

  const res = await fetch('/api/stage-asset', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Failed to stage asset on server (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.url) {
    throw new Error(data.error || 'Server did not return staged asset URL');
  }

  return data.url;
}
