import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, Loader2, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate, stagger } from 'animejs';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('mp4');

  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
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
      delay: stagger(60, { start: 150 }),
      duration: 500,
      easing: 'easeOutQuart'
    });
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

    // 1. Get the actual preview canvas from the DOM
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    // 2. Get audio stream from audioManager
    const audioStream = audioManager.getMediaStream();
    if (!audioStream) {
      console.warn("No audio stream available from AudioContextManager.");
      // Fallback or handle failure if needed
    }
    
    // 3. Setup MediaRecorder with chosen container format
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const finalTracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
      finalTracks.push(...audioStream.getAudioTracks());
    }
    
    const finalStream = new MediaStream(finalTracks);
    
    const mimeType = getMimeTypeForFormat(exportFormat);
    const options: MediaRecorderOptions = { videoBitsPerSecond: 8000000 };
    if (mimeType) {
      options.mimeType = mimeType;
    }
    const finalRecorder = new MediaRecorder(finalStream, options);
    const finalChunks: Blob[] = [];
    
    finalRecorder.ondataavailable = e => {
      if (e.data.size > 0) finalChunks.push(e.data);
    };
    
    finalRecorder.onstop = () => {
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
      } else {
        requestAnimationFrame(monitorProgress);
      }
    };
    
    monitorProgress();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="export-modal-card bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl p-5 sm:p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Dynamic glow accent */}
        <div 
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
          style={{ background: activeColor }}
        />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10"
              style={{ backgroundColor: `${activeColor}15` }}
            >
              <Download size={14} style={{ color: activeColor }} />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-[2px] font-display">Export Video</h2>
          </div>
          {!isExporting && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
              <X size={18} />
            </button>
          )}
        </div>

        {!audioFile ? (
          <div className="text-center text-slate-500 text-[10px] uppercase font-bold tracking-widest py-8 bg-white/[0.02] rounded-lg border border-white/5">
            NO AUDIO LOADED
          </div>
        ) : isExporting ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center gap-4 mb-2">
              <Loader2 className="animate-spin" size={24} style={{ color: activeColor }} />
              <span className="font-bold text-xs uppercase tracking-wider text-white">Rendering Video...</span>
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
              {Math.round(progress)}% COMPLETE - DO NOT CLOSE TAB
            </div>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            <div className="export-modal-item-anim space-y-3">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Project Name</label>
              <input 
                type="text"
                value={projectName}
                onChange={(e) => setName(e.target.value)}
                placeholder="NAME YOUR PROJECT (OPTIONAL)..."
                className="w-full bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-white/30 hover:bg-white/[0.04] px-3.5 py-2.5 rounded-lg text-white text-xs font-bold uppercase tracking-wider outline-none transition-glass placeholder-white/20 focus:bg-white/[0.05]"
              />
            </div>

            <div className="export-modal-item-anim space-y-3">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Container Format</label>
              <div className="flex gap-3">
                <button 
                  onClick={() => setExportFormat('webm')}
                  className={cn(
                    "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-glass",
                    exportFormat === 'webm'
                      ? "text-white shadow-lg"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                  style={exportFormat === 'webm' ? {
                    backgroundColor: `${activeColor}15`,
                    borderColor: `${activeColor}50`,
                    boxShadow: `0 0 15px ${activeColor}20`
                  } : {}}
                >
                  WebM (Fast)
                </button>
                <button 
                  onClick={() => setExportFormat('mp4')}
                  className={cn(
                    "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-glass",
                    exportFormat === 'mp4'
                      ? "text-white shadow-lg"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                  style={exportFormat === 'mp4' ? {
                    backgroundColor: `${activeColor}15`,
                    borderColor: `${activeColor}50`,
                    boxShadow: `0 0 15px ${activeColor}20`
                  } : {}}
                >
                  MP4
                </button>
              </div>
            </div>
            
            <div className="export-modal-item-anim bg-white/[0.02] border border-white/5 p-4 rounded-lg">
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono uppercase tracking-widest">
                <span className="text-white font-bold">[SYSTEM]</span> Export happens in real-time via canvas capture. 
                <br/><br/>
                ESTIMATED TIME: <span className="text-white font-bold tabular-nums">{Math.round(audioDuration)}s</span>
              </p>
            </div>

            <button
              onClick={handleExport}
              className="export-modal-item-anim w-full py-4 text-black font-black uppercase tracking-widest text-xs rounded-lg transition-all hover:scale-[1.02] active:scale-95 shadow-xl relative overflow-hidden group"
              style={{
                background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                boxShadow: `0 0 25px ${activeColor}40`
              }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10">Start Export</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
