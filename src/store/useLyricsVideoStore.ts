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

  showArtwork?: boolean;
  showVisualizer?: boolean;
  showLyrics?: boolean;
  showMeta?: boolean;
  bilingualEnabled?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeEasing?: 'linear' | 'smooth' | 'ease';

  elementPositions: CanvasElementPositions;
  animationStyle: 'karaoke' | 'fade';
  
  customBackground: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    value: string;
    videoUrl?: string;
    fit?: 'cover' | 'contain';
    zoom?: number;
    heightScale?: number;
    offsetX?: number;
    offsetY?: number;
    blur?: number;
    dim?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    vignette?: number;
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
    position?: 'bottom' | 'center' | 'top';
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
  setShowArtwork: (show: boolean) => void;
  setShowVisualizer: (show: boolean) => void;
  setShowLyrics: (show: boolean) => void;
  setShowMeta: (show: boolean) => void;
  setBilingualEnabled: (enabled: boolean) => void;
  setFadeDurations: (fadeIn: number, fadeOut: number, easing?: 'linear' | 'smooth' | 'ease') => void;
  
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
      showArtwork: true,
      showVisualizer: true,
      showLyrics: true,
      showMeta: true,
      bilingualEnabled: false,
      fadeInDuration: 0.4,
      fadeOutDuration: 0.4,
      fadeEasing: 'smooth',

      customBackground: {
        type: 'gradient',
        value: 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #312e81 100%)',
        videoUrl: undefined,
        blur: 0,
        dim: 0
      },

      typographyOverride: {
        fontFamily: 'Outfit',
        fontWeight: '700',
        fontSizeScale: 1.05,
        textColor: '#ffffff',
        activeWordColor: '#fef08a',
        inactiveWordColor: 'rgba(255, 255, 255, 0.7)',
        glowColor: '#eab308',
        showContainerPill: false,
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
        const isCinematicClean = templateId === 'cinematic-clean';

        if (isCinematicClean) {
          useStore.getState().updateVisualizerSettings({ enabled: false });
          useStore.getState().updateLyricsSettings({ animationStyle: 'fade', showBackgroundBox: false, position: 'center' });
        }

        set((s) => ({
          selectedTemplateId: templateId,
          visibleLineCount: tmpl.layout.maxLines || s.visibleLineCount || 2,
          showArtwork: isCinematicClean ? false : (s.showArtwork ?? true),
          showVisualizer: isCinematicClean ? false : (s.showVisualizer ?? true),
          showMeta: isCinematicClean ? false : (s.showMeta ?? true),
          animationStyle: isCinematicClean ? 'fade' : s.animationStyle,
          artworkOverride: {
            style: tmpl.layout.artworkType,
            animation: tmpl.layout.artworkAnim,
            sizeScale: s.artworkOverride?.sizeScale ?? 1.0
          },
          typographyOverride: {
            ...s.typographyOverride,
            // A template change must not force a dark caption box back on.
            showContainerPill: s.typographyOverride.showContainerPill ?? false,
            textColor: isCinematicClean ? '#ffffff' : s.typographyOverride.textColor,
            fontSizeScale: isCinematicClean ? 1.0 : s.typographyOverride.fontSizeScale
          },
          customBackground: {
            ...s.customBackground,
            blur: isCinematicClean ? 0 : s.customBackground.blur,
            dim: isCinematicClean ? 0 : s.customBackground.dim
          },
          animationOverride: {
            lineAnimation: tmpl.animations.lineAnimation,
            wordAnimation: isCinematicClean ? 'word-fade' : tmpl.animations.wordAnimation,
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

      setAnimationStyle: (style) => {
        useStore.getState().updateLyricsSettings({ animationStyle: style });
        set((s) => ({
          animationStyle: style,
          animationOverride: {
            ...s.animationOverride,
            wordAnimation: style === 'karaoke' ? 'karaoke' : 'word-fade',
            lineAnimation: style === 'fade' ? 'fade' : s.animationOverride.lineAnimation,
          }
        }));
      },

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

      setShowArtwork: (showArtwork) => set({ showArtwork }),
      setShowVisualizer: (showVisualizer) => {
        set({ showVisualizer });
        useStore.getState().updateVisualizerSettings({ enabled: showVisualizer });
      },
      setShowLyrics: (showLyrics) => set({ showLyrics }),
      setShowMeta: (showMeta) => set({ showMeta }),
      setBilingualEnabled: (bilingualEnabled) => {
        set({ bilingualEnabled });
        useStore.getState().updateLyricsSettings({ bilingualEnabled });
      },
      setFadeDurations: (fadeIn, fadeOut, easing = 'smooth') => {
        set({ fadeInDuration: fadeIn, fadeOutDuration: fadeOut, fadeEasing: easing });
        useStore.getState().updateLyricsSettings({ fadeInDuration: fadeIn, fadeOutDuration: fadeOut, fadeEasing: easing });
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
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = (persistedState || {}) as Partial<LyricsVideoState>;
        const typography = { ...state.typographyOverride };
        const background = { ...state.customBackground };
        // Previous builds shipped an opaque pill and blurred cover as their
        // hardcoded startup values. Migrate only that stock configuration;
        // custom backgrounds and customized caption styles remain untouched.
        if (typography.showContainerPill === true &&
            typography.pillBgColor === 'rgba(10, 10, 12, 0.85)') {
          typography.showContainerPill = false;
        }
        if (background.type === 'blurred-artwork' && background.value === '#18181b') {
          background.type = 'gradient';
          background.value = 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #312e81 100%)';
          background.blur = 0;
          background.dim = 0;
        }
        return { ...state, typographyOverride: typography, customBackground: background };
      }
    }
  )
);
