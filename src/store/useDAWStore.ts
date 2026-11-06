import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DAWClip, DAWProject, DAWTrack, TimelineTool, TrackType } from '../types/daw';
import { dawAudioEngine } from '../lib/dawAudioEngine';
import { useStore } from './useStore';
import { useMVStore } from './useMVStore';
import { ArrangementMarker, ArrangementSnapshot, normalizeMarkers, normalizeClipEdit, snapTime } from '../lib/dawArrangement';
import { splitClipFades } from '../lib/dawAudioProcessing';

export const TRACK_TYPE_COLORS: Record<TrackType, string> = {
  VOCAL: '#f43f5e',   // Rose
  GUITAR: '#f59e0b',  // Amber
  BASS: '#8b5cf6',    // Violet
  DRUMS: '#06b6d4',   // Cyan
  KEYS: '#3b82f6',    // Blue
  SYNTH: '#d946ef',   // Fuchsia
  AI: '#10b981',      // Emerald
  AUDIO: '#14b8a6',   // Teal
  OTHER: '#64748b'    // Slate
};

const defaultInitialTracks: DAWTrack[] = [
  {
    id: 'track-vocal',
    name: 'Vocal 1',
    type: 'VOCAL',
    color: TRACK_TYPE_COLORS.VOCAL,
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    clips: []
  },
  {
    id: 'track-guitar',
    name: 'Guitar 1',
    type: 'GUITAR',
    color: TRACK_TYPE_COLORS.GUITAR,
    volume: 0.85,
    pan: -0.2,
    muted: false,
    solo: false,
    armed: false,
    clips: []
  },
  {
    id: 'track-drums',
    name: 'Drums',
    type: 'DRUMS',
    color: TRACK_TYPE_COLORS.DRUMS,
    volume: 0.85,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    clips: []
  },
  {
    id: 'track-ai-music',
    name: 'AI Master Track',
    type: 'AI',
    color: TRACK_TYPE_COLORS.AI,
    volume: 1.0,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    clips: []
  }
];

interface DAWState {
  // Project Metadata
  projectId: string;
  projectName: string;
  bpm: number;
  key: string;
  timeSignature: string;
  projectDuration: number;
  masterVolume: number;
  
  // Transport & Playback
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;

  // Recording
  isRecording: boolean;
  recordingStartTime: number;
  armedTrackId: string | null;
  inputMonitoringEnabled: boolean;
  selectedInputDeviceId: string | null;

  // Tracks & Clips
  tracks: DAWTrack[];
  selectedTrackId: string | null;
  selectedClipId: string | null;
  markers: ArrangementMarker[];
  addMarker: (name?: string) => void;
  updateMarker: (id: string, updates: Partial<ArrangementMarker>) => void;
  removeMarker: (id: string) => void;
  navigateMarker: (direction: -1 | 1) => void;
  loopSelectedClip: () => void;
  repeatClip: (clipId: string, count: number) => void;
  editClip: (clipId: string, updates: Partial<DAWClip>) => void;
  
  // Timeline View & UI
  timelineZoom: number; // Pixels per second (e.g. 80)
  timelineScrollX: number;
  activeTool: TimelineTool;
  snapToGrid: boolean;
  gridDivision: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | 'off';
  showLyricsRuler: boolean;

  // History Undo/Redo
  history: ArrangementSnapshot[];
  historyIndex: number;

  // Actions - Transport
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setBpm: (bpm: number) => void;
  setKey: (key: string) => void;
  setTimeSignature: (ts: string) => void;
  setProjectName: (name: string) => void;
  setMasterVolume: (vol: number) => void;
  setLoopRegion: (start: number, end: number) => void;
  toggleLoop: () => void;

  // Actions - Tools & Timeline View
  setActiveTool: (tool: TimelineTool) => void;
  setTimelineZoom: (zoom: number | ((prev: number) => number)) => void;
  setTimelineScrollX: (scroll: number | ((prev: number) => number)) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridDivision: (div: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | 'off') => void;
  setShowLyricsRuler: (show: boolean) => void;

  // Actions - Tracks
  setSelectedTrackId: (id: string | null) => void;
  addTrack: (type?: TrackType, name?: string) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<DAWTrack>) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackArmed: (trackId: string) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;

  // Actions - Clips
  setSelectedClipId: (id: string | null) => void;
  addClip: (trackId: string, clip: Omit<DAWClip, 'id' | 'trackId'> & { id?: string }) => string;
  updateClip: (clipId: string, updates: Partial<DAWClip>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
  trimClip: (clipId: string, newStartTime: number, newDuration: number, newSourceStart: number, newSourceEnd: number) => void;

  // Actions - Recording
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setInputMonitoringEnabled: (enabled: boolean) => void;
  setSelectedInputDeviceId: (deviceId: string | null) => void;

  // Actions - Undo / Redo History
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Actions - AI & Project Workflows
  importGeneratedSongToDAW: (song: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
    bpm?: number;
    key?: string;
    lyrics?: string;
    coverUrl?: string;
  }) => Promise<void>;
  
  newProject: () => void;
  getCanonicalProjectJson: () => DAWProject;
  loadCanonicalProjectJson: (project: DAWProject) => void;
}

export const useDAWStore = create<DAWState>()(
  persist(
    (set, get) => {
      // Register central audio engine time update listener
      dawAudioEngine.setOnTimeUpdate((time) => {
        set({ currentTime: time });
        // Sync with primary useStore currentTime for lyrics & visualizer
        useStore.getState().setCurrentTime(time);
      });
      const initialMarkers: ArrangementMarker[] = [];

      return {
        projectId: `proj-${Date.now()}`,
        projectName: 'New DAW Song',
        bpm: 120,
        key: 'C Major',
        timeSignature: '4/4',
        projectDuration: 180,
        masterVolume: 1.0,

        currentTime: 0,
        isPlaying: false,
        isLooping: false,
        loopStart: 0,
        loopEnd: 32,

        isRecording: false,
        recordingStartTime: 0,
        armedTrackId: null,
        inputMonitoringEnabled: false,
        selectedInputDeviceId: null,

        tracks: defaultInitialTracks,
        selectedTrackId: 'track-ai-music',
        selectedClipId: null,
        markers: initialMarkers,

        timelineZoom: 70, // 70px per second
        timelineScrollX: 0,
        activeTool: 'select',
        snapToGrid: true,
        gridDivision: '1/4',
        showLyricsRuler: true,

        history: [{ tracks: defaultInitialTracks, markers: initialMarkers }],
        historyIndex: 0,

        // --- Transport Implementation ---
        play: () => {
          const { currentTime, tracks, isLooping, loopStart, loopEnd } = get();
          dawAudioEngine.setMasterVolume(get().masterVolume);
          dawAudioEngine.play(currentTime, tracks, isLooping, loopStart, loopEnd);
          set({ isPlaying: true });
          useStore.getState().setIsPlaying(true);
        },

        pause: () => {
          const pauseTime = dawAudioEngine.pause();
          set({ isPlaying: false, currentTime: pauseTime });
          useStore.getState().setIsPlaying(false);
          useStore.getState().setCurrentTime(pauseTime);
        },

        stop: () => {
          dawAudioEngine.stop();
          set({ isPlaying: false, currentTime: 0 });
          useStore.getState().setIsPlaying(false);
          useStore.getState().setCurrentTime(0);
        },

        seek: (time: number) => {
          const { tracks, isLooping, loopStart, loopEnd } = get();
          const clamped = Math.max(0, time);
          dawAudioEngine.seek(clamped, tracks, isLooping, loopStart, loopEnd);
          set({ currentTime: clamped });
          useStore.getState().setCurrentTime(clamped);
        },

        setCurrentTime: (currentTime: number) => set({ currentTime }),
        setBpm: (bpm: number) => set({ bpm: Math.max(40, Math.min(280, bpm)) }),
        setKey: (key: string) => set({ key }),
        setTimeSignature: (timeSignature: string) => set({ timeSignature }),
        setProjectName: (projectName: string) => set({ projectName }),
        setMasterVolume: (masterVolume: number) => {
          dawAudioEngine.setMasterVolume(masterVolume);
          set({ masterVolume });
        },

        setLoopRegion: (loopStart: number, loopEnd: number) => {
          const start = Number.isFinite(loopStart) ? Math.max(0, loopStart) : 0;
          set({ loopStart: start, loopEnd: Number.isFinite(loopEnd) ? Math.max(start + .01, loopEnd) : start + .01 });
        },

        toggleLoop: () => set(state => ({ isLooping: !state.isLooping })),

        // --- Timeline & Tools ---
        setActiveTool: (activeTool: TimelineTool) => set({ activeTool }),
        setTimelineZoom: (timelineZoom) => set(state => ({
          timelineZoom: Math.max(20, Math.min(300, typeof timelineZoom === 'function' ? timelineZoom(state.timelineZoom) : timelineZoom))
        })),
        setTimelineScrollX: (timelineScrollX) => set(state => ({
          timelineScrollX: Math.max(0, typeof timelineScrollX === 'function' ? timelineScrollX(state.timelineScrollX) : timelineScrollX)
        })),
        setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
        setGridDivision: (gridDivision) => set({ gridDivision }),
        setShowLyricsRuler: (showLyricsRuler) => set({ showLyricsRuler }),

        // --- Track Management ---
        setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId, selectedClipId: null }),

        addTrack: (type: TrackType = 'AUDIO', name?: string) => {
          const newId = `track-${crypto.randomUUID()}`;
          const trackCount = get().tracks.filter(t => t.type === type).length + 1;
          const trackName = name || `${type.charAt(0) + type.slice(1).toLowerCase()} ${trackCount}`;

          const newTrack: DAWTrack = {
            id: newId,
            name: trackName,
            type,
            color: TRACK_TYPE_COLORS[type] || '#64748b',
            volume: 0.85,
            pan: 0,
            muted: false,
            solo: false,
            armed: false,
            clips: []
          };

          set(state => {
            const updated = [...state.tracks, newTrack];
            dawAudioEngine.updateTrackParameters(updated);
            return {
              tracks: updated,
              selectedTrackId: newId,
              selectedClipId: null
            };
          });

          get().commitHistory();
          return newId;
        },

        removeTrack: (trackId: string) => {
          set(state => {
            const updated = state.tracks.filter(t => t.id !== trackId);
            dawAudioEngine.updateTrackParameters(updated);
            return {
              tracks: updated,
              selectedTrackId: state.selectedTrackId === trackId ? (updated[0]?.id || null) : state.selectedTrackId,
              selectedClipId: updated.some(t => t.clips.some(c => c.id === state.selectedClipId)) ? state.selectedClipId : null,
              armedTrackId: state.armedTrackId === trackId ? null : state.armedTrackId
            };
          });
          get().commitHistory();
        },

        updateTrack: (trackId: string, updates: Partial<DAWTrack>) => {
          set(state => {
            const updated = state.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t);
            dawAudioEngine.updateTrackParameters(updated);
            return { tracks: updated };
          });
        },

        setTrackVolume: (trackId: string, volume: number) => {
          set(state => {
            const updated = state.tracks.map(t => t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1.5, volume)) } : t);
            dawAudioEngine.updateTrackParameters(updated);
            return { tracks: updated };
          });
        },

        setTrackPan: (trackId: string, pan: number) => {
          set(state => {
            const updated = state.tracks.map(t => t.id === trackId ? { ...t, pan: Math.max(-1, Math.min(1, pan)) } : t);
            dawAudioEngine.updateTrackParameters(updated);
            return { tracks: updated };
          });
        },

        toggleTrackMute: (trackId: string) => {
          set(state => {
            const updated = state.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t);
            dawAudioEngine.updateTrackParameters(updated);
            return { tracks: updated };
          });
        },

        toggleTrackSolo: (trackId: string) => {
          set(state => {
            const updated = state.tracks.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t);
            dawAudioEngine.updateTrackParameters(updated);
            return { tracks: updated };
          });
        },

        toggleTrackArmed: (trackId: string) => {
          set(state => {
            const isCurrentlyArmed = state.tracks.find(t => t.id === trackId)?.armed;
            const updated = state.tracks.map(t => ({
              ...t,
              armed: t.id === trackId ? !isCurrentlyArmed : false // Exclusive arming
            }));
            return {
              tracks: updated,
              armedTrackId: !isCurrentlyArmed ? trackId : null
            };
          });
        },

        reorderTracks: (startIndex: number, endIndex: number) => {
          set(state => {
            const newTracks = [...state.tracks];
            const [removed] = newTracks.splice(startIndex, 1);
            newTracks.splice(endIndex, 0, removed);
            return { tracks: newTracks };
          });
          get().commitHistory();
        },

        // --- Clip Management ---
        setSelectedClipId: (selectedClipId) => set(state => ({ selectedClipId,
          selectedTrackId: state.tracks.find(t => t.clips.some(c => c.id === selectedClipId))?.id ?? state.selectedTrackId })),

        addMarker: (name) => {
          const s = get();
          if (s.markers.length >= 500) return;
          const marker = { id: crypto.randomUUID(), name: name?.trim().slice(0, 80) || `Marker ${s.markers.length + 1}`,
            time: snapTime(s.currentTime, s.bpm, s.gridDivision, s.snapToGrid), color: '#a78bfa' };
          set({ markers: [...s.markers, marker].sort((a, b) => a.time - b.time) });
          get().commitHistory();
        },
        updateMarker: (id, updates) => {
          set(s => ({ markers: normalizeMarkers(s.markers.map(m => m.id === id ? { ...m, ...updates, id } : m)) }));
          get().commitHistory();
        },
        removeMarker: (id) => {
          set(s => ({ markers: s.markers.filter(m => m.id !== id) }));
          get().commitHistory();
        },
        navigateMarker: (direction) => {
          const s = get();
          const ordered = direction === 1 ? s.markers : [...s.markers].reverse();
          const marker = ordered.find(m => direction === 1 ? m.time > s.currentTime + .01 : m.time < s.currentTime - .01);
          if (marker) s.seek(marker.time);
        },
        loopSelectedClip: () => {
          const s = get();
          const clip = s.tracks.flatMap(t => t.clips).find(c => c.id === s.selectedClipId);
          if (clip) {
            set({ loopStart: clip.startTime, loopEnd: clip.startTime + clip.duration, isLooping: true });
            get().seek(clip.startTime);
          }
        },
        editClip: (id, updates) => {
          const s = get();
          const clip = s.tracks.flatMap(t => t.clips).find(c => c.id === id);
          if (!clip) return;
          s.updateClip(id, normalizeClipEdit(clip, updates));
          get().commitHistory();
        },
        repeatClip: (id, count) => {
          const s = get();
          const track = s.tracks.find(t => t.clips.some(c => c.id === id));
          const clip = track?.clips.find(c => c.id === id);
          if (!track || !clip || !Number.isFinite(count)) return;
          const copies = Array.from({ length: Math.max(0, Math.min(32, Math.floor(count))) }, (_, i) => ({
            ...clip, id: crypto.randomUUID(), startTime: clip.startTime + clip.duration * (i + 1)
          }));
          if (!copies.length) return;
          set({ tracks: s.tracks.map(t => t.id === track.id ? { ...t, clips: [...t.clips, ...copies] } : t),
            projectDuration: Math.max(s.projectDuration, copies.at(-1)!.startTime + clip.duration + 5) });
          get().commitHistory();
        },

        addClip: (trackId: string, clipData) => {
          const clipId = clipData.id || `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newClip: DAWClip = {
            ...clipData,
            id: clipId,
            trackId,
            volume: clipData.volume ?? 1.0,
            fadeIn: clipData.fadeIn ?? 0,
            fadeOut: clipData.fadeOut ?? 0,
            sourceStart: clipData.sourceStart ?? 0,
            sourceEnd: clipData.sourceEnd ?? clipData.duration
          };

          set(state => {
            const updatedTracks = state.tracks.map(track => {
              if (track.id === trackId) {
                return {
                  ...track,
                  clips: [...track.clips, newClip]
                };
              }
              return track;
            });

            // Update project duration if clip exceeds current max
            const clipEnd = newClip.startTime + newClip.duration;
            const newProjectDuration = Math.max(state.projectDuration, clipEnd + 5);

            return {
              tracks: updatedTracks,
              selectedClipId: clipId,
              projectDuration: newProjectDuration
            };
          });

          // Preload audio buffer into central engine
          dawAudioEngine.loadAudioBuffer(newClip.audioUrl)
            .then(buf => {
              if (!newClip.peaks || newClip.peaks.length === 0) {
                const peaks = dawAudioEngine.computePeaks(buf);
                get().updateClip(clipId, { peaks });
              }
            })
            .catch(console.warn);

          get().commitHistory();
          return clipId;
        },

        updateClip: (clipId: string, updates: Partial<DAWClip>) => {
          set(state => {
            let maxEnd = state.projectDuration;
            const updatedTracks = state.tracks.map(track => ({
              ...track,
              clips: track.clips.map(clip => {
                if (clip.id === clipId) {
                  let merged = { ...clip, ...updates };
                  if (clip.fadeEnvelope && !Object.prototype.hasOwnProperty.call(updates, 'fadeEnvelope') &&
                      (updates.sourceStart !== undefined || updates.duration !== undefined)) {
                    const offset = clip.fadeEnvelope.offset + merged.sourceStart - clip.sourceStart;
                    merged.fadeEnvelope = offset >= 0 && offset + merged.duration <= clip.fadeEnvelope.duration + .000001
                      ? { ...clip.fadeEnvelope, offset } : undefined;
                    if (merged.fadeEnvelope) merged = { ...merged, ...splitClipFades(merged, merged.duration).left };
                  }
                  maxEnd = Math.max(maxEnd, merged.startTime + merged.duration + 5);
                  return merged;
                }
                return clip;
              })
            }));

            return {
              tracks: updatedTracks,
              projectDuration: maxEnd
            };
          });
        },

        removeClip: (clipId: string) => {
          set(state => ({
            tracks: state.tracks.map(track => ({
              ...track,
              clips: track.clips.filter(c => c.id !== clipId)
            })),
            selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
          }));
          get().commitHistory();
        },

        moveClip: (clipId: string, newTrackId: string, newStartTime: number) => {
          if (!get().tracks.some(t => t.id === newTrackId)) return;
          const clampedStart = Math.max(0, newStartTime);
          set(state => {
            let targetClip: DAWClip | null = null;

            // Remove clip from source track
            const tracksWithoutClip = state.tracks.map(track => {
              const found = track.clips.find(c => c.id === clipId);
              if (found) targetClip = found;
              return {
                ...track,
                clips: track.clips.filter(c => c.id !== clipId)
              };
            });

            if (!targetClip) return state;

            const movedClip: DAWClip = {
              ...(targetClip as DAWClip),
              trackId: newTrackId,
              startTime: clampedStart
            };

            const updatedTracks = tracksWithoutClip.map(track => {
              if (track.id === newTrackId) {
                return {
                  ...track,
                  clips: [...track.clips, movedClip]
                };
              }
              return track;
            });

            const maxEnd = Math.max(state.projectDuration, clampedStart + movedClip.duration + 5);

            return {
              tracks: updatedTracks,
              projectDuration: maxEnd
            };
          });
          get().commitHistory();
        },

        splitClip: (clipId: string, splitTime: number) => {
          set(state => {
            let originalClip: DAWClip | null = null;
            let targetTrackId = '';

            for (const track of state.tracks) {
              const found = track.clips.find(c => c.id === clipId);
              if (found) {
                originalClip = found;
                targetTrackId = track.id;
                break;
              }
            }

            if (!originalClip) return state;

            const clipStart = originalClip.startTime;
            const clipEnd = originalClip.startTime + originalClip.duration;

            if (splitTime <= clipStart + 0.05 || splitTime >= clipEnd - 0.05) {
              return state; // Split point out of bounds
            }

            const leftDuration = splitTime - clipStart;
            const rightDuration = clipEnd - splitTime;
            const fades = splitClipFades(originalClip, leftDuration);

            const leftClip: DAWClip = {
              ...originalClip,
              ...fades.left,
              duration: leftDuration,
              sourceEnd: originalClip.sourceStart + leftDuration
            };

            const rightClip: DAWClip = {
              ...originalClip,
              ...fades.right,
              id: `clip-split-${crypto.randomUUID()}`,
              startTime: splitTime,
              duration: rightDuration,
              sourceStart: originalClip.sourceStart + leftDuration,
              sourceEnd: originalClip.sourceEnd
            };

            const updatedTracks = state.tracks.map(track => {
              if (track.id === targetTrackId) {
                return {
                  ...track,
                  clips: track.clips.map(c => c.id === clipId ? leftClip : c).concat([rightClip])
                };
              }
              return track;
            });

            return { tracks: updatedTracks, selectedClipId: rightClip.id };
          });
          get().commitHistory();
        },

        duplicateClip: (clipId: string) => {
          const state = get();
          for (const track of state.tracks) {
            const found = track.clips.find(c => c.id === clipId);
            if (found) {
              const dupClip: DAWClip = {
                ...found,
                id: `clip-dup-${Date.now()}`,
                name: `${found.name} (Copy)`,
                startTime: found.startTime + found.duration
              };
              get().addClip(track.id, dupClip);
              break;
            }
          }
        },

        trimClip: (clipId: string, newStartTime: number, newDuration: number, newSourceStart: number, newSourceEnd: number) => {
          if (newDuration < 0.1) return;
          get().updateClip(clipId, {
            startTime: Math.max(0, newStartTime),
            duration: newDuration,
            sourceStart: Math.max(0, newSourceStart),
            sourceEnd: newSourceEnd
          });
          get().commitHistory();
        },

        // --- Recording & Input Workflows ---
        startRecording: async () => {
          const { isPlaying, armedTrackId, tracks, currentTime } = get();
          let targetTrackId = armedTrackId;

          // If no track is armed, arm the first Vocal/Guitar track or create one
          if (!targetTrackId) {
            const vocalTrack = tracks.find(t => t.type === 'VOCAL' || t.type === 'GUITAR' || t.type === 'AUDIO');
            if (vocalTrack) {
              targetTrackId = vocalTrack.id;
              get().toggleTrackArmed(vocalTrack.id);
            } else {
              targetTrackId = get().addTrack('VOCAL', 'Recorded Vocal');
              get().toggleTrackArmed(targetTrackId);
            }
          }

          try {
            await dawAudioEngine.startRecording();
            set({ isRecording: true, recordingStartTime: currentTime });

            if (!isPlaying) {
              get().play();
            }
          } catch (err) {
            console.error('Failed to start recording take:', err);
            set({ isRecording: false });
          }
        },

        stopRecording: async () => {
          if (!get().isRecording) return;
          const { armedTrackId, recordingStartTime } = get();

          try {
            const { blob, url, buffer, peaks } = await dawAudioEngine.stopRecording();
            get().pause();
            set({ isRecording: false });

            if (armedTrackId && buffer.duration > 0.3) {
              const takeName = `Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
              get().addClip(armedTrackId, {
                name: takeName,
                audioUrl: url,
                startTime: recordingStartTime,
                duration: buffer.duration,
                sourceStart: 0,
                sourceEnd: buffer.duration,
                volume: 1.0,
                fadeIn: 0.05,
                fadeOut: 0.05,
                peaks
              });
            }
          } catch (err) {
            console.error('Failed to finalize recorded audio take:', err);
            set({ isRecording: false });
          }
        },

        setInputMonitoringEnabled: (enabled: boolean) => {
          set({ inputMonitoringEnabled: enabled });
          if (enabled) {
            dawAudioEngine.startInputMonitoring(get().selectedInputDeviceId || undefined).catch(console.warn);
          } else {
            dawAudioEngine.stopInputMonitoring();
          }
        },

        setSelectedInputDeviceId: (selectedInputDeviceId: string | null) => {
          set({ selectedInputDeviceId });
          if (get().inputMonitoringEnabled) {
            dawAudioEngine.startInputMonitoring(selectedInputDeviceId || undefined).catch(console.warn);
          }
        },

        // --- Undo / Redo History ---
        commitHistory: () => {
          const { tracks, markers, history, historyIndex } = get();
          if (history[historyIndex]?.tracks === tracks && history[historyIndex]?.markers === markers) return;
          const trimmedHistory = history.slice(0, historyIndex + 1);
          const next = [...trimmedHistory, { tracks, markers }].slice(-100);
          set({
            history: next,
            historyIndex: next.length - 1
          });
        },

        undo: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const { tracks: restoredTracks, markers } = history[newIndex];
            dawAudioEngine.updateTrackParameters(restoredTracks);
            set({
              tracks: restoredTracks,
              markers,
              historyIndex: newIndex
            });
          }
        },

        redo: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const { tracks: restoredTracks, markers } = history[newIndex];
            dawAudioEngine.updateTrackParameters(restoredTracks);
            set({
              tracks: restoredTracks,
              markers,
              historyIndex: newIndex
            });
          }
        },

        // --- AI & Project Workflows ---
        importGeneratedSongToDAW: async (song) => {
          const { id, title, audioUrl, duration, bpm = 120, key = 'C Major', lyrics = '', coverUrl } = song;
          const state = get();

          // 1. Ensure an AI track exists
          let aiTrack = state.tracks.find(t => t.type === 'AI');
          let aiTrackId = aiTrack?.id;

          if (!aiTrack) {
            aiTrackId = get().addTrack('AI', 'AI Song Master');
          }

          // 2. Pre-decode waveform peaks
          let peaks: number[] = [];
          try {
            const buf = await dawAudioEngine.loadAudioBuffer(audioUrl);
            peaks = dawAudioEngine.computePeaks(buf);
          } catch {
            peaks = [];
          }

          // 3. Add audio clip to the AI track
          const newClip: DAWClip = {
            id: `clip-ai-${Date.now()}`,
            trackId: aiTrackId!,
            name: title,
            audioUrl,
            startTime: 0,
            duration: duration || 30,
            sourceStart: 0,
            sourceEnd: duration || 30,
            volume: 1.0,
            fadeIn: 0.05,
            fadeOut: 0.05,
            peaks
          };

          get().addClip(aiTrackId!, newClip);

          // 4. Update Project BPM, Key & Name
          set({
            projectName: title,
            bpm,
            key,
            projectDuration: Math.max(state.projectDuration, duration + 5),
            currentTime: 0
          });

          // 5. Update primary global stores (useStore and useMVStore)
          const primaryStore = useStore.getState();
          primaryStore.setName(title);

          try {
            const audioRes = await fetch(audioUrl);
            const audioBlob = await audioRes.blob();
            primaryStore.setAudio(audioBlob, audioUrl, duration, coverUrl || null);
          } catch {
            primaryStore.setAudio(null as any, audioUrl, duration, coverUrl || null);
          }

          // 6. Import lyrics if present
          if (lyrics && lyrics.trim()) {
            const rawLines = lyrics.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const lineDuration = Math.max(3, duration / Math.max(1, rawLines.length));
            const importedLines = rawLines.map((lineText, idx) => ({
              id: `ai-lyr-${idx}-${Date.now()}`,
              startTime: idx * lineDuration,
              endTime: (idx + 1) * lineDuration,
              text: lineText
            }));

            primaryStore.updateLyricsSettings({ lines: importedLines });
          }

          // 7. Auto-navigate to LRC tab
          primaryStore.setActiveTab('lrc');
        },

        newProject: () => {
          dawAudioEngine.stop();
          dawAudioEngine.setMasterVolume(1);
          useStore.getState().setIsPlaying(false);
          const markers: ArrangementMarker[] = [];
          set({
            projectId: `proj-${Date.now()}`,
            projectName: 'Untitled DAW Session',
            bpm: 120,
            key: 'C Major',
            timeSignature: '4/4',
            projectDuration: 180,
            masterVolume: 1.0,
            currentTime: 0,
            isPlaying: false,
            tracks: defaultInitialTracks,
            selectedTrackId: defaultInitialTracks[0].id,
            selectedClipId: null,
            markers,
            isLooping: false, loopStart: 0, loopEnd: 32,
            history: [{ tracks: defaultInitialTracks, markers }],
            historyIndex: 0
          });
        },

        getCanonicalProjectJson: (): DAWProject => {
          const s = get();
          return {
            id: s.projectId,
            name: s.projectName,
            bpm: s.bpm,
            key: s.key,
            timeSignature: s.timeSignature,
            duration: s.projectDuration,
            tracks: s.tracks,
            markers: s.markers,
            masterVolume: s.masterVolume,
            loopStart: s.loopStart,
            loopEnd: s.loopEnd,
            isLooping: s.isLooping,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        },

        loadCanonicalProjectJson: (project: DAWProject) => {
          dawAudioEngine.stop();
          useStore.getState().setIsPlaying(false);
          const markers = normalizeMarkers(project.markers);
          set({
            projectId: project.id,
            projectName: project.name || 'Imported Project',
            bpm: project.bpm || 120,
            key: project.key || 'C Major',
            timeSignature: project.timeSignature || '4/4',
            projectDuration: project.duration || 180,
            masterVolume: project.masterVolume ?? 1.0,
            tracks: project.tracks || defaultInitialTracks,
            markers,
            loopStart: project.loopStart || 0,
            loopEnd: project.loopEnd || 32,
            isLooping: !!project.isLooping,
            currentTime: 0,
            isPlaying: false,
            selectedClipId: null,
            selectedTrackId: project.tracks?.[0]?.id || null,
            history: [{ tracks: project.tracks || defaultInitialTracks, markers }],
            historyIndex: 0
          });
          dawAudioEngine.updateTrackParameters(project.tracks || defaultInitialTracks);
          dawAudioEngine.setMasterVolume(project.masterVolume ?? 1);
          preloadProjectAudio(project.id, project.tracks || defaultInitialTracks);
        }
      };
    },
    {
      name: 'joelizer-daw-store-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        bpm: state.bpm,
        key: state.key,
        timeSignature: state.timeSignature,
        tracks: state.tracks,
        markers: state.markers,
        projectDuration: state.projectDuration,
        masterVolume: state.masterVolume,
        loopStart: state.loopStart,
        loopEnd: state.loopEnd,
        isLooping: state.isLooping
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.markers = normalizeMarkers(state.markers);
          state.history = [{ tracks: state.tracks, markers: state.markers }];
          state.historyIndex = 0;
          dawAudioEngine.setMasterVolume(state.masterVolume);
        }
      }
    }
  )
);

// Scheduling is a snapshot: edits and cycle changes must refresh it during playback.
useDAWStore.subscribe((state, previous) => {
  const clipsChanged = state.tracks !== previous.tracks && (state.tracks.length !== previous.tracks.length ||
    state.tracks.some((track, i) => track.id !== previous.tracks[i]?.id || track.clips !== previous.tracks[i]?.clips));
  if (state.isPlaying && (clipsChanged || state.isLooping !== previous.isLooping ||
      state.loopStart !== previous.loopStart || state.loopEnd !== previous.loopEnd)) {
    dawAudioEngine.seek(dawAudioEngine.currentTime, state.tracks, state.isLooping, state.loopStart, state.loopEnd);
  }
});

// Restored clips need decoded source lengths for accurate waveform crops and trims.
// Peak generation is derived data, so update history snapshots without adding edits.
function preloadProjectAudio(projectId: string, tracks: DAWTrack[]) {
  for (const url of new Set(tracks.flatMap(t => t.clips.map(c => c.audioUrl)))) {
    void dawAudioEngine.loadAudioBuffer(url).then(buffer => {
      const peaks = dawAudioEngine.computePeaks(buffer);
      useDAWStore.setState(state => {
        if (state.projectId !== projectId) return state;
        const refresh = (list: DAWTrack[]) => list.map(t => ({ ...t,
          clips: t.clips.map(c => c.audioUrl === url ? { ...c, peaks } : c) }));
        const nextTracks = refresh(state.tracks);
        return { tracks: nextTracks, history: state.history.map(snapshot => ({ ...snapshot,
          tracks: snapshot.tracks === state.tracks ? nextTracks : refresh(snapshot.tracks) })) };
      });
    }).catch(() => { /* Missing source assets remain recoverable via portable sessions. */ });
  }
}
