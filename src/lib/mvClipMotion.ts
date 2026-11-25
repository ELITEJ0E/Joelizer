/** Shared motion geometry for stills and videos, in preview and browser export. */
export type MVClipMotion = 'none' | 'ken-burns-in' | 'ken-burns-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down';
export type MotionTransform = { scale: number; x: number; y: number };

export function getMVClipMotion(
  effect: MVClipMotion | undefined,
  progress: number,
  width: number,
  height: number
): MotionTransform {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  switch (effect) {
    case 'ken-burns-in': return { scale: 1 + 0.18 * t, x: 0, y: 0 };
    case 'ken-burns-out': return { scale: 1.18 - 0.18 * t, x: 0, y: 0 };
    case 'pan-left': return { scale: 1.12, x: -0.08 * width * t, y: 0 };
    case 'pan-right': return { scale: 1.12, x: 0.08 * width * t, y: 0 };
    case 'pan-up': return { scale: 1.12, x: 0, y: -0.08 * height * t };
    case 'pan-down': return { scale: 1.12, x: 0, y: 0.08 * height * t };
    default: return { scale: 1, x: 0, y: 0 };
  }
}

export function applyMVClipMotion(
  ctx: CanvasRenderingContext2D,
  motion: MotionTransform,
  width: number,
  height: number
): void {
  ctx.translate(width / 2 + motion.x, height / 2 + motion.y);
  ctx.scale(motion.scale, motion.scale);
  ctx.translate(-width / 2, -height / 2);
}
