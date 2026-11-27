import type { OverlaySettings } from './overlayEffects';
import { drawOverlayEffects } from './overlayEffects';
export type MVElementKind = 'watermark' | 'text' | 'star' | 'heart' | 'rectangle' | 'circle';
export interface MVCanvasElement {
  id: string; kind: MVElementKind; text: string; x: number; y: number; size: number;
  color: string; opacity: number; startTime: number; endTime: number;
}
export type MVTimedEffect = OverlaySettings & { id: string };
const clamp = (v: number, min: number, max: number, fallback: number) => Number.isFinite(v) ? Math.min(max,Math.max(min,v)) : fallback;
export function makeMVElement(kind: MVElementKind, id: string): MVCanvasElement {
  return { id, kind, text: kind === 'watermark' ? 'JOEL TAN' : 'Your text',
    x: 0.5, y: kind === 'watermark' ? 0.5 : 0.35, size: kind === 'watermark' ? 0.035 : kind === 'text' ? 0.065 : 0.15,
    color: '#ffffff', opacity: kind === 'watermark' ? 0.45 : 1, startTime: 0, endTime: 0 };
}
export function normalizeMVElement(e: MVCanvasElement): MVCanvasElement {
  return { ...e, x: clamp(e.x,0,1,0.5), y: clamp(e.y,0,1,0.5), size: clamp(e.size,0.01,0.8,0.05),
    opacity: clamp(e.opacity,0,1,1), startTime: clamp(e.startTime,0,86400,0), endTime: clamp(e.endTime,0,86400,0),
    text: (e.text || '').slice(0,120) };
}
export const elementActive = (e: MVCanvasElement,t: number) => t >= e.startTime && (e.endTime <= 0 || t < e.endTime);
export const elementIsText = (e: MVCanvasElement) => e.kind === 'text' || e.kind === 'watermark';
export const elementLabel = (e: MVCanvasElement) => e.kind === 'star' ? '★' : e.kind === 'heart' ? '♥' : e.text;
export function elementMetrics(e: MVCanvasElement,w: number,h: number) {
  const size = Math.min(w,h)*e.size;
  return { x: w*e.x, y:h*e.y, size, width: elementIsText(e) ? Math.min(w*0.95,Math.max(size,elementLabel(e).length*size*0.65)) : size,
    height: size };
}
export function drawMVCanvasElements(ctx: CanvasRenderingContext2D,w:number,h:number,time:number,elements: readonly MVCanvasElement[] = []) {
  for (const raw of elements) {
    const e = normalizeMVElement(raw);
    if (!elementActive(e,time)) continue;
    const m = elementMetrics(e,w,h);
    ctx.save();
    ctx.globalAlpha = e.opacity;
    ctx.fillStyle = e.color;
    if (e.kind === 'rectangle') ctx.fillRect(m.x-m.size/2,m.y-m.size/2,m.size,m.size);
    else if (e.kind === 'circle') { ctx.beginPath(); ctx.arc(m.x,m.y,m.size/2,0,Math.PI*2); ctx.fill(); }
    else {
      ctx.font = `${e.kind==='watermark'?600:700} ${m.size}px Arial, sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(elementLabel(e),m.x,m.y,w*0.95);
    }
    ctx.restore();
  }
}
export function drawMVExtraEffects(ctx:CanvasRenderingContext2D,w:number,h:number,time:number,effects:readonly MVTimedEffect[] = []) {
  for (const effect of effects) drawOverlayEffects(ctx,w,h,effect,time);
}
