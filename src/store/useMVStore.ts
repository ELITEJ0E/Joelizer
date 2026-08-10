import { create } from 'zustand';

export interface MediaAsset {
  id: string;
  file?: File;
  url: string; // Object URL or direct HTTP URL
  name: string;
  mediaType: 'video' | 'image';
  duration: number; // in seconds (for images, default e.g. 10s)
  thumbnail: string; // data URL or thumbnail image URL
  isStock?: boolean;
  sourceType?: 'local' | 'url' | 'stock';
  motionScore?: number;
  brightness?: number;
  tags?: string[];
  status: 'pending' | 'analyzing' | 'ready' | 'error';
}

export interface TimelineClip {
  id: string;
  assetId: string;
  startTime: number; // Start time on timeline
  endTime: number;   // End time on timeline
  trimStart: number; // Start trim within media asset
  trimEnd: number;   // End trim within media asset
  locked?: boolean;
  mediaType?: 'video' | 'image';
  effect?: 'ken-burns-in' | 'ken-burns-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'none';
  transition?: 'cut' | 'fade' | 'dissolve' | 'glitch';
}

export interface TimelineText {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: { word: string; start: number; end: number }[];
}

export interface SongAnalysis {
  bpm: number;
  key: string;
  language: string;
  sections: { title: string; startTime: number; endTime: number }[];
}

export interface MVProjectState {
  // Engine Connection
  localEngineConnected: boolean;
  
  // Settings & Edit Parameters
  style: string;
  pacing: string;
  beatSync: string;
  editSeed: number;
  geminiKey: string;
  useGemini: boolean;

  // Media Library
  videoAssets: MediaAsset[];
  stockFolder: string;
  mediaSourceFilter: 'all' | 'my-clips' | 'stock';
  
  // Analysis & Captions
  songAnalysis: SongAnalysis | null;
  wordTimings: TimelineText[];

  // Timeline
  timelineClips: TimelineClip[];
  selectedClipId: string | null;
  
  // Actions
  setLocalEngineConnected: (connected: boolean) => void;
  setStyle: (style: string) => void;
  setPacing: (pacing: string) => void;
  setBeatSync: (beatSync: string) => void;
  setEditSeed: (seed: number) => void;
  setGeminiKey: (key: string) => void;
  setUseGemini: (use: boolean) => void;
  setStockFolder: (folder: string) => void;
  setMediaSourceFilter: (filter: 'all' | 'my-clips' | 'stock') => void;
  setSelectedClipId: (id: string | null) => void;

  addVideoAsset: (asset: MediaAsset) => void;
  updateVideoAsset: (id: string, updates: Partial<MediaAsset>) => void;
  removeVideoAsset: (id: string) => void;

  setSongAnalysis: (analysis: SongAnalysis | null) => void;
  setWordTimings: (timings: TimelineText[]) => void;

  setTimelineClips: (clips: TimelineClip[]) => void;
  updateTimelineClip: (id: string, updates: Partial<TimelineClip>) => void;
  toggleLockClip: (id: string) => void;
  removeTimelineClip: (id: string) => void;
  splitTimelineClip: (id: string, splitTime: number) => void;
}

export const useMVStore = create<MVProjectState>((set) => ({
  localEngineConnected: false,
  style: 'Cinematic',
  pacing: 'Balanced',
  beatSync: 'Strong',
  editSeed: 42,
  geminiKey: '',
  useGemini: false,

  videoAssets: [],
  stockFolder: '',
  mediaSourceFilter: 'all',
  
  songAnalysis: null,
  wordTimings: [],
  timelineClips: [],
  selectedClipId: null,

  setLocalEngineConnected: (connected) => set({ localEngineConnected: connected }),
  setStyle: (style) => set({ style }),
  setPacing: (pacing) => set({ pacing }),
  setBeatSync: (beatSync) => set({ beatSync }),
  setEditSeed: (editSeed) => set({ editSeed }),
  setGeminiKey: (geminiKey) => set({ geminiKey }),
  setUseGemini: (useGemini) => set({ useGemini }),
  setStockFolder: (stockFolder) => set({ stockFolder }),
  setMediaSourceFilter: (mediaSourceFilter) => set({ mediaSourceFilter }),
  setSelectedClipId: (selectedClipId) => set({ selectedClipId }),

  addVideoAsset: (asset) => set((s) => ({ videoAssets: [...s.videoAssets, asset] })),
  updateVideoAsset: (id, updates) => set((s) => ({
    videoAssets: s.videoAssets.map((v) => v.id === id ? { ...v, ...updates } : v)
  })),
  removeVideoAsset: (id) => set((s) => ({
    videoAssets: s.videoAssets.filter((v) => v.id !== id),
    timelineClips: s.timelineClips.filter((c) => c.assetId !== id)
  })),

  setSongAnalysis: (songAnalysis) => set({ songAnalysis }),
  setWordTimings: (wordTimings) => set({ wordTimings }),

  setTimelineClips: (timelineClips) => set({ timelineClips }),
  updateTimelineClip: (id, updates) => set((s) => ({
    timelineClips: s.timelineClips.map((c) => c.id === id ? { ...c, ...updates } : c)
  })),
  toggleLockClip: (id) => set((s) => ({
    timelineClips: s.timelineClips.map((c) => c.id === id ? { ...c, locked: !c.locked } : c)
  })),
  removeTimelineClip: (id) => set((s) => ({
    timelineClips: s.timelineClips.filter((c) => c.id !== id),
    selectedClipId: s.selectedClipId === id ? null : s.selectedClipId
  })),
  splitTimelineClip: (id, splitTime) => set((s) => {
    const clipIndex = s.timelineClips.findIndex(c => c.id === id);
    if (clipIndex === -1) return s;
    const clip = s.timelineClips[clipIndex];
    if (splitTime <= clip.startTime + 0.1 || splitTime >= clip.endTime - 0.1) return s;

    const splitOffset = splitTime - clip.startTime;
    
    const clip1: TimelineClip = {
      ...clip,
      endTime: splitTime,
      trimEnd: clip.trimStart + splitOffset
    };

    const clip2: TimelineClip = {
      ...clip,
      id: `clip-split-${Date.now()}`,
      startTime: splitTime,
      trimStart: clip.trimStart + splitOffset,
      locked: false
    };

    const newClips = [...s.timelineClips];
    newClips.splice(clipIndex, 1, clip1, clip2);

    return { timelineClips: newClips };
  })
}));
