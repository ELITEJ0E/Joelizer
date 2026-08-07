import React, { useState, useEffect, useRef } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { 
  Upload, Music, FileText, Play, Pause, RotateCcw, Download, Sparkles, 
  Trash2, Plus, Split, Combine, Clock, Zap, CheckCircle2, ChevronRight,
  Layers, Volume2, VolumeX, Eye, Radio, RefreshCw, Undo2, Redo2, Sliders, SlidersHorizontal, Activity, AudioLines, ArrowUpRight, ListMusic, XCircle,
  Copy, Check, Package, X, PanelLeftClose, PanelLeftOpen, Link2
} from 'lucide-react';
import { cn, formatTime } from '../../lib/utils';
import { Scrubber } from '../ui/scrubber';
import { VideoSlider } from '../ui/video-slider';
import { audioManager } from '../../lib/audio';
import { analyzeAudioBuffer, drawStudioWaveform, WaveformData, calculateBpmFromBeats } from '../../lib/audioAnalysis';
import { GeminiServerProvider, parseUploadedLyricFile, parseLRCContent, getActiveLyricLine } from '../../lib/transcriptionProvider';
import { LyricLineWithWords, ProcessingProgress, ExportFormat, SongAnalysis } from '../../types/studio';
import { generateLRC, generateEnhancedLRC, generateSRT, generateASS, generateJSON, generateTXT, generateZIP, downloadFile, formatLRCStamp } from '../../lib/lyricExporters';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { AudioSourceModal } from '../Audio/AudioSourceModal';

export function StudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const audioUrl = useStore(s => s.audioUrl);
  const setAudio = useStore(s => s.setAudio);
  const lyricsLines = useStore(s => s.lyricsSettings.lines);
  const updateLyricsSettings = useStore(s => s.updateLyricsSettings);
  const setActiveTab = useStore(s => s.setActiveTab);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);

  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);

  // Global Studio State from Store for persistence across tab unmounts
  const selectedLineId = useStore(s => s.selectedStudioLineId);
  const setSelectedLineId = useStore(s => s.setSelectedStudioLineId);
  const zoom = useStore(s => s.studioZoom);
  const setZoom = useStore(s => s.setStudioZoom);
  const scrollOffset = useStore(s => s.studioScrollOffset);
  const setScrollOffset = useStore(s => s.setStudioScrollOffset);

  // Local Studio State
  const [lines, setLines] = useState<LyricLineWithWords[]>([]);
  const [history, setHistory] = useState<LyricLineWithWords[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);

  const [rawUploadedLyrics, setRawUploadedLyrics] = useState<string>('');
  const [uploadedLyricsFileName, setUploadedLyricsFileName] = useState<string | null>(null);

  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);

  // Dragging Marker Pin State
  const draggingLineRef = useRef<string | null>(null);
  const isDraggingMarkerRef = useRef<boolean>(false);
  const isDraggingPlayheadRef = useRef<boolean>(false);

  // Playback state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Song AI Intelligence
  const [analysis, setAnalysis] = useState<SongAnalysis>({
    bpm: 120,
    key: 'C Major',
    language: 'English',
    sections: []
  });

  // AI Processing State
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [activeExportFormat, setActiveExportFormat] = useState<ExportFormat | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { handleClose: handleCloseExportMenu } = usePopstateModal(showExportMenu, () => setShowExportMenu(false));
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const { handleClose: handleCloseAudioModal } = usePopstateModal(isAudioModalOpen, () => setIsAudioModalOpen(false));
  const [copiedLRC, setCopiedLRC] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileStudioTab, setMobileStudioTab] = useState<'waveform' | 'lyrics' | 'source'>('waveform');

  const handleCopyLRC = () => {
    const lrcContent = generateLRC(lines, projectName || 'joelizer-lyrics');
    navigator.clipboard.writeText(lrcContent);
    setCopiedLRC(true);
    setTimeout(() => setCopiedLRC(false), 2000);
  };

  const handleClearAllLines = () => {
    if (lines.length === 0) return;
    updateLinesWithHistory([]);
    setSelectedLineId(null);
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelAIGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress({ stage: 'error', message: 'Generation cancelled', percentage: 0 });
    setTimeout(() => setProgress(null), 1200);
  };

  const handleRawLyricsChange = (text: string) => {
    setRawUploadedLyrics(text);
    // Automatically parse if LRC format timestamps are present
    if (text.includes('[') && /\[\d{1,2}:\d{2}/.test(text)) {
      const parsed = parseLRCContent(text);
      if (parsed.length > 0) {
        updateLinesWithHistory(parsed);
      }
    }
  };

  const handleManualParseLRC = () => {
    if (!rawUploadedLyrics.trim()) return;
    const parsed = parseLRCContent(rawUploadedLyrics);
    if (parsed.length > 0) {
      updateLinesWithHistory(parsed);
    } else {
      const splitLines = rawUploadedLyrics.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const newLines: LyricLineWithWords[] = splitLines.map((t, idx) => ({
        id: `lrc-manual-${idx}-${Date.now()}`,
        startTime: idx * 3.5,
        endTime: (idx + 1) * 3.5,
        text: t
      }));
      updateLinesWithHistory(newLines);
    }
  };

  // Initialize lines from store or default
  useEffect(() => {
    if (lyricsLines && lyricsLines.length > 0) {
      setLines(lyricsLines);
      setHistory([lyricsLines]);
      setHistoryIndex(0);
    }
  }, []);

  // Update store when lines change
  const updateLinesWithHistory = (newLines: LyricLineWithWords[]) => {
    setLines(newLines);
    updateLyricsSettings({ lines: newLines });
    
    // History stack management
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newLines);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setLines(prev);
      updateLyricsSettings({ lines: prev });
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setLines(next);
      updateLyricsSettings({ lines: next });
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Analyze audio when audioFile changes
  useEffect(() => {
    if (audioFile) {
      setIsAnalyzingAudio(true);
      analyzeAudioBuffer(audioFile)
        .then(data => {
          setWaveformData(data);
          const detectedBpm = calculateBpmFromBeats(data.beats, data.duration);
          setAnalysis(prev => ({ ...prev, bpm: detectedBpm }));
          setIsAnalyzingAudio(false);
        })
        .catch(err => {
          console.error("Failed to analyze audio waveform:", err);
          setIsAnalyzingAudio(false);
        });
    }
  }, [audioFile]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    drawStudioWaveform(
      ctx,
      width,
      height,
      waveformData,
      currentTime,
      zoom,
      scrollOffset,
      lines,
      activeColor,
      selectedLineId,
      hoveredLineId
    );
  }, [waveformData, currentTime, zoom, scrollOffset, lines, activeColor, selectedLineId, hoveredLineId]);

  // Non-passive Wheel Listener for smooth Trackpad Pinch & Zoom in both directions and horizontal pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Continuous exponential scale based on deltaY:
        // Spreading fingers (zooming in): deltaY < 0 => -deltaY > 0 => factor > 1
        // Pinching fingers (zooming out): deltaY > 0 => -deltaY < 0 => factor < 1
        const zoomFactor = Math.pow(1.002, -e.deltaY);
        setZoom(z => Math.min(30, Math.max(0.2, z * zoomFactor)));
      } else {
        // Pan horizontally with trackpad swipe / scroll
        const panFactor = e.deltaX * 0.05 || e.deltaY * 0.05;
        if (waveformData) {
          const visibleWindow = waveformData.duration / zoom;
          setScrollOffset(prev => Math.min(Math.max(0, waveformData.duration - visibleWindow), Math.max(0, prev + panFactor)));
        }
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [waveformData, zoom]);

  // Studio Specific Keyboard Shortcuts (Undo, Redo, Line Marking, Line Selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside text input / textarea / contenteditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === '[') {
        e.preventDefault();
        if (selectedLineId) {
          handleMarkStart(selectedLineId, currentTime);
        } else if (lines.length > 0) {
          handleMarkStart(lines[0].id, currentTime);
        }
      } else if (e.key === ']') {
        e.preventDefault();
        if (selectedLineId) {
          handleMarkEnd(selectedLineId, currentTime);
        }
      } else if (e.code === 'Enter' || e.key === 'Enter') {
        e.preventDefault();
        if (lines.length === 0) return;
        const currentIdx = lines.findIndex(l => l.id === selectedLineId);
        const targetIdx = currentIdx !== -1 ? currentIdx : 0;
        const targetLine = lines[targetIdx];
        if (targetLine) {
          handleMarkStart(targetLine.id, currentTime);
          if (targetIdx < lines.length - 1) {
            setSelectedLineId(lines[targetIdx + 1].id);
          }
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (lines.length === 0) return;
        const currentIdx = lines.findIndex(l => l.id === selectedLineId);
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : lines.length - 1;
        setSelectedLineId(lines[prevIdx].id);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (lines.length === 0) return;
        const currentIdx = lines.findIndex(l => l.id === selectedLineId);
        const nextIdx = currentIdx !== -1 && currentIdx < lines.length - 1 ? currentIdx + 1 : 0;
        setSelectedLineId(lines[nextIdx].id);
      } else if (e.code === 'ArrowLeft' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleSeek(Math.min(audioDuration || 1000, currentTime + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLineId, lines, currentTime, isPlaying, audioDuration, historyIndex, history, undo, redo]);

  // Auto-scroll selected lyric line into view
  useEffect(() => {
    if (selectedLineId) {
      const el = document.getElementById(`lyric-line-${selectedLineId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedLineId]);

  // Auto-scroll waveform playhead
  useEffect(() => {
    if (waveformData) {
      const visibleWindow = waveformData.duration / zoom;
      if (currentTime > scrollOffset + visibleWindow * 0.8) {
        setScrollOffset(Math.min(waveformData.duration - visibleWindow, currentTime - visibleWindow * 0.2));
      } else if (currentTime < scrollOffset) {
        setScrollOffset(Math.max(0, currentTime - 1));
      }
    }
  }, [currentTime, zoom, scrollOffset, waveformData]);

  // Handle Play/Pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    audioManager.seek(time);
    setCurrentTime(time);
  };

  // Handle Audio File Upload
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudio(file, url, audio.duration, null);
      };
      // Clear transcriptions and synchronized lines for the new song
      updateLinesWithHistory([]);
      setSelectedLineId(null);
      setRawUploadedLyrics('');
      setUploadedLyricsFileName(null);
    }
  };

  // Handle Lyrics File Upload
  const handleLyricsSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setUploadedLyricsFileName(file.name);
        const { rawText, lines: parsedLines } = await parseUploadedLyricFile(file);
        setRawUploadedLyrics(rawText);

        if (parsedLines && parsedLines.length > 0) {
          updateLinesWithHistory(parsedLines);
        }
      } catch (err) {
        console.error("Error reading lyric file:", err);
      }
    }
  };

  // Run AI Transcription or Alignment
  const runAITranscription = async (forcedAlignmentMode = false) => {
    if (!audioFile) {
      alert("Please upload an audio file first.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const provider = new GeminiServerProvider();
    
    // Simulate multi-stage progress
    setProgress({ stage: 'uploading', message: 'Preparing audio payload...', percentage: 10 });
    await new Promise(r => setTimeout(r, 200));

    if (controller.signal.aborted) return;

    setProgress({ stage: 'extracting_audio', message: 'Extracting audio frequencies...', percentage: 25 });
    await new Promise(r => setTimeout(r, 300));

    if (controller.signal.aborted) return;

    try {
      if (forcedAlignmentMode || rawUploadedLyrics.trim()) {
        setProgress({ stage: 'aligning', message: 'Performing AI Forced Alignment against uploaded lyrics...', percentage: 60 });
        const result = await provider.align(audioFile, rawUploadedLyrics || lines.map(l => l.text).join('\n'), { signal: controller.signal });
        
        if (controller.signal.aborted) return;

        setProgress({ stage: 'finalizing', message: 'Structuring timestamp alignment...', percentage: 90 });
        if (result.lines && result.lines.length > 0) {
          updateLinesWithHistory(result.lines);
        }
      } else {
        setProgress({ stage: 'transcribing', message: 'Joelizing...', percentage: 65 });
        const result = await provider.transcribe(audioFile, { signal: controller.signal });
        
        if (controller.signal.aborted) return;

        setProgress({ stage: 'finalizing', message: 'Generating synchronized LRC line model...', percentage: 90 });
        if (result.lines && result.lines.length > 0) {
          updateLinesWithHistory(result.lines);
        }
        if (result.language) {
          setAnalysis(prev => ({ ...prev, language: result.language, bpm: result.bpm || prev.bpm, key: result.key || prev.key }));
        }
      }

      setProgress({ stage: 'complete', message: 'AI Lyric Synchronization Complete!', percentage: 100 });
      setTimeout(() => setProgress(null), 2000);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        console.log("AI Generation Aborted by User");
        return;
      }
      console.error("AI Error:", err);
      setProgress({ stage: 'error', message: 'Processing Error', percentage: 100, error: err.message });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // Run AI Analysis (BPM, Key, Sections)
  const runAIAnalysis = async () => {
    if (!audioFile) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setProgress({ stage: 'transcribing', message: 'Detecting Song Tempo, Musical Key & Structure...', percentage: 50 });
    try {
      const provider = new GeminiServerProvider();
      const res = await provider.detectBpmAndKey(audioFile, controller.signal);
      if (controller.signal.aborted) return;
      setAnalysis(prev => ({ ...prev, bpm: res.bpm, key: res.key }));
      setProgress({ stage: 'complete', message: 'Musical Analysis Complete!', percentage: 100 });
      setTimeout(() => setProgress(null), 1500);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setProgress(null);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // Line Editing Operations
  const handleLineTextChange = (id: string, newText: string) => {
    const updated = lines.map(l => l.id === id ? { ...l, text: newText } : l);
    updateLinesWithHistory(updated);
  };

  const handleMarkStart = (id: string, newTimeSec: number) => {
    const targetIdx = lines.findIndex(l => l.id === id);
    if (targetIdx === -1) return;

    const newStart = Math.max(0, newTimeSec);

    const updated = lines.map((l, idx) => {
      if (idx === targetIdx) {
        const oldDur = (l.endTime && l.endTime > l.startTime) ? (l.endTime - l.startTime) : 3.5;
        const newEnd = Math.max(newStart + 0.3, newStart + oldDur);
        
        let newWords = l.words;
        if (l.words && l.words.length > 0) {
          const delta = newStart - l.startTime;
          newWords = l.words.map(w => ({
            ...w,
            start: Math.max(0, w.start + delta),
            end: Math.max(0, w.end + delta)
          }));
        }

        return {
          ...l,
          startTime: newStart,
          endTime: newEnd,
          words: newWords
        };
      } else if (idx === targetIdx - 1) {
        // Cap preceding line's end time if it overlaps past the new start time
        if (l.endTime > newStart) {
          return {
            ...l,
            endTime: newStart
          };
        }
      }
      return l;
    });

    setSelectedLineId(id);
    updateLinesWithHistory(updated);
  };

  const handleMarkEnd = (id: string, newTimeSec: number) => {
    const targetIdx = lines.findIndex(l => l.id === id);
    if (targetIdx === -1) return;

    const updated = lines.map((l, idx) => {
      if (idx === targetIdx) {
        const newEnd = Math.max(l.startTime + 0.2, newTimeSec);
        return {
          ...l,
          endTime: newEnd
        };
      }
      return l;
    });

    setSelectedLineId(id);
    updateLinesWithHistory(updated);
  };

  const handleLineTimeChange = (id: string, newTimeSec: number) => {
    handleMarkStart(id, newTimeSec);
  };

  const handleAddLine = (afterIndex: number) => {
    const prevLine = lines[afterIndex];
    const newStart = prevLine ? prevLine.startTime + 3.0 : 0;
    const newLine: LyricLineWithWords = {
      id: `line-${Date.now()}`,
      startTime: newStart,
      endTime: newStart + 3.0,
      text: "New Lyric Line"
    };

    const newLines = [...lines];
    newLines.splice(afterIndex + 1, 0, newLine);
    updateLinesWithHistory(newLines);
  };

  const handleDeleteLine = (id: string) => {
    const newLines = lines.filter(l => l.id !== id);
    updateLinesWithHistory(newLines);
  };

  const handleSplitLine = (index: number) => {
    const line = lines[index];
    if (!line) return;
    const parts = line.text.split(' ');
    if (parts.length < 2) return;

    const mid = Math.floor(parts.length / 2);
    const text1 = parts.slice(0, mid).join(' ');
    const text2 = parts.slice(mid).join(' ');

    const midTime = line.startTime + (line.endTime - line.startTime) / 2;

    const line1: LyricLineWithWords = { ...line, text: text1, endTime: midTime };
    const line2: LyricLineWithWords = { id: `split-${Date.now()}`, startTime: midTime, endTime: line.endTime, text: text2 };

    const newLines = [...lines];
    newLines.splice(index, 1, line1, line2);
    updateLinesWithHistory(newLines);
  };

  const handleMergeLine = (index: number) => {
    if (index >= lines.length - 1) return;
    const current = lines[index];
    const next = lines[index + 1];

    const merged: LyricLineWithWords = {
      ...current,
      endTime: next.endTime,
      text: `${current.text} ${next.text}`.trim()
    };

    const newLines = [...lines];
    newLines.splice(index, 2, merged);
    updateLinesWithHistory(newLines);
  };

  const shiftAllTimestamps = (offsetSec: number) => {
    const updated = lines.map(l => ({
      ...l,
      startTime: Math.max(0, l.startTime + offsetSec),
      endTime: Math.max(0, l.endTime + offsetSec)
    }));
    updateLinesWithHistory(updated);
  };

  // Export handlers
  const handleExportFormat = async (fmt: ExportFormat) => {
    const name = projectName || 'joelizer-lyrics';
    if (fmt === 'lrc') {
      downloadFile(generateLRC(lines, name), `${name}.lrc`);
    } else if (fmt === 'enhanced-lrc') {
      downloadFile(generateEnhancedLRC(lines, name), `${name}-enhanced.lrc`);
    } else if (fmt === 'srt') {
      downloadFile(generateSRT(lines), `${name}.srt`);
    } else if (fmt === 'ass') {
      downloadFile(generateASS(lines, name), `${name}.ass`);
    } else if (fmt === 'json') {
      downloadFile(generateJSON(lines, analysis), `${name}.json`, 'application/json');
    } else if (fmt === 'txt') {
      downloadFile(generateTXT(lines), `${name}.txt`);
    } else if (fmt === 'zip') {
      const blob = await generateZIP(lines, name, analysis);
      downloadFile(blob, `${name}-lyrics-pack.zip`, 'application/zip');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#030304] text-slate-200 overflow-hidden relative font-sans">
      {/* TOP AI TOOLBAR */}
      <div className="h-16 sm:h-16 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-20 shrink-0 gap-3 overflow-x-auto no-scrollbar">
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: activeColor }} className="animate-pulse" />
            <span className="font-black tracking-[2px] uppercase text-xs font-mono" style={{ color: activeColor }}>
              JOELIZER STUDIO
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/5 border border-white/10 text-slate-400">
              AI LYRIC ENGINE
            </span>
          </div>
        </div>

        {/* AI Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {progress && progress.stage !== 'complete' && (
            <button
              onClick={cancelAIGeneration}
              className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer animate-pulse"
              title="Cancel ongoing AI task"
            >
              <XCircle size={12} />
              <span>Cancel</span>
            </button>
          )}

          <button
            onClick={() => runAITranscription(false)}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="AI Speech-to-Text Transcription"
          >
            <Sparkles size={12} style={{ color: activeColor }} className="animate-pulse" />
            <span>Generate Transcript</span>
          </button>

          <button
            onClick={() => runAITranscription(true)}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="Forced Lyric Text Alignment"
          >
            <SlidersHorizontal size={12} className="text-amber-400" />
            <span>Align Lyrics</span>
          </button>

          <button
            onClick={runAIAnalysis}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer hidden md:flex"
            title="Detect BPM & Key"
          >
            <Activity size={12} className="text-cyan-400" />
            <span>BPM & Key</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Export Quick Button */}
          <button
            onClick={() => setShowExportMenu(true)}
            className="px-3 py-1.5 text-black font-black text-[10px] uppercase rounded flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
            style={{ backgroundColor: activeColor }}
          >
            <Download size={12} />
            <span>Export Pack</span>
          </button>

          <button
            onClick={() => {
              updateLyricsSettings({ lines });
              setActiveTab('lyrics');
            }}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[10px] uppercase rounded flex items-center gap-1 transition-all cursor-pointer active:scale-95 ml-1"
          >
            <Eye size={12} />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* MOBILE STUDIO SEGMENTED TAB SWITCHER */}
      <div className="md:hidden flex items-center bg-[#070709] border-b border-white/10 shrink-0 p-1 gap-1 z-10">
        <button
          onClick={() => setMobileStudioTab('waveform')}
          className={cn(
            "flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
            mobileStudioTab === 'waveform'
              ? "bg-white/15 text-white font-black shadow-md border border-white/20"
              : "text-slate-400 hover:text-white"
          )}
          style={mobileStudioTab === 'waveform' ? { color: activeColor, borderColor: `${activeColor}50` } : {}}
        >
          <AudioLines size={13} />
          <span>Waveform</span>
        </button>

        <button
          onClick={() => setMobileStudioTab('lyrics')}
          className={cn(
            "flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
            mobileStudioTab === 'lyrics'
              ? "bg-white/15 text-white font-black shadow-md border border-white/20"
              : "text-slate-400 hover:text-white"
          )}
          style={mobileStudioTab === 'lyrics' ? { color: activeColor, borderColor: `${activeColor}50` } : {}}
        >
          <FileText size={13} />
          <span>Lyrics ({lines.length})</span>
        </button>

        <button
          onClick={() => setMobileStudioTab('source')}
          className={cn(
            "flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer",
            mobileStudioTab === 'source'
              ? "bg-white/15 text-white font-black shadow-md border border-white/20"
              : "text-slate-400 hover:text-white"
          )}
          style={mobileStudioTab === 'source' ? { color: activeColor, borderColor: `${activeColor}50` } : {}}
        >
          <Sliders size={13} />
          <span>Source & AI</span>
        </button>
      </div>

      {/* THREE-PANEL STUDIO WORKFLOW */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT PANEL: AUDIO & LYRIC UPLOADS & METADATA */}
        {isSidebarOpen ? (
          <div className={cn("w-full md:w-80 bg-black/40 border-r border-white/10 flex-col p-4 gap-4 overflow-y-auto shrink-0 transition-all duration-300", mobileStudioTab === 'source' ? "flex flex-1 h-full" : "hidden md:flex")}>
            {/* Header inside left panel */}
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders size={14} style={{ color: activeColor }} />
                <span>Audio & Source</span>
              </span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            
            {/* 1. Upload Audio Section */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider">1. Audio Source</span>
              {audioFile && <CheckCircle2 size={14} style={{ color: activeColor }} />}
            </div>

            <button
              type="button"
              onClick={() => setIsAudioModalOpen(true)}
              className="w-full border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.04] rounded-lg p-3.5 flex items-center justify-center gap-3 transition-all cursor-pointer group"
            >
              <div 
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                style={{ color: activeColor }}
              >
                <Music size={16} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-bold text-white block">Load Audio Track</span>
                <span className="text-[9px] text-slate-400 font-mono">Upload local file or paste audio link</span>
              </div>
            </button>

            {audioFile ? (
              <div className="bg-white/5 rounded-lg p-2.5 flex items-center gap-2.5 border border-white/10">
                <Music size={16} style={{ color: activeColor }} />
                <div className="overflow-hidden flex-1">
                  <span className="text-xs font-bold text-white truncate block">{('name' in audioFile) ? (audioFile as File).name : 'Saved Track'}</span>
                  <span className="text-[9px] text-slate-400 font-mono">{Math.round(audioDuration)}s • {(audioFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 text-center italic font-mono">No custom audio loaded</div>
            )}
          </div>

          {/* 2. Upload Lyrics Section (Optional) */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider">2. Raw Lyrics (Optional)</span>
              {rawUploadedLyrics && <CheckCircle2 size={14} style={{ color: activeColor }} />}
            </div>

            <label className="border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.04] rounded-lg p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
              <FileText size={18} className="text-slate-400" />
              <div className="text-center">
                <span className="text-[11px] font-bold text-white block">Upload Lyrics Document</span>
                <span className="text-[9px] text-slate-500 font-mono">TXT, LRC, DOCX</span>
              </div>
              <input type="file" accept=".txt,.lrc,.docx" className="hidden" onChange={handleLyricsSelect} />
            </label>

            {uploadedLyricsFileName && (
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 p-2 rounded flex items-center justify-between">
                <span className="truncate">{uploadedLyricsFileName}</span>
                <button onClick={() => { setRawUploadedLyrics(''); setUploadedLyricsFileName(null); }} className="text-slate-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Quick Textarea Preview & LRC Parser */}
            <textarea
              value={rawUploadedLyrics}
              onChange={(e) => handleRawLyricsChange(e.target.value)}
              placeholder="Paste or write lyrics text (supports LRC format [mm:ss.xx])..."
              className="w-full h-24 bg-black/50 border border-white/10 rounded-lg p-2.5 text-[10px] font-mono text-slate-300 outline-none focus:border-white/20 resize-none"
            />
            {rawUploadedLyrics.trim() && (
              <button
                onClick={handleManualParseLRC}
                className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <ListMusic size={12} style={{ color: activeColor }} />
                <span>Parse & Sync LRC Lines</span>
              </button>
            )}
          </div>

          {/* 3. AI Song Intelligence Summary */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider block">3. AI Song Intelligence</span>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-slate-500 block text-[8px] uppercase">TEMPO</span>
                <span className="font-bold text-white">{analysis.bpm || 120} BPM</span>
              </div>

              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-slate-500 block text-[8px] uppercase">KEY</span>
                <span className="font-bold text-white">{analysis.key || 'C Major'}</span>
              </div>

              <div className="bg-white/5 p-2 rounded border border-white/5 col-span-2">
                <span className="text-slate-500 block text-[8px] uppercase">LANGUAGE</span>
                <span className="font-bold text-white">{analysis.language || 'English'}</span>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-black/80 border-r border-white/10 flex flex-col items-center py-4 px-2 shrink-0 transition-all duration-300">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer shadow-xl flex flex-col items-center gap-1.5 group"
              title="Expand Audio & Source Sidebar"
            >
              <PanelLeftOpen size={18} style={{ color: activeColor }} />
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400 group-hover:text-white [writing-mode:vertical-lr] rotate-180 py-2">Source</span>
            </button>
          </div>
        )}

        {/* CENTER PANEL: WAVEFORM & TIMELINE PREVIEW & CONTROLS */}
        <div className={cn("flex-1 flex-col bg-[#050508] border-r border-white/10 overflow-hidden relative", mobileStudioTab === 'waveform' ? "flex w-full h-full" : "hidden md:flex")}>
          
          {/* Interactive Waveform Canvas Container */}
          <div className="flex-1 relative bg-black/60 flex flex-col justify-center items-center overflow-hidden select-none">
            <canvas 
              ref={canvasRef} 
              width={900} 
              height={300}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const ratio = clickX / rect.width;
                const duration = waveformData?.duration || 1;
                const visibleWindow = duration / zoom;
                const clickTime = scrollOffset + ratio * visibleWindow;

                // Check if click is near any line pin marker handle (only at the top 20% of canvas)
                let hitLineId: string | null = null;
                const isTopArea = (clickY / rect.height) < 0.2;
                
                if (isTopArea) {
                  lines.forEach(l => {
                    const lx = ((l.startTime - scrollOffset) / visibleWindow) * rect.width;
                    if (Math.abs(clickX - lx) <= 14) {
                      hitLineId = l.id;
                    }
                  });
                }

                if (hitLineId) {
                  draggingLineRef.current = hitLineId;
                  isDraggingMarkerRef.current = true;
                  setSelectedLineId(hitLineId);
                } else {
                  handleSeek(clickTime);
                  isDraggingPlayheadRef.current = true;
                }
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const hoverX = e.clientX - rect.left;
                const hoverY = e.clientY - rect.top;
                const ratio = hoverX / rect.width;
                const duration = waveformData?.duration || 1;
                const visibleWindow = duration / zoom;
                const hoverTime = Math.max(0, scrollOffset + ratio * visibleWindow);

                // Find pin hover (only at the top 20% of canvas)
                let hoverId: string | null = null;
                const isTopArea = (hoverY / rect.height) < 0.2;
                
                if (isTopArea) {
                  lines.forEach(l => {
                    const lx = ((l.startTime - scrollOffset) / visibleWindow) * rect.width;
                    if (Math.abs(hoverX - lx) <= 14) {
                      hoverId = l.id;
                    }
                  });
                }
                setHoveredLineId(hoverId);

                // If currently dragging a marker pin
                if (isDraggingMarkerRef.current && draggingLineRef.current) {
                  const targetId = draggingLineRef.current;
                  setLines(prev => prev.map(l => l.id === targetId ? { ...l, startTime: hoverTime } : l));
                } else if (isDraggingPlayheadRef.current) {
                  handleSeek(hoverTime);
                }
              }}
              onMouseUp={() => {
                if (isDraggingMarkerRef.current) {
                  isDraggingMarkerRef.current = false;
                  draggingLineRef.current = null;
                  updateLyricsSettings({ lines });
                }
                if (isDraggingPlayheadRef.current) {
                  isDraggingPlayheadRef.current = false;
                }
              }}
              onMouseLeave={() => {
                if (isDraggingMarkerRef.current) {
                  isDraggingMarkerRef.current = false;
                  draggingLineRef.current = null;
                  updateLyricsSettings({ lines });
                }
                if (isDraggingPlayheadRef.current) {
                  isDraggingPlayheadRef.current = false;
                }
                setHoveredLineId(null);
              }}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.touches[0].clientX - rect.left;
                  const ratio = clickX / rect.width;
                  const duration = waveformData?.duration || 1;
                  const visibleWindow = duration / zoom;
                  const clickTime = scrollOffset + ratio * visibleWindow;
                  
                  // For touch, prioritize seeking / dragging playhead unless very specifically hitting a pin
                  let hitLineId: string | null = null;
                  const clickY = e.touches[0].clientY - rect.top;
                  if ((clickY / rect.height) < 0.3) {
                    lines.forEach(l => {
                      const lx = ((l.startTime - scrollOffset) / visibleWindow) * rect.width;
                      if (Math.abs(clickX - lx) <= 20) {
                        hitLineId = l.id;
                      }
                    });
                  }
                  
                  if (hitLineId) {
                    draggingLineRef.current = hitLineId;
                    isDraggingMarkerRef.current = true;
                    setSelectedLineId(hitLineId);
                  } else {
                    handleSeek(clickTime);
                    isDraggingPlayheadRef.current = true;
                  }
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const hoverX = e.touches[0].clientX - rect.left;
                  const ratio = hoverX / rect.width;
                  const duration = waveformData?.duration || 1;
                  const visibleWindow = duration / zoom;
                  const hoverTime = Math.max(0, scrollOffset + ratio * visibleWindow);

                  if (isDraggingMarkerRef.current && draggingLineRef.current) {
                    const targetId = draggingLineRef.current;
                    setLines(prev => prev.map(l => l.id === targetId ? { ...l, startTime: hoverTime } : l));
                  } else if (isDraggingPlayheadRef.current) {
                    handleSeek(hoverTime);
                  }
                }
              }}
              onTouchEnd={() => {
                if (isDraggingMarkerRef.current) {
                  isDraggingMarkerRef.current = false;
                  draggingLineRef.current = null;
                  updateLyricsSettings({ lines });
                }
                if (isDraggingPlayheadRef.current) {
                  isDraggingPlayheadRef.current = false;
                }
              }}
              className={cn(
                "w-full h-full",
                hoveredLineId || isDraggingMarkerRef.current ? "cursor-ew-resize" : "cursor-pointer"
              )}
              style={{ touchAction: 'none' }}
            />

            {/* Time Overlay */}
            <div className="absolute top-3 left-4 bg-black/80 backdrop-blur border border-white/10 px-3 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-2">
              <span style={{ color: activeColor }}>{formatLRCStamp(currentTime).replace('[', '').replace(']', '')}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{formatLRCStamp(audioDuration).replace('[', '').replace(']', '')}</span>
            </div>

            {/* Current Active Lyric Display */}
            <div className="absolute bottom-6 inset-x-8 text-center bg-black/80 backdrop-blur-md border border-white/15 py-3 px-6 rounded-xl shadow-2xl">
              {(() => {
                const currentLine = getActiveLyricLine(lines, currentTime);
                return currentLine ? (
                  <span className="text-sm sm:text-base font-bold text-white tracking-wide" style={{ textShadow: `0 0 10px ${activeColor}80` }}>
                    {currentLine.text}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 italic font-mono">[ Instrumental / Silence ]</span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: EDITABLE LYRIC LINE TIMELINE & HISTORY */}
        <div className={cn("w-full md:w-[420px] lg:w-[440px] bg-black/60 border-l border-white/10 flex-col shrink-0 overflow-hidden", mobileStudioTab === 'lyrics' ? "flex flex-1 w-full h-full" : "hidden md:flex")}>
          
          {/* Header Bar */}
          <div className="p-3.5 bg-black/80 border-b border-white/10 flex items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 shrink-0">
              Synced Lines ({lines.length})
            </span>

            {/* Actions: Clear All, Undo, Redo, Global Offset */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleClearAllLines}
                disabled={lines.length === 0}
                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 disabled:opacity-30 rounded text-[10px] font-mono font-bold text-rose-300 hover:text-rose-200 cursor-pointer flex items-center gap-1.5 transition-all shrink-0"
                title="Clear all synchronized lines"
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </button>

              <div className="h-4 w-px bg-white/10" />

              <div className="flex items-center gap-1">
                <button 
                  onClick={undo} 
                  disabled={historyIndex <= 0} 
                  className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded text-slate-300 cursor-pointer"
                  title="Undo"
                >
                  <Undo2 size={13} />
                </button>

                <button 
                  onClick={redo} 
                  disabled={historyIndex >= history.length - 1} 
                  className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded text-slate-300 cursor-pointer"
                  title="Redo"
                >
                  <Redo2 size={13} />
                </button>
              </div>

              <div className="h-4 w-px bg-white/10" />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftAllTimestamps(-0.5)}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono font-bold text-slate-300 cursor-pointer hover:text-white transition-colors"
                  title="Shift All Lyrics -0.5s"
                >
                  -0.5s
                </button>

                <button
                  onClick={() => shiftAllTimestamps(0.5)}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono font-bold text-slate-300 cursor-pointer hover:text-white transition-colors"
                  title="Shift All Lyrics +0.5s"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>

          {/* Hotkey Helper Bar */}
          <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/10 text-[9px] font-mono text-slate-400 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-300 shrink-0">
              <Zap size={10} style={{ color: activeColor }} /> Quick Sync Hotkeys:
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span><kbd className="px-1 bg-white/10 rounded text-white">Space</kbd> Play/Pause</span>
              <span><kbd className="px-1 bg-white/10 rounded text-white">P / N</kbd> Prev/Next Track</span>
              <span><kbd className="px-1 bg-white/10 rounded text-white">[ ]</kbd> Start/End</span>
              <span><kbd className="px-1 bg-white/10 rounded text-white">Enter</kbd> Start & Next</span>
              <span><kbd className="px-1 bg-white/10 rounded text-white">↑↓</kbd> Select</span>
              <span><kbd className="px-1 bg-white/10 rounded text-white">Ctrl+Z/Y</kbd> Undo/Redo</span>
            </div>
          </div>

          {/* Editable Line List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {lines.length === 0 ? (
              <div className="text-center text-slate-500 font-mono text-xs py-12">
                No lyric lines generated yet. <br />
                Click <span className="text-emerald-400 font-bold">Generate Transcript</span> above!
              </div>
            ) : (() => {
              const activeLine = getActiveLyricLine(lines, currentTime);
              return lines.map((line, idx) => {
                const isActive = activeLine?.id === line.id;
                const isSelected = selectedLineId === line.id;
                return (
                  <div
                    key={line.id}
                    id={`lyric-line-${line.id}`}
                    onClick={() => setSelectedLineId(line.id)}
                    className={cn(
                      "p-3 rounded-lg border transition-all space-y-2 relative group cursor-pointer",
                      isSelected
                        ? "bg-white/[0.08] border-white/30 shadow-xl"
                        : isActive
                        ? "bg-white/[0.04] border-white/20"
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                    style={isSelected ? { borderColor: activeColor } : (isActive ? { borderColor: `${activeColor}80` } : {})}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Line Badge & Timestamp Input */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                          #{idx + 1}
                        </span>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleSeek(line.startTime); }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                          title="Seek audio to line start"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>

                        <input
                          type="text"
                          value={formatLRCStamp(line.startTime).replace('[', '').replace(']', '')}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const [m, s] = e.target.value.split(':');
                            if (m !== undefined && s !== undefined) {
                              const sec = parseFloat(m) * 60 + parseFloat(s);
                              if (!isNaN(sec)) handleLineTimeChange(line.id, sec);
                            }
                          }}
                          className="w-20 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 font-bold outline-none text-center"
                        />
                      </div>

                      {/* Quick Sync & Nudge Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStart(line.id, currentTime);
                          }}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded text-[9px] font-mono font-bold text-emerald-300 hover:text-white cursor-pointer transition-all active:scale-95"
                          title="Set start time to current playhead position (Shortcut: '[')"
                        >
                          Mark Start [
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkEnd(line.id, currentTime);
                          }}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded text-[9px] font-mono font-bold text-cyan-300 hover:text-white cursor-pointer transition-all active:scale-95"
                          title="Set end time to current playhead position (Shortcut: ']')"
                        >
                          Mark End ]
                        </button>
                      </div>
                    </div>

                    {/* Micro-Nudge Row */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-0.5 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-bold text-[8px]">NUDGE:</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime - 0.5); }}
                          className="px-1 py-0.5 bg-white/5 hover:bg-white/15 rounded text-slate-300 cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime - 0.1); }}
                          className="px-1 py-0.5 bg-white/5 hover:bg-white/15 rounded text-slate-300 cursor-pointer"
                        >
                          -0.1s
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime + 0.1); }}
                          className="px-1 py-0.5 bg-white/5 hover:bg-white/15 rounded text-slate-300 cursor-pointer"
                        >
                          +0.1s
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime + 0.5); }}
                          className="px-1 py-0.5 bg-white/5 hover:bg-white/15 rounded text-slate-300 cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>

                      {/* Line Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSplitLine(idx); }}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Split line into two"
                        >
                          <Split size={12} />
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleMergeLine(idx); }}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Merge with next line"
                        >
                          <Combine size={12} />
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddLine(idx); }}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Add new line below"
                        >
                          <Plus size={12} />
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLine(line.id); }}
                          className="p-1 hover:bg-rose-500/20 rounded text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="Delete line"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Text Input */}
                    <input
                      type="text"
                      value={line.text}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleLineTextChange(line.id, e.target.value)}
                      className="w-full bg-black/30 border border-white/10 focus:border-white/20 rounded px-2.5 py-1.5 text-xs text-white font-medium outline-none"
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM PLAYBACK & CONTROL BAR */}
      <div className="sticky bottom-0 z-30 shrink-0 w-full bg-[#070709] border-t border-white/10 px-3 py-3.5 sm:py-2.5 sm:px-6 shadow-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 min-h-[86px] sm:min-h-0">
        {/* Play/Pause & Seek Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={togglePlay}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-black shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
            style={{ backgroundColor: activeColor }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>

          <button
            onClick={() => handleSeek(0)}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Restart Audio"
          >
            <RotateCcw size={15} />
          </button>

          {/* Time Counter */}
          <div className="text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded shrink-0">
            <span style={{ color: activeColor }}>{formatLRCStamp(currentTime).replace('[', '').replace(']', '')}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatLRCStamp(audioDuration).replace('[', '').replace(']', '')}</span>
          </div>
        </div>

        {/* Mini Progress Video Slider (for mobile & desktop) */}
        <div className="flex-1 min-w-[120px] max-w-md mx-1 sm:mx-4 flex items-center">
          <VideoSlider
            value={currentTime}
            min={0}
            max={audioDuration || 100}
            step={0.01}
            onChange={(t) => handleSeek(t)}
            formatTooltip={formatTime}
            className="w-full"
          />
        </div>

        {/* Speed & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 text-[9px] sm:text-[10px] font-mono">
            <span className="text-slate-500 px-1 font-bold shrink-0 hidden min-[400px]:inline">SPEED</span>
            {[0.5, 1.0, 1.5, 2.0].map(s => (
              <button
                key={s}
                onClick={() => {
                  setPlaybackSpeed(s);
                  audioManager.setPlaybackRate(s);
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded cursor-pointer transition-all shrink-0",
                  playbackSpeed === s ? "bg-white/20 text-white font-bold" : "text-slate-400 hover:text-white"
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 text-[10px] font-mono shrink-0">
            <span className="text-slate-500 px-1 font-bold">ZOOM</span>
            {[1, 2, 4, 8].map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  "px-2 py-0.5 rounded cursor-pointer transition-all",
                  zoom === z ? "bg-white/20 text-white font-bold" : "text-slate-400 hover:text-white"
                )}
              >
                {z}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI PROCESSING PROGRESS MODAL */}
      {progress && (
        <div className="fixed inset-0 z-50 bg-[#020202]/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 transition-all">
          <div className="flex flex-col items-center space-y-6 max-w-sm w-full">
            {/* Minimal Spinner */}
            <div className="relative flex items-center justify-center w-16 h-16">
              <div 
                className="absolute inset-0 rounded-full border border-white/5 animate-[spin_3s_linear_infinite]" 
              />
              <div 
                className="absolute inset-0 rounded-full border-t border-r border-transparent animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]" 
                style={{ borderTopColor: activeColor }}
              />
              <Sparkles size={18} style={{ color: activeColor }} className="animate-pulse" />
            </div>

            <div className="text-center space-y-2 w-full">
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-white">
                JOELIZER AI
              </h3>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide animate-pulse">
                {progress.message}
              </p>
            </div>

            {/* Ultra minimal progress bar */}
            <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_currentColor]"
                style={{ width: `${progress.percentage}%`, backgroundColor: activeColor }}
              />
            </div>
            
            <div className="text-[9px] font-mono font-bold text-slate-500 tracking-widest uppercase">
              {progress.percentage}%
            </div>

            {progress.error && (
              <div className="mt-4 px-4 py-2 bg-rose-950/20 border border-rose-900/50 rounded text-rose-400 text-[10px] font-mono text-center">
                {progress.error}
              </div>
            )}

            {/* Cancel Generation Button */}
            {progress.stage !== 'complete' && (
              <button
                onClick={cancelAIGeneration}
                className="mt-4 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <XCircle size={15} />
                <span>Cancel Generation</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* EXPORT PACK MODAL DIALOG */}
      {showExportMenu && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseExportMenu(); }}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-[#09090d] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-2xl relative overflow-hidden space-y-5">
            {/* Ambient Background Accent */}
            <div 
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[90px] pointer-events-none opacity-20"
              style={{ background: activeColor }}
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Package size={20} style={{ color: activeColor }} />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">EXPORT LYRICS & SYNC PACK</h2>
                  <p className="text-[10px] text-slate-400 font-mono">Copy synced LRC, download individual formats, or grab full pack</p>
                </div>
              </div>
              <button
                onClick={handleCloseExportMenu}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* LRC Copy & Preview Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">LRC Content Preview</span>
                <button
                  onClick={handleCopyLRC}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {copiedLRC ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} style={{ color: activeColor }} />
                      <span>Copy LRC Lyrics</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                value={generateLRC(lines, projectName || 'joelizer-lyrics')}
                className="w-full h-32 bg-black/60 border border-white/10 rounded-lg p-3 text-[10px] font-mono text-emerald-400/90 outline-none resize-none leading-relaxed select-all"
              />
            </div>

            {/* Primary Action: Download All as ZIP Pack */}
            <button
              onClick={() => { handleExportFormat('zip'); setShowExportMenu(false); }}
              className="w-full py-3.5 text-black font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-xl transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
              style={{ backgroundColor: activeColor, boxShadow: `0 0 30px ${activeColor}40` }}
            >
              <Package size={16} />
              <span>Download All as ZIP Pack (.zip)</span>
            </button>

            {/* Individual Export Formats */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Download Individual Format</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => { handleExportFormat('lrc'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-emerald-400 flex items-center justify-between">
                    <span>LRC File</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Standard timed lyrics</div>
                </button>

                <button
                  onClick={() => { handleExportFormat('enhanced-lrc'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-cyan-400 flex items-center justify-between">
                    <span>Enhanced LRC</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Word karaoke timestamps</div>
                </button>

                <button
                  onClick={() => { handleExportFormat('srt'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-amber-400 flex items-center justify-between">
                    <span>SRT Subtitles</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Video subtitle format</div>
                </button>

                <button
                  onClick={() => { handleExportFormat('ass'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-purple-400 flex items-center justify-between">
                    <span>ASS Subtitles</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Styled karaoke subtitles</div>
                </button>

                <button
                  onClick={() => { handleExportFormat('txt'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-slate-200 flex items-center justify-between">
                    <span>TXT Lyrics</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Plain text transcript</div>
                </button>

                <button
                  onClick={() => { handleExportFormat('json'); setShowExportMenu(false); }}
                  className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg text-left transition-all cursor-pointer group"
                >
                  <div className="text-[10px] font-bold uppercase text-white group-hover:text-rose-400 flex items-center justify-between">
                    <span>JSON Data</span>
                    <Download size={11} className="opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-500">Full structured object</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Audio Source Modal (File upload & URL paste) */}
      <AudioSourceModal
        isOpen={isAudioModalOpen}
        onClose={handleCloseAudioModal}
        onLyricsExtracted={(lyrics) => setRawUploadedLyrics(lyrics)}
      />
    </div>
  );
}
