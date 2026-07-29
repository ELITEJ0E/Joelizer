import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, Loader2, Download, Zap, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate, stagger } from 'animejs';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('webm');
  
  // Custom performance optimization settings
  const [resolution, setResolution] = useState<'360p' | '720p' | '1080p'>('720p');
  const [fps, setFps] = useState<15 | 30 | 60>(30);
  const [bitrate, setBitrate] = useState<1500000 | 4000000 | 8000000>(4000000);

  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setExportResolutionOverride = useStore(s => s.setExportResolutionOverride);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  useEffect(() => {
    // Scale and fade in the export modal card
    animate('.export-modal-card', {
      scale: [0.93, 1],
      opacity: [0, 1],
      duration: 450,
      easing: 'easeOutBack'
    });
    
    // Stagger slide-up the options inside the export card
    animate('.export-modal-item-anim', {
      opacity: [0, 1],
      translateY: [15, 0],
      delay: stagger(50, { start: 100 }),
      duration: 500,
      easing: 'easeOutQuart'
    });

    return () => {
      // Ensure override is cleared when modal unmounts
      useStore.getState().setExportResolutionOverride(null);
    };
  }, []);

  const getMimeTypeForFormat = (format: 'webm' | 'mp4') => {
    if (format === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264,mp3',
        'video/mp4;codecs=h264',
        'video/mp4'
      ];
      for (const type of mp4Types) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    }
    
    const webmTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/ogg'
    ];
    for (const type of webmTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  const handleExport = async () => {
    if (!audioFile) return;
    setIsExporting(true);
    setProgress(0);

    // Apply the active canvas resolution override (resizes canvas for faster frame processing)
    setExportResolutionOverride(resolution);
    
    // Let layout flush so the canvas dimension state can update
    await new Promise(resolve => setTimeout(resolve, 150));

    // 1. Get the actual preview canvas from the DOM
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      setExportResolutionOverride(null);
      setIsExporting(false);
      return;
    }

    // 2. Get audio stream from audioManager
    const audioStream = audioManager.getMediaStream();
    if (!audioStream) {
      console.warn("No audio stream available from AudioContextManager.");
    }
    
    // 3. Setup MediaRecorder with chosen container format, optimized FPS and bitrate
    const canvasStream = canvas.captureStream(fps);
    const finalTracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
      finalTracks.push(...audioStream.getAudioTracks());
    }
    
    const finalStream = new MediaStream(finalTracks);
    
    const mimeType = getMimeTypeForFormat(exportFormat);
    const options: MediaRecorderOptions = { videoBitsPerSecond: bitrate };
    if (mimeType) {
      options.mimeType = mimeType;
    }
    
    const finalRecorder = new MediaRecorder(finalStream, options);
    const finalChunks: Blob[] = [];
    
    finalRecorder.ondataavailable = e => {
      if (e.data.size > 0) finalChunks.push(e.data);
    };
    
    finalRecorder.onstop = () => {
      setExportResolutionOverride(null);
      const blob = new Blob(finalChunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const safeProjectName = projectName ? projectName.trim() : '';
      const baseName = safeProjectName ? safeProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'visualizer';
      a.download = `${baseName}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      onClose();
    };

    finalRecorder.onerror = () => {
      setExportResolutionOverride(null);
      setIsExporting(false);
    };
    
    // Start playback and recording
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(true);
    
    finalRecorder.start(100);
    
    const pStartTime = performance.now();
    
    const monitorProgress = () => {
      if (finalRecorder.state === 'inactive') return;
      const elapsed = audioEl ? audioEl.currentTime : (performance.now() - pStartTime) / 1000;
      setProgress(Math.min((elapsed / audioDuration) * 100, 100));
      
      if (elapsed >= audioDuration || (audioEl && audioEl.ended)) {
        if ((finalRecorder.state as string) !== 'inactive') {
          finalRecorder.stop();
        }
        setIsPlaying(false);
        setExportResolutionOverride(null);
      } else {
        requestAnimationFrame(monitorProgress);
      }
    };
    
    monitorProgress();
  };

  // Performance/Overhead calculations
  const getPerformanceFeedback = () => {
    if (resolution === '360p' && fps === 15) {
      return {
        tag: 'ULTRA EFFICIENCY',
        desc: 'Up to 10x faster rendering & compilation. Ideal for quick drafts and low-spec machines.',
        color: '#00e676',
        percent: '-92% CPU load'
      };
    }
    if (resolution === '360p' || (resolution === '720p' && fps === 15)) {
      return {
        tag: 'HIGHLY EFFICIENT',
        desc: '4x to 6x faster processing. Smooth encoding with extremely small output sizes.',
        color: '#00e676',
        percent: '-75% CPU load'
      };
    }
    if (resolution === '720p' && fps === 30) {
      return {
        tag: 'BALANCED (RECOMMENDED)',
        desc: 'Standard HD recording. Perfectly optimized quality/speed trade-off for sharing.',
        color: activeColor,
        percent: '-40% CPU load'
      };
    }
    if (resolution === '1080p' && fps === 60) {
      return {
        tag: 'MAXIMUM QUALITY',
        desc: 'Uncompressed Full HD 60 FPS. Demands heavy graphic processing and encoding power.',
        color: '#ff1744',
        percent: '+180% CPU load'
      };
    }
    return {
      tag: 'CUSTOM PRESET',
      desc: 'Optimized manual settings. Hardware acceleration is recommended.',
      color: activeColor,
      percent: 'Optimized rendering'
    };
  };

  const perfInfo = getPerformanceFeedback();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="export-modal-card bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl p-5 sm:p-7 w-full max-w-lg shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Dynamic glow accent */}
        <div 
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
          style={{ background: activeColor }}
        />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10"
              style={{ backgroundColor: `${activeColor}15` }}
            >
              <Download size={14} style={{ color: activeColor }} />
            </div>
            <h2 className="text-xs font-mono uppercase tracking-[3px] font-black" style={{ color: activeColor }}>[ EXPORT VISUALIZER ]</h2>
          </div>
          {!isExporting && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer">
              <X size={18} />
            </button>
          )}
        </div>

        {!audioFile ? (
          <div className="text-center text-slate-500 text-[10px] uppercase font-bold tracking-widest py-8 bg-white/[0.02] rounded-lg border border-white/5">
            NO AUDIO LOADED
          </div>
        ) : isExporting ? (
          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center justify-center gap-4 mb-2">
              <Loader2 className="animate-spin" size={28} style={{ color: activeColor }} />
              <div className="text-center">
                <span className="font-mono text-[10px] uppercase tracking-[3px] font-black block" style={{ color: activeColor }}>[ ENCODING FRAMES ]</span>
                <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-1 block">Rendering at {resolution} @ {fps}fps</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
              <div 
                className="absolute top-0 bottom-0 left-0 transition-all duration-300 ease-linear rounded-full"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: activeColor,
                  boxShadow: `0 0 10px ${activeColor}80` 
                }}
              />
            </div>
            <div className="text-center text-[10px] font-mono text-slate-400 tabular-nums font-bold tracking-widest">
              {Math.round(progress)}% COMPLETE - DO NOT CLOSE OR MINIMIZE TAB
            </div>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {/* Project Name Input */}
            <div className="export-modal-item-anim space-y-2">
              <label className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest block">Project Filename</label>
              <input 
                type="text"
                value={projectName}
                onChange={(e) => setName(e.target.value)}
                placeholder="NAME YOUR FILE..."
                className="w-full bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-white/30 hover:bg-white/[0.04] px-3.5 py-2.5 rounded-lg text-white text-xs font-bold uppercase tracking-wider outline-none transition-glass placeholder-white/20 focus:bg-white/[0.05]"
              />
            </div>

            {/* Container Format & Resolution Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="export-modal-item-anim space-y-2">
                <label className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest block">Container Format</label>
                <div className="flex gap-2">
                  {(['webm', 'mp4'] as const).map((fmt) => (
                    <button 
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-glass cursor-pointer",
                        exportFormat === fmt
                          ? "text-white shadow-md border-white/20"
                          : "bg-white/[0.01] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                      style={exportFormat === fmt ? {
                        backgroundColor: `${activeColor}15`,
                        borderColor: `${activeColor}50`,
                      } : {}}
                    >
                      {fmt === 'webm' ? 'WebM (Fast)' : 'MP4 (Standard)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="export-modal-item-anim space-y-2">
                <label className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest block">Quality / Resolution</label>
                <div className="flex gap-2">
                  {(['360p', '720p', '1080p'] as const).map((res) => (
                    <button 
                      key={res}
                      onClick={() => setResolution(res)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-glass cursor-pointer",
                        resolution === res
                          ? "text-white shadow-md border-white/20"
                          : "bg-white/[0.01] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                      style={resolution === res ? {
                        backgroundColor: `${activeColor}15`,
                        borderColor: `${activeColor}50`,
                      } : {}}
                    >
                      {res === '360p' ? '360p' : res === '720p' ? '720p' : '1080p'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FPS and Bitrate Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="export-modal-item-anim space-y-2">
                <label className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest block">Frame Rate (FPS)</label>
                <div className="flex gap-2">
                  {([15, 30, 60] as const).map((fpsVal) => (
                    <button 
                      key={fpsVal}
                      onClick={() => setFps(fpsVal)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-glass cursor-pointer",
                        fps === fpsVal
                          ? "text-white shadow-md border-white/20"
                          : "bg-white/[0.01] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                      style={fps === fpsVal ? {
                        backgroundColor: `${activeColor}15`,
                        borderColor: `${activeColor}50`,
                      } : {}}
                    >
                      {fpsVal} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div className="export-modal-item-anim space-y-2">
                <label className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-widest block">Target Bitrate</label>
                <div className="flex gap-2">
                  {([1500000, 4000000, 8000000] as const).map((bitrateVal) => (
                    <button 
                      key={bitrateVal}
                      onClick={() => setBitrate(bitrateVal)}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-glass cursor-pointer",
                        bitrate === bitrateVal
                          ? "text-white shadow-md border-white/20"
                          : "bg-white/[0.01] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                      style={bitrate === bitrateVal ? {
                        backgroundColor: `${activeColor}15`,
                        borderColor: `${activeColor}50`,
                      } : {}}
                    >
                      {bitrateVal === 1500000 ? '1.5M' : bitrateVal === 4000000 ? '4.0M' : '8.0M'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Advisor */}
            <div className="export-modal-item-anim bg-white/[0.01] border border-white/5 p-4 rounded-lg flex gap-3.5 items-start">
              <div className="p-1 rounded bg-white/5 flex-shrink-0 mt-0.5">
                <Zap size={14} style={{ color: perfInfo.color }} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase font-black" style={{ color: perfInfo.color }}>
                    {perfInfo.tag}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 font-mono text-slate-400 font-bold">
                    {perfInfo.percent}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-400 leading-relaxed font-medium uppercase tracking-wider">
                  {perfInfo.desc} 
                  <br/>
                  <span className="text-slate-500 font-mono mt-1 block">EST. ELAPSED TIME FOR ENCODING: {Math.round(audioDuration)}s</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleExport}
              className="export-modal-item-anim w-full py-3.5 text-black font-black uppercase tracking-widest text-[10px] rounded-lg transition-all hover:scale-[1.01] active:scale-95 shadow-xl relative overflow-hidden group cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                boxShadow: `0 0 25px ${activeColor}40`
              }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Download size={14} /> Start Optimized Export
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
