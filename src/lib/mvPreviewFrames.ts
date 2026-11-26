/** Keep actual decoded footage on screen while a video decoder catches up. */
export function clampPreviewVideoTime(time: number, duration: number): number {
  return Math.max(0, Math.min(time, Number.isFinite(duration) && duration > 0
    ? Math.max(0, duration - 0.001) : Infinity));
}
export function isPreviewFrameReady(video: Pick<HTMLVideoElement, 'readyState' | 'seeking' | 'currentTime' | 'videoWidth' | 'videoHeight'>,
  target: number, speed: number): boolean {
  return video.readyState >= 2 && !video.seeking && video.videoWidth > 0 && video.videoHeight > 0 &&
    Math.abs(video.currentTime - target) < Math.max(0.3, 0.14 * speed);
}
type CachedFrame = { canvas: HTMLCanvasElement; url: string; time: number };
export class MVPreviewFrameCache {
  private frames = new Map<string, CachedFrame>();
  remember(id: string, url: string, video: HTMLVideoElement, target: number, speed: number): void {
    if (!isPreviewFrameReady(video, target, speed)) return;
    const existing = this.frames.get(id);
    if (existing?.url === url && existing.time === video.currentTime) return;
    // Limit backup copies to 1080p-equivalent pixels, not the source's full 4K/8K resolution.
    const scale = Math.min(1, Math.sqrt(1920 * 1080 / (video.videoWidth * video.videoHeight)));
    const w = Math.max(1, Math.round(video.videoWidth * scale)), h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = existing?.url === url ? existing.canvas : document.createElement('canvas');
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try { ctx.drawImage(video, 0, 0, w, h); } catch { return; }
    this.frames.delete(id);
    this.frames.set(id, { canvas, url, time: video.currentTime });
    while (this.frames.size > 3) this.frames.delete(this.frames.keys().next().value!);
  }
  get(id: string, url: string, target: number, speed: number): HTMLCanvasElement | undefined {
    const frame = this.frames.get(id);
    // Do not show an unrelated frame after a large scrub or source replacement.
    if (frame?.url === url && Math.abs(frame.time - target) <= Math.max(0.5, 0.35 * speed)) return frame.canvas;
    return undefined;
  }
  delete(id: string): void { this.frames.delete(id); }
  clear(): void { this.frames.clear(); }
}
