import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { audioManager } from '../lib/audio';

/**
 * Global keyboard shortcuts hook for player controls and audio navigation.
 * Handles Space (Play/Pause), P/N or Shift+Left/Right (Prev/Next Track), and Arrow Left/Right (Seek).
 */
export function useGlobalKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if video export is active
      if (useStore.getState().exportResolutionOverride) {
        return;
      }

      // Ignore if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      const isPrevKey = 
        e.key === 'p' || 
        e.key === 'P' || 
        e.key === 'MediaTrackPrevious' || 
        (e.shiftKey && e.code === 'ArrowLeft') ||
        (e.altKey && e.code === 'ArrowLeft');

      const isNextKey = 
        e.key === 'n' || 
        e.key === 'N' || 
        e.key === 'MediaTrackNext' || 
        (e.shiftKey && e.code === 'ArrowRight') ||
        (e.altKey && e.code === 'ArrowRight');

      // 1. Play / Pause with Space
      if (isSpace) {
        e.preventDefault();
        // Blur button or select if focused so Space doesn't re-trigger a click event
        if (tag === 'button' || tag === 'select' || tag === 'a') {
          target?.blur();
        }
        const state = useStore.getState();
        const nextPlaying = !state.isPlaying;
        state.setIsPlaying(nextPlaying);
        if (nextPlaying) {
          const audioCtx = (window as any).webkitAudioContext || window.AudioContext;
          if ((audioManager as any).ctx?.state === 'suspended') {
            (audioManager as any).ctx.resume();
          }
        }
        return;
      }

      // 2. Previous Track
      if (isPrevKey) {
        e.preventDefault();
        if (tag === 'button' || tag === 'select' || tag === 'a') {
          target?.blur();
        }
        useStore.getState().previousTrack();
        return;
      }

      // 3. Next Track
      if (isNextKey) {
        e.preventDefault();
        if (tag === 'button' || tag === 'select' || tag === 'a') {
          target?.blur();
        }
        useStore.getState().nextTrack();
        return;
      }

      // 4. Seek Left/Right
      if (e.code === 'ArrowLeft' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const state = useStore.getState();
        const newTime = Math.max(0, state.currentTime - 5);
        audioManager.seek(newTime);
        state.setCurrentTime(newTime);
      } else if (e.code === 'ArrowRight' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const state = useStore.getState();
        const newTime = Math.min(state.audioDuration || 1000, state.currentTime + 5);
        audioManager.seek(newTime);
        state.setCurrentTime(newTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
