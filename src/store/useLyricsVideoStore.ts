import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from '../lib/lyricsTemplates';
import { BACKGROUND_PRESETS, BackgroundPreset } from '../lib/lyricsBackgrounds';
import { useMVStore } from './useMVStore';
import { useStore } from './useStore';

export type VideoCreationMode = 'music-video' | 'lyrics-video';

export interface LyricsVideoState {
  videoMode: VideoCreationMode;
  selectedTemplateId: LyricTemplateId;
  selectedBackgroundPresetId: string;
  
  customBackground: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    value: string;
    videoUrl?: string;
  };

  typographyOverride: {
    fontFamily: string;
    fontWeight: string;
    fontSizeScale: number;
    textColor: string;
    activeWordColor: string;
    inactiveWordColor: string;
    glowColor: string;
    showContainerPill: boolean;
    pillBgColor: string;
  };

  artworkOverride: {
    style: ArtworkStyle;
    animation: ArtworkAnimation;
    sizeScale: number;
  };

  animationOverride: {
    lineAnimation: LineAnimation;
    wordAnimation: WordAnimation;
    intensity: number;
  };

  showSafeArea: boolean;
  isAutoGenerating: boolean;

  // Actions
  setVideoMode: (mode: VideoCreationMode) => void;
  setSelectedTemplateId: (templateId: LyricTemplateId) => void;
  setSelectedBackgroundPresetId: (presetId: string) => void;
  setCustomBackground: (bg: Partial<LyricsVideoState['customBackground']>) => void;
  updateTypographyOverride: (updates: Partial<LyricsVideoState['typographyOverride']>) => void;
  updateArtworkOverride: (updates: Partial<LyricsVideoState['artworkOverride']>) => void;
  updateAnimationOverride: (updates: Partial<LyricsVideoState['animationOverride']>) => void;
  setShowSafeArea: (show: boolean) => void;
  
  // Magic Auto-Generator
  generateLyricsVideo: () => void;
}

export const useLyricsVideoStore = create<LyricsVideoState>()(
  persist(
    (set, get) => ({
      videoMode: 'lyrics-video',
      selectedTemplateId: 'vinyl',
      selectedBackgroundPresetId: 'sunset',

      customBackground: {
        type: 'blurred-artwork',
        value: '#18181b',
        videoUrl: undefined
      },

      typographyOverride: {
        fontFamily: 'Outfit',
        fontWeight: '700',
        fontSizeScale: 1.05,
        textColor: '#ffffff',
        activeWordColor: '#fef08a',
        inactiveWordColor: 'rgba(255, 255, 255, 0.7)',
        glowColor: '#eab308',
        showContainerPill: true,
        pillBgColor: 'rgba(10, 10, 12, 0.85)'
      },

      artworkOverride: {
        style: 'vinyl',
        animation: 'rotate',
        sizeScale: 1.0
      },

      animationOverride: {
        lineAnimation: 'slide-up',
        wordAnimation: 'karaoke',
        intensity: 1.0
      },

      showSafeArea: false,
      isAutoGenerating: false,

      setVideoMode: (videoMode) => set({ videoMode }),

      setSelectedTemplateId: (templateId) => {
        const tmpl = LYRIC_VIDEO_TEMPLATES[templateId];
        if (!tmpl) return;

        set({
          selectedTemplateId: templateId,
          customBackground: {
            type: tmpl.defaultBackground.type,
            value: tmpl.defaultBackground.value
          },
          typographyOverride: {
            fontFamily: tmpl.typography.fontFamily,
            fontWeight: tmpl.typography.fontWeight,
            fontSizeScale: tmpl.typography.fontSizeScale,
            textColor: tmpl.typography.textColor,
            activeWordColor: tmpl.typography.activeWordColor,
            inactiveWordColor: tmpl.typography.inactiveWordColor,
            glowColor: tmpl.typography.glowColor,
            showContainerPill: tmpl.typography.showContainerPill,
            pillBgColor: tmpl.typography.pillBgColor
          },
          artworkOverride: {
            style: tmpl.layout.artworkType,
            animation: tmpl.layout.artworkAnim,
            sizeScale: 1.0
          },
          animationOverride: {
            lineAnimation: tmpl.animations.lineAnimation,
            wordAnimation: tmpl.animations.wordAnimation,
            intensity: tmpl.animations.intensity
          }
        });
      },

      setSelectedBackgroundPresetId: (presetId) => {
        const preset = BACKGROUND_PRESETS.find(p => p.id === presetId);
        if (preset) {
          set({
            selectedBackgroundPresetId: presetId,
            customBackground: {
              type: preset.type,
              value: preset.value
            }
          });
        }
      },

      setCustomBackground: (bg) => set((s) => ({ customBackground: { ...s.customBackground, ...bg } })),

      updateTypographyOverride: (updates) => set((s) => ({
        typographyOverride: { ...s.typographyOverride, ...updates }
      })),

      updateArtworkOverride: (updates) => set((s) => ({
        artworkOverride: { ...s.artworkOverride, ...updates }
      })),

      updateAnimationOverride: (updates) => set((s) => ({
        animationOverride: { ...s.animationOverride, ...updates }
      })),

      setShowSafeArea: (showSafeArea) => set({ showSafeArea }),

      generateLyricsVideo: () => {
        set({ isAutoGenerating: true });

        const mvState = useMVStore.getState();
        const mainState = useStore.getState();

        const analysis = mvState.songAnalysis;
        const bpm = analysis?.bpm || 120;
        const language = analysis?.language || 'en';

        // Intelligent template selection based on song profile
        let targetTemplate: LyricTemplateId = 'vinyl';

        if (bpm > 130) {
          targetTemplate = 'kinetic'; // Upbeat / High energy
        } else if (bpm < 90) {
          targetTemplate = 'dreamy'; // Slow / Ballad
        } else if (language === 'ko' || language === 'ja') {
          targetTemplate = 'neon'; // K-pop / J-pop vibe
        } else {
          const templates: LyricTemplateId[] = ['vinyl', 'centered', 'full-screen', 'classic', 'orbital', 'neon', 'karaoke'];
          targetTemplate = templates[Math.floor(Math.random() * templates.length)];
        }

        get().setSelectedTemplateId(targetTemplate);

        setTimeout(() => {
          set({ isAutoGenerating: false });
        }, 600);
      }
    }),
    {
      name: 'lyrics-video-storage',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);
