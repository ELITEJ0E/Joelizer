/**
 * Privacy-first file-format and provenance hints. These are NOT signature
 * verification, hidden-watermark detection, or an AI-authorship classifier.
 */
export interface AudioFileInspection {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  container: string;
  markerHints: string[];
  scopeNote: string;
}

export function detectAudioContainer(header: Uint8Array, filename: string): string {
  const text = new TextDecoder('latin1').decode(header);
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WAVE') return 'WAV / RIFF';
  if (text.startsWith('fLaC')) return 'FLAC';
  if (text.startsWith('OggS')) return 'Ogg';
  if (text.startsWith('ID3') || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) return 'MP3 / ID3';
  if (text.slice(4, 8) === 'ftyp') return 'MP4 / M4A';
  if (header[0] === 0xff && (header[1] & 0xf0) === 0xf0) return 'AAC / ADTS';
  return filename.match(/\.[^.]+$/)?.[0]?.toUpperCase().replace('.', '') || 'Unknown';
}

export async function inspectAudioFile(file: File): Promise<AudioFileInspection> {
  const sampledBytes = 256 * 1024;
  const first = new Uint8Array(await file.slice(0, sampledBytes).arrayBuffer());
  const last = file.size > sampledBytes
    ? new Uint8Array(await file.slice(Math.max(sampledBytes, file.size - sampledBytes)).arrayBuffer())
    : new Uint8Array();
  const snippet = new TextDecoder('latin1').decode(first) + '\n' + new TextDecoder('latin1').decode(last);
  const hints: string[] = [];
  const candidates = [
    { regex: /c2pa|content.credentials|jumb|c2cl/gi, label: 'Possible C2PA/Content Credentials markers' },
    { regex: /\bsuno\b/gi, label: 'Suno text marker' },
    { regex: /\bsynthid\b/gi, label: 'SynthID text marker' },
    { regex: /ixml|bext|broadcast.wav/gi, label: 'Production metadata (iXML / BWF)' },
    { regex: /isrc/gi, label: 'Possible ISRC text marker' },
    { regex: /lavf|lame|encoder|isft/gi, label: 'Encoder or software tags' }
  ];
  for (const candidate of candidates) {
    if (candidate.regex.test(snippet)) hints.push(candidate.label);
  }
  return {
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'Unspecified',
    container: detectAudioContainer(first, file.name),
    markerHints: hints,
    scopeNote: 'Only the beginning and end of the file were sampled for readable marker strings. Presence is not proof of authenticity; absence does not rule out signed credentials, embedded watermarks, or AI generation.'
  };
}

export async function calculateFileSha256(file: Blob): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('SHA-256 requires a secure browser context.');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export function waveformStructureCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 4) return null;
  const am = a.reduce((x, y) => x + y, 0) / a.length;
  const bm = b.reduce((x, y) => x + y, 0) / b.length;
  let numerator = 0; let da = 0; let db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - am; const y = b[i] - bm;
    numerator += x * y; da += x * x; db += y * y;
  }
  return da * db > 1e-15 ? Math.max(-1, Math.min(1, numerator / Math.sqrt(da * db))) : null;
}
