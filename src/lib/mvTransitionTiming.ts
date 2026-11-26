import { getClipSpeed, type SpeedTimedClip } from './clipSpeed';
import type { MVTransition } from './mvTransitionSettings';

type Interval = { startTime: number; endTime: number; type?: string; assetId?: string };
const media = (c: Interval) => c.type !== 'vinyl-lyrics' && c.type !== 'visualizer' &&
  c.assetId !== 'vinyl-lyrics' && c.assetId !== 'visualizer';
/** A newer overlapping clip owns the frame. Ignore only tiny rounding gaps,
 * retaining the previous frame until the next clip begins. Larger gaps remain intentional. */
export function getMVActiveClip<T extends Interval>(clips: readonly T[], time: number): T | undefined {
  let active: T | undefined;
  for (const c of clips) {
    if (c.startTime <= time && time < c.endTime && (!active || c.startTime >= active.startTime)) active = c;
  }
  if (active) return active;
  const next = clips.filter(c => c.startTime > time).sort((a,b) => a.startTime-b.startTime)[0];
  if (!next) return undefined;
  return clips.filter(c => c.endTime <= time && c.endTime > c.startTime &&
    next.startTime - c.endTime <= 0.002).sort((a,b) => b.endTime-a.endTime)[0];
}
/** Incoming media starts before the cut. Cap on both scene lengths and on
 * the outgoing time actually visible before the incoming scene takes over. */
export function getMVTransitionLead(outgoing: Interval | undefined | null, incoming: Interval | undefined | null,
  type: MVTransition = 'cut', duration = 0.5): number {
  if (!outgoing || !incoming || !media(outgoing) || !media(incoming) || type === 'cut' ||
      !Number.isFinite(duration) || incoming.startTime <= outgoing.startTime ||
      incoming.startTime - outgoing.endTime > 0.002) return 0;
  return Math.max(0, Math.min(duration, 2, (incoming.endTime-incoming.startTime)/2,
    (outgoing.endTime-outgoing.startTime)/2, (incoming.startTime-outgoing.startTime)/2));
}
/** Keep an incoming clip moving during pre-roll without exceeding its trim.
 * If there is insufficient source footage, spread the selected range over
 * the extended window instead of playing beyond the end or freezing there. */
export function getMVTransitionPlaybackRate(clip: SpeedTimedClip, lead = 0): number {
  const speed = getClipSpeed(clip);
  const span = clip.trimEnd - clip.trimStart;
  const duration = clip.endTime - clip.startTime + Math.max(0, lead);
  return lead > 0 && span > 0 && duration > 0 ? Math.min(speed, span / duration) : speed;
}
export function getMVTransitionSourceTime(clip: SpeedTimedClip, time: number, lead = 0): number {
  const start = Math.max(0, clip.trimStart);
  const target = start + Math.max(0, time - clip.startTime + lead) * getMVTransitionPlaybackRate(clip, lead);
  const end = clip.trimEnd > start ? Math.max(start, clip.trimEnd - 0.001) : Infinity;
  return Math.min(end, target);
}
export function getMVTransitionProgress(time: number, cut: number, lead: number): number {
  return lead > 0 ? Math.max(0, Math.min(1, (time - cut + lead) / lead)) : 1;
}
export function getMVTransitionVisual(type: MVTransition, progress: number, width: number, height: number) {
  const p = Math.max(0, Math.min(1, progress));
  const ease = p*p*(3-2*p);
  const envelope = Math.sin(p*Math.PI);
  return { opacity: ease, x: type === 'slide' ? width*(1-ease) : 0,
    scale: type === 'zoom' || type === 'morph' ? 1.2-0.2*ease : 1,
    filter: type === 'glitch' ? `hue-rotate(${envelope*45}deg)` :
      type === 'morph' ? `blur(${envelope*Math.min(width,height)*0.004}px)` : undefined };
}
export function applyMVTransitionVisual(ctx: CanvasRenderingContext2D, type: MVTransition, progress: number, w: number, h: number) {
  const v = getMVTransitionVisual(type, progress, w, h);
  ctx.globalAlpha = v.opacity;
  if (v.filter) ctx.filter = v.filter;
  if (v.x) ctx.translate(v.x, 0);
  if (v.scale !== 1) { ctx.translate(w/2,h/2); ctx.scale(v.scale,v.scale); ctx.translate(-w/2,-h/2); }
}
