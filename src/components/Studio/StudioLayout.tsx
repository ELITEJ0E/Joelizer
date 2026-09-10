import React, { useState, useEffect, useRef } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { 
  Upload, Music, FileText, Play, Pause, RotateCcw, Download, Sparkles, 
  Trash2, Plus, Split, Combine, Clock, Zap, CheckCircle2, ChevronRight,
  Layers, Volume2, VolumeX, Eye, Radio, RefreshCw, Undo2, Redo2, Sliders, SlidersHorizontal, Activity, AudioLines, ArrowUpRight, ListMusic, XCircle,
  Copy, Check, Package, X, PanelLeftClose, PanelLeftOpen, Link2, Globe,
  SkipBack, SkipForward, Repeat
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
import { SongListPopover } from '../Audio/SongListPopover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function StudioLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const audioUrl = useStore(s => s.audioUrl);
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const currentTrack = tracks[currentTrackIndex] || (tracks.length > 0 ? tracks[0] : null);
  const setAudio = useStore(s => s.setAudio);
  const lyricsLines = useStore(s => s.lyricsSettings.lines);
  const updateLyricsSettings = useStore(s => s.updateLyricsSettings);
  const setActiveTab = useStore(s => s.setActiveTab);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);

  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsLooping = useStore(s => s.setIsLooping);
  const previousTrack = useStore(s => s.previousTrack);
  const nextTrack = useStore(s => s.nextTrack);
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

  // Song AI Intelligence & Language
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Auto');
  const [analysis, setAnalysis] = useState<SongAnalysis>({
    bpm: 120,
    key: 'C Major',
    language: 'Auto',
    sections: []
  });

  // AI Processing State
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [activeExportFormat, setActiveExportFormat] = useState<ExportFormat | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { handleClose: handleCloseExportMenu } = usePopstateModal(showExportMenu, () => setShowExportMenu(false));
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const { handleClose: handleCloseAudioModal } = usePopstateModal(isAudioModalOpen, () => setIsAudioModalOpen(false));
  const [selectedCopyFormat, setSelectedCopyFormat] = useState<'lrc' | 'enhanced-lrc' | 'srt' | 'ass' | 'json' | 'txt'>('lrc');
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileStudioTab, setMobileStudioTab] = useState<'waveform' | 'lyrics' | 'source'>('waveform');

  const getFormatContent = (fmt: 'lrc' | 'enhanced-lrc' | 'srt' | 'ass' | 'json' | 'txt') => {
    const name = projectName || 'joelizer-lyrics';
    switch (fmt) {
      case 'lrc':
        return generateLRC(lines, name);
      case 'enhanced-lrc':
        return generateEnhancedLRC(lines, name);
      case 'srt':
        return generateSRT(lines);
      case 'ass':
        return generateASS(lines, name);
      case 'json':
        return generateJSON(lines, analysis);
      case 'txt':
        return generateTXT(lines);
      default:
        return generateLRC(lines, name);
    }
  };

  const handleCopyCurrentFormat = () => {
    const content = getFormatContent(selectedCopyFormat);
    navigator.clipboard.writeText(content);
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2000);
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

  // Analyze audio when audioFile or audioUrl changes
  useEffect(() => {
    const source = (audioFile && (audioFile.size > 0 || (audioFile as any).byteLength > 0)) ? audioFile : audioUrl;
    if (source) {
      setIsAnalyzingAudio(true);
      analyzeAudioBuffer(source, 800, audioDuration || 180)
        .then(data => {
          setWaveformData(data);
          const detectedBpm = calculateBpmFromBeats(data.beats, data.duration);
          setAnalysis(prev => ({ ...prev, bpm: detectedBpm }));
          setIsAnalyzingAudio(false);
        })
        .catch(err => {
          console.warn("Audio waveform analysis warning:", err);
          setIsAnalyzingAudio(false);
        });
    } else {
      setWaveformData(null);
    }
  }, [audioFile, audioUrl, audioDuration]);

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
      } else if (e.code === 'Enter' || e.key === 'Enter') {
        e.preventDefault();
        if (lines.length === 0) return;
        const currentIdx = lines.findIndex(l => l.id === selectedLineId);
        const targetIdx = currentIdx !== -1 ? currentIdx : 0;
        const targetLine = lines[targetIdx];
        if (targetLine) {
          if (e.shiftKey) {
            handleMarkEnd(targetLine.id, currentTime);
          } else {
            handleMarkStart(targetLine.id, currentTime);
            if (targetIdx < lines.length - 1) {
              setSelectedLineId(lines[targetIdx + 1].id);
            }
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
        const result = await provider.align(audioFile, rawUploadedLyrics || lines.map(l => l.text).join('\n'), { language: selectedLanguage, signal: controller.signal });
        
        if (controller.signal.aborted) return;

        setProgress({ stage: 'finalizing', message: 'Structuring timestamp alignment...', percentage: 90 });
        if (result.lines && result.lines.length > 0) {
          updateLinesWithHistory(result.lines);
        }
        if (result.language) {
          setAnalysis(prev => ({ ...prev, language: result.language, bpm: result.bpm || prev.bpm, key: result.key || prev.key }));
        }
      } else {
        setProgress({ stage: 'transcribing', message: 'Joelizing...', percentage: 65 });
        const result = await provider.transcribe(audioFile, { language: selectedLanguage, signal: controller.signal });
        
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
    <div className="flex flex-col h-full w-full bg-[#0a0c0f] text-[#c4cad4] overflow-hidden relative font-sans">
      {/* WORKSTATION TIMELINE HEADER BAR */}
      <div className="h-10 bg-[#0e1115] border-b border-[#232933] px-3 flex items-center justify-between z-20 shrink-0 gap-2 overflow-x-auto no-scrollbar">
        {/* Left: Audio Analysis Info */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#13171e] border border-[#232933] text-[10px] font-mono text-[#9aa2ae]">
            <Activity size={12} className="text-accent" />
            <span className="font-bold text-[#f0f3f6]">{analysis.bpm || 120} BPM</span>
            <span className="text-[#5e6877]">•</span>
            <span>{analysis.key || 'C Major'}</span>
          </div>
        </div>

        {/* Center: AI Synchronization & Alignment Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Target Language Selector */}
          <div className="flex items-center gap-1 bg-[#13171e] border border-[#232933] hover:border-[#323b49] rounded px-2 py-1 text-[10px] font-mono transition-colors">
            <Globe size={11} className="text-[#7e8999] shrink-0" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-[#f0f3f6] focus:outline-none cursor-pointer font-medium text-[10px]"
              title="Target Lyric Language"
            >
              <option value="Auto" className="bg-[#12161c] text-[#f0f3f6]">Auto Detect</option>
              <option value="English" className="bg-[#12161c] text-[#f0f3f6]">English</option>
              <option value="Korean" className="bg-[#12161c] text-[#f0f3f6]">Korean (한국어)</option>
              <option value="Japanese" className="bg-[#12161c] text-[#f0f3f6]">Japanese (日本語)</option>
              <option value="Chinese" className="bg-[#12161c] text-[#f0f3f6]">Chinese (中文)</option>
              <option value="Spanish" className="bg-[#12161c] text-[#f0f3f6]">Spanish</option>
              <option value="French" className="bg-[#12161c] text-[#f0f3f6]">French</option>
            </select>
          </div>

          {progress && progress.stage !== 'complete' && (
            <button
              type="button"
              onClick={cancelAIGeneration}
              className="px-2 py-1 bg-[#2e171b] hover:bg-[#3f1e24] border border-[#f85149]/40 text-[#ff7b72] rounded text-[10px] font-semibold tracking-wide flex items-center gap-1 transition-colors cursor-pointer"
              title="Cancel ongoing task"
            >
              <XCircle size={11} />
              <span>Cancel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => runAITranscription(true)}
            className="px-2.5 py-1 bg-[#13171e] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] rounded text-[10px] font-semibold text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
            title="Perform AI Forced Alignment against uploaded lyrics"
          >
            <SlidersHorizontal size={11} className="text-accent" />
            <span>Align Lyrics</span>
          </button>

          <button
            type="button"
            onClick={() => runAITranscription(false)}
            className="px-2.5 py-1 bg-[#13171e] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] rounded text-[10px] font-semibold text-[#c4cad4] hover:text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98 hidden sm:flex"
            title="Speech-to-Text Transcription"
          >
            <Sparkles size={11} className="text-[#7e8999]" />
            <span>Transcribe Audio</span>
          </button>

          <button
            type="button"
            onClick={runAIAnalysis}
            className="px-2 py-1 bg-[#13171e] hover:bg-[#1a2028] border border-[#232933] rounded text-[10px] font-semibold text-[#7e8999] hover:text-[#c4cad4] flex items-center gap-1 transition-colors cursor-pointer hidden md:flex"
            title="Detect BPM & Key"
          >
            <Activity size={11} />
            <span>Detect BPM</span>
          </button>
        </div>

        {/* Right: Export & Preview actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowExportMenu(true)}
            className="px-2.5 py-1 bg-[#181d24] hover:bg-[#202731] border border-[#262c37] hover:border-[#384252] text-[#f0f3f6] font-semibold text-[10px] rounded flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
          >
            <Download size={11} className="text-accent" />
            <span>Export LRC</span>
          </button>

          <button
            type="button"
            onClick={() => {
              updateLyricsSettings({ lines });
              setActiveTab('lyrics');
            }}
            className="px-2.5 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent font-semibold text-[10px] rounded flex items-center gap-1 transition-colors cursor-pointer active:scale-98 ml-0.5"
            title="Switch to Lyrics Video Canvas"
          >
            <Eye size={11} />
            <span>Video View</span>
          </button>
        </div>
      </div>

      {/* MOBILE STUDIO SEGMENTED TAB SWITCHER */}
      <div className="md:hidden flex items-center bg-[#0e1115] border-b border-[#232933] shrink-0 p-1 gap-1 z-10">
        <button
          type="button"
          onClick={() => setMobileStudioTab('waveform')}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-mono font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            mobileStudioTab === 'waveform'
              ? "bg-[#181d24] text-accent border border-[#232933]"
              : "text-[#7e8999] hover:text-[#f0f3f6]"
          )}
        >
          <AudioLines size={12} />
          <span>Waveform</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileStudioTab('lyrics')}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-mono font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            mobileStudioTab === 'lyrics'
              ? "bg-[#181d24] text-accent border border-[#232933]"
              : "text-[#7e8999] hover:text-[#f0f3f6]"
          )}
        >
          <FileText size={12} />
          <span>Lyrics ({lines.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileStudioTab('source')}
          className={cn(
            "flex-1 py-1.5 text-[10px] font-mono font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            mobileStudioTab === 'source'
              ? "bg-[#181d24] text-accent border border-[#232933]"
              : "text-[#7e8999] hover:text-[#f0f3f6]"
          )}
        >
          <Sliders size={12} />
          <span>Source & AI</span>
        </button>
      </div>

      {/* THREE-PANEL STUDIO WORKFLOW */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT PANEL: AUDIO & LYRIC UPLOADS & METADATA */}
        {isSidebarOpen ? (
          <div className={cn("w-full md:w-72 lg:w-80 bg-[#111418] border-r border-[#232933] flex-col p-3.5 gap-3.5 overflow-y-auto shrink-0 transition-all duration-200", mobileStudioTab === 'source' ? "flex flex-1 h-full" : "hidden md:flex")}>
            {/* Header inside left panel */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#232933]">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#9aa2ae] flex items-center gap-2">
                <Sliders size={13} className="text-accent" />
                <span>Audio & Source</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#1a2028] rounded transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            
            {/* 1. Upload Audio Section */}
            <div className="bg-[#13171e] border border-[#232933] rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#7e8999] tracking-wider">1. Audio Source</span>
                {audioFile && <CheckCircle2 size={13} className="text-accent" />}
              </div>

              <button
                type="button"
                onClick={() => setIsAudioModalOpen(true)}
                className="w-full border border-dashed border-[#2b3442] hover:border-[#425066] hover:bg-[#181d26] rounded p-3 flex items-center gap-3 transition-colors cursor-pointer group text-left"
              >
                <div 
                  className="w-7 h-7 rounded bg-[#181d26] border border-[#2b3442] flex items-center justify-center shrink-0 text-accent"
                >
                  <Music size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-[#f0f3f6] block">Load Audio Track</span>
                  <span className="text-[9px] text-[#7e8999] font-mono">Upload file or paste audio URL</span>
                </div>
              </button>
            </div>

            {/* 2. Upload Lyrics Section (Optional) */}
            <div className="bg-[#13171e] border border-[#232933] rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#7e8999] tracking-wider">2. Raw Lyrics (Optional)</span>
                {rawUploadedLyrics && <CheckCircle2 size={13} className="text-accent" />}
              </div>

              <label className="border border-dashed border-[#2b3442] hover:border-[#425066] hover:bg-[#181d26] rounded p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
                <FileText size={16} className="text-[#7e8999]" />
                <div className="text-center">
                  <span className="text-[11px] font-semibold text-[#f0f3f6] block">Upload Lyrics Document</span>
                  <span className="text-[9px] text-[#5e6877] font-mono">TXT, LRC, DOCX</span>
                </div>
                <input type="file" accept=".txt,.lrc,.docx" className="hidden" onChange={handleLyricsSelect} />
              </label>

              {uploadedLyricsFileName && (
                <div className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 p-1.5 rounded flex items-center justify-between">
                  <span className="truncate">{uploadedLyricsFileName}</span>
                  <button type="button" onClick={() => { setRawUploadedLyrics(''); setUploadedLyricsFileName(null); }} className="text-[#7e8999] hover:text-[#f0f3f6]">✕</button>
                </div>
              )}

              {/* Quick Textarea Preview & LRC Parser */}
              <textarea
                value={rawUploadedLyrics}
                onChange={(e) => handleRawLyricsChange(e.target.value)}
                placeholder="Paste or write lyrics text (supports LRC format [mm:ss.xx])..."
                className="w-full h-20 bg-[#0e1115] border border-[#232933] focus:border-[#3b4759] rounded p-2 text-[10px] font-mono text-[#c4cad4] outline-none resize-none"
              />
              {rawUploadedLyrics.trim() && (
                <button
                  type="button"
                  onClick={handleManualParseLRC}
                  className="w-full py-1.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-[10px] font-mono font-semibold text-[#f0f3f6] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ListMusic size={12} className="text-accent" />
                  <span>Parse & Sync LRC Lines</span>
                </button>
              )}
            </div>

            {/* 3. AI Song Intelligence Summary */}
            <div className="bg-[#13171e] border border-[#232933] rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#7e8999] tracking-wider block">3. Track Intelligence</span>
                <div className="flex items-center gap-1 text-[9px] font-mono text-[#7e8999]">
                  <Globe size={10} className="text-accent" />
                  <span>{selectedLanguage}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="bg-[#0e1115] p-2 rounded border border-[#232933]">
                  <span className="text-[#5e6877] block text-[8px] uppercase">TEMPO</span>
                  <span className="font-bold text-[#f0f3f6]">{analysis.bpm || 120} BPM</span>
                </div>

                <div className="bg-[#0e1115] p-2 rounded border border-[#232933]">
                  <span className="text-[#5e6877] block text-[8px] uppercase">KEY</span>
                  <span className="font-bold text-[#f0f3f6]">{analysis.key || 'C Major'}</span>
                </div>

                <div className="bg-[#0e1115] p-2 rounded border border-[#232933] col-span-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[#5e6877] block text-[8px] uppercase">TARGET LANGUAGE</span>
                    <span className="font-bold text-[#f0f3f6]">{analysis.language && analysis.language !== 'Auto' ? analysis.language : selectedLanguage}</span>
                  </div>
                  <Select value={selectedLanguage} onValueChange={(val) => setSelectedLanguage(val)}>
                    <SelectTrigger className="h-6 w-28 text-[9px] bg-[#161b22] border-[#2b3442] text-[#f0f3f6]">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12161c] border-[#232933] text-[#f0f3f6]">
                      <SelectItem value="Auto">Auto Detect</SelectItem>
                      <SelectItem value="Korean">Korean (한국어)</SelectItem>
                      <SelectItem value="Chinese">Chinese (中文)</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Japanese">Japanese (日本語)</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0e1115] border-r border-[#232933] flex flex-col items-center py-3 px-1.5 shrink-0 transition-all duration-200">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-[#13171e] hover:bg-[#181d26] border border-[#232933] rounded text-[#7e8999] hover:text-[#f0f3f6] transition-colors cursor-pointer flex flex-col items-center gap-1.5"
              title="Expand Source Sidebar"
            >
              <PanelLeftOpen size={15} className="text-accent" />
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-[#7e8999] [writing-mode:vertical-lr] rotate-180 py-1">Source</span>
            </button>
          </div>
        )}

        {/* CENTER PANEL: WAVEFORM & TIMELINE PREVIEW & CONTROLS */}
        <div className={cn("flex-1 flex-col bg-[#0a0c0f] border-r border-[#232933] overflow-hidden relative", mobileStudioTab === 'waveform' ? "flex w-full h-full" : "hidden md:flex")}>
          
          {/* Interactive Waveform Canvas Container */}
          <div className="flex-1 relative bg-[#0b0d11] flex flex-col justify-center items-center overflow-hidden select-none">
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
            <div className="absolute top-2.5 left-3 bg-[#12161c]/90 border border-[#232933] px-2.5 py-1 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 shadow-sm">
              <span className="text-accent font-bold">{formatLRCStamp(currentTime).replace('[', '').replace(']', '')}</span>
              <span className="text-[#5e6877]">/</span>
              <span className="text-[#7e8999]">{formatLRCStamp(audioDuration).replace('[', '').replace(']', '')}</span>
            </div>

            {/* Current Active Lyric Display (Workstation Editorial Strip) */}
            <div className="absolute bottom-4 inset-x-6 text-center bg-[#12161c]/95 border border-[#232933] py-2 px-4 rounded shadow-md">
              {(() => {
                const currentLine = getActiveLyricLine(lines, currentTime);
                return currentLine ? (
                  <span className="text-sm font-semibold text-[#f0f3f6] tracking-normal">
                    {currentLine.text}
                  </span>
                ) : (
                  <span className="text-xs text-[#5e6877] font-mono">[ Instrumental / Silence ]</span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: EDITABLE LYRIC LINE TIMELINE & HISTORY */}
        <div className={cn("w-full md:w-[320px] lg:w-[360px] bg-[#111418] border-l border-[#232933] flex-col shrink-0 overflow-hidden", mobileStudioTab === 'lyrics' ? "flex flex-1 w-full h-full" : "hidden md:flex")}>
          
          {/* Header Bar */}
          <div className="p-3 bg-[#13171e] border-b border-[#232933] flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#9aa2ae] shrink-0">
              Synced Lines ({lines.length})
            </span>

            {/* Actions: Clear All, Undo, Redo, Global Offset */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearAllLines}
                disabled={lines.length === 0}
                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 disabled:opacity-30 rounded text-[10px] font-mono font-semibold text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1.5 transition-colors shrink-0"
                title="Clear all synchronized lines"
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </button>

              <div className="h-3.5 w-px bg-[#232933]" />

              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={undo} 
                  disabled={historyIndex <= 0} 
                  className="p-1 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] disabled:opacity-30 rounded text-[#9aa2ae] hover:text-[#f0f3f6] cursor-pointer"
                  title="Undo"
                >
                  <Undo2 size={12} />
                </button>

                <button 
                  type="button"
                  onClick={redo} 
                  disabled={historyIndex >= history.length - 1} 
                  className="p-1 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] disabled:opacity-30 rounded text-[#9aa2ae] hover:text-[#f0f3f6] cursor-pointer"
                  title="Redo"
                >
                  <Redo2 size={12} />
                </button>
              </div>

              <div className="h-3.5 w-px bg-[#232933]" />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftAllTimestamps(-0.5)}
                  className="px-1.5 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-[10px] font-mono font-semibold text-[#9aa2ae] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                  title="Shift All Lyrics -0.5s"
                >
                  -0.5s
                </button>

                <button
                  type="button"
                  onClick={() => shiftAllTimestamps(0.5)}
                  className="px-1.5 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-[10px] font-mono font-semibold text-[#9aa2ae] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                  title="Shift All Lyrics +0.5s"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>

          {/* Hotkey Helper Bar */}
          <div className="px-3 py-1.5 bg-[#0e1115] border-b border-[#232933] text-[9px] font-mono text-[#7e8999] flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
            <span className="flex items-center gap-1.5 font-bold text-[#9aa2ae] shrink-0">
              <Zap size={10} className="text-accent" /> Quick Sync:
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span><kbd className="px-1 py-0.5 bg-[#181d26] border border-[#2b3442] rounded text-[#c4cad4]">Space</kbd> Play</span>
              <span><kbd className="px-1 py-0.5 bg-[#181d26] border border-[#2b3442] rounded text-[#c4cad4]">Enter</kbd> Next</span>
              <span><kbd className="px-1 py-0.5 bg-[#181d26] border border-[#2b3442] rounded text-[#c4cad4]">[</kbd> Mark Start</span>
              <span><kbd className="px-1 py-0.5 bg-[#181d26] border border-[#2b3442] rounded text-[#c4cad4]">]</kbd> Mark End</span>
              <span><kbd className="px-1 py-0.5 bg-[#181d26] border border-[#2b3442] rounded text-[#c4cad4]">Ctrl+Z</kbd> Undo</span>
            </div>
          </div>

          {/* Editable Line List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {lines.length === 0 ? (
              <div className="text-center text-[#5e6877] font-mono text-xs py-12">
                No lyric lines generated yet. <br />
                Click <span className="text-accent font-semibold">Generate Transcript</span> above!
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
                      "p-2.5 rounded-md border transition-all space-y-2 relative group cursor-pointer",
                      isSelected
                        ? "bg-[#17202b] border-accent"
                        : isActive
                        ? "bg-[#161d24] border-accent/40"
                        : "bg-[#13171e] border-[#232933] hover:border-[#333d4d]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Line Badge & Timestamp Input */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#181d26] border border-[#2b3442] text-[#9aa2ae]">
                          #{idx + 1}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSeek(line.startTime); }}
                          className="p-1 rounded hover:bg-[#1f2631] text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
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
                          className="w-20 bg-[#0e1115] border border-[#2b3442] focus:border-[#3b4759] rounded px-1.5 py-0.5 text-[10px] font-mono text-accent font-bold outline-none text-center"
                        />
                      </div>

                      {/* Quick Sync & Nudge Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStart(line.id, currentTime);
                          }}
                          className="px-1.5 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-[9px] font-mono font-semibold text-accent hover:text-white cursor-pointer transition-colors"
                          title="Set start time to current playhead position (Shortcut: '[')"
                        >
                          Mark Start [
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkEnd(line.id, currentTime);
                          }}
                          className="px-1.5 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-[9px] font-mono font-semibold text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                          title="Set end time to current playhead position (Shortcut: ']')"
                        >
                          Mark End ]
                        </button>
                      </div>
                    </div>

                    {/* Micro-Nudge Row */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-[#7e8999] pt-1 border-t border-[#232933]">
                      <div className="flex items-center gap-1">
                        <span className="text-[#5e6877] font-semibold text-[8px]">NUDGE:</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime - 0.5); }}
                          className="px-1 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#232933] rounded text-[#9aa2ae] cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime - 0.1); }}
                          className="px-1 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#232933] rounded text-[#9aa2ae] cursor-pointer"
                        >
                          -0.1s
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime + 0.1); }}
                          className="px-1 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#232933] rounded text-[#9aa2ae] cursor-pointer"
                        >
                          +0.1s
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleLineTimeChange(line.id, line.startTime + 0.5); }}
                          className="px-1 py-0.5 bg-[#181d26] hover:bg-[#222935] border border-[#232933] rounded text-[#9aa2ae] cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>

                      {/* Line Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSplitLine(idx); }}
                          className="p-1 hover:bg-[#1f2631] rounded text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                          title="Split line into two"
                        >
                          <Split size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMergeLine(idx); }}
                          className="p-1 hover:bg-[#1f2631] rounded text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                          title="Merge with next line"
                        >
                          <Combine size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAddLine(idx); }}
                          className="p-1 hover:bg-[#1f2631] rounded text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
                          title="Add new line below"
                        >
                          <Plus size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteLine(line.id); }}
                          className="p-1 hover:bg-rose-500/20 rounded text-rose-400 hover:text-rose-300 cursor-pointer transition-colors"
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
                      className="w-full bg-[#0e1115] border border-[#232933] focus:border-[#3b4759] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] font-medium outline-none"
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM PLAYBACK & CONTROL BAR */}
      <div className="sticky bottom-0 z-30 shrink-0 w-full bg-[#0e1115] border-t border-[#232933] px-3 py-2.5 sm:px-4 shadow-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 min-h-[64px] sm:min-h-0">
        {/* Play/Pause, Skip, Loop & Track Playlist Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Song List Dropdown / Popup Trigger */}
          <SongListPopover align="left" />

          <div className="h-5 w-[1px] bg-[#232933] mx-0.5" />

          {/* Previous Track Button */}
          <button
            type="button"
            onClick={previousTrack}
            className="p-1.5 text-[#9aa2ae] hover:text-[#f0f3f6] transition-colors cursor-pointer shrink-0 rounded hover:bg-[#181d26]"
            title="Previous Track"
          >
            <SkipBack size={15} />
          </button>

          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded flex items-center justify-center text-[#0a0c0f] bg-accent hover:bg-accent/80 transition-colors cursor-pointer shrink-0 shadow-sm"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>

          {/* Next Track Button */}
          <button
            type="button"
            onClick={nextTrack}
            className="p-1.5 text-[#9aa2ae] hover:text-[#f0f3f6] transition-colors cursor-pointer shrink-0 rounded hover:bg-[#181d26]"
            title="Next Track"
          >
            <SkipForward size={15} />
          </button>

          {/* Looping / Repeat Button */}
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={cn(
              "p-1.5 rounded transition-colors cursor-pointer shrink-0 relative",
              isLooping
                ? "bg-accent/15 border border-accent/40 text-accent"
                : "text-[#9aa2ae] hover:text-[#f0f3f6] hover:bg-[#181d26] border border-transparent"
            )}
            title={isLooping ? 'Disable Loop' : 'Enable Loop (Repeat Current Song)'}
          >
            <Repeat size={14} />
            {isLooping && (
              <span
                className="absolute -top-1 -right-1 w-3 h-3 text-[#0a0c0f] text-[8px] font-bold rounded-full flex items-center justify-center bg-accent"
              >
                1
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSeek(0)}
            className="p-1.5 text-[#9aa2ae] hover:text-[#f0f3f6] transition-colors cursor-pointer shrink-0 rounded hover:bg-[#181d26] hidden min-[480px]:inline-flex"
            title="Restart Audio to 0:00"
          >
            <RotateCcw size={14} />
          </button>

          {/* Time Counter */}
          <div className="text-[10px] sm:text-[11px] font-mono font-medium flex items-center gap-1.5 bg-[#13171e] border border-[#232933] px-2 py-1 rounded shrink-0">
            <span className="text-accent font-bold">{formatLRCStamp(currentTime).replace('[', '').replace(']', '')}</span>
            <span className="text-[#5e6877]">/</span>
            <span className="text-[#7e8999]">{formatLRCStamp(audioDuration).replace('[', '').replace(']', '')}</span>
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
          <div className="flex items-center gap-0.5 bg-[#13171e] border border-[#232933] rounded p-0.5 text-[9px] sm:text-[10px] font-mono">
            <span className="text-[#5e6877] px-1 font-semibold shrink-0 hidden min-[400px]:inline">SPEED</span>
            {[0.5, 1.0, 1.5, 2.0].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setPlaybackSpeed(s);
                  audioManager.setPlaybackRate(s);
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0",
                  playbackSpeed === s ? "bg-[#1f2631] text-accent font-bold border border-[#2b3442]" : "text-[#7e8999] hover:text-[#f0f3f6]"
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#13171e] border border-[#232933] rounded p-0.5 text-[10px] font-mono shrink-0">
            <span className="text-[#5e6877] px-1 font-semibold">ZOOM</span>
            {[1, 2, 4, 8].map(z => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={cn(
                  "px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                  zoom === z ? "bg-[#1f2631] text-accent font-bold border border-[#2b3442]" : "text-[#7e8999] hover:text-[#f0f3f6]"
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
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-6"
        >
          <div className="bg-[#12161c] border border-[#232933] rounded-lg p-5 sm:p-6 w-full max-w-3xl shadow-2xl relative overflow-hidden space-y-4 h-[84vh] max-h-[720px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#232933] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#181d26] border border-[#2b3442] flex items-center justify-center text-accent">
                  <Package size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#f0f3f6]">Export Lyrics Data</h2>
                  <p className="text-[11px] text-[#7e8999] font-mono">Select format to preview, copy to clipboard, or download</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Download All as ZIP button */}
                <button
                  type="button"
                  onClick={() => { handleExportFormat('zip'); setShowExportMenu(false); }}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] text-[#c4cad4] hover:text-[#f0f3f6] rounded text-xs font-semibold transition-colors cursor-pointer"
                  title="Download all formats in a single ZIP file"
                >
                  <Package size={13} className="text-accent" />
                  <span>Download ZIP Pack</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseExportMenu}
                  className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors rounded cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Format Selection Tabs for Preview & Copy */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7e8999]">
                  Select Format:
                </span>
                <span className="text-[10px] font-mono text-[#5e6877]">Standard LRC format recommended</span>
              </div>

              {/* Format Tabs Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'lrc', label: 'LRC', badge: 'Standard' },
                  { id: 'enhanced-lrc', label: 'Enhanced LRC', badge: 'Word Timings' },
                  { id: 'json', label: 'JSON', badge: 'Full Data' },
                  { id: 'srt', label: 'SRT', badge: 'Subtitles' },
                  { id: 'ass', label: 'ASS', badge: 'Styled Subtitles' },
                  { id: 'txt', label: 'TXT', badge: 'Plain Text' }
                ].map(fmt => {
                  const isSelected = selectedCopyFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedCopyFormat(fmt.id as any)}
                      className={cn(
                        "px-3 py-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 select-none",
                        isSelected
                          ? "bg-[#181d26] border-accent text-accent"
                          : "bg-[#0e1115] hover:bg-[#181d26] border-[#232933] text-[#9aa2ae] hover:text-[#f0f3f6]"
                      )}
                    >
                      <span>{fmt.label}</span>
                      <span className="text-[9px] opacity-60 font-mono">({fmt.badge})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Preview & Copy Toolbar */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#c4cad4]">
                    {selectedCopyFormat.toUpperCase()} Preview
                  </span>
                  <span className="text-[10px] text-[#5e6877] font-mono">
                    ({lines.length} lines)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Download this specific format */}
                  <button
                    type="button"
                    onClick={() => handleExportFormat(selectedCopyFormat)}
                    className="px-2.5 py-1.5 bg-[#181d26] hover:bg-[#222935] border border-[#2b3442] rounded text-xs font-semibold text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={`Download .${selectedCopyFormat === 'enhanced-lrc' ? 'lrc' : selectedCopyFormat} file`}
                  >
                    <Download size={13} className="text-accent" />
                    <span>Download .{selectedCopyFormat === 'enhanced-lrc' ? 'lrc' : selectedCopyFormat}</span>
                  </button>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopyCurrentFormat}
                    className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-[#0a0c0f] rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedFormat ? (
                      <>
                        <Check size={13} strokeWidth={2.5} />
                        <span>Copied {selectedCopyFormat.toUpperCase()}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} strokeWidth={2.5} />
                        <span>Copy {selectedCopyFormat.toUpperCase()}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Large Scrollable Textarea Preview */}
              <div className="flex-1 min-h-0 relative rounded border border-[#232933] bg-[#0b0d11] overflow-hidden">
                <textarea
                  readOnly
                  value={getFormatContent(selectedCopyFormat)}
                  className="w-full h-full p-3 text-xs font-mono text-accent outline-none resize-none leading-relaxed select-all no-scrollbar"
                />
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
        onAutoTranscribe={() => runAITranscription()}
      />
    </div>
  );
}
