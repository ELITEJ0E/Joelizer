import React, { useState, useEffect, useRef } from 'react';
import { useStore, LyricLine } from '../../store/useStore';
import { 
  Upload, Music, FileText, Play, Pause, RotateCcw, Download, Sparkles, 
  Trash2, Plus, Split, Combine, Clock, Zap, CheckCircle2, ChevronRight,
  Layers, Volume2, VolumeX, Eye, Radio, RefreshCw, Undo2, Redo2, Sliders, ArrowUpRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { analyzeAudioBuffer, drawStudioWaveform, WaveformData, calculateBpmFromBeats } from '../../lib/audioAnalysis';
import { GeminiServerProvider, parseUploadedLyricFile } from '../../lib/transcriptionProvider';
import { LyricLineWithWords, ProcessingProgress, ExportFormat, SongAnalysis } from '../../types/studio';
import { generateLRC, generateEnhancedLRC, generateSRT, generateASS, generateJSON, generateTXT, generateZIP, downloadFile, formatLRCStamp } from '../../lib/lyricExporters';

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

  // Local Studio State
  const [lines, setLines] = useState<LyricLineWithWords[]>([]);
  const [history, setHistory] = useState<LyricLineWithWords[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [rawUploadedLyrics, setRawUploadedLyrics] = useState<string>('');
  const [uploadedLyricsFileName, setUploadedLyricsFileName] = useState<string | null>(null);

  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Waveform Zoom & Drag
  const [zoom, setZoom] = useState<number>(1.0);
  const [scrollOffset, setScrollOffset] = useState<number>(0);

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    const lyricTimes = lines.map(l => l.startTime);

    drawStudioWaveform(
      ctx,
      width,
      height,
      waveformData,
      currentTime,
      zoom,
      scrollOffset,
      lyricTimes,
      activeColor
    );
  }, [waveformData, currentTime, zoom, scrollOffset, lines, activeColor]);

  // Audio Playback Listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Auto-scroll waveform playhead
      if (waveformData) {
        const visibleWindow = waveformData.duration / zoom;
        if (audio.currentTime > scrollOffset + visibleWindow * 0.8) {
          setScrollOffset(Math.min(waveformData.duration - visibleWindow, audio.currentTime - visibleWindow * 0.2));
        } else if (audio.currentTime < scrollOffset) {
          setScrollOffset(Math.max(0, audio.currentTime - 1));
        }
      }
    };

    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [zoom, scrollOffset, waveformData]);

  // Handle Play/Pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
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

    const provider = new GeminiServerProvider();
    
    // Simulate multi-stage progress
    setProgress({ stage: 'uploading', message: 'Preparing audio payload...', percentage: 10 });
    await new Promise(r => setTimeout(r, 200));

    setProgress({ stage: 'extracting_audio', message: 'Extracting audio frequencies...', percentage: 25 });
    await new Promise(r => setTimeout(r, 300));

    try {
      if (forcedAlignmentMode || rawUploadedLyrics.trim()) {
        setProgress({ stage: 'aligning', message: 'Performing AI Forced Alignment against uploaded lyrics...', percentage: 60 });
        const result = await provider.align(audioFile, rawUploadedLyrics || lines.map(l => l.text).join('\n'));
        
        setProgress({ stage: 'finalizing', message: 'Structuring timestamp alignment...', percentage: 90 });
        if (result.lines && result.lines.length > 0) {
          updateLinesWithHistory(result.lines);
        }
      } else {
        setProgress({ stage: 'transcribing', message: 'Transcribing singing & speech timestamps with Gemini 2.5...', percentage: 65 });
        const result = await provider.transcribe(audioFile);
        
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
      console.error("AI Error:", err);
      setProgress({ stage: 'error', message: 'Processing Error', percentage: 100, error: err.message });
    }
  };

  // Run AI Analysis (BPM, Key, Sections)
  const runAIAnalysis = async () => {
    if (!audioFile) return;
    setProgress({ stage: 'transcribing', message: 'Detecting Song Tempo, Musical Key & Structure...', percentage: 50 });
    try {
      const provider = new GeminiServerProvider();
      const res = await provider.detectBpmAndKey(audioFile);
      setAnalysis(prev => ({ ...prev, bpm: res.bpm, key: res.key }));
      setProgress({ stage: 'complete', message: 'Musical Analysis Complete!', percentage: 100 });
      setTimeout(() => setProgress(null), 1500);
    } catch (err) {
      setProgress(null);
    }
  };

  // Line Editing Operations
  const handleLineTextChange = (id: string, newText: string) => {
    const updated = lines.map(l => l.id === id ? { ...l, text: newText } : l);
    updateLinesWithHistory(updated);
  };

  const handleLineTimeChange = (id: string, newTimeSec: number) => {
    const updated = lines.map(l => l.id === id ? { ...l, startTime: Math.max(0, newTimeSec) } : l);
    updateLinesWithHistory(updated);
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
      {/* Hidden HTML Audio Element for Playback */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="auto" 
        />
      )}

      {/* TOP AI TOOLBAR */}
      <div className="h-14 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between z-20 shrink-0 gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 shrink-0">
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
          <button
            onClick={() => runAITranscription(false)}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="AI Speech-to-Text Transcription"
          >
            <Zap size={12} style={{ color: activeColor }} />
            <span>Generate Transcript</span>
          </button>

          <button
            onClick={() => runAITranscription(true)}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            title="Forced Lyric Text Alignment"
          >
            <Radio size={12} className="text-yellow-400" />
            <span>Align Lyrics</span>
          </button>

          <button
            onClick={runAIAnalysis}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer hidden md:flex"
            title="Detect BPM & Key"
          >
            <Clock size={12} className="text-cyan-400" />
            <span>BPM & Key</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Export Quick Buttons */}
          <button
            onClick={() => handleExportFormat('lrc')}
            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono font-bold uppercase hover:text-white transition-all cursor-pointer"
          >
            LRC
          </button>

          <button
            onClick={() => handleExportFormat('enhanced-lrc')}
            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono font-bold uppercase hover:text-white transition-all cursor-pointer hidden sm:block"
          >
            Karaoke
          </button>

          <button
            onClick={() => handleExportFormat('srt')}
            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono font-bold uppercase hover:text-white transition-all cursor-pointer"
          >
            SRT
          </button>

          <button
            onClick={() => handleExportFormat('ass')}
            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono font-bold uppercase hover:text-white transition-all cursor-pointer hidden sm:block"
          >
            ASS
          </button>

          <button
            onClick={() => handleExportFormat('zip')}
            className="px-3 py-1.5 text-black font-black text-[10px] uppercase rounded flex items-center gap-1 transition-all cursor-pointer shadow-lg active:scale-95"
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
            <span>Preview Visualizer</span>
          </button>
        </div>
      </div>

      {/* THREE-PANEL STUDIO WORKFLOW */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT PANEL: AUDIO & LYRIC UPLOADS & METADATA */}
        <div className="w-full md:w-80 bg-black/40 border-r border-white/10 flex flex-col p-4 gap-4 overflow-y-auto shrink-0">
          
          {/* 1. Upload Audio Section */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase text-slate-400 tracking-wider">1. Audio Source</span>
              {audioFile && <CheckCircle2 size={14} style={{ color: activeColor }} />}
            </div>

            <label className="border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.04] rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
              <Upload size={20} className="text-slate-400" />
              <div className="text-center">
                <span className="text-xs font-bold text-white block">Upload Audio</span>
                <span className="text-[9px] text-slate-500 font-mono">MP3, WAV, FLAC, M4A</span>
              </div>
              <input type="file" accept="audio/*" className="hidden" onChange={handleAudioSelect} />
            </label>

            {audioFile ? (
              <div className="bg-white/5 rounded-lg p-2.5 flex items-center gap-2.5 border border-white/10">
                <Music size={16} style={{ color: activeColor }} />
                <div className="overflow-hidden flex-1">
                  <span className="text-xs font-bold text-white truncate block">{audioFile.name}</span>
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

            {/* Quick Textarea Preview */}
            <textarea
              value={rawUploadedLyrics}
              onChange={(e) => setRawUploadedLyrics(e.target.value)}
              placeholder="Paste or write lyrics text here to align..."
              className="w-full h-24 bg-black/50 border border-white/10 rounded-lg p-2.5 text-[10px] font-mono text-slate-300 outline-none focus:border-white/20 resize-none"
            />
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

        {/* CENTER PANEL: WAVEFORM & TIMELINE PREVIEW & CONTROLS */}
        <div className="flex-1 flex flex-col bg-[#050508] border-r border-white/10 overflow-hidden relative">
          
          {/* Interactive Waveform Canvas Container */}
          <div className="flex-1 relative bg-black/60 flex flex-col justify-center items-center overflow-hidden">
            <canvas 
              ref={canvasRef} 
              width={900} 
              height={300}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = clickX / rect.width;
                if (waveformData) {
                  const visibleWindow = waveformData.duration / zoom;
                  const seekTime = scrollOffset + ratio * visibleWindow;
                  handleSeek(seekTime);
                }
              }}
              className="w-full h-full cursor-pointer"
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
                const currentLine = lines.find(l => currentTime >= l.startTime && currentTime <= l.endTime);
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

          {/* PLAYBACK & WAVEFORM CONTROL BAR */}
          <div className="h-16 bg-black/90 border-t border-white/10 px-4 flex items-center justify-between gap-4 shrink-0">
            {/* Play/Pause Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center text-black shadow-lg transition-transform active:scale-95 cursor-pointer"
                style={{ backgroundColor: activeColor }}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                onClick={() => handleSeek(0)}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Restart Audio"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1 text-[10px] font-mono">
              <span className="text-slate-500 px-1 font-bold">SPEED</span>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setPlaybackSpeed(s);
                    if (audioRef.current) audioRef.current.playbackRate = s;
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded cursor-pointer transition-all",
                    playbackSpeed === s ? "bg-white/20 text-white font-bold" : "text-slate-400 hover:text-white"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1 text-[10px] font-mono">
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

        {/* RIGHT PANEL: EDITABLE LYRIC LINE TIMELINE & HISTORY */}
        <div className="w-full md:w-96 bg-black/60 border-l border-white/10 flex flex-col shrink-0 overflow-hidden">
          
          {/* Header Bar */}
          <div className="p-3.5 bg-black/80 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
              Synchronized Lines ({lines.length})
            </span>

            {/* History & Global Offset */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={undo} 
                disabled={historyIndex <= 0} 
                className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded text-slate-300 cursor-pointer"
                title="Undo"
              >
                <Undo2 size={14} />
              </button>

              <button 
                onClick={redo} 
                disabled={historyIndex >= history.length - 1} 
                className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded text-slate-300 cursor-pointer"
                title="Redo"
              >
                <Redo2 size={14} />
              </button>

              <div className="h-4 w-px bg-white/10 mx-1" />

              <button
                onClick={() => shiftAllTimestamps(-0.5)}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] font-mono font-bold text-slate-300 cursor-pointer"
                title="Shift All Lyrics -0.5s"
              >
                -0.5s
              </button>

              <button
                onClick={() => shiftAllTimestamps(0.5)}
                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] font-mono font-bold text-slate-300 cursor-pointer"
                title="Shift All Lyrics +0.5s"
              >
                +0.5s
              </button>
            </div>
          </div>

          {/* Editable Line List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {lines.length === 0 ? (
              <div className="text-center text-slate-500 font-mono text-xs py-12">
                No lyric lines generated yet. <br />
                Click <span className="text-emerald-400 font-bold">Generate Transcript</span> above!
              </div>
            ) : (
              lines.map((line, idx) => {
                const isActive = currentTime >= line.startTime && currentTime <= line.endTime;
                return (
                  <div
                    key={line.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all space-y-2 relative group",
                      isActive
                        ? "bg-white/[0.06] border-white/20 shadow-lg"
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    )}
                    style={isActive ? { borderColor: `${activeColor}60` } : {}}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Timestamp Input */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSeek(line.startTime)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                          title="Seek audio to line start"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>

                        <input
                          type="text"
                          value={formatLRCStamp(line.startTime).replace('[', '').replace(']', '')}
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

                      {/* Line Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleSplitLine(idx)}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Split line into two"
                        >
                          <Split size={12} />
                        </button>

                        <button
                          onClick={() => handleMergeLine(idx)}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Merge with next line"
                        >
                          <Combine size={12} />
                        </button>

                        <button
                          onClick={() => handleAddLine(idx)}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                          title="Add new line below"
                        >
                          <Plus size={12} />
                        </button>

                        <button
                          onClick={() => handleDeleteLine(line.id)}
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
                      onChange={(e) => handleLineTextChange(line.id, e.target.value)}
                      className="w-full bg-black/30 border border-white/10 focus:border-white/20 rounded px-2.5 py-1.5 text-xs text-white font-medium outline-none"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* AI PROCESSING PROGRESS MODAL */}
      {progress && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#09090d] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <Sparkles size={20} style={{ color: activeColor }} className="animate-spin" />
              <div>
                <h3 className="text-xs font-mono font-black uppercase tracking-widest text-white">
                  JOELIZER AI PROCESSING
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{progress.message}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative">
                <div 
                  className="h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percentage}%`, backgroundColor: activeColor }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-400 font-bold">
                <span>{progress.stage.toUpperCase()}</span>
                <span>{progress.percentage}%</span>
              </div>
            </div>

            {progress.error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-300 text-xs font-mono">
                {progress.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
