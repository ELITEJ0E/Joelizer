import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { 
  X, Loader2, Download, Zap, CheckCircle2, Film, Music2, 
  Monitor, AlertCircle, FileText, Copy, Check, Package, Upload, Play, Disc
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate, stagger } from 'animejs';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { ExportRangeSlider } from './ExportRangeSlider';
import { buildCanonicalProjectJson } from '../../lib/projectJsonBuilder';
import { getBestAvailableRenderer } from '../../lib/renderers/renderManager';
import { AspectRatioType, ExportResolutionType, ExportModeType } from '../../types/projectJson';
import { 
  generateLRC, generateEnhancedLRC, generateSRT, generateASS, 
  generateJSON, generateTXT, generateZIP, downloadFile 
} from '../../lib/lyricExporters';
import { dawAudioEngine } from '../../lib/dawAudioEngine';
import { useDAWStore } from '../../store/useDAWStore';

type ExportTabType = 'video' | 'lyrics' | 'audio';
type LyricFormatType = 'lrc' | 'enhanced-lrc' | 'srt' | 'ass' | 'json' | 'txt';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { handleClose } = usePopstateModal(true, onClose);
  
  // Navigation Tabs: Video vs Lyrics vs Audio
  const [activeExportTab, setActiveExportTab] = useState<ExportTabType>('video');

  // Video Export Engine: Server Remotion vs Fast Browser Engine
  const [engineChoice, setEngineChoice] = useState<'server' | 'browser'>('server');

  // Video Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'ready' | 'error'>('preparing');
  const [stageMessage, setStageMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeRendererName, setActiveRendererName] = useState<string>('');

  // Video Settings
  const [resolution, setResolution] = useState<ExportResolutionType>('1080p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [aspectRatio, setAspectRatioState] = useState<AspectRatioType>('16:9');
  const [exportMode, setExportMode] = useState<ExportModeType>('lyrics-video');
  const [allowSilentExport, setAllowSilentExport] = useState(false);

  // Lyrics Export State
  const [selectedLyricFormat, setSelectedLyricFormat] = useState<LyricFormatType>('lrc');
  const [hasCopiedLyrics, setHasCopiedLyrics] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Audio Master Export State
  const [isAudioBouncing, setIsAudioBouncing] = useState(false);
  const [audioBounceNotice, setAudioBounceNotice] = useState<string | null>(null);

  // Render Engine Health Test State
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Global store values
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const currentTrack = tracks[currentTrackIndex];

  const audioFile = useStore(s => s.audioFile);
  const audioUrl = useStore(s => s.audioUrl) || currentTrack?.url || null;
  const audioDuration = useStore(s => s.audioDuration) || currentTrack?.duration || 0;
  const projectName = useStore(s => s.name) || currentTrack?.name || 'Joelizer Video';
  const setName = useStore(s => s.setName);
  const setAudio = useStore(s => s.setAudio);
  const setAspectRatioStore = useStore(s => s.setAspectRatio);
  const activeColor = useStore(s => s.visualizerSettings?.color) || '#00e676';
  const activeTab = useStore(s => s.activeTab);
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];
  const songAnalysis = useMVStore(s => s.songAnalysis) || { bpm: 120, key: 'C Major', energy: 0.8, mood: 'Dynamic' };

  const mvTimelineClips = useMVStore(s => s.timelineClips);
  const lyricsVideoMode = useLyricsVideoStore(s => s.videoMode);
  const setLyricsVideoMode = useLyricsVideoStore(s => s.setVideoMode);

  const maxMVClipEnd = mvTimelineClips.reduce((max, clip) => Math.max(max, clip.endTime), 0);
  const maxLyricEnd = lyricsLines.reduce((max, line) => Math.max(max, line.endTime || 0), 0);
  const effectiveAudioDuration = audioDuration || maxMVClipEnd || maxLyricEnd || 15;
  const hasAudio = !!audioFile || !!audioUrl || mvTimelineClips.length > 0 || allowSilentExport;

  const exportRangeStart = useStore(s => s.exportRangeStart) || 0;
  const rawExportRangeEnd = useStore(s => s.exportRangeEnd);
  const exportRangeEnd = (rawExportRangeEnd !== null && rawExportRangeEnd > exportRangeStart) 
    ? rawExportRangeEnd 
    : effectiveAudioDuration;
  const setExportRange = useStore(s => s.setExportRange);

  useEffect(() => {
    // Intelligently default tabs based on active studio context
    if (activeTab === 'lyrics') {
      setExportMode('lyrics-video');
      setActiveExportTab('video');
    } else if (activeTab === 'mv-studio') {
      setExportMode('music-video');
      setActiveExportTab('video');
    } else if (activeTab === 'lrc' && lyricsLines.length > 0 && !audioUrl && !audioFile) {
      setActiveExportTab('lyrics');
    }

    animate('.export-modal-card', {
      scale: [0.94, 1],
      opacity: [0, 1],
      duration: 350,
      easing: 'easeOutBack'
    });
    
    animate('.export-modal-item-anim', {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(30, { start: 60 }),
      duration: 400,
      easing: 'easeOutQuart'
    });

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleAspectRatioChange = (ar: AspectRatioType) => {
    setAspectRatioState(ar);
    setAspectRatioStore(ar);
  };

  const handleModeChange = (mode: ExportModeType) => {
    setExportMode(mode);
    setLyricsVideoMode(mode);
  };

  // Run 10-second automated render test
  const handleRunRenderTest = async () => {
    setIsTestRunning(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/render-test');
      const contentType = res.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data) {
          setTestResult(data);
          return;
        }
      }

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Render engine test succeeded.'
        });
      } else {
        const rawText = await res.text().catch(() => '');
        setTestResult({
          success: false,
          message: rawText.slice(0, 120) || `Render test returned status ${res.status}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to execute render test endpoint'
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const handleCancelExport = () => {
    isCancelledRef.current = true;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExporting(false);
    setExportStage('preparing');
    setProgress(0);
    setDownloadUrl(null);
    setExportError(null);
  };

  // Load user audio file
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setAudio(file, url, audio.duration, undefined, { name: file.name.replace(/\.[^/.]+$/, "") });
      setAllowSilentExport(false);
    };
  };

  // Load sample demo track
  const handleLoadDemoTrack = () => {
    const demoUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
    const demoTrackName = 'Lofi Evening Chill';
    setAudio(null, demoUrl, 140, 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop', {
      name: demoTrackName,
      artist: 'Joelizer Studio'
    });
    setAllowSilentExport(false);
  };

  // Unified Production Export (Server Remotion or Fast Browser MediaRecorder)
  const handleStartExport = async (forcedEngine?: 'server' | 'browser') => {
    const targetEngine = forcedEngine || engineChoice;

    try {
      isCancelledRef.current = false;
      setIsExporting(true);
      setExportStage('preparing');
      setStageMessage('Preparing project timeline, styles, and assets...');
      setProgress(5);
      setExportError(null);
      setDownloadUrl(null);

      // 1. Build canonical JSON with staging
      const projectJson = await buildCanonicalProjectJson({
        resolution,
        fps,
        modeOverride: exportMode
      });

      // 2. Select renderer
      setStageMessage(`Connecting to ${targetEngine === 'browser' ? 'Fast Browser Video Engine' : 'Production Remotion Engine'}...`);
      setProgress(12);

      const renderer = await getBestAvailableRenderer(targetEngine);
      setActiveRendererName(renderer.name);

      const result = await renderer.render(projectJson, (prog) => {
        if (isCancelledRef.current) return;
        setExportStage(prog.stage as any);
        setStageMessage(prog.stageMessage);
        setProgress(prog.progress);
        if (prog.error) setExportError(prog.error);
      });

      if (result.outputUrl) {
        setDownloadUrl(result.outputUrl);
        setFileSize(result.fileSize || null);
        setExportStage('ready');
        setProgress(100);
      }
    } catch (err: any) {
      console.error('Unified export error:', err);
      setExportStage('error');
      setExportError(err.message || 'Failed to export video');
    }
  };

  // Lyrics content preview generator
  const getLyricsPreviewContent = (fmt: LyricFormatType): string => {
    const name = projectName || 'Joelizer-Lyrics';
    const lines = lyricsLines as any;
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
        return generateJSON(lines, songAnalysis);
      case 'txt':
        return generateTXT(lines);
      default:
        return generateLRC(lines, name);
    }
  };

  // Download specific lyrics format
  const handleDownloadLyrics = (fmt: LyricFormatType) => {
    const name = (projectName || 'Joelizer-Lyrics').replace(/[^a-zA-Z0-9_-]/g, '_');
    const content = getLyricsPreviewContent(fmt);
    const ext = fmt === 'enhanced-lrc' ? 'lrc' : fmt;
    const mime = fmt === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    downloadFile(content, `${name}.${ext}`, mime);
  };

  // Copy lyrics format to clipboard
  const handleCopyLyrics = async (fmt: LyricFormatType) => {
    try {
      const content = getLyricsPreviewContent(fmt);
      await navigator.clipboard.writeText(content);
      setHasCopiedLyrics(true);
      setTimeout(() => setHasCopiedLyrics(false), 2000);
    } catch (e) {
      console.warn('Clipboard copy notice:', e);
    }
  };

  // Download complete lyrics ZIP pack
  const handleDownloadZipPack = async () => {
    try {
      setIsZipping(true);
      const name = (projectName || 'Joelizer-Lyrics').replace(/[^a-zA-Z0-9_-]/g, '_');
      const blob = await generateZIP(lyricsLines as any, name, songAnalysis);
      downloadFile(blob, `${name}-lyrics-pack.zip`, 'application/zip');
    } catch (err) {
      console.error('Failed to generate ZIP pack:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Bounce Multitrack WAV in DAW
  const handleBounceWavMaster = async () => {
    try {
      setIsAudioBouncing(true);
      setAudioBounceNotice('Rendering pristine multitrack mixdown to WAV...');
      const dawTracks = useDAWStore.getState().tracks;
      const wavBlob = await dawAudioEngine.bounceProjectToWav(dawTracks, effectiveAudioDuration);
      const cleanName = (projectName || 'Joelizer_Master').replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadFile(wavBlob, `${cleanName}_Master.wav`, 'audio/wav');
      setAudioBounceNotice('Master WAV downloaded successfully!');
      setTimeout(() => setAudioBounceNotice(null), 3000);
    } catch (err: any) {
      setAudioBounceNotice(`Render notice: ${err.message || 'WAV rendering failed'}`);
      setTimeout(() => setAudioBounceNotice(null), 4000);
    } finally {
      setIsAudioBouncing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return createPortal(
    <div 
      onClick={(e) => { 
        if (e.target === e.currentTarget) { 
          if (isExporting) handleCancelExport(); 
          else handleClose(); 
        } 
      }}
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="export-modal-card bg-[#0d0f12] border border-white/15 rounded-2xl p-4 sm:p-6 w-full max-w-xl shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] my-auto">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Glow accent */}
        <div 
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
          style={{ background: activeColor }}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0 mb-3">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center border border-white/10"
              style={{ backgroundColor: `${activeColor}15` }}
            >
              <Download size={14} style={{ color: activeColor }} />
            </div>
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest font-black" style={{ color: activeColor }}>
                Production Export Studio
              </h2>
              <span className="text-[9px] text-slate-400 font-mono block">Video MP4 • Sync Lyrics • Master Audio</span>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={isExporting ? handleCancelExport : handleClose} 
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Multi-Format Export Tab Switcher */}
        {!isExporting && (
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-xl mb-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveExportTab('video')}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeExportTab === 'video'
                  ? "bg-white/15 text-white shadow-sm border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Film size={13} style={activeExportTab === 'video' ? { color: activeColor } : {}} />
              <span>Video (MP4)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveExportTab('lyrics')}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeExportTab === 'lyrics'
                  ? "bg-white/15 text-white shadow-sm border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <FileText size={13} style={activeExportTab === 'lyrics' ? { color: activeColor } : {}} />
              <span>Lyrics Data</span>
              {lyricsLines.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                  {lyricsLines.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveExportTab('audio')}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeExportTab === 'audio'
                  ? "bg-white/15 text-white shadow-sm border border-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Music2 size={13} style={activeExportTab === 'audio' ? { color: activeColor } : {}} />
              <span>Audio Master</span>
            </button>
          </div>
        )}

        {/* -------------------- TAB 1: VIDEO PRODUCTION EXPORT -------------------- */}
        {activeExportTab === 'video' && (
          <>
            {isExporting ? (
              <div className="space-y-4 py-4 my-auto">
                {exportStage === 'ready' && downloadUrl ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-3 py-2 animate-in fade-in zoom-in-95">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 animate-bounce">
                      <CheckCircle2 size={26} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Video Export Complete!</h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {resolution} @ {fps}fps {fileSize ? `• ${formatFileSize(fileSize)}` : ''} • Engine: {activeRendererName || 'Remotion'}
                      </p>
                    </div>

                    {downloadUrl && (
                      <div className="w-full rounded-xl overflow-hidden border border-emerald-500/30 bg-black/80 shadow-2xl my-1">
                        <video 
                          src={downloadUrl.startsWith('blob:') ? downloadUrl : `${downloadUrl}?stream=1`} 
                          controls 
                          className="w-full max-h-[220px] object-contain rounded-xl bg-black"
                          preload="metadata"
                        />
                      </div>
                    )}

                    <a
                      href={downloadUrl || '#'}
                      download={`${(projectName || 'Joelizer-Video').replace(/[^a-zA-Z0-9_-]/g, '_')}.${downloadUrl?.startsWith('blob:') ? 'webm' : 'mp4'}`}
                      className="w-full py-3.5 px-6 rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 text-black transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl cursor-pointer mt-2"
                      style={{
                        background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                        boxShadow: `0 0 25px ${activeColor}50`
                      }}
                    >
                      <Download size={16} />
                      <span>Download {downloadUrl?.startsWith('blob:') ? 'Video (WebM)' : 'Production MP4'}</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCancelExport}
                      className="text-[11px] font-mono text-slate-400 hover:text-white underline pt-1 cursor-pointer"
                    >
                      Export Another Video
                    </button>
                  </div>
                ) : exportStage === 'error' ? (
                  <div className="space-y-4 text-center py-2 animate-in fade-in">
                    <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono">Export Encountered An Issue</h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-1 px-4 leading-relaxed">
                        {exportError || 'Server Remotion pipeline was interrupted.'}
                      </p>
                    </div>

                    {/* SMART FALLBACK: 1-Click Browser Video Engine Export */}
                    {!(exportMode === 'music-video' && mvTimelineClips.some(c => c.type === 'video' || c.type === 'image')) && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-left space-y-2">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <Zap size={14} />
                        <span className="text-xs font-bold font-mono uppercase">Instant Browser Export Fallback</span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-mono">
                        You can export immediately using the Fast Client Browser Engine. It records video in real-time with zero server wait!
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStartExport('browser')}
                        className="w-full py-2.5 px-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black uppercase text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Zap size={14} />
                        <span>Export with Fast Browser Engine Now</span>
                      </button>
                    </div>
                    )}

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleStartExport('server')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer"
                      >
                        Retry Server Render
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelExport}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={30} style={{ color: activeColor }} />
                      <div className="text-center">
                        <span className="font-mono text-xs uppercase tracking-widest font-black block" style={{ color: activeColor }}>
                          {exportStage.toUpperCase()}...
                        </span>
                        <span className="text-[11px] text-slate-300 font-mono block mt-1">{stageMessage}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
                      <div 
                        className="absolute top-0 bottom-0 left-0 transition-all duration-300 ease-out rounded-full"
                        style={{ 
                          width: `${progress}%`,
                          backgroundColor: activeColor,
                          boxShadow: `0 0 12px ${activeColor}` 
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 font-bold px-1">
                      <span>STAGE: {exportStage} • {activeRendererName || engineChoice}</span>
                      <span className="tabular-nums text-white">{Math.round(progress)}%</span>
                    </div>

                    {/* Cancel button */}
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={handleCancelExport}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <X size={14} />
                        <span>Cancel Export</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3.5 pr-1 py-1">
                
                {/* Notice banner if audio is not loaded */}
                {!hasAudio && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertCircle size={15} />
                      <span className="text-xs font-bold font-mono uppercase">No Audio File Loaded</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono">
                      Attach an audio track or choose a quick option below to enable video export:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleAudioFileUpload} 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload size={13} />
                        <span>Upload Audio File</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleLoadDemoTrack}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play size={13} className="text-emerald-400" />
                        <span>Load Demo Track</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAllowSilentExport(true)}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[11px] font-mono underline cursor-pointer"
                      >
                        Export with Silent Audio
                      </button>
                    </div>
                  </div>
                )}

                {/* Engine Selector: Server Remotion vs Fast Browser Engine */}
                <div className="export-modal-item-anim space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                    Render Engine
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEngineChoice('server')}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                        engineChoice === 'server'
                          ? "bg-white/10 border-white/40 text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                      )}
                      style={engineChoice === 'server' ? { borderColor: `${activeColor}80` } : {}}
                    >
                      <Film size={16} className={engineChoice === 'server' ? 'text-emerald-400' : 'text-slate-400'} />
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold uppercase font-mono">Server Remotion</span>
                          <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">MP4</span>
                        </div>
                        <span className="text-[9px] text-slate-400 block font-mono mt-0.5 leading-tight">
                          Frame-accurate high quality server render
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEngineChoice('browser')}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                        engineChoice === 'browser'
                          ? "bg-white/10 border-white/40 text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                      )}
                      style={engineChoice === 'browser' ? { borderColor: `${activeColor}80` } : {}}
                    >
                      <Zap size={16} className={engineChoice === 'browser' ? 'text-amber-400' : 'text-slate-400'} />
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold uppercase font-mono">Fast Browser</span>
                          <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">Instant</span>
                        </div>
                        <span className="text-[9px] text-slate-400 block font-mono mt-0.5 leading-tight">
                          Instant in-browser capture (zero server wait)
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Video Mode Selection */}
                <div className="export-modal-item-anim space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Video Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange('lyrics-video')}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2",
                        exportMode === 'lyrics-video'
                          ? "bg-emerald-500/15 border-emerald-500/80 text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      <Music2 size={16} className={exportMode === 'lyrics-video' ? 'text-emerald-400' : 'text-slate-400'} />
                      <div>
                        <span className="text-xs font-bold uppercase block font-mono">Lyrics Video</span>
                        <span className="text-[9px] text-slate-400 block font-mono">Vinyl & Kinetic Typography</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeChange('music-video')}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2",
                        exportMode === 'music-video'
                          ? "bg-purple-500/15 border-purple-500/80 text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      <Film size={16} className={exportMode === 'music-video' ? 'text-purple-400' : 'text-slate-400'} />
                      <div>
                        <span className="text-xs font-bold uppercase block font-mono">Music Video</span>
                        <span className="text-[9px] text-slate-400 block font-mono">Timeline Clips & Cuts</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Range Selection */}
                <div className="export-modal-item-anim">
                  <ExportRangeSlider
                    duration={effectiveAudioDuration}
                    start={exportRangeStart}
                    end={exportRangeEnd}
                    onChange={setExportRange}
                    activeColor={activeColor}
                  />
                </div>

                {/* Aspect Ratio Selection */}
                <div className="export-modal-item-anim space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: '16:9' as AspectRatioType, label: '16:9', desc: 'YouTube' },
                      { id: '9:16' as AspectRatioType, label: '9:16', desc: 'Shorts/TikTok' },
                      { id: '1:1' as AspectRatioType, label: '1:1', desc: 'Square' },
                      { id: '4:5' as AspectRatioType, label: '4:5', desc: 'Social' }
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAspectRatioChange(item.id)}
                        className={cn(
                          "py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                          aspectRatio === item.id
                            ? "bg-white/10 border-white/40 text-white"
                            : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                        )}
                        style={aspectRatio === item.id ? { borderColor: `${activeColor}80` } : {}}
                      >
                        <span className="text-[10px] font-bold uppercase font-mono">{item.label}</span>
                        <span className="text-[8px] text-slate-400 font-mono">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution Preset */}
                <div className="export-modal-item-anim space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Resolution & Quality</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: '1080p' as ExportResolutionType, label: '1080p Full HD', tag: 'Production' },
                      { id: '720p' as ExportResolutionType, label: '720p HD', tag: 'Fast' },
                      { id: '360p' as ExportResolutionType, label: '360p Draft', tag: 'Test' }
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setResolution(item.id)}
                        className={cn(
                          "py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                          resolution === item.id
                            ? "bg-white/10 border-white/40 text-white"
                            : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                        )}
                        style={resolution === item.id ? { borderColor: `${activeColor}80` } : {}}
                      >
                        <span className="text-[10px] font-bold uppercase font-mono">{item.label}</span>
                        <span className="text-[8px] text-slate-400 font-mono">{item.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filename Input */}
                <div className="export-modal-item-anim space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Project Filename</label>
                  <input 
                    type="text"
                    value={projectName}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name your video file..."
                    className="w-full bg-black/50 border border-white/15 focus:border-white/40 px-3 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider outline-none font-mono"
                  />
                </div>

                {/* Engine Health Verification */}
                <div className="export-modal-item-anim pt-1 border-t border-white/10">
                  <div className="bg-white/[0.02] border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor size={14} className="text-emerald-400" />
                      <div>
                        <span className="text-[10px] font-mono font-bold text-white uppercase block">10s Engine Health Test</span>
                        <span className="text-[9px] text-slate-400 font-mono block">Verify Remotion & FFmpeg pipeline</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunRenderTest}
                      disabled={isTestRunning}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      {isTestRunning ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                      <span>{isTestRunning ? 'Testing...' : 'Run Test'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div className={cn(
                      "mt-2 p-2 rounded-lg text-[10px] font-mono border",
                      testResult.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    )}>
                      {testResult.message}
                    </div>
                  )}
                </div>

                {/* Primary Export Action */}
                <button
                  type="button"
                  onClick={() => handleStartExport()}
                  disabled={!hasAudio}
                  className={cn(
                    "export-modal-item-anim w-full py-3.5 text-black font-black uppercase tracking-wider text-xs rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer mt-3",
                    !hasAudio ? "opacity-50 cursor-not-allowed" : "hover:brightness-110 active:scale-95"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                    boxShadow: `0 0 25px ${activeColor}40`
                  }}
                >
                  <Download size={16} /> 
                  <span>
                    Export {engineChoice === 'browser' ? 'Video' : 'MP4'} ({resolution} • {engineChoice === 'browser' ? 'Browser Engine' : 'Server Engine'})
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {/* -------------------- TAB 2: LYRICS & SUBTITLES EXPORT -------------------- */}
        {activeExportTab === 'lyrics' && (
          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3.5 pr-1 py-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase text-white block">
                  Export Lyrics & Subtitles
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {lyricsLines.length} synchronized lyric lines ready
                </span>
              </div>

              {/* Download all formats as ZIP */}
              <button
                type="button"
                onClick={handleDownloadZipPack}
                disabled={isZipping || lyricsLines.length === 0}
                className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isZipping ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                <span>Download All (ZIP)</span>
              </button>
            </div>

            {/* Format selection chips */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: 'lrc' as LyricFormatType, label: 'LRC', desc: 'Standard' },
                { id: 'enhanced-lrc' as LyricFormatType, label: 'Enhanced', desc: 'Word Sync' },
                { id: 'srt' as LyricFormatType, label: 'SRT', desc: 'Subtitles' },
                { id: 'ass' as LyricFormatType, label: 'ASS', desc: 'Styled' },
                { id: 'json' as LyricFormatType, label: 'JSON', desc: 'Raw Data' },
                { id: 'txt' as LyricFormatType, label: 'TXT', desc: 'Plain' },
              ].map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedLyricFormat(fmt.id)}
                  className={cn(
                    "py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center",
                    selectedLyricFormat === fmt.id
                      ? "bg-white/15 border-white/40 text-white"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                  )}
                  style={selectedLyricFormat === fmt.id ? { borderColor: `${activeColor}80` } : {}}
                >
                  <span className="text-[10px] font-mono font-bold uppercase">{fmt.label}</span>
                  <span className="text-[8px] text-slate-400 font-mono">{fmt.desc}</span>
                </button>
              ))}
            </div>

            {/* Preview Box */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
                <span>FORMAT PREVIEW (.{(selectedLyricFormat === 'enhanced-lrc' ? 'lrc' : selectedLyricFormat).toUpperCase()})</span>
                <span>{getLyricsPreviewContent(selectedLyricFormat).split('\n').length} lines</span>
              </div>
              <div className="h-44 bg-black/60 border border-white/10 rounded-xl p-3 overflow-y-auto custom-scrollbar font-mono text-[11px] text-slate-300 whitespace-pre leading-relaxed select-text">
                {lyricsLines.length === 0 ? (
                  <span className="text-slate-500 italic">No lyrics loaded in studio.</span>
                ) : (
                  getLyricsPreviewContent(selectedLyricFormat)
                )}
              </div>
            </div>

            {/* Actions for Lyrics */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyLyrics(selectedLyricFormat)}
                disabled={lyricsLines.length === 0}
                className="py-2.5 px-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {hasCopiedLyrics ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{hasCopiedLyrics ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadLyrics(selectedLyricFormat)}
                disabled={lyricsLines.length === 0}
                className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                <span>Download .{selectedLyricFormat === 'enhanced-lrc' ? 'lrc' : selectedLyricFormat}</span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------- TAB 3: AUDIO MASTER EXPORT -------------------- */}
        {activeExportTab === 'audio' && (
          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3.5 pr-1 py-1">
            <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Disc size={18} className="text-emerald-400" />
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white">Multitrack Master Mixdown</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Pristine 48kHz 24-bit Lossless WAV Audio</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                Bounces all active tracks, stems, effects, and timeline pans into a production master WAV file.
              </p>

              <button
                type="button"
                onClick={handleBounceWavMaster}
                disabled={isAudioBouncing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 mt-1"
              >
                {isAudioBouncing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{isAudioBouncing ? 'Bouncing Audio Master...' : 'Download Master Mix (WAV)'}</span>
              </button>

              {audioBounceNotice && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono text-center">
                  {audioBounceNotice}
                </div>
              )}
            </div>

            {/* Project JSON Backup */}
            <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-purple-400" />
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase text-white">Full Project Data (JSON)</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Complete backup of lyrics, timing, styles & clips</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const projectJson = await buildCanonicalProjectJson({ skipStaging: true });
                  const blob = new Blob([JSON.stringify(projectJson, null, 2)], { type: 'application/json' });
                  downloadFile(blob, `${(projectName || 'Joelizer').replace(/[^a-zA-Z0-9_-]/g, '_')}.project.json`, 'application/json');
                }}
                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-mono font-bold uppercase text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-white/20 cursor-pointer"
              >
                <Download size={14} />
                <span>Export Canonical Project JSON</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
