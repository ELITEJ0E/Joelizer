import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, Loader2 } from 'lucide-react';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);

  // Note: True deterministic offline rendering using OfflineAudioContext + WebCodecs
  // is quite complex. For this pass, we are using the reliable MediaRecorder + captureStream
  // approach that records the canvas in real-time as the audio plays.
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
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    // Optionally connect to destination to hear it during export
    source.connect(audioCtx.destination);

    // 3. Setup MediaRecorder
    const canvasStream = canvas.captureStream(30); // 30 FPS
    
    // Combine video and audio tracks
    const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const stream = new MediaStream(tracks);
    
    const recorder = new MediaRecorder(stream, { 
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus' 
        : 'video/webm' 
    });
    
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'joelizer-export.webm';
      a.click();
      
      URL.revokeObjectURL(url);
      setIsExporting(false);
      onClose();
    };

    // 4. Start recording and audio
    recorder.start(100); // collect data every 100ms
    source.start(0);
    
    // 5. Update progress (since this is real-time capture)
    const startTime = audioCtx.currentTime;
    
    const updateProgress = () => {
      if (recorder.state === 'inactive') return;
      
      const elapsed = audioCtx.currentTime - startTime;
      const pct = Math.min((elapsed / audioDuration) * 100, 100);
      setProgress(pct);
      
      // Update store so visualizer draws (it reads from audioManager which uses an <audio> tag)
      // Actually, our preview uses an <audio> tag. The source we just created is independent.
      // For a true real-time capture of our preview, we just need to play the main audio tag
      // and capture the canvas.
      
      if (elapsed < audioDuration) {
        requestAnimationFrame(updateProgress);
      }
    };
    
    // Wait, the preview draws based on `audioManager` which listens to the main `<audio>` element.
    // If we play `source` via `AudioContext`, `audioManager` won't "see" it.
    // To make it see it, we need to actually just play the store's audio and capture the stream!
    
    // Let's cancel the offline source approach and just drive the existing player
    source.disconnect();
    audioCtx.close();
    
    // ---- REALTIME PREVIEW CAPTURE ----
    const mainStream = new MediaStream(canvas.captureStream(30).getVideoTracks());
    
    // We need to capture the audio from the <audio> element.
    // However, Web Audio API doesn't easily let us capture a MediaElementAudioSourceNode 
    // without reconnecting it to a MediaStreamDestination. 
    // So let's just do a WebM without audio for this simple MVP, or we can use the source buffer.
    
    // Let's do the proper way: we will use the audio buffer we decoded to provide the audio track
    // while we play the main store audio to drive the visualizer.
    
    const captureAudioCtx = new window.AudioContext();
    const captureSource = captureAudioCtx.createBufferSource();
    captureSource.buffer = audioBuffer;
    const captureDest = captureAudioCtx.createMediaStreamDestination();
    captureSource.connect(captureDest);
    
    const finalTracks = [...canvas.captureStream(30).getVideoTracks(), ...captureDest.stream.getAudioTracks()];
    const finalStream = new MediaStream(finalTracks);
    
    const finalRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
    const finalChunks: Blob[] = [];
    
    finalRecorder.ondataavailable = e => {
      if (e.data.size > 0) finalChunks.push(e.data);
    };
    
    finalRecorder.onstop = () => {
      const blob = new Blob(finalChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'joelizer-export.webm';
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
                <button className="flex-1 py-2 rounded bg-[#00e676]/10 border border-[#00e676] text-white text-[10px] font-bold uppercase tracking-widest">
                  WebM (Fast)
                </button>
                <button disabled className="flex-1 py-2 rounded bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed">
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
