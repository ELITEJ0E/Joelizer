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

export interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  lyrics?: string;
  duration: number;
  audioUrl: string;
  createdAt: number;
  tags: string[];
  model: string;
  coverUrl: string;
  isLiked?: boolean;
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
  
  // AI Music Generation
  aiMusicPrompt: string;
  aiMusicLyrics: string;
  aiMusicDuration: number;
  aiMusicStatus: 'idle' | 'generating' | 'ready' | 'error';
  aiMusicStatusText: string;
  aiMusicResultUrl: string | null;
  aiMusicError: string | null;
  generatedTracks: GeneratedTrack[];

  // Actions
  setLocalEngineConnected: (connected: boolean) => void;
  setAiMusicPrompt: (prompt: string) => void;
  setAiMusicLyrics: (lyrics: string) => void;
  setAiMusicDuration: (duration: number) => void;
  setAiMusicStatus: (status: 'idle' | 'generating' | 'ready' | 'error', text?: string) => void;
  setAiMusicResultUrl: (url: string | null) => void;
  setAiMusicError: (error: string | null) => void;
  addGeneratedTrack: (track: GeneratedTrack) => void;
  toggleLikeGeneratedTrack: (id: string) => void;
  deleteGeneratedTrack: (id: string) => void;
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
  addTimelineClip: (clip: TimelineClip) => void;
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

  aiMusicPrompt: 'Upbeat electronic synthwave pop track with heavy bass drop and vocoder lead',
  aiMusicLyrics: '',
  aiMusicDuration: 30,
  aiMusicStatus: 'idle',
  aiMusicStatusText: 'READY',
  aiMusicResultUrl: null,
  aiMusicError: null,
  generatedTracks: [
    {
      id: 'demo-track-1',
      title: 'Neon Seoul Nights x Joelizer',
      prompt: 'Dreamy Y2K K-pop synthwave, soft feminine lead vocals, airy layered harmonies, catchy synth lead',
      lyrics: '[Verse]\nMidnight lights in the city rain\nReflections dancing on the window pane\n[Chorus]\nNeon Seoul Nights calling my name\nWe never will be the same',
      duration: 30,
      audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      createdAt: Date.now() - 3600000,
      tags: ['K-Pop', 'Synthwave', 'Vocal'],
      model: 'ACE-Step v1.5',
      coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      isLiked: true
    },
    {
      id: 'demo-track-2',
      title: 'Cyberpunk Drive',
      prompt: 'High energy 80s synthwave with heavy bass drop, arpeggiator synths, retro drums',
      duration: 30,
      audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=synthwave-80s-110045.mp3',
      createdAt: Date.now() - 7200000,
      tags: ['Synthwave', 'Instrumental'],
      model: 'ACE-Step v1.5',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
      isLiked: false
    }
  ],

  setLocalEngineConnected: (connected) => set({ localEngineConnected: connected }),
  setAiMusicPrompt: (aiMusicPrompt) => set({ aiMusicPrompt }),
  setAiMusicLyrics: (aiMusicLyrics) => set({ aiMusicLyrics }),
  setAiMusicDuration: (aiMusicDuration) => set({ aiMusicDuration }),
  setAiMusicStatus: (status, text) => set({
    aiMusicStatus: status,
    aiMusicStatusText: text || (status === 'generating' ? 'GENERATING' : status === 'ready' ? 'READY' : status === 'error' ? 'ERROR' : 'IDLE')
  }),
  setAiMusicResultUrl: (aiMusicResultUrl) => set({ aiMusicResultUrl }),
  setAiMusicError: (aiMusicError) => set({ aiMusicError }),
  addGeneratedTrack: (track) => set((state) => ({ generatedTracks: [track, ...state.generatedTracks] })),
  toggleLikeGeneratedTrack: (id) => set((state) => ({
    generatedTracks: state.generatedTracks.map(t => t.id === id ? { ...t, isLiked: !t.isLiked } : t)
  })),
  deleteGeneratedTrack: (id) => set((state) => ({
    generatedTracks: state.generatedTracks.filter(t => t.id !== id)
  })),
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
  addTimelineClip: (newClip) => set((s) => {
    const clipDur = Math.max(0.5, newClip.endTime - newClip.startTime);
    let start = newClip.startTime;

    // Overlap avoidance: snap start time to after any overlapping clip
    const sorted = [...s.timelineClips].sort((a, b) => a.startTime - b.startTime);
    for (const existing of sorted) {
      if (start < existing.endTime && start + clipDur > existing.startTime) {
        start = existing.endTime;
      }
    }

    const adjustedClip: TimelineClip = {
      ...newClip,
      startTime: Number(start.toFixed(2)),
      endTime: Number((start + clipDur).toFixed(2))
    };

    return {
      timelineClips: [...s.timelineClips, adjustedClip],
      selectedClipId: adjustedClip.id
    };
  }),
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
