import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DAWClip, DAWProject, DAWTrack, TimelineTool, TrackType } from '../types/daw';
import { dawAudioEngine } from '../lib/dawAudioEngine';
import { useStore } from './useStore';
import { useMVStore } from './useMVStore';

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
  
  // Timeline View & UI
  timelineZoom: number; // Pixels per second (e.g. 80)
  timelineScrollX: number;
  activeTool: TimelineTool;
  snapToGrid: boolean;
  gridDivision: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | 'off';
  showLyricsRuler: boolean;

  // History Undo/Redo
  history: DAWTrack[][];
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

        timelineZoom: 70, // 70px per second
        timelineScrollX: 0,
        activeTool: 'select',
        snapToGrid: true,
        gridDivision: '1/4',
        showLyricsRuler: true,

        history: [defaultInitialTracks],
        historyIndex: 0,

        // --- Transport Implementation ---
        play: () => {
          const { currentTime, tracks, isLooping, loopStart, loopEnd } = get();
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
          set({ loopStart: Math.max(0, loopStart), loopEnd: Math.max(loopStart + 0.5, loopEnd) });
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
        setSelectedTrackId: (selectedTrackId) => set({ selectedTrackId }),

        addTrack: (type: TrackType = 'AUDIO', name?: string) => {
          const newId = `track-${Date.now()}`;
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
              selectedTrackId: newId
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
              selectedTrackId: state.selectedTrackId === trackId ? (updated[0]?.id || null) : state.selectedTrackId
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
        setSelectedClipId: (selectedClipId) => set({ selectedClipId }),

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
                  const merged = { ...clip, ...updates };
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

            const leftClip: DAWClip = {
              ...originalClip,
              duration: leftDuration,
              sourceEnd: originalClip.sourceStart + leftDuration
            };

            const rightClip: DAWClip = {
              ...originalClip,
              id: `clip-split-${Date.now()}`,
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
          const { tracks, history, historyIndex } = get();
          const trimmedHistory = history.slice(0, historyIndex + 1);
          set({
            history: [...trimmedHistory, tracks],
            historyIndex: trimmedHistory.length
          });
        },

        undo: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const restoredTracks = history[newIndex];
            dawAudioEngine.updateTrackParameters(restoredTracks);
            set({
              tracks: restoredTracks,
              historyIndex: newIndex
            });
          }
        },

        redo: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const restoredTracks = history[newIndex];
            dawAudioEngine.updateTrackParameters(restoredTracks);
            set({
              tracks: restoredTracks,
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
            history: [defaultInitialTracks],
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
          set({
            projectId: project.id,
            projectName: project.name || 'Imported Project',
            bpm: project.bpm || 120,
            key: project.key || 'C Major',
            timeSignature: project.timeSignature || '4/4',
            projectDuration: project.duration || 180,
            masterVolume: project.masterVolume ?? 1.0,
            tracks: project.tracks || defaultInitialTracks,
            loopStart: project.loopStart || 0,
            loopEnd: project.loopEnd || 32,
            isLooping: !!project.isLooping,
            currentTime: 0,
            isPlaying: false,
            history: [project.tracks || defaultInitialTracks],
            historyIndex: 0
          });
          dawAudioEngine.updateTrackParameters(project.tracks || defaultInitialTracks);
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
        projectDuration: state.projectDuration,
        masterVolume: state.masterVolume,
        loopStart: state.loopStart,
        loopEnd: state.loopEnd,
        isLooping: state.isLooping
      })
    }
  )
);
