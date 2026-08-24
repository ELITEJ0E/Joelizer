export type TrackType = 
  | 'VOCAL'
  | 'GUITAR'
  | 'BASS'
  | 'DRUMS'
  | 'KEYS'
  | 'SYNTH'
  | 'AI'
  | 'AUDIO'
  | 'OTHER';

export interface DAWClip {
  id: string;
  trackId: string;
  name: string;
  audioUrl: string;
  startTime: number;    // Timeline start offset in seconds
  duration: number;     // Effective duration on timeline in seconds
  sourceStart: number;  // In-point trim inside raw audio in seconds
  sourceEnd: number;    // Out-point trim inside raw audio in seconds
  volume: number;       // 0 to 1.5 linear gain
  fadeIn: number;       // Fade in duration in seconds
  fadeOut: number;      // Fade out duration in seconds
  color?: string;
  peaks?: number[];     // Visual waveform peak array
  isMuted?: boolean;
}

export interface DAWTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number;       // 0 to 1 linear gain
  pan: number;          // -1 (Left) to +1 (Right)
  muted: boolean;
  solo: boolean;
  armed: boolean;       // Armed for microphone/guitar recording
  clips: DAWClip[];
}

export interface DAWProject {
  id: string;
  name: string;
  bpm: number;
  key: string;
  timeSignature: string; // e.g. "4/4", "3/4", "6/8"
  duration: number;      // Total project length in seconds
  tracks: DAWTrack[];
  masterVolume: number;
  loopStart: number;
  loopEnd: number;
  isLooping: boolean;
  createdAt: number;
  updatedAt: number;
  sourceAiPrompt?: string;
}

export interface RecordedTake {
  id: string;
  trackId: string;
  blob: Blob;
  url: string;
  duration: number;
  startTime: number;
  peaks: number[];
}

export type TimelineTool = 'select' | 'split' | 'trim' | 'erase';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}
