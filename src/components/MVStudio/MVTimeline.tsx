import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
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
  origTrimStart?: number;
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
  const setClipAutoManaged = useMVStore(s => s.setClipAutoManaged);
  const removeTimelineClip = useMVStore(s => s.removeTimelineClip);
  const splitTimelineClip = useMVStore(s => s.splitTimelineClip);
  const duplicateTimelineClip = useMVStore(s => s.duplicateTimelineClip);
  const copiedTimelineClip = useMVStore(s => s.copiedTimelineClip);
  const copyTimelineClip = useMVStore(s => s.copyTimelineClip);
  const pasteTimelineClip = useMVStore(s => s.pasteTimelineClip);
  const addTimelineClip = useMVStore(s => s.addTimelineClip);
  const updateTimelineClip = useMVStore(s => s.updateTimelineClip);
  const commitTimeline = useMVStore(s => s.commitTimeline);

  // Global History hook
  const { canUndo, canRedo, undo, redo, recordSnapshot } = useGlobalHistory();

  // Timeline UI States
  const [zoom, setZoom] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640 ? 7 : 1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const scrubPointerXRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
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

      // CapCut-style MV editing commands; keep native copy/paste in inputs.
      const modifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (modifier && !e.altKey && !isInput && (key === 'c' || key === 'v' || key === 'd' || key === 'b')) {
        if (key === 'c' && selectedClipId) {
          e.preventDefault();
          copyTimelineClip(selectedClipId);
          return;
        }
        if (key === 'v' && useMVStore.getState().copiedTimelineClip) {
          e.preventDefault();
          pasteTimelineClip(currentTime);
          commitTimeline();
          return;
        }
        if (key === 'd' && selectedClipId) {
          e.preventDefault();
          duplicateTimelineClip(selectedClipId);
          commitTimeline();
          return;
        }
        if (key === 'b' && selectedClipId) {
          const clip = useMVStore.getState().timelineClips.find(c => c.id === selectedClipId);
          if (clip && !clip.locked && currentTime > clip.startTime + 0.1 &&
            currentTime < clip.endTime - 0.1) {
            e.preventDefault();
            splitTimelineClip(selectedClipId, currentTime);
            commitTimeline();
            return;
          }
        }
      }

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
      } else if ((e.key === '[' || (!e.shiftKey && e.code === 'BracketLeft')) && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedClipId) {
          e.preventDefault();
          const clip = timelineClips.find(c => c.id === selectedClipId);
          if (clip) {
            const newStart = Math.min(currentTime, clip.endTime - 0.2);
            updateTimelineClip(selectedClipId, { startTime: newStart });
            recordSnapshot('Trim Clip In-Point [');
          }
        }
      } else if ((e.key === ']' || (!e.shiftKey && e.code === 'BracketRight')) && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedClipId) {
          e.preventDefault();
          const clip = timelineClips.find(c => c.id === selectedClipId);
          if (clip) {
            const newEnd = Math.max(currentTime, clip.startTime + 0.2);
            updateTimelineClip(selectedClipId, { endTime: newEnd });
            recordSnapshot('Trim Clip Out-Point ]');
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedClipId, selectedLyricId, selectedWordKey, removeTimelineClip, setSelectedClipId, recordSnapshot, timelineClips, currentTime, updateTimelineClip, copyTimelineClip, pasteTimelineClip, duplicateTimelineClip, splitTimelineClip, commitTimeline]);

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

  // Seek through the actual Joelizer audio player, not a generic document
  // <audio> element that may be unrelated to the selected soundtrack.
  const handleSeek = useCallback((clientX: number) => {
    const ruler = containerRef.current;
    if (!ruler || duration <= 0) return;
    const rect = ruler.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const time = Math.max(0, Math.min(duration, x / rect.width * duration));
    setCurrentTime(time);
    audioManager.seek(Math.min(time, Math.max(0, duration - 0.001)));
  }, [duration, setCurrentTime]);

  // Keep the playhead advancing through horizontally scrolled/zoomed sections.
  // A captured pointer can sit at the viewport edge while the timeline pans.
  const scrollWhileScrubbing = useCallback(() => {
    if (!scrubbingRef.current) { scrubFrameRef.current = null; return; }
    const wrapper = scrollWrapperRef.current;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const previousScroll = wrapper.scrollLeft;
      const distance = 32;
      const x = scrubPointerXRef.current;
      if (x > rect.right - distance && wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth) {
        wrapper.scrollLeft += Math.max(2, (x - (rect.right - distance)) * 0.38);
      } else if (x < rect.left + distance && wrapper.scrollLeft > 0) {
        wrapper.scrollLeft -= Math.max(2, ((rect.left + distance) - x) * 0.38);
      }
      // Avoid a redundant React/audio seek on every animation frame when the
      // playhead hasn't moved. Pointer-move events handle normal dragging.
      if (wrapper.scrollLeft !== previousScroll) handleSeek(x);
    }
    scrubFrameRef.current = requestAnimationFrame(scrollWhileScrubbing);
  }, [handleSeek]);

  useEffect(() => () => {
    scrubbingRef.current = false;
    if (scrubFrameRef.current !== null) cancelAnimationFrame(scrubFrameRef.current);
  }, []);

  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (dragSessionRef.current || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubPointerXRef.current = e.clientX;
    scrubbingRef.current = true;
    setIsScrubbing(true);
    handleSeek(e.clientX);
    if (scrubFrameRef.current === null) {
      scrubFrameRef.current = requestAnimationFrame(scrollWhileScrubbing);
    }
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    scrubPointerXRef.current = e.clientX;
    handleSeek(e.clientX);
  };

  const finishRulerScrub = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    scrubPointerXRef.current = e.clientX;
    handleSeek(e.clientX);
    scrubbingRef.current = false;
    setIsScrubbing(false);
    if (scrubFrameRef.current !== null) {
      cancelAnimationFrame(scrubFrameRef.current);
      scrubFrameRef.current = null;
    }
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
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
      origTrimStart: clip.trimStart,
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
        const maxLeftShift = session.origStart - (session.origTrimStart ?? currentTrimStart);
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
        const newTrimStart = Math.max(0, currentTrimStart + (finalStart - clip.startTime));
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
      className="flex flex-col h-full bg-[#0a0c0f] text-[#f0f3f6] select-none"
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
    >
      {/* ========================================================================= */}
      {/* TOP TOOLBAR */}
      {/* ========================================================================= */}
      <div className="h-9 border-b border-[#232933] flex items-center px-2 sm:px-3 justify-between gap-2 bg-[#0e1115] text-xs shrink-0 min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5 overflow-hidden">
          {/* Play / Pause button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent hover:bg-accent/80 text-black text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            {isPlaying ? <Pause size={11} strokeWidth={2.5} /> : <Play size={11} strokeWidth={2.5} className="ml-0.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Title */}
          <span className="hidden sm:flex font-mono text-[11px] font-bold uppercase tracking-widest items-center gap-1.5 text-accent">
            <Film size={12} />
            Timeline
          </span>

          {/* Global Undo / Redo */}
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#232933]">
            <button
              onClick={(e) => { e.stopPropagation(); undo(); }}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] disabled:opacity-30 text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Undo2 size={11} />
              <span>Undo</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); redo(); }}
              disabled={!canRedo}
              title="Redo (Ctrl+Y / Cmd+Shift+Z)"
              className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] disabled:opacity-30 text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Redo2 size={11} />
              <span>Redo</span>
            </button>
          </div>

          {/* Playhead paste is accessible by button as well as Ctrl+V / Cmd+V. */}
          <button type="button" disabled={!copiedTimelineClip}
            onClick={() => { pasteTimelineClip(currentTime); commitTimeline(); }}
            title="Paste copied clip at playhead (Ctrl+V / Cmd+V)"
            className="shrink-0 rounded border border-[#303846] bg-[#161b22] px-2 py-1 text-[10px] font-mono font-semibold text-[#d1dae4] disabled:opacity-30 hover:border-accent/60">
            Paste
          </button>

          {/* Magnetic Snapping Toggle */}
          <div className="flex items-center pl-2 border-l border-[#232933]">
            <button
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              title="Toggle Magnetic Snapping (S)"
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                snappingEnabled 
                  ? 'bg-[#161b22] text-accent border border-accent/40 shadow-sm' 
                  : 'bg-[#12161c] text-[#7e8999] hover:text-[#f0f3f6] border border-[#232933]'
              }`}
            >
              <Magnet size={11} />
              <span>Snap: {snappingEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Selected Video Clip Quick Actions */}
          {selectedClip && (
            <div className="flex items-center gap-1 pl-2.5 border-l border-[#232933]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLockClip(selectedClip.id);
                  commitTimeline();
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                  selectedClip.locked ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#161b22] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                {selectedClip.locked ? <Lock size={10} /> : <Unlock size={10} />}
                <span>{selectedClip.locked ? 'Locked' : 'Lock'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  splitTimelineClip(selectedClip.id, currentTime);
                  commitTimeline();
                }}
                disabled={currentTime <= selectedClip.startTime || currentTime >= selectedClip.endTime || selectedClip.locked}
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Scissors size={10} />
                <span>Split</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyTimelineClip(selectedClip.id);
                }}
                title="Copy selected clip (Ctrl+C / Cmd+C)"
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy size={10} /><span>Copy</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateTimelineClip(selectedClip.id);
                  commitTimeline();
                }}
                title="Duplicate selected clip (Ctrl+D / Cmd+D)"
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy size={10} />
                <span>Dup</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTimelineClip(selectedClip.id);
                  commitTimeline();
                }}
                className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={10} />
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* Selected Lyric Line Quick Actions in Header */}
          {selectedLyric && !selectedClip && (
            <div className="flex items-center gap-1 pl-2.5 border-l border-[#232933]">
              <span className="text-[10px] text-accent font-bold font-mono">LYRIC:</span>
              <button
                onClick={() => setWordsExpanded(!wordsExpanded)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  wordsExpanded ? 'bg-accent text-black' : 'bg-[#161b22] text-[#7e8999] hover:text-[#f0f3f6] border border-[#232933]'
                }`}
              >
                <Layers size={10} />
                <span>{wordsExpanded ? 'Words ▲' : 'Words ▼'}</span>
              </button>

              <button
                onClick={() => splitLyricLine(selectedLyric.id, currentTime)}
                disabled={currentTime <= selectedLyric.startTime + 0.2 || currentTime >= selectedLyric.endTime - 0.2}
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 disabled:opacity-30 cursor-pointer"
              >
                <Scissors size={10} />
                <span>Split</span>
              </button>

              <button
                onClick={() => duplicateLyricLine(selectedLyric.id)}
                className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy size={10} />
                <span>Dup</span>
              </button>

              <button
                onClick={() => deleteLyricLine(selectedLyric.id)}
                className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={10} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Zoom Controls & Slider */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(1, z - 0.5))}
            className="p-1 rounded bg-[#12161c] hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={11} />
          </button>

          {/* Zoom Slider */}
          <input
            type="range"
            min="1"
            max="15"
            step="0.2"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-10 sm:w-16 h-1 bg-[#232933] rounded appearance-none cursor-pointer accent-accent"
            title="Zoom timeline scale"
          />

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(20, z + 0.5))}
            className="p-1 rounded bg-[#12161c] hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={11} />
          </button>

          {/* Zoom Badge */}
          <div className="flex items-center px-1.5 py-0.5 rounded bg-[#12161c] border border-[#232933] text-[10px] text-[#7e8999] font-mono">
            <span className="text-accent font-bold">{zoom.toFixed(1)}x</span>
          </div>

          {/* Fit Timeline Button */}
          <button
            onClick={() => setZoom(1)}
            title="Fit Entire Timeline to Window"
            className="px-2 py-0.5 rounded bg-[#12161c] hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 size={10} />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Mobile lyric inspector: readable text stays available even when
          time-scaled lyric blocks are narrower than a word. */}
      {displayLyrics.length > 0 && (
        <div className="sm:hidden flex shrink-0 items-center gap-2 border-b border-[#28303c] bg-[#121923] px-2 py-2 min-w-0">
          <Type size={14} className="shrink-0 text-accent" />
          <button type="button" className="min-w-0 flex-1 text-left"
            onClick={() => {
              const target = selectedLyric ?? displayLyrics.find(line => currentTime >= line.startTime && currentTime < line.endTime)
                ?? displayLyrics.find(line => line.startTime >= currentTime);
              if (target) setSelectedLyricId(target.id);
            }}
            aria-label="Select current lyric">
            <span className="block truncate text-[12px] font-semibold text-[#f0f3f6]">
              {(selectedLyric ?? displayLyrics.find(line => currentTime >= line.startTime && currentTime < line.endTime)
                ?? displayLyrics.find(line => line.startTime >= currentTime))?.text || 'Select a lyric'}
            </span>
            <span className="text-[9px] text-[#92a2b5]">Tap to select · timeline zoom {zoom.toFixed(1)}x</span>
          </button>
          <button type="button"
            className="shrink-0 rounded-md border border-[#35475b] bg-[#1d2a3a] p-2 text-accent"
            aria-label="Edit current lyric"
            onClick={() => {
              const target = selectedLyric ?? displayLyrics.find(line => currentTime >= line.startTime && currentTime < line.endTime)
                ?? displayLyrics.find(line => line.startTime >= currentTime);
              if (!target) return;
              const text = window.prompt('Edit lyric line:', target.text);
              if (text !== null && text.trim() && text.trim() !== target.text) {
                updateLyricLineText(target.id, text.trim());
                recordSnapshot('Edit Lyric Text');
              }
            }}>
            <Edit3 size={14}/>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIMELINE MAIN CONTAINER (Track Headers + Scrollable Tracks) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex relative overflow-hidden bg-[#0a0c0f]">
        
        {/* ========================================================================= */}
        {/* LEFT FIXED TRACK HEADERS */}
        {/* ========================================================================= */}
        <div className="w-28 bg-[#0e1115] border-r border-[#232933] flex flex-col shrink-0 z-30 shadow-lg">
          {/* Header Spacer (matches ruler height) */}
          <div className="h-6 border-b border-[#232933] bg-[#12161c] flex items-center px-2 text-[9px] font-mono text-[#7e8999] font-bold uppercase tracking-wider">
            <span>TRACKS</span>
          </div>

          {/* VIS Track Header */}
          <div className="h-16 border-b border-[#232933] p-1.5 flex flex-col justify-between relative group/vis-header bg-[#12161c]/40">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-[#f0f3f6] flex items-center gap-1">
                <Film size={11} className="text-accent" /> VIS
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setVisTrackVisible(!visTrackVisible)}
                  title={visTrackVisible ? 'Hide video track' : 'Show video track'}
                  className="text-[#7e8999] hover:text-[#f0f3f6] p-0.5 cursor-pointer"
                >
                  {visTrackVisible ? <Eye size={11} /> : <EyeOff size={11} className="text-[#7e8999]/40" />}
                </button>
                <button
                  onClick={() => setVisTrackLocked(!visTrackLocked)}
                  title={visTrackLocked ? 'Unlock track' : 'Lock track'}
                  className={`p-0.5 cursor-pointer ${visTrackLocked ? 'text-amber-400' : 'text-[#7e8999] hover:text-[#f0f3f6]'}`}
                >
                  {visTrackLocked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => handleTrackAction('vis', 'add-visualizer')}
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#161b22] hover:bg-[#1f2631] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] flex items-center gap-0.5 cursor-pointer"
                title="Add scene clip"
              >
                <Plus size={9} /> Media
              </button>
              <button
                onClick={() => setActiveTrackMenu(activeTrackMenu === 'vis' ? null : 'vis')}
                className="text-[#7e8999] hover:text-[#f0f3f6] p-0.5 cursor-pointer"
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
          <div className="h-14 sm:h-10 border-b border-[#232933] p-1.5 flex flex-col justify-between relative group/lyr-header bg-[#12161c]/30">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-[#f0f3f6] flex items-center gap-1">
                <Type size={11} className="text-accent" /> LYR
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLyrTrackVisible(!lyrTrackVisible)}
                  title={lyrTrackVisible ? 'Hide lyrics track' : 'Show lyrics track'}
                  className="text-[#7e8999] hover:text-[#f0f3f6] p-0.5 cursor-pointer"
                >
                  {lyrTrackVisible ? <Eye size={11} /> : <EyeOff size={11} className="text-[#7e8999]/40" />}
                </button>
                <button
                  onClick={() => setWordsExpanded(!wordsExpanded)}
                  title={wordsExpanded ? 'Collapse word layer' : 'Expand word layer'}
                  className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold flex items-center gap-0.5 cursor-pointer ${
                    wordsExpanded ? 'bg-[#161b22] text-accent border border-accent/40' : 'bg-[#12161c] text-[#7e8999] hover:text-[#f0f3f6] border border-[#232933]'
                  }`}
                >
                  {wordsExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                  <span>W</span>
                </button>
                <button
                  onClick={() => setActiveTrackMenu(activeTrackMenu === 'lyr' ? null : 'lyr')}
                  className="text-[#7e8999] hover:text-[#f0f3f6] p-0.5 cursor-pointer"
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
            <div className="h-8 border-b border-[#232933] px-1.5 flex items-center justify-between bg-[#12161c]/50">
              <span className="font-mono text-[9px] font-bold text-amber-400 flex items-center gap-0.5 pl-2">
                └ WORD
              </span>
              <span className="text-[8px] font-mono text-[#7e8999]">
                Sync
              </span>
            </div>
          )}

          {/* AUD Track Header */}
          <div className="h-12 border-b border-[#232933] p-1.5 flex flex-col justify-between relative group/aud-header bg-[#12161c]/30">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-[#f0f3f6] flex items-center gap-1">
                <Music size={11} className="text-accent" /> AUD
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleMute}
                  title={audioMuted ? 'Unmute' : 'Mute'}
                  className={`p-0.5 cursor-pointer ${audioMuted ? 'text-red-400' : 'text-accent'}`}
                >
                  {audioMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
                <button
                  onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  className="text-[#7e8999] hover:text-[#f0f3f6] p-0.5 cursor-pointer"
                  title="Volume level"
                >
                  <MoreVertical size={11} />
                </button>
              </div>
            </div>

            {/* Volume slider popover */}
            {showVolumeSlider && (
              <div className="absolute left-28 top-0 z-50 p-2 bg-[#12161c] border border-[#232933] rounded-lg shadow-xl flex items-center gap-2">
                <Volume2 size={12} className="text-accent" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioMuted ? 0 : audioVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-[#232933] rounded accent-accent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-[#f0f3f6] font-bold w-6">{Math.round(audioVolume * 100)}%</span>
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
              onPointerUp={finishRulerScrub}
              onPointerCancel={finishRulerScrub}
              onLostPointerCapture={() => {
                scrubbingRef.current = false;
                setIsScrubbing(false);
                if (scrubFrameRef.current !== null) cancelAnimationFrame(scrubFrameRef.current);
                scrubFrameRef.current = null;
              }}
              className="h-6 bg-[#0e1115] border-b border-[#232933] relative text-[9px] font-mono text-[#7e8999] flex items-center cursor-ew-resize select-none"
            >
              {/* Dynamic Ruler Ticks & Section Markers */}
              {Array.from({ length: Math.max(13, Math.round(12 * zoom)) + 1 }, (_, i) => (duration / Math.max(12, Math.round(12 * zoom))) * i).map((tick, idx) => (
                <div 
                  key={idx}
                  className="absolute flex flex-col items-center -translate-x-1/2 pointer-events-none"
                  style={{ left: `${(tick / duration) * 100}%` }}
                >
                  <span className="text-[8px] font-mono opacity-80">{formatTime(tick)}</span>
                  <div className="w-[1px] h-1.5 bg-[#232933]" />
                </div>
              ))}

              {/* Song Section Badges on Ruler (Intro, Verse, Chorus, Drop, etc.) */}
              {songAnalysis?.sections?.map((sec, i) => (
                <div
                  key={i}
                  className="absolute top-0.5 px-1.5 py-0.2 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-[#161b22] border border-[#232933] text-yellow-400 pointer-events-none -translate-x-1/2"
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
                className={`h-16 relative border-b border-[#232933] bg-[#0a0c0f] group/vis ${visTrackVisible ? '' : 'opacity-20 pointer-events-none'}`}
              >
                {/* Empty Drop Hint */}
                {timelineClips.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#7e8999]/40 text-[10px] font-mono tracking-widest uppercase">
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

                  let clipBg = 'bg-[#161b22] border-[#2e3746] hover:border-[#404d60]';
                  if (clip.locked) {
                    clipBg = 'bg-amber-950/40 border-amber-600/50';
                  } else if (isVinyl) {
                    clipBg = 'bg-indigo-950/50 border-indigo-500/40 hover:border-indigo-400';
                  } else if (isVisualizer) {
                    clipBg = 'bg-emerald-950/50 border-emerald-500/40 hover:border-emerald-400';
                  } else if (isImage) {
                    clipBg = 'bg-amber-950/40 border-amber-500/40 hover:border-amber-400';
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
                          ? 'ring-1 border-accent z-20 shadow-[0_0_10px_rgba(0,230,118,0.2)] bg-[#1a212b]' 
                          : clipBg
                      }`}
                      style={{ 
                        left: `${left}%`, 
                        width: `${width}%`,
                      }}
                    >
                      {/* Left Resize Trim Handle */}
                      {!clip.locked && (
                        <div 
                          onPointerDown={(e) => handleClipPointerDown(e, clip, 'clip-left')}
                          className="absolute left-0 top-0 bottom-0 w-2.5 bg-accent/30 hover:bg-accent z-30 cursor-ew-resize opacity-0 group-hover/vis:opacity-100 transition-opacity"
                          title="Drag to trim start"
                        />
                      )}

                      {/* Thumbnail */}
                      {asset && asset.thumbnail && !isVinyl && !isVisualizer && (
                        <img src={asset.thumbnail} alt="" className="h-full opacity-60 object-cover pointer-events-none" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none" />

                      {/* Label & Type Icon */}
                      <div className="absolute left-2 right-2 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono text-[#f0f3f6] truncate">
                        <span className="truncate flex items-center gap-1 font-bold">
                          {isVinyl ? (
                            <span className="text-purple-300">💿</span>
                          ) : isVisualizer ? (
                            <span className="text-accent">📊</span>
                          ) : isImage ? (
                            <ImageIcon size={9} className="text-amber-300" />
                          ) : (
                            <Film size={9} className="text-accent" />
                          )}
                          {clipLabel}
                        </span>
                        {clip.locked && <Lock size={10} className="text-amber-400 shrink-0" />}
                      </div>

                      {/* Right Resize Trim Handle */}
                      {!clip.locked && (
                        <div 
                          onPointerDown={(e) => handleClipPointerDown(e, clip, 'clip-right')}
                          className="absolute right-0 top-0 bottom-0 w-2.5 bg-accent/30 hover:bg-accent z-30 cursor-ew-resize opacity-0 group-hover/vis:opacity-100 transition-opacity"
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
              <div className={`h-14 sm:h-10 relative border-b border-[#232933] bg-[#0c0e12] group/lyr ${lyrTrackVisible ? '' : 'opacity-20 pointer-events-none'}`}>
                {displayLyrics.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#7e8999]/40 text-[10px] font-mono tracking-widest uppercase">
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
                          ? 'bg-[#1a212b] border-accent ring-1 ring-accent z-20 shadow-[0_0_10px_rgba(0,230,118,0.25)] text-[#f0f3f6]'
                          : isCurrent 
                            ? 'bg-[#161b22] border-accent/60 text-accent z-10 shadow-sm' 
                            : 'bg-[#12161c] border-[#232933] hover:border-[#384252] text-[#7e8999] hover:text-[#f0f3f6]'
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {/* Left Trim Handle */}
                      <div 
                        onPointerDown={(e) => handleLyricPointerDown(e, line, 'lyric-left')}
                        className="absolute left-0 top-0 bottom-0 w-2 bg-accent/40 hover:bg-accent z-30 cursor-ew-resize opacity-0 group-hover/lyr:opacity-100 transition-opacity"
                        title="Drag to trim lyric start"
                      />

                      {/* Text label */}
                      <span className="text-[11px] sm:text-[10px] leading-snug font-mono font-semibold line-clamp-2 sm:truncate pointer-events-none break-words">
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
            onCopy={() => { copyTimelineClip(selectedClip.id); }}
            onPaste={() => { pasteTimelineClip(currentTime); commitTimeline(); }}
            canPaste={!!copiedTimelineClip}
            onToggleLock={() => {
              toggleLockClip(selectedClip.id);
              commitTimeline();
            }}
            onToggleAutoManaged={() => {
              setClipAutoManaged(selectedClip.id, selectedClip.editOrigin !== 'auto' || !!selectedClip.manuallyEdited);
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
