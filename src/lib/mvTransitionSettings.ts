import type { TimelineClip } from '../store/useMVStore';

export type MVTransition = NonNullable<TimelineClip['transition']>;

/**
 * Automatic scenes must follow the Auto Edit transition setting even when
 * a previous generator assigned "cut" or "dissolve" to the clip.
 * Explicitly edited/manual scenes keep their own transition.
 */
export function getEffectiveMVTransition(
  clip: Pick<TimelineClip, 'transition' | 'transitionDuration' | 'editOrigin' | 'manuallyEdited' | 'transitionManuallyEdited'>,
  autoEnabled: boolean,
  defaultTransition: MVTransition,
  defaultDuration: number
): { type: MVTransition; duration: number } {
  const manuallyChosen = clip.transitionManuallyEdited === true;
  const type: MVTransition = manuallyChosen
    ? (clip.transition ?? (autoEnabled ? defaultTransition : 'cut'))
    : (autoEnabled ? defaultTransition : 'cut');
  const duration = Math.max(0.1, Math.min(2,
    manuallyChosen ? (clip.transitionDuration ?? defaultDuration) : defaultDuration));
  return { type, duration };
}
