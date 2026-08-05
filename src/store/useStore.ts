import { create } from 'zustand';
import { 
  saveAudioToStorage, 
  loadAudioFromStorage, 
  saveLyricsToStorage, 
  loadLyricsFromStorage 
} from '../lib/storage';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface VisualizerSettings {
  style: 'bars' | 'waveform' | 'radial' | 'particles' | 'kaleidoscope' | 'orb';
  color: string;
  sensitivity: number;
  smoothing: number;
  segments?: number; // for kaleidoscope, e.g. 6 to 12
  hitResponse: number; // intensity of bass-driven pulse
  glitchIntensity: number; // intensity of chromatic aberration/glitch
  shakeIntensity: number; // intensity of beat-synced shake
  showGrain: boolean; // toggle grain overlay
  showScanlines: boolean; // toggle scanlines overlay
}

export interface BackgroundSettings {
  type: 'color' | 'gradient' | 'image' | 'video';
  value: string;
  blurAlbumArt: boolean;
  fit?: 'cover' | 'contain';
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
  backgroundColor?: string;
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

export interface Track {
  id: string;
  name: string;
  artist: string;
  url: string;
  duration: number; // in seconds
  albumArt?: string;
  isUserUploaded?: boolean;
}

interface ProjectState {
  name: string;
  aspectRatio: AspectRatio;
  layers: Layer[];
  visualizerSettings: VisualizerSettings;
  backgroundSettings: BackgroundSettings;
  lyricsSettings: LyricsSettings;
  logoSettings: LogoSettings;
  
  tracks: Track[];
  currentTrackIndex: number;
  audioFile: File | Blob | null;
  audioDuration: number;
  audioUrl: string | null;
  albumArt: string | null;
  
  selectedLayerId: string | null;
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  
  exportResolutionOverride: '1080p' | '720p' | '360p' | null;
  activeTab: 'lyrics' | 'studio';
  
  // Actions
  setName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setActiveTab: (tab: 'lyrics' | 'studio') => void;
  setExportResolutionOverride: (override: '1080p' | '720p' | '360p' | null) => void;
  setAudio: (file: File | Blob, url: string, duration: number, albumArt: string | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  
  updateVisualizerSettings: (settings: Partial<VisualizerSettings>) => void;
  updateBackgroundSettings: (settings: Partial<BackgroundSettings>) => void;
  updateLyricsSettings: (settings: Partial<LyricsSettings>) => void;
  updateLogoSettings: (settings: Partial<LogoSettings>) => void;
  updateLayerVisibility: (id: string, visible: boolean) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  resetVisualizerSettings: () => void;
  
  setCurrentTime: (time: number) => void;
  setAudioDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLooping: (looping: boolean) => void;
  
  nextTrack: () => void;
  previousTrack: () => void;
  selectTrack: (index: number) => void;
  
  initFromStorage: () => Promise<void>;
}

const defaultLayers: Layer[] = [
  { id: 'bg', type: 'background', name: 'Background', visible: true },
  { id: 'vis', type: 'visualizer', name: 'Visualizer', visible: true },
  { id: 'lyr', type: 'lyrics', name: 'Lyrics', visible: true },
  { id: 'logo', type: 'logo', name: 'Logo', visible: true },
];

const defaultVisualizerSettings: VisualizerSettings = {
  style: 'bars',
  color: '#00e676',
  sensitivity: 0.95,
  smoothing: 0.65,
  segments: 8,
  hitResponse: 0.15,
  glitchIntensity: 0,
  shakeIntensity: 0,
  showGrain: false,
  showScanlines: false,
};

// Initial state starts with stored lyrics if available
const initialLyrics = loadLyricsFromStorage() || [];

export const useStore = create<ProjectState>((set, get) => ({
  name: '',
  aspectRatio: '16:9',
  layers: defaultLayers,
  selectedLayerId: 'vis',
  
  visualizerSettings: defaultVisualizerSettings,
  
  backgroundSettings: {
    type: 'color',
    value: '#111111',
    blurAlbumArt: false,
    fit: 'cover',
  },
  
  lyricsSettings: {
    lines: initialLyrics,
    font: 'Inter',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    animationStyle: 'karaoke',
  },
  
  logoSettings: {
    image: null,
    position: 'bottom-right',
    opacity: 0.8,
    size: 0.15,
  },
  
  tracks: [],
  currentTrackIndex: 0,
  audioFile: null,
  audioDuration: 0,
  audioUrl: null,
  albumArt: null,
  
  currentTime: 0,
  isPlaying: false,
  isLooping: false,
  exportResolutionOverride: null,
  activeTab: 'lyrics',
  
  setName: (name) => set({ name }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setExportResolutionOverride: (exportResolutionOverride) => set({ exportResolutionOverride }),
  setAudio: (file, url, duration, albumArt) => {
    const fileName = (file as File).name || 'Uploaded Track';
    saveAudioToStorage(file, fileName, duration);

    const newTrack: Track = {
      id: `uploaded-${Date.now()}`,
      name: fileName.replace(/\.[^/.]+$/, ""),
      artist: 'Uploaded Audio',
      url: url,
      duration: duration,
      albumArt: albumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop',
      isUserUploaded: true
    };
    
    set((state) => {
      const otherTracks = state.tracks.filter(t => t.id !== newTrack.id);
      const updatedTracks = [newTrack, ...otherTracks];
      return {
        tracks: updatedTracks,
        currentTrackIndex: 0,
        audioFile: file,
        audioUrl: url,
        audioDuration: duration,
        albumArt: newTrack.albumArt || null,
        currentTime: 0,
        isPlaying: false
      };
    });
  },
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),
  
  updateVisualizerSettings: (updates) => set((state) => ({ visualizerSettings: { ...state.visualizerSettings, ...updates } })),
  updateBackgroundSettings: (updates) => set((state) => ({ backgroundSettings: { ...state.backgroundSettings, ...updates } })),
  updateLyricsSettings: (updates) => {
    if (updates.lines) {
      saveLyricsToStorage(updates.lines);
    }
    set((state) => ({ lyricsSettings: { ...state.lyricsSettings, ...updates } }));
  },
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
  resetVisualizerSettings: () => set({ visualizerSettings: defaultVisualizerSettings }),
  
  setCurrentTime: (currentTime) => set({ currentTime }),
  setAudioDuration: (audioDuration) => set({ audioDuration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLooping: (isLooping) => set({ isLooping }),
  
  nextTrack: () => set((state) => {
    if (state.tracks.length === 0) return { currentTime: 0, isPlaying: true };
    if (state.tracks.length <= 1) {
      return { currentTime: 0, isPlaying: true };
    }
    const nextIndex = (state.currentTrackIndex + 1) % state.tracks.length;
    const nextTrack = state.tracks[nextIndex];
    return {
      currentTrackIndex: nextIndex,
      audioUrl: nextTrack.url,
      audioDuration: nextTrack.duration,
      albumArt: nextTrack.albumArt || null,
      currentTime: 0,
      isPlaying: true,
      audioFile: nextTrack.isUserUploaded ? state.audioFile : null
    };
  }),
  
  previousTrack: () => set((state) => {
    if (state.tracks.length === 0) return { currentTime: 0, isPlaying: true };
    if (state.tracks.length <= 1 || state.currentTime > 3) {
      return { currentTime: 0, isPlaying: true };
    }
    const prevIndex = state.currentTrackIndex === 0 ? state.tracks.length - 1 : state.currentTrackIndex - 1;
    const prevTrack = state.tracks[prevIndex];
    return {
      currentTrackIndex: prevIndex,
      audioUrl: prevTrack.url,
      audioDuration: prevTrack.duration,
      albumArt: prevTrack.albumArt || null,
      currentTime: 0,
      isPlaying: true,
      audioFile: prevTrack.isUserUploaded ? state.audioFile : null
    };
  }),
  
  selectTrack: (index) => set((state) => {
    if (index < 0 || index >= state.tracks.length) return {};
    const track = state.tracks[index];
    return {
      currentTrackIndex: index,
      audioUrl: track.url,
      audioDuration: track.duration,
      albumArt: track.albumArt || null,
      currentTime: 0,
      isPlaying: true,
      audioFile: track.isUserUploaded ? state.audioFile : null
    };
  }),

  initFromStorage: async () => {
    const savedAudio = await loadAudioFromStorage();
    if (savedAudio && savedAudio.blob) {
      const url = URL.createObjectURL(savedAudio.blob);
      const track: Track = {
        id: 'stored-track',
        name: savedAudio.name.replace(/\.[^/.]+$/, ""),
        artist: 'Uploaded Audio',
        url: url,
        duration: savedAudio.duration,
        albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop',
        isUserUploaded: true
      };
      set({
        audioFile: savedAudio.blob,
        audioUrl: url,
        audioDuration: savedAudio.duration,
        tracks: [track],
        currentTrackIndex: 0,
        albumArt: track.albumArt || null
      });
    }

    const savedLyrics = loadLyricsFromStorage();
    if (savedLyrics && Array.isArray(savedLyrics) && savedLyrics.length > 0) {
      set((state) => ({
        lyricsSettings: {
          ...state.lyricsSettings,
          lines: savedLyrics
        }
      }));
    }
  }
}));

