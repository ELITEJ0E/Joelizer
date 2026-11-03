/**
 * A monotonic clock for browser MediaRecorder exports.
 * MV preview cannot rely on audio currentTime: projects can be silent,
 * audio can end before the final clip, and HTMLAudioElement time updates are delayed.
 */
let active: { originSeconds: number; originMs: number } | null = null;
const samples = new Map<string, { min: number; max: number; count: number }>();

export function startBrowserExportClock(startSeconds: number): void {
  samples.clear();
  active = { originSeconds: startSeconds, originMs: performance.now() };
}

export function getBrowserExportTime(): number | null {
  return active ? active.originSeconds + (performance.now() - active.originMs) / 1000 : null;
}

export function sampleBrowserExportVideo(clipId: string, mediaSeconds: number): void {
  if (!active || !Number.isFinite(mediaSeconds)) return;
  const sample = samples.get(clipId);
  if (sample) {
    sample.min = Math.min(sample.min, mediaSeconds);
    sample.max = Math.max(sample.max, mediaSeconds);
    sample.count++;
  } else {
    samples.set(clipId, { min: mediaSeconds, max: mediaSeconds, count: 1 });
  }
}

export function validateBrowserExportVideo(
  clips: { id: string; type: string; startTime: number; endTime: number }[],
  exportStart: number,
  exportEnd: number
): void {
  for (const clip of clips) {
    if (clip.type !== 'video') continue;
    const overlap = Math.max(0, Math.min(clip.endTime, exportEnd) - Math.max(clip.startTime, exportStart));
    if (overlap <= 0.2) continue;
    const sample = samples.get(clip.id);
    if (!sample) {
      throw new Error(`Video clip "${clip.id}" produced no decodable frames during export. Check the file and its cross-origin access.`);
    }
    if (overlap >= 1.5 && sample.max - sample.min < Math.min(0.4, overlap * 0.2)) {
      throw new Error(`Video clip "${clip.id}" did not advance during export (source stayed at ${sample.min.toFixed(2)}s). Please verify the clip is playable.`);
    }
  }
}

export function stopBrowserExportClock(): void {
  active = null;
  samples.clear();
}
