import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('mp4');

  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const projectName = useStore(s => s.name);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);

  const getMimeTypeForFormat = (format: 'webm' | 'mp4') => {
    if (format === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264,mp3',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=h264'
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

    // 2. Setup audio context for recording
    const audioCtx = new window.AudioContext();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const captureSource = audioCtx.createBufferSource();
    captureSource.buffer = audioBuffer;
    const captureDest = audioCtx.createMediaStreamDestination();
    captureSource.connect(captureDest);
    
    // 3. Setup MediaRecorder with chosen container format
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const finalTracks = [...canvasStream.getVideoTracks(), ...captureDest.stream.getAudioTracks()];
    const finalStream = new MediaStream(finalTracks);
    
    const mimeType = getMimeTypeForFormat(exportFormat);
    const options = mimeType ? { mimeType } : undefined;
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
    setCurrentTime(0);
    setIsPlaying(true);
    
    finalRecorder.start(100);
    captureSource.start(0);
    
    const pStartTime = performance.now();
    
    const monitorProgress = () => {
      if (finalRecorder.state === 'inactive') return;
      const elapsed = (performance.now() - pStartTime) / 1000;
      setProgress(Math.min((elapsed / audioDuration) * 100, 100));
      
      if (elapsed >= audioDuration) {
        finalRecorder.stop();
        setIsPlaying(false);
        audioCtx.close();
      } else {
        requestAnimationFrame(monitorProgress);
      }
    };
    
    monitorProgress();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#0d0d0d] border border-white/10 rounded p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-[2px]">Export Video</h2>
          {!isExporting && (
            <button onClick={onClose} className="text-slate-500 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {!audioFile ? (
          <div className="text-center text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">
            NO AUDIO LOADED
          </div>
        ) : isExporting ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-[#00e676] mb-2">
              <Loader2 className="animate-spin" size={16} />
              <span className="font-bold text-xs uppercase tracking-wider">Rendering Video...</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00e676] transition-all duration-300 ease-linear shadow-[0_0_8px_#00e676]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center text-[10px] font-mono text-slate-500">
              {Math.round(progress)}% COMPLETE - DO NOT CLOSE TAB
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider block">Format</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setExportFormat('webm')}
                  className={cn(
                    "flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest border transition-all",
                    exportFormat === 'webm'
                      ? "bg-[#00e676]/10 border-[#00e676] text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  WebM (Fast)
                </button>
                <button 
                  onClick={() => setExportFormat('mp4')}
                  className={cn(
                    "flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest border transition-all",
                    exportFormat === 'mp4'
                      ? "bg-[#00e676]/10 border-[#00e676] text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  MP4
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
              [SYSTEM] Export happens in real-time via canvas capture. 
              ESTIMATED TIME: {Math.round(audioDuration)}s.
            </p>

            <button
              onClick={handleExport}
              className="w-full py-3 bg-[#00e676] hover:bg-[#00c867] text-black font-black uppercase tracking-widest text-xs rounded transition-colors"
            >
              Start Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
