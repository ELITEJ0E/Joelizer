import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { useMVStore, TimelineClip, TimelineText } from '../../store/useMVStore';
import { 
  Lock, Unlock, Scissors, Trash2, Film, Image as ImageIcon, Music, Type, 
  Play, Pause, Undo2, Redo2, Eye, EyeOff, Volume2, VolumeX, Magnet, 
  Plus, ZoomIn, ZoomOut, Maximize2, MoreVertical, Layers, ChevronRight, ChevronDown, Copy, Edit3, Sparkles
} from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { useGlobalHistory } from '../../lib/globalHistory';
import { collectSnapTargets, calculateSnap, SnapTarget } from '../../lib/timelineSnapping';
import { 
  syncAllLyrics, updateLyricLineTiming, splitLyricLine, mergeLyricWithNext, 
  duplicateLyricLine, deleteLyricLine, addLyricLineAtTime, updateLyricLineText,
  updateWordTiming, updateWordText, deleteWord, insertWord, ensureLineWords
} from '../../lib/timelineLyricsSync';
import { ClipContextBar } from './Timeline/ClipContextBar';
import { LyricContextBar } from './Timeline/LyricContextBar';
import { WordContextBar } from './Timeline/WordContextBar';
import { TrackHeaderMenu } from './Timeline/TrackHeaderMenu';

interface DragSession {
  target: 'clip-body' | 'clip-left' | 'clip-right' | 'lyric-body' | 'lyric-left' | 'lyric-right' | 'word-body' | 'word-left' | 'word-right';
  id: string; // clipId or lyricId
  subId?: string; // word index or sub-id
  startX: number;
  origStart: number;
  origEnd: number;
  pointerId: number;
}

export function MVTimeline() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Audio / Player State
  const currentTime = useStore(s => s.currentTime);
  const duration = useStore(s => s.audioDuration) || 120;
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const waveformPeaks = useStore(s => s.waveformPeaks);
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];
  
  // MV Store State
  const timelineClips = useMVStore(s => s.timelineClips);
  const videoAssets = useMVStore(s => s.videoAssets);
  const wordTimings = useMVStore(s => s.wordTimings);
  const songAnalysis = useMVStore(s => s.songAnalysis);
  const selectedClipId = useMVStore(s => s.selectedClipId);
  const setSelectedClipId = useMVStore(s => s.setSelectedClipId);
  const toggleLockClip = useMVStore(s => s.toggleLockClip);
  const removeTimelineClip = useMVStore(s => s.removeTimelineClip);
  const splitTimelineClip = useMVStore(s => s.splitTimelineClip);
  const duplicateTimelineClip = useMVStore(s => s.duplicateTimelineClip);
  const addTimelineClip = useMVStore(s => s.addTimelineClip);
  const updateTimelineClip = useMVStore(s => s.updateTimelineClip);
  const commitTimeline = useMVStore(s => s.commitTimeline);

  // Global History hook
  const { canUndo, canRedo, undo, redo, recordSnapshot } = useGlobalHistory();

  // Timeline UI States
  const [zoom, setZoom] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [activeSnapGuide, setActiveSnapGuide] = useState<{ time: number; label: string } | null>(null);

  // Selection states
  const [selectedLyricId, setSelectedLyricId] = useState<string | null>(null);
  const [selectedWordKey, setSelectedWordKey] = useState<{ lineId: string; wordIndex: number } | null>(null);

  // Track Visibility & Mute States
  const [visTrackVisible, setVisTrackVisible] = useState(true);
  const [visTrackLocked, setVisTrackLocked] = useState(false);
  const [lyrTrackVisible, setLyrTrackVisible] = useState(true);
  const [lyrTrackLocked, setLyrTrackLocked] = useState(false);
  const [wordsExpanded, setWordsExpanded] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [activeTrackMenu, setActiveTrackMenu] = useState<'vis' | 'lyr' | 'aud' | null>(null);

  // Drag Session Ref & State (Pointer capture)
  const dragSessionRef = useRef<DragSession | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Synchronize lyrics from store if empty
  useEffect(() => {
    if (lyricsLines.length > 0 && wordTimings.length === 0) {
      syncAllLyrics(lyricsLines);
    }
  }, [lyricsLines, wordTimings.length]);

  // Combined Lyrics Source (Prefer useStore lines synced with wordTimings)
  const displayLyrics = useMemo(() => {
    if (lyricsLines.length > 0) return lyricsLines;
    return wordTimings.map(wt => ({
      id: wt.id,
      text: wt.text,
      startTime: wt.startTime,
      endTime: wt.endTime,
      words: wt.words
    }));
  }, [lyricsLines, wordTimings]);

  // Keyboard Shortcuts: Global Undo/Redo & Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (isInput) return;
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedClipId) {
          e.preventDefault();
          removeTimelineClip(selectedClipId);
          setSelectedClipId(null);
          recordSnapshot('Delete Clip');
        } else if (selectedWordKey) {
          e.preventDefault();
          deleteWord(selectedWordKey.lineId, selectedWordKey.wordIndex);
          setSelectedWordKey(null);
        } else if (selectedLyricId) {
          e.preventDefault();
          deleteLyricLine(selectedLyricId);
          setSelectedLyricId(null);
        }
      } else if ((e.key === 's' || e.key === 'S') && !isInput && (e.ctrlKey || e.metaKey)) {
        // Toggle snapping
        e.preventDefault();
        setSnappingEnabled(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedClipId, selectedLyricId, selectedWordKey, removeTimelineClip, setSelectedClipId, recordSnapshot]);

  // Non-passive Wheel Listener for smooth Zoom around cursor/playhead
  useEffect(() => {
    const container = scrollWrapperRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const zoomFactor = Math.pow(1.002, -e.deltaY);
        setZoom(z => Math.min(20, Math.max(1, z * zoomFactor)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Time conversion helpers
  const timeToPx = useCallback((time: number, totalWidth: number) => {
    if (duration <= 0) return 0;
    return (time / duration) * totalWidth;
  }, [duration]);

  const pxToTime = useCallback((px: number, totalWidth: number) => {
    if (totalWidth <= 0 || duration <= 0) return 0;
    return Math.max(0, Math.min(duration, (px / totalWidth) * duration));
  }, [duration]);

  // Scrubbing & Seeking Handler
  const handleSeek = useCallback((clientX: number) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    setCurrentTime(time);
    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.currentTime = time;
  }, [duration, setCurrentTime]);

  // Pointer Down for Playhead Scrubbing on Time Ruler
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (dragSessionRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    handleSeek(e.clientX);
  };

  // Pointer Move for Playhead Scrubbing
  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (isScrubbing) {
      handleSeek(e.clientX);
    }
  };

  // Pointer Up for Playhead Scrubbing
  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  // Pointer Down for Dragging Visual Clip
  const handleClipPointerDown = (
    e: React.PointerEvent,
    clip: TimelineClip,
    type: 'clip-body' | 'clip-left' | 'clip-right'
  ) => {
    if (clip.locked || visTrackLocked) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setSelectedClipId(clip.id);
    setSelectedLyricId(null);
    setSelectedWordKey(null);

    dragSessionRef.current = {
      target: type,
      id: clip.id,
      startX: e.clientX,
      origStart: clip.startTime,
      origEnd: clip.endTime,
      pointerId: e.pointerId,
    };
    setActiveDragId(clip.id);
  };

  // Pointer Down for Dragging Lyric Line
  const handleLyricPointerDown = (
    e: React.PointerEvent,
    line: LyricLine,
    type: 'lyric-body' | 'lyric-left' | 'lyric-right'
  ) => {
    if (lyrTrackLocked) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setSelectedLyricId(line.id);
    setSelectedClipId(null);
    setSelectedWordKey(null);

    dragSessionRef.current = {
      target: type,
      id: line.id,
      startX: e.clientX,
      origStart: line.startTime,
      origEnd: line.endTime,
      pointerId: e.pointerId,
    };
    setActiveDragId(line.id);
  };

  // Pointer Down for Dragging Word
  const handleWordPointerDown = (
    e: React.PointerEvent,
    lineId: string,
    wordIndex: number,
    word: { word: string; start: number; end: number },
    type: 'word-body' | 'word-left' | 'word-right'
  ) => {
    if (lyrTrackLocked) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setSelectedWordKey({ lineId, wordIndex });
    setSelectedLyricId(lineId);
    setSelectedClipId(null);

    dragSessionRef.current = {
      target: type,
      id: lineId,
      subId: String(wordIndex),
      startX: e.clientX,
      origStart: word.start,
      origEnd: word.end,
      pointerId: e.pointerId,
    };
    setActiveDragId(`word-${lineId}-${wordIndex}`);
  };

  // Global Pointer Move for Dragging Clips / Lyrics / Words
  const handleGlobalPointerMove = useCallback((e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session || !containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - session.startX;
    const deltaTime = (deltaX / rect.width) * duration;
    const dur = session.origEnd - session.origStart;

    // Collect Snapping Targets if enabled
    let snapTargets: SnapTarget[] = [];
    if (snappingEnabled) {
      snapTargets = collectSnapTargets({
        currentTime,
        duration,
        clips: timelineClips,
        lyrics: displayLyrics,
        songAnalysis,
        ignoreClipId: session.target.startsWith('clip') ? session.id : undefined,
        ignoreLyricId: session.target.startsWith('lyric') ? session.id : undefined,
        includeWords: wordsExpanded,
      });
    }

    // 1. VISUAL CLIP DRAG / RESIZE
    if (session.target.startsWith('clip')) {
      const clip = timelineClips.find(c => c.id === session.id);
      if (!clip) return;

      let maxAssetDuration = Infinity;
      const asset = videoAssets.find(v => v.id === clip.assetId);
      if (asset && asset.duration) maxAssetDuration = asset.duration;
      const currentTrimStart = clip.trimStart || 0;

      if (session.target === 'clip-body') {
        let rawStart = Math.max(0, Math.min(duration - dur, session.origStart + deltaTime));
        let rawEnd = rawStart + dur;

        // Check snapping on start or end
        let finalStart = rawStart;
        let snapInfo: { time: number; label: string } | null = null;

        if (snappingEnabled) {
          const snapStart = calculateSnap(rawStart, snapTargets);
          const snapEnd = calculateSnap(rawEnd, snapTargets);

          if (snapStart.isSnapped) {
            finalStart = snapStart.snappedTime;
            snapInfo = { time: snapStart.snappedTime, label: snapStart.target?.label || 'Snap' };
          } else if (snapEnd.isSnapped) {
            finalStart = snapEnd.snappedTime - dur;
            snapInfo = { time: snapEnd.snappedTime, label: snapEnd.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        updateTimelineClip(session.id, {
          startTime: Number(finalStart.toFixed(2)),
          endTime: Number((finalStart + dur).toFixed(2)),
        });
      } else if (session.target === 'clip-left') {
        const maxLeftShift = session.origStart - currentTrimStart;
        let rawStart = Math.max(Math.max(0, maxLeftShift), Math.min(session.origEnd - 0.3, session.origStart + deltaTime));
        
        let finalStart = rawStart;
        let snapInfo: { time: number; label: string } | null = null;
        if (snappingEnabled) {
          const snap = calculateSnap(rawStart, snapTargets);
          if (snap.isSnapped) {
            finalStart = Math.max(Math.max(0, maxLeftShift), Math.min(session.origEnd - 0.3, snap.snappedTime));
            snapInfo = { time: snap.snappedTime, label: snap.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        const newTrimStart = Math.max(0, currentTrimStart + (finalStart - session.origStart));
        updateTimelineClip(session.id, {
          startTime: Number(finalStart.toFixed(2)),
          trimStart: Number(newTrimStart.toFixed(2)),
        });
      } else if (session.target === 'clip-right') {
        const maxPossibleEnd = session.origStart + (maxAssetDuration - currentTrimStart);
        let rawEnd = Math.max(session.origStart + 0.3, Math.min(Math.min(duration, maxPossibleEnd), session.origEnd + deltaTime));

        let finalEnd = rawEnd;
        let snapInfo: { time: number; label: string } | null = null;
        if (snappingEnabled) {
          const snap = calculateSnap(rawEnd, snapTargets);
          if (snap.isSnapped) {
            finalEnd = Math.max(session.origStart + 0.3, Math.min(Math.min(duration, maxPossibleEnd), snap.snappedTime));
            snapInfo = { time: snap.snappedTime, label: snap.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        const newTrimEnd = Math.max(0.3, currentTrimStart + (finalEnd - session.origStart));
        updateTimelineClip(session.id, {
          endTime: Number(finalEnd.toFixed(2)),
          trimEnd: Number(newTrimEnd.toFixed(2)),
        });
      }
    }

    // 2. LYRIC LINE DRAG / RESIZE
    else if (session.target.startsWith('lyric')) {
      if (session.target === 'lyric-body') {
        let rawStart = Math.max(0, Math.min(duration - dur, session.origStart + deltaTime));
        let rawEnd = rawStart + dur;

        let finalStart = rawStart;
        let snapInfo: { time: number; label: string } | null = null;

        if (snappingEnabled) {
          const snapStart = calculateSnap(rawStart, snapTargets);
          const snapEnd = calculateSnap(rawEnd, snapTargets);

          if (snapStart.isSnapped) {
            finalStart = snapStart.snappedTime;
            snapInfo = { time: snapStart.snappedTime, label: snapStart.target?.label || 'Snap' };
          } else if (snapEnd.isSnapped) {
            finalStart = snapEnd.snappedTime - dur;
            snapInfo = { time: snapEnd.snappedTime, label: snapEnd.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        updateLyricLineTiming(session.id, finalStart, finalStart + dur, false);
      } else if (session.target === 'lyric-left') {
        let rawStart = Math.max(0, Math.min(session.origEnd - 0.3, session.origStart + deltaTime));
        let finalStart = rawStart;
        let snapInfo: { time: number; label: string } | null = null;

        if (snappingEnabled) {
          const snap = calculateSnap(rawStart, snapTargets);
          if (snap.isSnapped) {
            finalStart = Math.max(0, Math.min(session.origEnd - 0.3, snap.snappedTime));
            snapInfo = { time: snap.snappedTime, label: snap.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        updateLyricLineTiming(session.id, finalStart, session.origEnd, false);
      } else if (session.target === 'lyric-right') {
        let rawEnd = Math.max(session.origStart + 0.3, Math.min(duration, session.origEnd + deltaTime));
        let finalEnd = rawEnd;
        let snapInfo: { time: number; label: string } | null = null;

        if (snappingEnabled) {
          const snap = calculateSnap(rawEnd, snapTargets);
          if (snap.isSnapped) {
            finalEnd = Math.max(session.origStart + 0.3, Math.min(duration, snap.snappedTime));
            snapInfo = { time: snap.snappedTime, label: snap.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        updateLyricLineTiming(session.id, session.origStart, finalEnd, false);
      }
    }

    // 3. WORD DRAG / RESIZE
    else if (session.target.startsWith('word')) {
      const wordIdx = Number(session.subId);
      if (session.target === 'word-body') {
        let rawStart = Math.max(0, session.origStart + deltaTime);
        let rawEnd = rawStart + dur;

        let finalStart = rawStart;
        let snapInfo: { time: number; label: string } | null = null;

        if (snappingEnabled) {
          const snap = calculateSnap(rawStart, snapTargets);
          if (snap.isSnapped) {
            finalStart = snap.snappedTime;
            snapInfo = { time: snap.snappedTime, label: snap.target?.label || 'Snap' };
          }
        }

        setActiveSnapGuide(snapInfo);
        updateWordTiming(session.id, wordIdx, finalStart, finalStart + dur, false);
      } else if (session.target === 'word-left') {
        let rawStart = Math.max(0, Math.min(session.origEnd - 0.1, session.origStart + deltaTime));
        updateWordTiming(session.id, wordIdx, rawStart, session.origEnd, false);
      } else if (session.target === 'word-right') {
        let rawEnd = Math.max(session.origStart + 0.1, session.origEnd + deltaTime);
        updateWordTiming(session.id, wordIdx, session.origStart, rawEnd, false);
      }
    }
  }, [duration, snappingEnabled, currentTime, timelineClips, displayLyrics, songAnalysis, wordsExpanded, updateTimelineClip, videoAssets]);

  // Global Pointer Up: Commit to History & Clean Session
  const handleGlobalPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragSessionRef.current) {
      const session = dragSessionRef.current;
      if (session.target.startsWith('clip')) {
        commitTimeline();
      } else if (session.target.startsWith('lyric') || session.target.startsWith('word')) {
        recordSnapshot('Edit Lyric Timing');
      }

      dragSessionRef.current = null;
      setActiveDragId(null);
      setActiveSnapGuide(null);
    }
  }, [commitTimeline, recordSnapshot]);

  // Drop handler on VIS track lane from media asset library
  const handleDropOnVisTrack = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const assetId = e.dataTransfer.getData('application/joelizer-asset-id') || e.dataTransfer.getData('text/plain');
    if (!assetId || !containerRef.current || duration <= 0) return;

    const asset = videoAssets.find(v => v.id === assetId);
    if (!asset) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const dropTime = (x / rect.width) * duration;
    const clipDur = Math.min(4, asset.duration || 4);

    addTimelineClip({
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      assetId: asset.id,
      startTime: Number(dropTime.toFixed(2)),
      endTime: Number(Math.min(duration, dropTime + clipDur).toFixed(2)),
      trimStart: 0,
      trimEnd: clipDur,
      locked: false,
      type: asset.type,
    });
    commitTimeline();
  };

  // Track Menu Actions
  const handleTrackAction = (track: 'vis' | 'lyr' | 'aud', action: string) => {
    if (track === 'vis') {
      if (action === 'add-visualizer') {
        addTimelineClip({
          id: `clip-vis-${Date.now()}`,
          assetId: 'visualizer',
          startTime: Number(currentTime.toFixed(2)),
          endTime: Number(Math.min(duration, currentTime + 5).toFixed(2)),
          trimStart: 0,
          trimEnd: 5,
          locked: false,
          type: 'visualizer',
        });
        commitTimeline();
      } else if (action === 'add-vinyl') {
        addTimelineClip({
          id: `clip-vinyl-${Date.now()}`,
          assetId: 'vinyl-lyrics',
          startTime: Number(currentTime.toFixed(2)),
          endTime: Number(Math.min(duration, currentTime + 6).toFixed(2)),
          trimStart: 0,
          trimEnd: 6,
          locked: false,
          type: 'vinyl-lyrics',
        });
        commitTimeline();
      } else if (action === 'auto-fill') {
        if (videoAssets.length > 0) {
          let cur = 0;
          let idx = 0;
          const newClips: TimelineClip[] = [];
          while (cur < duration) {
            const asset = videoAssets[idx % videoAssets.length];
            const clipDur = Math.min(4, asset.duration || 4);
            const end = Math.min(duration, cur + clipDur);
            newClips.push({
              id: `clip-auto-${Date.now()}-${idx}`,
              assetId: asset.id,
              startTime: Number(cur.toFixed(2)),
              endTime: Number(end.toFixed(2)),
              trimStart: 0,
              trimEnd: end - cur,
              locked: false,
              type: asset.type,
            });
            cur = end;
            idx++;
          }
          useMVStore.getState().setTimelineClips(newClips);
          commitTimeline();
        }
      } else if (action === 'clear-clips') {
        useMVStore.getState().setTimelineClips([]);
        commitTimeline();
      }
    } else if (track === 'lyr') {
      if (action === 'add-line') {
        addLyricLineAtTime(currentTime);
      } else if (action === 'generate-words') {
        const lines = displayLyrics.map(l => ({ ...l, words: ensureLineWords(l) }));
        syncAllLyrics(lines);
        setWordsExpanded(true);
        recordSnapshot('Auto-Generate Words');
      } else if (action === 'align-beats') {
        const bpm = songAnalysis?.bpm || 120;
        const beatSec = 60 / bpm;
        const aligned = displayLyrics.map(l => {
          const snappedStart = Math.round(l.startTime / beatSec) * beatSec;
          const dur = Math.max(beatSec, l.endTime - l.startTime);
          return {
            ...l,
            startTime: Number(snappedStart.toFixed(2)),
            endTime: Number((snappedStart + dur).toFixed(2)),
          };
        });
        syncAllLyrics(aligned);
        recordSnapshot('Align Lyrics to Beats');
      } else if (action === 'clear-lyrics') {
        syncAllLyrics([]);
        recordSnapshot('Clear All Lyrics');
      }
    } else if (track === 'aud') {
      if (action === 'reset-volume') {
        setAudioVolume(1);
        setAudioMuted(false);
        const audioEl = document.querySelector('audio');
        if (audioEl) {
          audioEl.volume = 1;
          audioEl.muted = false;
        }
      }
    }
  };

  // Toggle Audio Mute
  const handleToggleMute = () => {
    const newMuted = !audioMuted;
    setAudioMuted(newMuted);
    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.muted = newMuted;
  };

  // Volume Change
  const handleVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.volume = vol;
      if (vol > 0 && audioMuted) {
        setAudioMuted(false);
        audioEl.muted = false;
      }
    }
  };

  // Selected Clip Object
  const selectedClip = timelineClips.find(c => c.id === selectedClipId);
  // Selected Lyric Line Object
  const selectedLyric = displayLyrics.find(l => l.id === selectedLyricId);
  // Selected Word Object
  const selectedWord = selectedWordKey && selectedLyric?.words ? selectedLyric.words[selectedWordKey.wordIndex] : null;

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="flex flex-col h-full bg-[#08080c] text-slate-300 select-none"
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
    >
      {/* ========================================================================= */}
      {/* TOP TOOLBAR */}
      {/* ========================================================================= */}
      <div className="h-9 border-b border-white/10 flex items-center px-3 justify-between bg-black/70 text-xs shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Play / Pause button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-black text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
            style={{ backgroundColor: activeColor }}
          >
            {isPlaying ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Title */}
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: activeColor }}>
            <Film size={13} />
            Timeline
          </span>

          {/* Global Undo / Redo */}
          <div className="flex items-center gap-1 pl-2 border-l border-white/10">
            <button
              onClick={(e) => { e.stopPropagation(); undo(); }}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Undo2 size={11} />
              <span>Undo</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); redo(); }}
              disabled={!canRedo}
              title="Redo (Ctrl+Y / Cmd+Shift+Z)"
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Redo2 size={11} />
              <span>Redo</span>
            </button>
          </div>

          {/* Magnetic Snapping Toggle */}
          <div className="flex items-center pl-2 border-l border-white/10">
            <button
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              title="Toggle Magnetic Snapping (S)"
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                snappingEnabled 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Magnet size={11} />
              <span>Snap: {snappingEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Selected Video Clip Quick Actions */}
          {selectedClip && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLockClip(selectedClip.id);
                  commitTimeline();
                }}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  selectedClip.locked ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {selectedClip.locked ? <Lock size={11} /> : <Unlock size={11} />}
                <span>{selectedClip.locked ? 'Locked' : 'Lock'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  splitTimelineClip(selectedClip.id, currentTime);
                  commitTimeline();
                }}
                disabled={currentTime <= selectedClip.startTime || currentTime >= selectedClip.endTime || selectedClip.locked}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Scissors size={11} />
                <span>Split</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateTimelineClip(selectedClip.id);
                  commitTimeline();
                }}
                disabled={selectedClip.locked}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Copy size={11} />
                <span>Dup</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTimelineClip(selectedClip.id);
                  commitTimeline();
                }}
                className="px-2 py-1 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* Selected Lyric Line Quick Actions in Header */}
          {selectedLyric && !selectedClip && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
              <span className="text-[10px] text-purple-400 font-bold font-mono">LYRIC:</span>
              <button
                onClick={() => setWordsExpanded(!wordsExpanded)}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  wordsExpanded ? 'bg-purple-500 text-white' : 'bg-purple-900/40 text-purple-200 hover:bg-purple-900/60 border border-purple-500/30'
                }`}
              >
                <Layers size={11} />
                <span>{wordsExpanded ? 'Words ▲' : 'Words ▼'}</span>
              </button>

              <button
                onClick={() => splitLyricLine(selectedLyric.id, currentTime)}
                disabled={currentTime <= selectedLyric.startTime + 0.2 || currentTime >= selectedLyric.endTime - 0.2}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Scissors size={11} />
                <span>Split</span>
              </button>

              <button
                onClick={() => duplicateLyricLine(selectedLyric.id)}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy size={11} />
                <span>Dup</span>
              </button>

              <button
                onClick={() => deleteLyricLine(selectedLyric.id)}
                className="px-2 py-1 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls & Slider */}
        <div className="flex items-center gap-2">
          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(1, z - 0.5))}
            className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>

          {/* Zoom Slider */}
          <input
            type="range"
            min="1"
            max="15"
            step="0.2"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            title="Zoom timeline scale"
          />

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(20, z + 0.5))}
            className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>

          {/* Zoom Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
            <span className="text-white font-extrabold">{zoom.toFixed(1)}x</span>
          </div>

          {/* Fit Timeline Button */}
          <button
            onClick={() => setZoom(1)}
            title="Fit Entire Timeline to Window"
            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 size={10} />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIMELINE MAIN CONTAINER (Track Headers + Scrollable Tracks) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex relative overflow-hidden bg-black/40">
        
        {/* ========================================================================= */}
        {/* LEFT FIXED TRACK HEADERS */}
        {/* ========================================================================= */}
        <div className="w-28 bg-[#0d0d12] border-r border-white/10 flex flex-col shrink-0 z-30 shadow-lg">
          {/* Header Spacer (matches ruler height) */}
          <div className="h-6 border-b border-white/10 bg-white/5 flex items-center px-2 text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
            <span>TRACKS</span>
          </div>

          {/* VIS Track Header */}
          <div className="h-16 border-b border-white/10 p-1.5 flex flex-col justify-between relative group/vis-header bg-blue-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black text-blue-400 flex items-center gap-1">
                <Film size={11} /> VIS
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVisTrackVisible(!visTrackVisible)}
                  title={visTrackVisible ? 'Hide video track' : 'Show video track'}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  {visTrackVisible ? <Eye size={11} /> : <EyeOff size={11} className="text-slate-600" />}
                </button>
                <button
                  onClick={() => setVisTrackLocked(!visTrackLocked)}
                  title={visTrackLocked ? 'Unlock track' : 'Lock track'}
                  className={`p-0.5 cursor-pointer ${visTrackLocked ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
                >
                  {visTrackLocked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => handleTrackAction('vis', 'add-visualizer')}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 flex items-center gap-0.5 cursor-pointer"
                title="Add scene clip"
              >
                <Plus size={9} /> Media
              </button>
              <button
                onClick={() => setActiveTrackMenu(activeTrackMenu === 'vis' ? null : 'vis')}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                title="Track options"
              >
                <MoreVertical size={11} />
              </button>
            </div>

            {activeTrackMenu === 'vis' && (
              <TrackHeaderMenu
                trackType="vis"
                onClose={() => setActiveTrackMenu(null)}
                onAction={(act) => handleTrackAction('vis', act)}
              />
            )}
          </div>

          {/* LYR Track Header */}
          <div className="h-10 border-b border-white/10 p-1.5 flex flex-col justify-between relative group/lyr-header bg-purple-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black text-purple-400 flex items-center gap-1">
                <Type size={11} /> LYR
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLyrTrackVisible(!lyrTrackVisible)}
                  title={lyrTrackVisible ? 'Hide lyrics track' : 'Show lyrics track'}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  {lyrTrackVisible ? <Eye size={11} /> : <EyeOff size={11} className="text-slate-600" />}
                </button>
                <button
                  onClick={() => setWordsExpanded(!wordsExpanded)}
                  title={wordsExpanded ? 'Collapse word layer' : 'Expand word layer'}
                  className={`px-1 py-0.5 rounded text-[8px] font-black flex items-center gap-0.5 cursor-pointer ${
                    wordsExpanded ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {wordsExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                  <span>W</span>
                </button>
                <button
                  onClick={() => setActiveTrackMenu(activeTrackMenu === 'lyr' ? null : 'lyr')}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Lyrics track options"
                >
                  <MoreVertical size={11} />
                </button>
              </div>
            </div>

            {activeTrackMenu === 'lyr' && (
              <TrackHeaderMenu
                trackType="lyr"
                onClose={() => setActiveTrackMenu(null)}
                onAction={(act) => handleTrackAction('lyr', act)}
              />
            )}
          </div>

          {/* Sub-Header: WORD Timeline Layer (when expanded) */}
          {wordsExpanded && (
            <div className="h-8 border-b border-white/10 px-1.5 flex items-center justify-between bg-amber-950/20">
              <span className="font-mono text-[9px] font-black text-amber-400 flex items-center gap-0.5 pl-2">
                └ WORD
              </span>
              <span className="text-[8px] font-mono text-amber-300/60 font-semibold">
                Sync
              </span>
            </div>
          )}

          {/* AUD Track Header */}
          <div className="h-12 border-b border-white/10 p-1.5 flex flex-col justify-between relative group/aud-header bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <Music size={11} /> AUD
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleMute}
                  title={audioMuted ? 'Unmute' : 'Mute'}
                  className={`p-0.5 cursor-pointer ${audioMuted ? 'text-red-400' : 'text-emerald-400'}`}
                >
                  {audioMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Volume level"
                >
                  <MoreVertical size={11} />
                </button>
              </div>
            </div>

            {/* Volume slider popover */}
            {showVolumeSlider && (
              <div className="absolute left-28 top-0 z-50 p-2 bg-[#121218] border border-white/20 rounded-lg shadow-xl flex items-center gap-2">
                <Volume2 size={12} className="text-emerald-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioMuted ? 0 : audioVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/20 rounded accent-emerald-400 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-white font-bold w-6">{Math.round(audioVolume * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCROLLABLE TRACK LANES & TIME RULER */}
        {/* ========================================================================= */}
        <div 
          ref={scrollWrapperRef}
          className="flex-1 relative overflow-x-auto overflow-y-hidden"
          onClick={() => {
            setSelectedClipId(null);
            setSelectedLyricId(null);
            setSelectedWordKey(null);
          }}
        >
          <div 
            ref={containerRef}
            className="h-full relative min-w-full"
            style={{ width: `${100 * zoom}%` }}
          >
            {/* ===================================================================== */}
            {/* TIME RULER & SCRUBBER */}
            {/* ===================================================================== */}
            <div 
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              className="h-6 bg-white/5 border-b border-white/10 relative text-[9px] font-mono text-slate-400 flex items-center cursor-ew-resize select-none"
            >
              {/* Dynamic Ruler Ticks & Section Markers */}
              {Array.from({ length: Math.max(13, Math.round(12 * zoom)) }, (_, i) => (duration / Math.max(12, Math.round(12 * zoom))) * i).map((tick, idx) => (
                <div 
                  key={idx}
                  className="absolute flex flex-col items-center -translate-x-1/2 pointer-events-none"
                  style={{ left: `${(tick / duration) * 100}%` }}
                >
                  <span className="text-[8px] font-mono opacity-80">{formatTime(tick)}</span>
                  <div className="w-[1px] h-1.5 bg-white/20" />
                </div>
              ))}

              {/* Song Section Badges on Ruler (Intro, Verse, Chorus, Drop, etc.) */}
              {songAnalysis?.sections?.map((sec, i) => (
                <div
                  key={i}
                  className="absolute top-0.5 px-1.5 py-0.2 rounded text-[7px] font-black uppercase tracking-wider bg-white/10 border border-white/20 text-yellow-300 pointer-events-none -translate-x-1/2"
                  style={{ left: `${(sec.startTime / duration) * 100}%` }}
                >
                  {sec.title}
                </div>
              ))}
            </div>

            {/* ===================================================================== */}
            {/* TRACK LANES */}
            {/* ===================================================================== */}
            <div className="flex flex-col">

              {/* ----------------------------------------------------------------- */}
              {/* TRACK 1: VISUAL (VIS) */}
              {/* ----------------------------------------------------------------- */}
              <div 
                ref={trackRef}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={handleDropOnVisTrack}
                className={`h-16 relative border-b border-white/10 bg-blue-950/20 group/vis ${visTrackVisible ? '' : 'opacity-20 pointer-events-none'}`}
              >
                {/* Empty Drop Hint */}
                {timelineClips.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-blue-400/40 text-[10px] font-mono tracking-widest uppercase">
                    Drag media clips here from library or click + Media
                  </div>
                )}

                {/* Render Visual Clips */}
                {timelineClips.map((clip) => {
                  const asset = videoAssets.find(v => v.id === clip.assetId);
                  const left = (clip.startTime / duration) * 100;
                  const width = Math.max(0.2, ((clip.endTime - clip.startTime) / duration) * 100);
                  const isSelected = clip.id === selectedClipId;
                  const isVinyl = clip.type === 'vinyl-lyrics' || clip.assetId === 'vinyl-lyrics';
                  const isVisualizer = clip.type === 'visualizer' || clip.assetId === 'visualizer';
                  const isImage = clip.type === 'image';

                  let clipBg = 'bg-blue-600/40 border-blue-400/50 hover:bg-blue-600/60';
                  if (clip.locked) {
                    clipBg = 'bg-amber-900/40 border-amber-500/60';
                  } else if (isVinyl) {
                    clipBg = 'bg-indigo-900/60 border-indigo-400/60 hover:bg-indigo-800/80';
                  } else if (isVisualizer) {
                    clipBg = 'bg-emerald-900/60 border-emerald-400/60 hover:bg-emerald-800/80';
                  } else if (isImage) {
                    clipBg = 'bg-amber-900/40 border-amber-500/50 hover:bg-amber-800/60';
                  }

                  let clipLabel = asset ? asset.name : 'Media Clip';
                  if (isVinyl) clipLabel = 'Vinyl Lyrics Scene';
                  if (isVisualizer) clipLabel = 'Audio Visualizer Scene';

                  return (
                    <div 
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        setSelectedLyricId(null);
                        setSelectedWordKey(null);
                      }}
                      onPointerDown={(e) => handleClipPointerDown(e, clip, 'clip-body')}
                      className={`absolute top-1 bottom-1 rounded border flex items-center overflow-hidden transition-all select-none ${
                        clip.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isSelected 
                          ? 'ring-2 border-white z-20 shadow-lg' 
                          : clipBg
                      }`}
                      style={{ 
                        left: `${left}%`, 
                        width: `${width}%`,
                        borderColor: isSelected ? activeColor : undefined,
                        boxShadow: isSelected ? `0 0 12px ${activeColor}` : undefined
                      }}
                    >
                      {/* Left Resize Trim Handle */}
                      {!clip.locked && (
                        <div 
                          onPointerDown={(e) => handleClipPointerDown(e, clip, 'clip-left')}
                          className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/30 hover:bg-yellow-400 z-30 cursor-ew-resize opacity-0 group-hover/vis:opacity-100 transition-opacity"
                          title="Drag to trim start"
                        />
                      )}

                      {/* Thumbnail */}
                      {asset && asset.thumbnail && !isVinyl && !isVisualizer && (
                        <img src={asset.thumbnail} alt="" className="h-full opacity-60 object-cover pointer-events-none" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none" />

                      {/* Label & Type Icon */}
                      <div className="absolute left-2 right-2 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono text-white truncate">
                        <span className="truncate flex items-center gap-1 font-bold">
                          {isVinyl ? (
                            <span className="text-purple-300">💿</span>
                          ) : isVisualizer ? (
                            <span className="text-emerald-300">📊</span>
                          ) : isImage ? (
                            <ImageIcon size={9} className="text-amber-300" />
                          ) : (
                            <Film size={9} className="text-blue-300" />
                          )}
                          {clipLabel}
                        </span>
                        {clip.locked && <Lock size={10} className="text-amber-400 shrink-0" />}
                      </div>

                      {/* Right Resize Trim Handle */}
                      {!clip.locked && (
                        <div 
                          onPointerDown={(e) => handleClipPointerDown(e, clip, 'clip-right')}
                          className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/30 hover:bg-yellow-400 z-30 cursor-ew-resize opacity-0 group-hover/vis:opacity-100 transition-opacity"
                          title="Drag to trim end"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ----------------------------------------------------------------- */}
              {/* TRACK 2: LYRICS (LYR) — REAL EDITABLE OBJECT BLOCKS */}
              {/* ----------------------------------------------------------------- */}
              <div className={`h-10 relative border-b border-white/10 bg-purple-950/20 group/lyr ${lyrTrackVisible ? '' : 'opacity-20 pointer-events-none'}`}>
                {displayLyrics.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-purple-400/40 text-[10px] font-mono tracking-widest uppercase">
                    No lyrics lines · Click + in Lyrics tab or track menu
                  </div>
                )}

                {displayLyrics.map((line) => {
                  const left = (line.startTime / duration) * 100;
                  const width = Math.max(0.3, ((line.endTime - line.startTime) / duration) * 100);
                  const isCurrent = currentTime >= line.startTime && currentTime <= line.endTime;
                  const isSelected = line.id === selectedLyricId;

                  return (
                    <div 
                      key={line.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLyricId(line.id);
                        setSelectedClipId(null);
                        setSelectedWordKey(null);
                      }}
                      onPointerDown={(e) => handleLyricPointerDown(e, line, 'lyric-body')}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const newText = prompt('Edit lyric line:', line.text);
                        if (newText && newText.trim()) {
                          updateLyricLineText(line.id, newText.trim());
                        }
                      }}
                      className={`absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between overflow-hidden transition-all cursor-grab active:cursor-grabbing select-none ${
                        isSelected
                          ? 'bg-purple-600/80 border-purple-300 ring-2 ring-purple-400 z-20 shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                          : isCurrent 
                            ? 'bg-purple-700/60 border-yellow-300/80 text-yellow-200 z-10 shadow-md' 
                            : 'bg-purple-900/40 border-purple-500/40 hover:bg-purple-900/60 text-purple-200'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        onPointerDown={(e) => handleLyricPointerDown(e, line, 'lyric-left')}
                        className="absolute left-0 top-0 bottom-0 w-2 bg-purple-300/40 hover:bg-yellow-400 z-30 cursor-ew-resize opacity-0 group-hover/lyr:opacity-100 transition-opacity"
                        title="Drag to trim lyric start"
                      />

                      {/* Text label */}
                      <span className="text-[10px] font-mono font-bold truncate pointer-events-none">
                        {line.text}
                      </span>

                      {/* Right Trim Handle */}
                      <div 
                        onPointerDown={(e) => handleLyricPointerDown(e, line, 'lyric-right')}
                        className="absolute right-0 top-0 bottom-0 w-2 bg-purple-300/40 hover:bg-yellow-400 z-30 cursor-ew-resize opacity-0 group-hover/lyr:opacity-100 transition-opacity"
                        title="Drag to trim lyric end"
                      />
                    </div>
                  );
                })}
              </div>

              {/* ----------------------------------------------------------------- */}
              {/* SUB-TRACK: WORD TIMELINE LAYER (WHEN EXPANDED) */}
              {/* ----------------------------------------------------------------- */}
              {wordsExpanded && (
                <div className="h-8 relative border-b border-white/10 bg-amber-950/20 group/word">
                  {displayLyrics.map((line) => {
                    const words = ensureLineWords(line);
                    return words.map((w, wordIdx) => {
                      const left = (w.start / duration) * 100;
                      const width = Math.max(0.15, ((w.end - w.start) / duration) * 100);
                      const isWordActive = currentTime >= w.start && currentTime <= w.end;
                      const isWordSelected = selectedWordKey?.lineId === line.id && selectedWordKey?.wordIndex === wordIdx;

                      return (
                        <div
                          key={`${line.id}-${wordIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWordKey({ lineId: line.id, wordIndex: wordIdx });
                            setSelectedLyricId(line.id);
                            setSelectedClipId(null);
                          }}
                          onPointerDown={(e) => handleWordPointerDown(e, line.id, wordIdx, w, 'word-body')}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            const newWord = prompt('Edit word:', w.word);
                            if (newWord && newWord.trim()) {
                              updateWordText(line.id, wordIdx, newWord.trim());
                            }
                          }}
                          className={`absolute top-0.5 bottom-0.5 rounded border px-1 flex items-center justify-center overflow-hidden transition-all cursor-grab active:cursor-grabbing select-none ${
                            isWordSelected
                              ? 'bg-amber-500 border-white text-black font-extrabold z-30 ring-1 ring-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                              : isWordActive
                                ? 'bg-amber-600/90 border-amber-300 text-white font-bold z-20'
                                : 'bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60 text-amber-200'
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {/* Left Trim Handle */}
                          <div 
                            onPointerDown={(e) => handleWordPointerDown(e, line.id, wordIdx, w, 'word-left')}
                            className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-200/40 hover:bg-white z-30 cursor-ew-resize opacity-0 group-hover/word:opacity-100"
                          />

                          <span className="text-[9px] font-sans truncate pointer-events-none">
                            {w.word}
                          </span>

                          {/* Right Trim Handle */}
                          <div 
                            onPointerDown={(e) => handleWordPointerDown(e, line.id, wordIdx, w, 'word-right')}
                            className="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-200/40 hover:bg-white z-30 cursor-ew-resize opacity-0 group-hover/word:opacity-100"
                          />
                        </div>
                      );
                    });
                  })}
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TRACK 3: AUDIO (AUD) WITH WAVEFORM & BEAT GRID */}
              {/* ----------------------------------------------------------------- */}
              <div className="h-12 relative bg-emerald-950/20 border-b border-white/10">
                {/* Waveform Visualization */}
                <div className="absolute inset-y-1 inset-x-0 flex items-center opacity-70 pointer-events-none">
                  {waveformPeaks && waveformPeaks.length > 0 ? (
                    <svg preserveAspectRatio="none" viewBox={`0 0 ${waveformPeaks.length} 100`} className="w-full h-full fill-emerald-400">
                      {waveformPeaks.map((peak, i) => (
                        <rect key={i} x={i} y={50 - peak * 45} width={1.2} height={Math.max(2, peak * 90)} />
                      ))}
                    </svg>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-600/40 text-[9px] font-mono uppercase tracking-widest">
                      Audio Waveform Track
                    </div>
                  )}
                </div>

                {/* Subtle Beat Grid Ticks Overlay */}
                {songAnalysis?.bpm && (
                  <div className="absolute inset-0 pointer-events-none opacity-20 flex">
                    {Array.from({ length: Math.floor((duration / (60 / songAnalysis.bpm))) }).map((_, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 w-[1px] ${i % 4 === 0 ? 'bg-emerald-300 opacity-60' : 'bg-emerald-500 opacity-30'}`}
                        style={{ left: `${((i * (60 / songAnalysis.bpm)) / duration) * 100}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* ===================================================================== */}
            {/* MAGNETIC SNAP GUIDE (Green laser vertical line) */}
            {/* ===================================================================== */}
            {activeSnapGuide && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-50 pointer-events-none shadow-[0_0_10px_#10b981]"
                style={{ left: `${(activeSnapGuide.time / duration) * 100}%` }}
              >
                <div className="absolute top-7 -translate-x-1/2 px-1.5 py-0.5 bg-emerald-900/90 text-emerald-200 border border-emerald-400 text-[8px] font-mono font-bold rounded shadow-lg whitespace-nowrap">
                  {activeSnapGuide.label}
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* PLAYHEAD */}
            {/* ===================================================================== */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 rotate-45 bg-red-500 shadow-md" />
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTEXTUAL FLOATING INSPECTOR BARS (Docked above bottom bar) */}
      {/* ========================================================================= */}
      {selectedWord && selectedWordKey && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50">
          <WordContextBar
            word={selectedWord}
            lineId={selectedWordKey.lineId}
            wordIndex={selectedWordKey.wordIndex}
            activeColor={activeColor}
            onEditWordText={(text) => updateWordText(selectedWordKey.lineId, selectedWordKey.wordIndex, text)}
            onInsertWordBefore={(text) => insertWord(selectedWordKey.lineId, selectedWordKey.wordIndex - 1, text)}
            onInsertWordAfter={(text) => insertWord(selectedWordKey.lineId, selectedWordKey.wordIndex, text)}
            onDeleteWord={() => {
              deleteWord(selectedWordKey.lineId, selectedWordKey.wordIndex);
              setSelectedWordKey(null);
            }}
            onClose={() => setSelectedWordKey(null)}
          />
        </div>
      )}

      {selectedLyric && !selectedWord && !selectedClip && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50">
          <LyricContextBar
            line={selectedLyric}
            currentTime={currentTime}
            activeColor={activeColor}
            isWordsExpanded={wordsExpanded}
            onToggleExpandWords={() => setWordsExpanded(!wordsExpanded)}
            onSplit={() => splitLyricLine(selectedLyric.id, currentTime)}
            onDuplicate={() => duplicateLyricLine(selectedLyric.id)}
            onMergeNext={() => mergeLyricWithNext(selectedLyric.id)}
            onDelete={() => {
              deleteLyricLine(selectedLyric.id);
              setSelectedLyricId(null);
            }}
            onEditText={(text) => updateLyricLineText(selectedLyric.id, text)}
            onClose={() => setSelectedLyricId(null)}
          />
        </div>
      )}

      {selectedClip && !selectedLyric && !selectedWord && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50">
          <ClipContextBar
            clip={selectedClip}
            currentTime={currentTime}
            activeColor={activeColor}
            onSplit={() => {
              splitTimelineClip(selectedClip.id, currentTime);
              commitTimeline();
            }}
            onDuplicate={() => {
              duplicateTimelineClip(selectedClip.id);
              commitTimeline();
            }}
            onToggleLock={() => {
              toggleLockClip(selectedClip.id);
              commitTimeline();
            }}
            onDelete={() => {
              removeTimelineClip(selectedClip.id);
              setSelectedClipId(null);
              commitTimeline();
            }}
            onUpdateEffect={(fx) => {
              updateTimelineClip(selectedClip.id, { effect: fx });
              commitTimeline();
            }}
            onUpdateTransition={(tr) => {
              updateTimelineClip(selectedClip.id, { transition: tr });
              commitTimeline();
            }}
            onClose={() => setSelectedClipId(null)}
          />
        </div>
      )}
    </div>
  );
}
