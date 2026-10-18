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

      // 5. Global Line Marking with [ and ] (when activeTab is not 'lrc', which has dedicated UI handler)
      const isMarkStartKey = (e.key === '[' || (!e.shiftKey && e.code === 'BracketLeft')) && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isMarkEndKey = (e.key === ']' || (!e.shiftKey && e.code === 'BracketRight')) && !e.ctrlKey && !e.metaKey && !e.altKey;

      if ((isMarkStartKey || isMarkEndKey) && useStore.getState().activeTab !== 'lrc') {
        const state = useStore.getState();
        const lines = state.lyricsSettings?.lines;
        if (lines && lines.length > 0) {
          e.preventDefault();
          const curTime = state.currentTime;
          let targetIdx = lines.findIndex(l => l.startTime <= curTime && (l.endTime ? l.endTime >= curTime : l.startTime + 4 >= curTime));
          if (targetIdx === -1) {
            targetIdx = lines.findIndex(l => l.startTime >= curTime);
          }
          if (targetIdx === -1) {
            targetIdx = 0;
          }

          if (isMarkStartKey) {
            const updated = lines.map((l, idx) => {
              if (idx === targetIdx) {
                const oldDur = (l.endTime && l.endTime > l.startTime) ? (l.endTime - l.startTime) : 3.5;
                return {
                  ...l,
                  startTime: Number(curTime.toFixed(2)),
                  endTime: Math.max(Number((curTime + 0.3).toFixed(2)), Number((curTime + oldDur).toFixed(2)))
                };
              }
              return l;
            });
            state.updateLyricsSettings({ lines: updated });
          } else if (isMarkEndKey) {
            const updated = lines.map((l, idx) => {
              if (idx === targetIdx) {
                return {
                  ...l,
                  endTime: Math.max(Number((l.startTime + 0.2).toFixed(2)), Number(curTime.toFixed(2)))
                };
              }
              return l;
            });
            state.updateLyricsSettings({ lines: updated });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
