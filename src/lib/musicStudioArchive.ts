import JSZip from 'jszip';
import type { DAWProject } from '../types/daw';

export interface MusicSessionArchive {
  project: DAWProject;
  fileCount: number;
}

const MAX_ASSETS = 300;
const MAX_TOTAL_BYTES = 800 * 1024 * 1024;

/**
 * Portable Music Studio project format. Stores each unique recording once,
 * then rewrites clip URLs to asset paths inside a ZIP. Unlike project JSON,
 * this archive contains the actual audio used by each clip.
 */
export async function exportMusicSession(project: DAWProject): Promise<Blob> {
  const zip = new JSZip();
  const copy: DAWProject = JSON.parse(JSON.stringify(project));
  const assetPaths = new Map<string, string>();
  let total = 0;
  for (const track of copy.tracks) {
    for (const clip of track.clips) {
      if (!clip.audioUrl) continue;
      const existing = assetPaths.get(clip.audioUrl);
      if (existing) {
        clip.audioUrl = existing;
        continue;
      }
      if (assetPaths.size >= MAX_ASSETS) throw new Error('Too many separate audio files for one project archive.');
      let response: Response;
      try {
        response = await fetch(clip.audioUrl);
      } catch {
        throw new Error('Missing audio for clip "' + clip.name + '". Reimport its source file before saving the session.');
      }
      if (!response.ok) throw new Error('Cannot retrieve source audio for clip "' + clip.name + '".');
      const blob = await response.blob();
      total += blob.size;
      if (total > MAX_TOTAL_BYTES) throw new Error('Session exceeds the 800 MB browser export limit. Export shorter audio stems.');
      const extension = blob.type.includes('mpeg') ? 'mp3'
        : blob.type.includes('ogg') ? 'ogg'
        : blob.type.includes('flac') ? 'flac'
        : blob.type.includes('mp4') ? 'm4a' : 'wav';
      const path = 'audio/clip-' + assetPaths.size + '.' + extension;
      // ArrayBuffer works in browsers and Node's native Blob implementation.
      zip.file(path, await blob.arrayBuffer());
      assetPaths.set(clip.audioUrl, path);
      clip.audioUrl = path;
    }
  }
  zip.file('project.json', JSON.stringify({
    format: 'joelizer-music-session',
    version: 1,
    project: copy,
    audioAssets: assetPaths.size
  }, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } });
}

/** Returns object URLs that must remain valid for the duration of the session. */
export async function importMusicSession(file: Blob): Promise<MusicSessionArchive> {
  if (file.size > MAX_TOTAL_BYTES) throw new Error('Session archive exceeds 800 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifest = zip.file('project.json');
  if (!manifest) throw new Error('This file is missing Music Studio project.json.');
  const parsed = JSON.parse(await manifest.async('string'));
  if (parsed?.format !== 'joelizer-music-session' || parsed?.version !== 1)
    throw new Error('Unsupported Music Studio session format.');
  const project = parsed.project as DAWProject;
  if (!project || !Array.isArray(project.tracks) || project.tracks.length > 150)
    throw new Error('The session has an invalid track arrangement.');
  const ids = new Set<string>();
  for (const track of project.tracks) {
    if (!track || !Array.isArray(track.clips) || track.clips.length > 2000)
      throw new Error('Invalid or oversized track clip list.');
    for (const clip of track.clips) {
      if (!clip.audioUrl || typeof clip.audioUrl !== 'string') throw new Error('Invalid audio asset reference.');
      ids.add(clip.audioUrl);
    }
  }
  if (ids.size > MAX_ASSETS) throw new Error('Too many audio assets.');
  const urls = new Map<string, string>();
  let size = 0;
  try {
    for (const path of ids) {
      // Asset paths must be inside the explicit audio/ directory.
      if (!/^audio\/clip-\d+\.(wav|mp3|m4a|flac|ogg)$/.test(path))
        throw new Error('Unsafe or unsupported clip asset path.');
      const asset = zip.file(path);
      if (!asset) throw new Error('Missing audio asset: ' + path);
      const blob = await asset.async('blob');
      size += blob.size;
      if (size > MAX_TOTAL_BYTES) throw new Error('Decompressed session exceeds 800 MB.');
      const url = URL.createObjectURL(blob);
      urls.set(path, url);
    }
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        clip.audioUrl = urls.get(clip.audioUrl)!;
      }
    }
    return { project, fileCount: urls.size };
  } catch (error) {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    throw error;
  }
}
