import { create } from 'zustand';

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
  audioFile: File | null;
  audioDuration: number;
  audioUrl: string | null;
  albumArt: string | null;
  
  selectedLayerId: string | null;
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  
  exportResolutionOverride: '1080p' | '720p' | '360p' | null;
  activeTab: 'lyrics' | 'studio' | 'themes' | 'settings';
  
  // Actions
  setName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setActiveTab: (tab: 'lyrics' | 'studio' | 'themes' | 'settings') => void;
  setExportResolutionOverride: (override: '1080p' | '720p' | '360p' | null) => void;
  setAudio: (file: File, url: string, duration: number, albumArt: string | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  
  updateVisualizerSettings: (settings: Partial<VisualizerSettings>) => void;
  updateBackgroundSettings: (settings: Partial<BackgroundSettings>) => void;
  updateLyricsSettings: (settings: Partial<LyricsSettings>) => void;
  updateLogoSettings: (settings: Partial<LogoSettings>) => void;
  updateLayerVisibility: (id: string, visible: boolean) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  resetVisualizerSettings: () => void;
  
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLooping: (looping: boolean) => void;
  
  nextTrack: () => void;
  previousTrack: () => void;
  selectTrack: (index: number) => void;
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
  sensitivity: 0.8,
  smoothing: 0.8,
  segments: 8,
  hitResponse: 0.5,
  glitchIntensity: 0,
  shakeIntensity: 0,
  showGrain: false,
  showScanlines: false,
};

const defaultTracks: Track[] = [
  {
    id: 'track-1',
    name: 'Retro Wave Horizon',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 372,
    albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: 'track-2',
    name: 'Cybernetic Pulse',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 425,
    albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: 'track-3',
    name: 'Ambient Nebulae',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration: 302,
    albumArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=200&auto=format&fit=crop'
  },
  {
    id: 'track-4',
    name: 'Midnight Overdrive',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration: 502,
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=200&auto=format&fit=crop'
  }
];

export const useStore = create<ProjectState>((set) => ({
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
  
  tracks: defaultTracks,
  currentTrackIndex: 0,
  audioFile: null,
  audioDuration: defaultTracks[0].duration,
  audioUrl: defaultTracks[0].url,
  albumArt: defaultTracks[0].albumArt || null,
  
  currentTime: 0,
  isPlaying: false,
  isLooping: false,
  exportResolutionOverride: null,
  activeTab: 'lyrics',
  
  setName: (name) => set({ name }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setExportResolutionOverride: (exportResolutionOverride) => set({ exportResolutionOverride }),
  setAudio: (file, url, duration, albumArt) => set((state) => {
    // When a custom audio file is uploaded, add it as a new track to the playlist or make it active
    const newTrack: Track = {
      id: `uploaded-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
      artist: 'Uploaded File',
      url: url,
      duration: duration,
      albumArt: albumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop',
      isUserUploaded: true
    };
    
    const updatedTracks = [...state.tracks, newTrack];
    const newIndex = updatedTracks.length - 1;
    
    return {
      tracks: updatedTracks,
      currentTrackIndex: newIndex,
      audioFile: file,
      audioUrl: url,
      audioDuration: duration,
      albumArt: newTrack.albumArt || null,
      currentTime: 0,
      isPlaying: true // play immediately
    };
  }),
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
  resetVisualizerSettings: () => set({ visualizerSettings: defaultVisualizerSettings }),
  
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLooping: (isLooping) => set({ isLooping }),
  
  nextTrack: () => set((state) => {
    const nextIndex = (state.currentTrackIndex + 1) % state.tracks.length;
    const nextTrack = state.tracks[nextIndex];
    return {
      currentTrackIndex: nextIndex,
      audioUrl: nextTrack.url,
      audioDuration: nextTrack.duration,
      albumArt: nextTrack.albumArt || null,
      currentTime: 0,
      isPlaying: true, // Auto-play next track
      audioFile: nextTrack.isUserUploaded ? state.audioFile : null
    };
  }),
  
  previousTrack: () => set((state) => {
    const prevIndex = state.currentTrackIndex === 0 ? state.tracks.length - 1 : state.currentTrackIndex - 1;
    const prevTrack = state.tracks[prevIndex];
    return {
      currentTrackIndex: prevIndex,
      audioUrl: prevTrack.url,
      audioDuration: prevTrack.duration,
      albumArt: prevTrack.albumArt || null,
      currentTime: 0,
      isPlaying: true, // Auto-play previous track
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
}));
