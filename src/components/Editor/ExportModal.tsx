import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import fixWebmDuration from 'fix-webm-duration';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { X, Loader2, Download, Zap, Sliders, ChevronDown, ChevronUp, CheckCircle2, Film, Music2, Monitor, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate, stagger } from 'animejs';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { ExportRangeSlider } from './ExportRangeSlider';
import { buildCanonicalProjectJson } from '../../lib/projectJsonBuilder';
import { AspectRatioType, ExportResolutionType, ExportModeType } from '../../types/projectJson';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { handleClose } = usePopstateModal(true, onClose);
  
  // Primary Export State (Server Remotion Engine)
  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'ready' | 'error'>('preparing');
  const [stageMessage, setStageMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Settings
  const [resolution, setResolution] = useState<ExportResolutionType>('1080p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [aspectRatio, setAspectRatioState] = useState<AspectRatioType>('16:9');
  const [exportMode, setExportMode] = useState<ExportModeType>('lyrics-video');
  const [useBrowserFallback, setUseBrowserFallback] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Render Engine Health Test State
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Global store values
  const audioFile = useStore(s => s.audioFile);
  const audioUrl = useStore(s => s.audioUrl);
  const audioDuration = useStore(s => s.audioDuration);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const setAspectRatioStore = useStore(s => s.setAspectRatio);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const activeTab = useStore(s => s.activeTab);

  const mvTimelineClips = useMVStore(s => s.timelineClips);
  const lyricsVideoMode = useLyricsVideoStore(s => s.videoMode);
  const setLyricsVideoMode = useLyricsVideoStore(s => s.setVideoMode);

  const maxMVClipEnd = mvTimelineClips.reduce((max, clip) => Math.max(max, clip.endTime), 0);
  const effectiveAudioDuration = audioDuration || maxMVClipEnd || 10;
  const hasAudio = !!audioFile || !!audioUrl || mvTimelineClips.length > 0;

  const exportRangeStart = useStore(s => s.exportRangeStart);
  const rawExportRangeEnd = useStore(s => s.exportRangeEnd);
  const exportRangeEnd = (rawExportRangeEnd !== null && rawExportRangeEnd > 0) ? rawExportRangeEnd : effectiveAudioDuration;
  const setExportRange = useStore(s => s.setExportRange);

  useEffect(() => {
    // Set initial mode from active tab or lyrics store
    if (activeTab === 'mv-studio') {
      setExportMode('music-video');
    } else {
      setExportMode(lyricsVideoMode || 'lyrics-video');
    }

    animate('.export-modal-card', {
      scale: [0.93, 1],
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutBack'
    });
    
    animate('.export-modal-item-anim', {
      opacity: [0, 1],
      translateY: [15, 0],
      delay: stagger(40, { start: 80 }),
      duration: 450,
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
      const data = await res.json();
      setTestResult(data);
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
    setExportJobId(null);
    setDownloadUrl(null);
  };

  // Primary Production Server Export (Remotion + FFmpeg)
  const handleServerExport = async () => {
    if (!hasAudio) return;

    try {
      isCancelledRef.current = false;
      setIsExporting(true);
      setExportStage('preparing');
      setStageMessage('Building Canonical Project JSON & media assets...');
      setProgress(5);
      setExportError(null);
      setDownloadUrl(null);

      // Build canonical JSON with embedded media URIs for user-uploaded files
      const projectJson = await buildCanonicalProjectJson({
        resolution,
        fps,
        modeOverride: exportMode,
        embedMediaAsDataUri: true
      });

      setStageMessage('Submitting project to Remotion server rendering pipeline...');
      setProgress(15);

      const res = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectJson)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server export request failed (${res.status})`);
      }

      const { exportId } = await res.json();
      setExportJobId(exportId);

      // Poll progress endpoint
      pollIntervalRef.current = setInterval(async () => {
        if (isCancelledRef.current) {
          clearInterval(pollIntervalRef.current);
          return;
        }

        try {
          const progRes = await fetch(`/api/export-progress/${exportId}`);
          if (!progRes.ok) return;

          const job = await progRes.json();
          setExportStage(job.stage);
          setStageMessage(job.stageMessage || 'Processing video...');
          setProgress(job.progress || 0);

          if (job.stage === 'ready') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setDownloadUrl(job.outputUrl || `/api/download-export/${exportId}`);
            setFileSize(job.fileSize || null);
          } else if (job.stage === 'error') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setExportError(job.error || 'Server rendering failed');
          }
        } catch (pollErr) {
          console.warn('Error polling export progress:', pollErr);
        }
      }, 800);
    } catch (err: any) {
      console.error('Server export initiation error:', err);
      setExportStage('error');
      setExportError(err.message || 'Failed to start video export process');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) { if (isExporting) handleCancelExport(); else handleClose(); } }}
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="export-modal-card bg-[#0d0f12] border border-white/15 rounded-2xl p-4 sm:p-6 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] my-auto">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Glow accent */}
        <div 
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
          style={{ background: activeColor }}
        />

        {/* Header */}
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
                Production MP4 Export
              </h2>
              <span className="text-[9px] text-slate-400 font-mono block">Remotion Engine + FFmpeg</span>
            </div>
          </div>
          
          <button 
            onClick={isExporting ? handleCancelExport : handleClose} 
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {!hasAudio ? (
          <div className="text-center text-slate-400 text-xs uppercase font-bold tracking-widest py-8 bg-white/[0.02] rounded-lg border border-white/5">
            No audio or timeline clips loaded
          </div>
        ) : isExporting ? (
          <div className="space-y-4 py-4 my-auto">
            {exportStage === 'ready' && downloadUrl ? (
              <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 animate-bounce">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Video Export Complete!</h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    H.264 MP4 • {resolution} @ {fps}fps {fileSize ? `(${formatFileSize(fileSize)})` : ''}
                  </p>
                </div>

                <a
                  href={downloadUrl}
                  download={`${(projectName || 'Joelizer-Video').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  className="w-full py-3.5 px-6 rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 text-black transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl cursor-pointer mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                    boxShadow: `0 0 25px ${activeColor}50`
                  }}
                >
                  <Download size={16} />
                  <span>Download Production MP4</span>
                </a>

                <button
                  onClick={handleCancelExport}
                  className="text-[11px] font-mono text-slate-400 hover:text-white underline pt-2 cursor-pointer"
                >
                  Export Another Video
                </button>
              </div>
            ) : exportStage === 'error' ? (
              <div className="space-y-3 text-center py-2">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider font-mono">Export Rendering Failed</h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-1 px-4">{exportError || 'An unexpected error occurred during server rendering.'}</p>
                </div>
                <button
                  onClick={handleCancelExport}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer"
                >
                  Try Again
                </button>
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
                  <span>STAGE: {exportStage}</span>
                  <span className="tabular-nums text-white">{Math.round(progress)}%</span>
                </div>

                {/* Cancel button */}
                <div className="pt-2 flex justify-center">
                  <button
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
            
            {/* Mode Selection */}
            <div className="export-modal-item-anim space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Video Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('lyrics-video')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2",
                    exportMode === 'lyrics-video'
                      ? "bg-emerald-500/15 border-emerald-500/80 text-white"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                  )}
                >
                  <Music2 size={16} className={exportMode === 'lyrics-video' ? 'text-emerald-400' : 'text-slate-400'} />
                  <div>
                    <span className="text-xs font-bold uppercase block font-mono">Lyrics Video</span>
                    <span className="text-[9px] text-slate-400 block font-mono">Typography & Visualizers</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('music-video')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2",
                    exportMode === 'music-video'
                      ? "bg-purple-500/15 border-purple-500/80 text-white"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                  )}
                >
                  <Film size={16} className={exportMode === 'music-video' ? 'text-purple-400' : 'text-slate-400'} />
                  <div>
                    <span className="text-xs font-bold uppercase block font-mono">Music Video</span>
                    <span className="text-[9px] text-slate-400 block font-mono">Clips & Auto Editing</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Range Selection */}
            <div className="export-modal-item-anim">
              <ExportRangeSlider
                duration={audioDuration}
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

            {/* Requirement 15: Render Engine Health Test Toggle */}
            <div className="export-modal-item-anim pt-1 border-t border-white/10">
              <div className="bg-white/[0.02] border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor size={14} className="text-emerald-400" />
                  <div>
                    <span className="text-[10px] font-mono font-bold text-white uppercase block">10s Engine Health Test</span>
                    <span className="text-[9px] text-slate-400 font-mono block">Verify Remotion & FFmpeg setup</span>
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

            {/* Start Export Action */}
            <button
              onClick={handleServerExport}
              className="export-modal-item-anim w-full py-3.5 text-black font-black uppercase tracking-wider text-xs rounded-xl transition-all hover:brightness-110 active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer mt-3"
              style={{
                background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                boxShadow: `0 0 25px ${activeColor}40`
              }}
            >
              <Download size={16} /> 
              <span>Export MP4 ({resolution} • 30fps)</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
