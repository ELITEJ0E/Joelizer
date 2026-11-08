import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { clampOverlay, DEFAULT_OVERLAY, OverlaySettings } from '../lib/overlayEffects';
type OverlayMode = 'lyrics-video' | 'music-video';
interface OverlayEffectsState {
  lyrics: OverlaySettings;
  mv: OverlaySettings;
  update: (mode: OverlayMode, changes: Partial<OverlaySettings>) => void;
  reset: (mode: OverlayMode) => void;
}
export const useOverlayEffectsStore = create<OverlayEffectsState>()(
  persist((set) => ({
    lyrics: { ...DEFAULT_OVERLAY },
    mv: { ...DEFAULT_OVERLAY },
    update: (mode, changes) => set(state => {
      const key = mode === 'music-video' ? 'mv' : 'lyrics';
      return { [key]: clampOverlay({ ...state[key], ...changes }) };
    }),
    reset: mode => set({ [mode === 'music-video' ? 'mv' : 'lyrics']: { ...DEFAULT_OVERLAY } })
  }), { name: 'joelizer-overlay-effects', storage: createJSONStorage(() => sessionStorage),
    partialize: s => ({ lyrics: s.lyrics, mv: s.mv }) })
);
