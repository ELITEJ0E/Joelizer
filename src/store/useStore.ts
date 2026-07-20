import { create } from 'zustand';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface VisualizerSettings {
  style: 'bars' | 'waveform' | 'radial' | 'particles';
  color: string;
  sensitivity: number;
  smoothing: number;
}

export interface BackgroundSettings {
  type: 'color' | 'gradient' | 'image';
  value: string;
  blurAlbumArt: boolean;
}

export interface LyricLine {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

export interface LyricsSettings {
  lines: LyricLine[];
  font: string;
  color: string;
  animationStyle: 'fade' | 'karaoke';
}

export interface LogoSettings {
  image: string | null;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
  size: number; // 0 to 1 scale relative to canvas
}

export interface Layer {
  id: string;
  type: 'background' | 'visualizer' | 'lyrics' | 'logo';
  name: string;
  visible: boolean;
}

interface ProjectState {
  name: string;
  aspectRatio: AspectRatio;
  layers: Layer[];
  visualizerSettings: VisualizerSettings;
  backgroundSettings: BackgroundSettings;
  lyricsSettings: LyricsSettings;
  logoSettings: LogoSettings;
  
  audioFile: File | null;
  audioDuration: number;
  audioUrl: string | null;
  albumArt: string | null;
  
  selectedLayerId: string | null;
  currentTime: number;
  isPlaying: boolean;
  
  // Actions
  setName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setAudio: (file: File, url: string, duration: number, albumArt: string | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  
  updateVisualizerSettings: (settings: Partial<VisualizerSettings>) => void;
  updateBackgroundSettings: (settings: Partial<BackgroundSettings>) => void;
  updateLyricsSettings: (settings: Partial<LyricsSettings>) => void;
  updateLogoSettings: (settings: Partial<LogoSettings>) => void;
  updateLayerVisibility: (id: string, visible: boolean) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

const defaultLayers: Layer[] = [
  { id: 'bg', type: 'background', name: 'Background', visible: true },
  { id: 'vis', type: 'visualizer', name: 'Visualizer', visible: true },
  { id: 'lyr', type: 'lyrics', name: 'Lyrics', visible: true },
  { id: 'logo', type: 'logo', name: 'Logo', visible: true },
];

export const useStore = create<ProjectState>((set) => ({
  name: 'Untitled Project',
  aspectRatio: '16:9',
  layers: defaultLayers,
  selectedLayerId: 'vis',
  
  visualizerSettings: {
    style: 'bars',
    color: '#00e676',
    sensitivity: 0.8,
    smoothing: 0.8,
  },
  
  backgroundSettings: {
    type: 'color',
    value: '#111111',
    blurAlbumArt: false,
  },
  
  lyricsSettings: {
    lines: [],
    font: 'Inter',
    color: '#ffffff',
    animationStyle: 'karaoke',
  },
  
  logoSettings: {
    image: null,
    position: 'bottom-right',
    opacity: 0.8,
    size: 0.15,
  },
  
  audioFile: null,
  audioDuration: 0,
  audioUrl: null,
  albumArt: null,
  
  currentTime: 0,
  isPlaying: false,
  
  setName: (name) => set({ name }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setAudio: (file, url, duration, albumArt) => set({ audioFile: file, audioUrl: url, audioDuration: duration, albumArt }),
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),
  
  updateVisualizerSettings: (updates) => set((state) => ({ visualizerSettings: { ...state.visualizerSettings, ...updates } })),
  updateBackgroundSettings: (updates) => set((state) => ({ backgroundSettings: { ...state.backgroundSettings, ...updates } })),
  updateLyricsSettings: (updates) => set((state) => ({ lyricsSettings: { ...state.lyricsSettings, ...updates } })),
  updateLogoSettings: (updates) => set((state) => ({ logoSettings: { ...state.logoSettings, ...updates } })),
  
  updateLayerVisibility: (id, visible) => set((state) => ({
    layers: state.layers.map(l => l.id === id ? { ...l, visible } : l)
  })),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const newLayers = [...state.layers];
    const [removed] = newLayers.splice(startIndex, 1);
    newLayers.splice(endIndex, 0, removed);
    return { layers: newLayers };
  }),
  
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));
