import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { 
  X, Loader2, Download, CheckCircle2, Film, Music2,
  AlertCircle, FileText, Copy, Check, Package
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate } from 'animejs';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { ExportRangeSlider } from './ExportRangeSlider';
import { buildCanonicalProjectJson } from '../../lib/projectJsonBuilder';
import { getBestAvailableRenderer } from '../../lib/renderers/renderManager';
import { ServerRemotionRenderer } from '../../lib/renderers/ServerRemotionRenderer';
import { OfflineWebCodecsRenderer } from '../../lib/renderers/OfflineWebCodecsRenderer';
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
  // Browser capture works immediately on Vercel. Upgrade to independent MP4 rendering
  // only after a real persistent Remotion backend responds to /api/health.
  const [engineChoice, setEngineChoice] = useState<'server' | 'offline' | 'browser'>('browser');
  const manuallySelectedEngine = useRef(false);
  const chooseEngine = (engine: 'server' | 'offline' | 'browser') => {
    manuallySelectedEngine.current = true;
    setEngineChoice(engine);
  };

  // Video Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'ready' | 'error'>('preparing');
  const [stageMessage, setStageMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'webm' | 'mp4'>('webm');
  const [actualExportResolution, setActualExportResolution] = useState<ExportResolutionType | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeRendererName, setActiveRendererName] = useState<string>('');

  // Video Settings
  const [resolution, setResolution] = useState<ExportResolutionType>('1080p');
  // Browser MediaRecorder often drops frames at 1080p/60 on midrange hardware.
  // Prefer reliable 30fps capture unless the user explicitly selects 60fps.
  const [fps, setFps] = useState<30 | 60>(30);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    // Probe local WebCodecs independently: waiting for the server health
    // timeout previously left Browser MediaRecorder selected for several
    // seconds, leading to another broken clip export when users clicked fast.
    new OfflineWebCodecsRenderer().isAvailable().then(offline => {
      if (alive && !manuallySelectedEngine.current && offline) {
        setEngineChoice('offline');
      }
    }).catch(() => {});
    new ServerRemotionRenderer().isAvailable().then(server => {
      if (!alive) return;
      setServerAvailable(server);
      if (server && !manuallySelectedEngine.current) setEngineChoice('server');
    }).catch(() => { if (alive) setServerAvailable(false); });
    return () => { alive = false; };
  }, []);
  const currentAspectRatio = useStore(s => s.aspectRatio);
  const [aspectRatio, setAspectRatioState] = useState<AspectRatioType>(currentAspectRatio as AspectRatioType);
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


  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const createdBlobUrlRef = useRef<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const cleanupBlobUrl = () => {
    if (previewVideoRef.current) {
      try {
        previewVideoRef.current.pause();
        previewVideoRef.current.removeAttribute('src');
        previewVideoRef.current.load();
      } catch {}
    }
    if (createdBlobUrlRef.current) {
      try { URL.revokeObjectURL(createdBlobUrlRef.current); } catch {}
      createdBlobUrlRef.current = null;
    }
  };

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
  const effectiveAudioDuration = Math.max(audioDuration || 0, maxMVClipEnd, maxLyricEnd) || 15;
  const hasAudio = !!audioFile || !!audioUrl || mvTimelineClips.length > 0 || allowSilentExport;

  const exportRangeStart = useStore(s => s.exportRangeStart) || 0;
  const rawExportRangeEnd = useStore(s => s.exportRangeEnd);
  const inheritedAudioEnd = exportMode === 'music-video'
    && maxMVClipEnd > (audioDuration || 0)
    && rawExportRangeEnd !== null
    && Math.abs(rawExportRangeEnd - (audioDuration || 0)) < 0.02;
  const exportRangeEnd = (rawExportRangeEnd !== null && rawExportRangeEnd > exportRangeStart && !inheritedAudioEnd)
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

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupBlobUrl();
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

  const handleCancelExport = () => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    cleanupBlobUrl();
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

  // Unified Production Export (Server Remotion or Fast Browser MediaRecorder)
  const handleStartExport = async (forcedEngine?: 'server' | 'offline' | 'browser') => {
    let targetEngine = forcedEngine || engineChoice;

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupBlobUrl();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      isCancelledRef.current = false;
      setIsExporting(true);
      setExportStage('preparing');
      setStageMessage('Preparing project timeline, styles, and assets...');
      setProgress(5);
      setExportError(null);
      setDownloadUrl(null);
      setActualExportResolution(null);

      // Recheck codec support at click time, so very fast user interactions
      // cannot accidentally select the laggy real-time browser recorder.
      if (!forcedEngine && targetEngine === 'browser' &&
          await new OfflineWebCodecsRenderer().isAvailable()) {
        targetEngine = 'offline';
        setEngineChoice('offline');
      }
      const renderer = await getBestAvailableRenderer(targetEngine);
      setActiveRendererName(renderer.name);
      setStageMessage(renderer.type === 'server'
        ? 'Uploading assets to the background-safe Remotion engine...'
        : renderer.type === 'offline'
          ? 'Preparing exact video frames for smooth MP4 export...'
          : 'Preparing real-time browser recording (keep tab visible)...');
      setProgress(12);
      const projectJson = await buildCanonicalProjectJson({
        resolution,
        fps,
        modeOverride: exportMode,
        skipStaging: renderer.type === 'browser' || renderer.type === 'offline'
      });

      const result = await renderer.render(projectJson, (prog) => {
        if (isCancelledRef.current || controller.signal.aborted) return;
        setExportStage(prog.stage as any);
        setStageMessage(prog.stageMessage);
        setProgress(prog.progress);
        if (prog.error) setExportError(prog.error);
      }, controller.signal);

      if (result.outputUrl && !controller.signal.aborted) {
        if (result.outputUrl.startsWith('blob:')) {
          createdBlobUrlRef.current = result.outputUrl;
        }
        setDownloadFormat(result.format || (renderer.type === 'browser' ? 'webm' : 'mp4'));
        setActualExportResolution(result.resolution || resolution);
        setDownloadUrl(result.outputUrl);
        setFileSize(result.fileSize || null);
        setExportStage('ready');
        setProgress(100);
      }
    } catch (err: any) {
      if (err?.message === 'Export cancelled by user.') return;
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
      <div className="export-modal-card bg-[#101419] border border-white/15 rounded-2xl p-4 sm:p-5 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[92dvh] my-auto">
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
                Export
              </h2>
              
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
              <span>Video</span>
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
              <span>Lyrics</span>

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
              <span>Audio</span>
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
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Export complete</h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {actualExportResolution || resolution} · {fps} FPS {fileSize ? `· ${formatFileSize(fileSize)}` : ''}
                      </p>
                      {actualExportResolution && actualExportResolution !== resolution && (
                        <p className="mt-1 text-xs text-amber-300">
                          Browser encoding limit: exported at {actualExportResolution} instead of {resolution}.
                        </p>
                      )}
                    </div>

                    {downloadUrl && (
                      <div className="w-full rounded-xl overflow-hidden border border-emerald-500/30 bg-black/80 shadow-2xl my-1">
                        <video 
                          ref={previewVideoRef}
                          src={downloadUrl.startsWith('blob:') ? downloadUrl : `${downloadUrl}?stream=1`} 
                          controls 
                          className="w-full max-h-[220px] object-contain rounded-xl bg-black"
                          preload="metadata"
                        />
                      </div>
                    )}

                    <a
                      href={downloadUrl || '#'}
                      download={`${(projectName || 'Joelizer-Video').replace(/[^a-zA-Z0-9_-]/g, '_')}.${downloadFormat}`}
                      className="w-full py-3.5 px-6 rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 text-black transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl cursor-pointer mt-2"
                      style={{
                        background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                        boxShadow: `0 0 25px ${activeColor}50`
                      }}
                    >
                      <Download size={16} />
                      <span>Download {downloadFormat === 'mp4' ? 'Smooth MP4' : 'Video (WebM)'}</span>
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
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono">Export failed</h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-1 px-4 leading-relaxed">
                        {exportError || 'Server Remotion pipeline was interrupted.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      {serverAvailable === true && <button
                        type="button"
                        onClick={() => handleStartExport('server')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer"
                      >
                        Retry
                      </button>}
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

                    <div className="text-right text-xs tabular-nums text-slate-300">{Math.round(progress)}%</div>

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
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-1 py-1">
                
                {!hasAudio && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-amber-200">Add audio or export without sound.</span>
                      <div className="flex flex-wrap gap-2">
                        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioFileUpload} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10">
                          Add audio
                        </button>
                        <button type="button" onClick={() => setAllowSilentExport(true)}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/10">
                          No audio
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">Video type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'lyrics-video' as ExportModeType, label: 'Lyrics video' },
                      { id: 'music-video' as ExportModeType, label: 'Music video' }
                    ]).map(mode => (
                      <button key={mode.id} type="button" onClick={() => handleModeChange(mode.id)}
                        aria-pressed={exportMode === mode.id}
                        className={cn(
                          'min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          exportMode === mode.id
                            ? 'border-accent bg-accent/10 text-white'
                            : 'border-white/15 bg-white/[0.03] text-slate-400 hover:bg-white/10 hover:text-white'
                        )}>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-slate-300">Aspect ratio</span>
                    <Select value={aspectRatio} onValueChange={v => handleAspectRatioChange(v as AspectRatioType)}>
                      <SelectTrigger aria-label="Video aspect ratio" className="h-10 w-full border-white/15 bg-[#171c23] text-xs normal-case"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110] bg-[#121820]">
                        {(['16:9', '9:16', '1:1', '4:5', '3:4', '4:3'] as AspectRatioType[]).map(value =>
                          <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-slate-300">Resolution</span>
                    <Select value={resolution} onValueChange={v => setResolution(v as ExportResolutionType)}>
                      <SelectTrigger aria-label="Export resolution" className="h-10 w-full border-white/15 bg-[#171c23] text-xs normal-case"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110] bg-[#121820]">
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="360p">360p</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-slate-300">Frame rate</span>
                    <Select value={String(fps)} onValueChange={v => setFps(Number(v) as 30 | 60)}>
                      <SelectTrigger aria-label="Export frame rate" className="h-10 w-full border-white/15 bg-[#171c23] text-xs normal-case"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110] bg-[#121820]">
                        <SelectItem value="30">30 FPS</SelectItem>
                        <SelectItem value="60">60 FPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-300">File name</span>
                  <input type="text" value={projectName}
                    onChange={e => setName(e.target.value)}
                    placeholder="Untitled video"
                    className="h-10 w-full rounded-lg border border-white/15 bg-[#171c23] px-3 text-sm text-white outline-none focus:border-accent" />
                </label>

                <details className="group rounded-lg border border-white/10 bg-white/[0.02]">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-xs text-slate-300 marker:hidden">
                    <span>Trim video <span className="text-slate-500">(optional)</span></span>
                    <span className="text-slate-400">
                      {Math.max(0, exportRangeEnd - exportRangeStart).toFixed(1)}s
                    </span>
                  </summary>
                  <div className="border-t border-white/10 p-3">
                    <ExportRangeSlider duration={effectiveAudioDuration}
                      start={exportRangeStart} end={exportRangeEnd}
                      onChange={setExportRange} activeColor={activeColor} />
                  </div>
                </details>

                {/* Primary Export Action */}
                <button
                  type="button"
                  onClick={() => handleStartExport()}
                  disabled={!hasAudio}
                  className={cn(
                    "w-full min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-[#07120d] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
                    !hasAudio && "cursor-not-allowed"
                  )}
                >
                  <Download size={16} className="inline mr-2" />
                  Export video
                </button>
              </div>
            )}
          </>
        )}

        {/* Lyrics export */}
        {activeExportTab === 'lyrics' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-slate-300">Format</span>
              <Select value={selectedLyricFormat} onValueChange={v => setSelectedLyricFormat(v as LyricFormatType)}>
                <SelectTrigger aria-label="Export lyric format" className="h-10 w-full border-white/15 bg-[#171c23] text-xs normal-case"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[110] bg-[#121820]">
                  <SelectItem value="lrc">LRC · Synced lyrics</SelectItem>
                  <SelectItem value="enhanced-lrc">Enhanced LRC · Word timing</SelectItem>
                  <SelectItem value="srt">SRT · Subtitles</SelectItem>
                  <SelectItem value="ass">ASS · Styled subtitles</SelectItem>
                  <SelectItem value="txt">TXT · Plain text</SelectItem>
                  <SelectItem value="json">JSON · Data</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <p className="text-xs text-slate-400">{lyricsLines.length} lyric lines</p>
            <button type="button" disabled={lyricsLines.length === 0}
              onClick={() => handleDownloadLyrics(selectedLyricFormat)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-[#07120d] hover:brightness-110 disabled:opacity-50">
              <Download size={16} /> Download lyrics
            </button>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleCopyLyrics(selectedLyricFormat)}
                disabled={lyricsLines.length === 0}
                className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50">
                {hasCopiedLyrics ? <Check size={14} /> : <Copy size={14} />}
                {hasCopiedLyrics ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={handleDownloadZipPack}
                disabled={isZipping || lyricsLines.length === 0}
                className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50">
                {isZipping ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                Download all formats
              </button>
            </div>
            <details className="rounded-lg border border-white/10">
              <summary className="cursor-pointer px-3 py-2.5 text-xs text-slate-400">Preview</summary>
              <pre className="max-h-44 overflow-auto border-t border-white/10 p-3 text-xs text-slate-300 whitespace-pre-wrap select-text">
                {getLyricsPreviewContent(selectedLyricFormat)}
              </pre>
            </details>
          </div>
        )}

        {/* Audio export */}
        {activeExportTab === 'audio' && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Audio master</h3>
              <p className="text-xs text-slate-400">WAV · 48 kHz · 24-bit</p>
            </div>
            <button type="button" onClick={handleBounceWavMaster} disabled={isAudioBouncing}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-[#07120d] hover:brightness-110 disabled:opacity-50">
              {isAudioBouncing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isAudioBouncing ? 'Exporting audio…' : 'Download WAV'}
            </button>
            {audioBounceNotice && <p className="text-xs text-slate-300">{audioBounceNotice}</p>}
            <details className="rounded-lg border border-white/10">
              <summary className="cursor-pointer px-3 py-2.5 text-xs text-slate-400">Project backup</summary>
              <div className="border-t border-white/10 p-3">
                <button type="button" onClick={async () => {
                  const projectJson = await buildCanonicalProjectJson({ skipStaging: true });
                  const blob = new Blob([JSON.stringify(projectJson, null, 2)], { type: 'application/json' });
                  downloadFile(blob, `${(projectName || 'Joelizer').replace(/[^a-zA-Z0-9_-]/g, '_')}.project.json`, 'application/json');
                }} className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-slate-200 hover:bg-white/10">
                  <Download size={14} /> Download project JSON
                </button>
              </div>
            </details>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
