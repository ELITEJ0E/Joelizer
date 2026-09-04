import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from '../lib/lyricsTemplates';
import { BACKGROUND_PRESETS, BackgroundPreset } from '../lib/lyricsBackgrounds';
import { CanvasElementPositions, ElementPos, getDefaultPositions, DEFAULT_POSITIONS_16_9 } from '../lib/lyricsLayout';
import { useMVStore } from './useMVStore';
import { useStore } from './useStore';

export type { ElementPos, CanvasElementPositions };

export type VideoCreationMode = 'music-video' | 'lyrics-video';

export interface LyricsVideoState {
  videoMode: VideoCreationMode;
  selectedTemplateId: LyricTemplateId;
  selectedBackgroundPresetId: string;
  selectedElement: 'artwork' | 'meta' | 'lyrics' | 'visualizer' | 'watermark' | null;
  visibleLineCount: number;

  elementPositions: CanvasElementPositions;
  animationStyle: 'karaoke' | 'fade';
  
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
  setAnimationStyle: (style: 'karaoke' | 'fade') => void;
  setShowSafeArea: (show: boolean) => void;
  setSelectedElement: (el: 'artwork' | 'meta' | 'lyrics' | 'visualizer' | 'watermark' | null) => void;
  setVisibleLineCount: (count: number) => void;
  setElementPosition: (key: keyof CanvasElementPositions, pos: ElementPos) => void;
  resetElementPositions: (aspectRatio?: string) => void;
  
  // Magic Auto-Generator
  generateLyricsVideo: () => void;
}

export const useLyricsVideoStore = create<LyricsVideoState>()(
  persist(
    (set, get) => ({
      videoMode: 'lyrics-video',
      selectedTemplateId: 'vinyl',
      selectedBackgroundPresetId: 'sunset',
      selectedElement: null,
      visibleLineCount: 2,
      elementPositions: DEFAULT_POSITIONS_16_9,
      animationStyle: 'karaoke',

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

        const currentAspectRatio = useStore.getState().aspectRatio;

        set((s) => ({
          selectedTemplateId: templateId,
          visibleLineCount: tmpl.layout.maxLines || s.visibleLineCount || 2,
          artworkOverride: {
            style: tmpl.layout.artworkType,
            animation: tmpl.layout.artworkAnim,
            sizeScale: s.artworkOverride?.sizeScale ?? 1.0
          },
          animationOverride: {
            lineAnimation: tmpl.animations.lineAnimation,
            wordAnimation: tmpl.animations.wordAnimation,
            intensity: tmpl.animations.intensity
          },
          elementPositions: getDefaultPositions(currentAspectRatio, templateId)
        }));
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
        animationOverride: { ...s.animationOverride, ...updates },
        ...(updates.wordAnimation === 'karaoke' ? { animationStyle: 'karaoke' } : updates.wordAnimation === 'word-fade' ? { animationStyle: 'fade' } : {})
      })),

      setAnimationStyle: (style) => set((s) => ({
        animationStyle: style,
        animationOverride: {
          ...s.animationOverride,
          wordAnimation: style === 'karaoke' ? 'karaoke' : 'word-fade',
          lineAnimation: style === 'fade' ? 'fade' : s.animationOverride.lineAnimation,
        }
      })),

      setShowSafeArea: (showSafeArea) => set({ showSafeArea }),

      setSelectedElement: (selectedElement) => set({ selectedElement }),
      setVisibleLineCount: (visibleLineCount) => set({ visibleLineCount }),
      setElementPosition: (key, pos) => set((s) => ({
        elementPositions: { ...s.elementPositions, [key]: pos }
      })),
      resetElementPositions: (aspectRatio = '16:9') => {
        const currentTemplate = get().selectedTemplateId;
        set({ elementPositions: getDefaultPositions(aspectRatio, currentTemplate) });
      },

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
          targetTemplate = 'vinyl-needle';
        } else if (bpm < 90) {
          targetTemplate = 'circle';
        } else if (language === 'ko' || language === 'ja') {
          targetTemplate = 'cd-needle';
        } else {
          const templates: LyricTemplateId[] = ['vinyl', 'cd', 'square', 'circle', 'full', 'vinyl-needle', 'cd-needle'];
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
