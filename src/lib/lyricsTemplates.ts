import { AspectRatio } from '../store/useStore';

export type LyricTemplateId = 
  | 'classic'
  | 'minimal'
  | 'centered'
  | 'full-screen'
  | 'vinyl'
  | 'orbital'
  | 'cinema'
  | 'kinetic'
  | 'dreamy'
  | 'neon'
  | 'karaoke';

export type ArtworkStyle = 'none' | 'square' | 'circle' | 'vinyl' | 'cd' | 'glowing-disc' | 'floating' | 'framed' | 'background-blur';
export type ArtworkAnimation = 'none' | 'rotate' | 'scale-beat' | 'pulse' | 'float' | 'bounce';
export type LyricPosition = 'center' | 'bottom' | 'top' | 'split';
export type LyricAlignment = 'left' | 'center' | 'right';

export type LineAnimation = 
  | 'fade' 
  | 'slide-up' 
  | 'slide-down' 
  | 'slide-left' 
  | 'slide-right' 
  | 'scale' 
  | 'blur-in' 
  | 'typewriter' 
  | 'bounce' 
  | 'wave' 
  | 'stagger';

export type WordAnimation = 
  | 'karaoke' 
  | 'word-pop' 
  | 'word-scale' 
  | 'word-glow' 
  | 'word-bounce' 
  | 'word-fade' 
  | 'word-slide' 
  | 'word-color' 
  | 'word-underline' 
  | 'word-blur' 
  | 'word-stagger';

export interface LyricVideoTemplate {
  id: LyricTemplateId;
  name: string;
  description: string;
  category: 'Modern' | 'Retro' | 'Minimal' | 'Cinematic' | 'Dynamic';
  previewColor: string;
  badge?: string;
  
  // Layout & Objects
  layout: {
    lyricPosition: LyricPosition;
    lyricAlignment: LyricAlignment;
    maxLines: number; // 1, 2, 3
    showNextLine: boolean;
    showPrevLine: boolean;
    artworkType: ArtworkStyle;
    artworkPosition: 'center' | 'top-center' | 'left' | 'background-blur';
    artworkAnim: ArtworkAnimation;
    showSongTitle: boolean;
    showArtist: boolean;
    titlePosition: 'top' | 'above-lyrics' | 'below-artwork' | 'corner';
  };

  // Typography & Styling Defaults
  typography: {
    fontFamily: string;
    fontWeight: string;
    fontSizeScale: number; // 0.8 to 1.5
    textColor: string;
    activeWordColor: string;
    inactiveWordColor: string;
    glowColor: string;
    shadowColor: string;
    showContainerPill: boolean;
    pillBgColor: string;
  };

  // Animations
  animations: {
    lineAnimation: LineAnimation;
    wordAnimation: WordAnimation;
    intensity: number; // 0.5 to 2.0
  };

  // Default Background Preset
  defaultBackground: {
    type: 'color' | 'gradient' | 'image' | 'video' | 'particles' | 'blurred-artwork' | 'waveform';
    presetName: string;
    value: string;
  };
}

export const LYRIC_VIDEO_TEMPLATES: Record<LyricTemplateId, LyricVideoTemplate> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Clean bold typography with floating album art card and subtle dark gradient.',
    category: 'Modern',
    previewColor: '#3b82f6',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'square',
      artworkPosition: 'top-center',
      artworkAnim: 'pulse',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Inter',
      fontWeight: '800',
      fontSizeScale: 1.0,
      textColor: '#ffffff',
      activeWordColor: '#38bdf8',
      inactiveWordColor: 'rgba(255, 255, 255, 0.65)',
      glowColor: '#0284c7',
      shadowColor: 'rgba(0,0,0,0.8)',
      showContainerPill: true,
      pillBgColor: 'rgba(0, 0, 0, 0.65)'
    },
    animations: {
      lineAnimation: 'fade',
      wordAnimation: 'word-color',
      intensity: 1.0
    },
    defaultBackground: {
      type: 'gradient',
      presetName: 'Sunset',
      value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
    }
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean white text on deep monochrome canvas with gentle fades.',
    category: 'Minimal',
    previewColor: '#94a3b8',
    layout: {
      lyricPosition: 'center',
      lyricAlignment: 'center',
      maxLines: 1,
      showNextLine: false,
      showPrevLine: false,
      artworkType: 'none',
      artworkPosition: 'center',
      artworkAnim: 'none',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'corner'
    },
    typography: {
      fontFamily: 'Inter',
      fontWeight: '600',
      fontSizeScale: 1.1,
      textColor: '#ffffff',
      activeWordColor: '#ffffff',
      inactiveWordColor: 'rgba(255, 255, 255, 0.4)',
      glowColor: 'transparent',
      shadowColor: 'transparent',
      showContainerPill: false,
      pillBgColor: 'transparent'
    },
    animations: {
      lineAnimation: 'blur-in',
      wordAnimation: 'word-fade',
      intensity: 0.8
    },
    defaultBackground: {
      type: 'color',
      presetName: 'Minimal',
      value: '#09090b'
    }
  },

  centered: {
    id: 'centered',
    name: 'Centered Focus',
    description: 'Impactful centered typography with active word glow and framed artwork.',
    category: 'Modern',
    previewColor: '#a855f7',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'framed',
      artworkPosition: 'top-center',
      artworkAnim: 'scale-beat',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: '800',
      fontSizeScale: 1.15,
      textColor: '#ffffff',
      activeWordColor: '#f0abfc',
      inactiveWordColor: 'rgba(255, 255, 255, 0.6)',
      glowColor: '#c084fc',
      shadowColor: 'rgba(0,0,0,0.9)',
      showContainerPill: true,
      pillBgColor: 'rgba(15, 10, 30, 0.75)'
    },
    animations: {
      lineAnimation: 'slide-up',
      wordAnimation: 'word-glow',
      intensity: 1.2
    },
    defaultBackground: {
      type: 'particles',
      presetName: 'Cosmic',
      value: 'radial-gradient(circle at center, #1e1b4b 0%, #030712 100%)'
    }
  },

  'full-screen': {
    id: 'full-screen',
    name: 'Full Screen',
    description: 'Oversized display typography dominating the full viewport canvas.',
    category: 'Dynamic',
    previewColor: '#ec4899',
    layout: {
      lyricPosition: 'center',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'background-blur',
      artworkPosition: 'background-blur',
      artworkAnim: 'none',
      showSongTitle: false,
      showArtist: false,
      titlePosition: 'corner'
    },
    typography: {
      fontFamily: 'Syne',
      fontWeight: '900',
      fontSizeScale: 1.4,
      textColor: '#ffffff',
      activeWordColor: '#f472b6',
      inactiveWordColor: 'rgba(255, 255, 255, 0.45)',
      glowColor: '#db2777',
      shadowColor: 'rgba(0,0,0,0.95)',
      showContainerPill: false,
      pillBgColor: 'transparent'
    },
    animations: {
      lineAnimation: 'scale',
      wordAnimation: 'word-pop',
      intensity: 1.4
    },
    defaultBackground: {
      type: 'blurred-artwork',
      presetName: 'Aurora',
      value: '#0f172a'
    }
  },

  vinyl: {
    id: 'vinyl',
    name: 'Vinyl Record',
    description: 'Rotating vinyl record with album art center label, groove reflections & sync lyrics.',
    category: 'Retro',
    previewColor: '#f59e0b',
    badge: 'Popular',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'vinyl',
      artworkPosition: 'top-center',
      artworkAnim: 'rotate',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSizeScale: 1.05,
      textColor: '#ffffff',
      activeWordColor: '#fef08a',
      inactiveWordColor: 'rgba(255, 255, 255, 0.7)',
      glowColor: '#eab308',
      shadowColor: 'rgba(0,0,0,0.9)',
      showContainerPill: true,
      pillBgColor: 'rgba(10, 10, 12, 0.85)'
    },
    animations: {
      lineAnimation: 'slide-up',
      wordAnimation: 'karaoke',
      intensity: 1.0
    },
    defaultBackground: {
      type: 'blurred-artwork',
      presetName: 'Sunset',
      value: '#18181b'
    }
  },

  orbital: {
    id: 'orbital',
    name: 'Orbital Ring',
    description: 'Circular orbiting particle ring around floating artwork with floating lyrics.',
    category: 'Dynamic',
    previewColor: '#10b981',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'glowing-disc',
      artworkPosition: 'top-center',
      artworkAnim: 'float',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Outfit',
      fontWeight: '800',
      fontSizeScale: 1.0,
      textColor: '#ffffff',
      activeWordColor: '#34d399',
      inactiveWordColor: 'rgba(255, 255, 255, 0.6)',
      glowColor: '#059669',
      shadowColor: 'rgba(0,0,0,0.85)',
      showContainerPill: true,
      pillBgColor: 'rgba(6, 78, 59, 0.4)'
    },
    animations: {
      lineAnimation: 'wave',
      wordAnimation: 'word-glow',
      intensity: 1.2
    },
    defaultBackground: {
      type: 'particles',
      presetName: 'Aurora',
      value: '#022c22'
    }
  },

  cinema: {
    id: 'cinema',
    name: 'Cinema Letterbox',
    description: 'Wide cinematic aesthetic with elegant serif typography and letterbox bars.',
    category: 'Cinematic',
    previewColor: '#6366f1',
    layout: {
      lyricPosition: 'center',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'none',
      artworkPosition: 'center',
      artworkAnim: 'none',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'top'
    },
    typography: {
      fontFamily: 'Playfair Display',
      fontWeight: '700',
      fontSizeScale: 1.2,
      textColor: '#f8fafc',
      activeWordColor: '#818cf8',
      inactiveWordColor: 'rgba(248, 250, 252, 0.5)',
      glowColor: '#4f46e5',
      shadowColor: 'rgba(0,0,0,0.95)',
      showContainerPill: false,
      pillBgColor: 'transparent'
    },
    animations: {
      lineAnimation: 'fade',
      wordAnimation: 'word-fade',
      intensity: 0.9
    },
    defaultBackground: {
      type: 'gradient',
      presetName: 'Cinematic',
      value: 'linear-gradient(180deg, #090d16 0%, #030712 100%)'
    }
  },

  kinetic: {
    id: 'kinetic',
    name: 'Kinetic Pop',
    description: 'High energy word scaling and dynamic motion designed for upbeat tracks.',
    category: 'Dynamic',
    previewColor: '#ef4444',
    layout: {
      lyricPosition: 'center',
      lyricAlignment: 'center',
      maxLines: 1,
      showNextLine: false,
      showPrevLine: false,
      artworkType: 'cd',
      artworkPosition: 'top-center',
      artworkAnim: 'bounce',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'corner'
    },
    typography: {
      fontFamily: 'Space Grotesk',
      fontWeight: '900',
      fontSizeScale: 1.3,
      textColor: '#ffffff',
      activeWordColor: '#f87171',
      inactiveWordColor: 'rgba(255, 255, 255, 0.4)',
      glowColor: '#dc2626',
      shadowColor: 'rgba(0,0,0,0.9)',
      showContainerPill: true,
      pillBgColor: 'rgba(127, 29, 29, 0.5)'
    },
    animations: {
      lineAnimation: 'bounce',
      wordAnimation: 'word-pop',
      intensity: 1.6
    },
    defaultBackground: {
      type: 'waveform',
      presetName: 'Cyberpunk',
      value: '#450a0a'
    }
  },

  dreamy: {
    id: 'dreamy',
    name: 'Dreamy Pastel',
    description: 'Soft pastel glow, gentle floating motion, and airy typography.',
    category: 'Modern',
    previewColor: '#f472b6',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'circle',
      artworkPosition: 'top-center',
      artworkAnim: 'float',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: '700',
      fontSizeScale: 1.05,
      textColor: '#fce7f3',
      activeWordColor: '#f9a8d4',
      inactiveWordColor: 'rgba(252, 231, 243, 0.65)',
      glowColor: '#ec4899',
      shadowColor: 'rgba(0,0,0,0.7)',
      showContainerPill: true,
      pillBgColor: 'rgba(131, 24, 67, 0.4)'
    },
    animations: {
      lineAnimation: 'stagger',
      wordAnimation: 'word-glow',
      intensity: 1.1
    },
    defaultBackground: {
      type: 'gradient',
      presetName: 'Dreamy',
      value: 'linear-gradient(135deg, #2e1065 0%, #701a75 50%, #1e1b4b 100%)'
    }
  },

  neon: {
    id: 'neon',
    name: 'Cyberpunk Neon',
    description: 'Intense electric neon outline and glowing active words over cyberpunk grid.',
    category: 'Retro',
    previewColor: '#06b6d4',
    badge: 'Electrifying',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: false,
      artworkType: 'glowing-disc',
      artworkPosition: 'top-center',
      artworkAnim: 'pulse',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Space Grotesk',
      fontWeight: '800',
      fontSizeScale: 1.1,
      textColor: '#ffffff',
      activeWordColor: '#22d3ee',
      inactiveWordColor: 'rgba(255, 255, 255, 0.5)',
      glowColor: '#0891b2',
      shadowColor: 'rgba(6, 182, 212, 0.9)',
      showContainerPill: true,
      pillBgColor: 'rgba(8, 51, 68, 0.75)'
    },
    animations: {
      lineAnimation: 'slide-right',
      wordAnimation: 'word-glow',
      intensity: 1.5
    },
    defaultBackground: {
      type: 'particles',
      presetName: 'Neon',
      value: '#083344'
    }
  },

  karaoke: {
    id: 'karaoke',
    name: 'Dual Karaoke',
    description: 'Classic dual-line karaoke display with active golden word highlight fill.',
    category: 'Retro',
    previewColor: '#eab308',
    layout: {
      lyricPosition: 'bottom',
      lyricAlignment: 'center',
      maxLines: 2,
      showNextLine: true,
      showPrevLine: true,
      artworkType: 'square',
      artworkPosition: 'top-center',
      artworkAnim: 'scale-beat',
      showSongTitle: true,
      showArtist: true,
      titlePosition: 'below-artwork'
    },
    typography: {
      fontFamily: 'Inter',
      fontWeight: '900',
      fontSizeScale: 1.15,
      textColor: '#ffffff',
      activeWordColor: '#fde047',
      inactiveWordColor: 'rgba(255, 255, 255, 0.85)',
      glowColor: '#ca8a04',
      shadowColor: 'rgba(0,0,0,0.95)',
      showContainerPill: true,
      pillBgColor: 'rgba(0, 0, 0, 0.8)'
    },
    animations: {
      lineAnimation: 'slide-up',
      wordAnimation: 'karaoke',
      intensity: 1.0
    },
    defaultBackground: {
      type: 'gradient',
      presetName: 'Sunset',
      value: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)'
    }
  }
};
