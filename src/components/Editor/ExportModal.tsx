import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import fixWebmDuration from 'fix-webm-duration';
import { useStore } from '../../store/useStore';
import { X, Loader2, Download, Zap, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { animate, stagger } from 'animejs';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { ExportRangeSlider } from './ExportRangeSlider';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { handleClose } = usePopstateModal(true, onClose);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPhase, setExportPhase] = useState<'recording' | 'encoding'>('recording');
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('webm');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [batchMode, setBatchMode] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const tracks = useStore(s => s.tracks);

  // Custom performance optimization settings
  const [resolution, setResolution] = useState<'360p' | '720p' | '1080p'>('720p');
  const [fps, setFps] = useState<15 | 30 | 60>(30);
  const [bitrate, setBitrate] = useState<1500000 | 4000000 | 8000000>(4000000);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const audioFile = useStore(s => s.audioFile);
  const audioDuration = useStore(s => s.audioDuration);
  const projectName = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setExportResolutionOverride = useStore(s => s.setExportResolutionOverride);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  const exportRangeStart = useStore(s => s.exportRangeStart);
  const exportRangeEnd = useStore(s => s.exportRangeEnd) !== null ? useStore(s => s.exportRangeEnd)! : audioDuration;
  const setExportRange = useStore(s => s.setExportRange);

  // Apply Quick Presets
  const applyPreset = (preset: 'turbo' | 'balanced' | 'quality') => {
    if (preset === 'turbo') {
      setResolution('360p');
      setFps(30);
      setBitrate(1500000);
    } else if (preset === 'balanced') {
      setResolution('720p');
      setFps(30);
      setBitrate(4000000);
    } else if (preset === 'quality') {
      setResolution('1080p');
      setFps(60);
      setBitrate(8000000);
    }
  };

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
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
      // Ensure export is safely cancelled and override & playback speed are cleared on unmount
      const audioEl = document.querySelector('audio');
      if (audioEl) {
        audioEl.playbackRate = 1.0;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        isCancelledRef.current = true;
        try {
          recorderRef.current.onstop = null;
          recorderRef.current.stop();
        } catch (_) {}
      }
      useStore.getState().setExportResolutionOverride(null);
    };
  }, []);

  const handleCancelExport = () => {
    isCancelledRef.current = true;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.playbackRate = 1.0;
      audioEl.currentTime = 0;
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null; // Prevent file download
      try {
        recorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping recorder on cancel:', err);
      }
    }
    recorderRef.current = null;
    setIsPlaying(false);
    setExportResolutionOverride(null);
    setIsExporting(false);
    setProgress(0);
    setCurrentTime(0);
  };

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
    const audioUrl = useStore.getState().audioUrl;
    if (!audioFile && !audioUrl) return;
    isCancelledRef.current = false;
    setIsExporting(true);
    setProgress(0);

    // 0. Ensure audio element and audioManager are initialized and unmuted
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioManager.init(audioEl);
      audioManager.resume();
      audioEl.muted = false;
      if (audioEl.volume === 0) audioEl.volume = 1.0;
    }

    // Apply the active canvas resolution override (resizes canvas for faster frame processing)
    setExportResolutionOverride(resolution);
    
    // Let layout flush so the canvas dimension state can update
    await new Promise(resolve => setTimeout(resolve, 150));
    if (isCancelledRef.current) return;

    // 1. Get the actual preview canvas from the DOM
    const canvas = document.getElementById('visualizer-canvas') as HTMLCanvasElement || document.querySelector('canvas');
    if (!canvas) {
      setExportResolutionOverride(null);
      setIsExporting(false);
      return;
    }

    // 2. Get audio stream from audioManager or HTML5 audio fallback
    let audioStream = audioManager.getMediaStream();
    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      if (audioEl) {
        try {
          const elStream = (audioEl as any).captureStream ? (audioEl as any).captureStream() : ((audioEl as any).mozCaptureStream ? (audioEl as any).mozCaptureStream() : null);
          if (elStream && elStream.getAudioTracks().length > 0) {
            audioStream = elStream;
          }
        } catch (e) {
          console.warn('Fallback audio stream capture from audio element failed:', e);
        }
      }
    }
    
    // 3. Setup MediaRecorder with chosen container format, optimized FPS and bitrate
    const canvasStream = canvas.captureStream(fps);
    const finalTracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
      const aTracks = audioStream.getAudioTracks();
      if (aTracks.length > 0) {
        finalTracks.push(...aTracks);
      }
    }
    
    const finalStream = new MediaStream(finalTracks);

    const createRecorder = (stream: MediaStream, prefFormat: 'webm' | 'mp4', targetBitrate: number) => {
      const candidates: string[] = [];
      if (prefFormat === 'mp4') {
        candidates.push(
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=h264,aac',
          'video/mp4;codecs=h264,mp3',
          'video/mp4;codecs=h264',
          'video/mp4'
        );
      }
      candidates.push(
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/ogg'
      );

      for (const mimeType of candidates) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          try {
            const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: targetBitrate });
            return { recorder: rec, mimeType };
          } catch (e) {
            console.warn(`Failed creating MediaRecorder for ${mimeType} with bitrate ${targetBitrate}:`, e);
          }
        }
      }

      for (const mimeType of candidates) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          try {
            const rec = new MediaRecorder(stream, { mimeType });
            return { recorder: rec, mimeType };
          } catch (e) {
            console.warn(`Failed creating MediaRecorder for ${mimeType}:`, e);
          }
        }
      }

      const rec = new MediaRecorder(stream);
      return { recorder: rec, mimeType: rec.mimeType || 'video/webm' };
    };

    let finalRecorder: MediaRecorder;
    let mimeType = '';
    try {
      const result = createRecorder(finalStream, exportFormat, bitrate);
      finalRecorder = result.recorder;
      mimeType = result.mimeType;
    } catch (err) {
      console.error('Fatal error initializing MediaRecorder:', err);
      alert('Your browser does not support encoding video recordings with the selected options. Please try WebM format.');
      setExportResolutionOverride(null);
      setIsExporting(false);
      return;
    }

    recorderRef.current = finalRecorder;
    const finalChunks: Blob[] = [];
    
    finalRecorder.ondataavailable = e => {
      if (e.data.size > 0) finalChunks.push(e.data);
    };
    
    finalRecorder.onstop = () => {
      if (audioEl) {
        audioEl.playbackRate = 1.0;
        audioEl.currentTime = 0;
        audioEl.removeEventListener('pause', handlePauseDuringExport);
      }
      if (isCancelledRef.current) return;
      setExportResolutionOverride(null);

      const actualExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const rawBlob = new Blob(finalChunks, { type: mimeType || 'video/webm' });
      const recordedDuration = exportRangeEnd - exportRangeStart;
      const durationMs = Math.round((recordedDuration || 0) * 1000);

      const triggerDownload = (downloadBlob: Blob, forcedExt?: string) => {
        if (isCancelledRef.current) return;
        const url = URL.createObjectURL(downloadBlob);
        const a = document.createElement('a');
        a.href = url;
        
        const safeProjectName = projectName ? projectName.trim() : '';
        const baseName = safeProjectName ? safeProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'visualizer';
        
        const isFull = exportRangeStart === 0 && (exportRangeEnd === audioDuration || Math.abs(exportRangeEnd - audioDuration) < 0.1);
        let rangeSuffix = '';
        if (!isFull) {
          const startMin = Math.floor(exportRangeStart / 60).toString().padStart(2, '0');
          const startSec = Math.floor(exportRangeStart % 60).toString().padStart(2, '0');
          const endMin = Math.floor(exportRangeEnd / 60).toString().padStart(2, '0');
          const endSec = Math.floor(exportRangeEnd % 60).toString().padStart(2, '0');
          rangeSuffix = `_${startMin}-${startSec}to${endMin}-${endSec}`;
        }
        a.download = `${baseName}${rangeSuffix}.${forcedExt || actualExt}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        setCurrentTime(0);
        setIsExporting(false);
        setExportPhase('recording');
        onClose();
      };

      const runFfmpegWithTimeout = async (blob: Blob) => {
        setExportPhase('encoding');
        setProgress(0);
        let ffmpegDone = false;

        const timeoutId = setTimeout(() => {
          if (!ffmpegDone && !isCancelledRef.current) {
            console.warn("FFmpeg load/transcode timed out. Falling back to high-quality WebM export.");
            triggerDownload(blob, 'webm');
          }
        }, 12000);

        try {
          const ffmpeg = ffmpegRef.current;
          if (!ffmpeg) throw new Error("FFmpeg not initialized");
          if (!ffmpeg.loaded) {
            await ffmpeg.load({
              coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
              wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
            });
          }
          
          ffmpeg.on('progress', ({ progress: p }) => {
            setProgress(Math.round(p * 100));
          });

          const inputName = `input.${actualExt}`;
          const outputName = `output.mp4`;
          
          const arrayBuffer = await blob.arrayBuffer();
          await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
          
          const ratio = useStore.getState().aspectRatio === '16:9' ? 16/9 : 
                        useStore.getState().aspectRatio === '9:16' ? 9/16 : 
                        useStore.getState().aspectRatio === '1:1' ? 1 : 4/5;
          const isPortrait = ratio < 1;
          let baseWidth = isPortrait ? 1080 : 1920;
          if (resolution === '720p') {
            baseWidth = isPortrait ? 720 : 1280;
          } else if (resolution === '360p') {
            baseWidth = isPortrait ? 360 : 640;
          }
          const baseHeight = Math.round(baseWidth / ratio);
          
          const vf = `scale=${baseWidth}:${baseHeight}`;
          const args = ['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', `${Math.round(bitrate / 1000)}k`, '-vf', vf, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outputName];
          
          await ffmpeg.exec(args);
          ffmpegDone = true;
          clearTimeout(timeoutId);
          
          const data = await ffmpeg.readFile(outputName);
          const finalBlob = new Blob([data], { type: 'video/mp4' });
          
          triggerDownload(finalBlob, 'mp4');
        } catch (e) {
          ffmpegDone = true;
          clearTimeout(timeoutId);
          console.error("FFmpeg encoding failed:", e);
          triggerDownload(blob, 'webm');
        }
      };

      const processAndDownload = (blob: Blob) => {
        if (exportFormat === 'webm') {
          // Direct WebM download with fixed duration metadata - fast & 100% reliable
          triggerDownload(blob, 'webm');
        } else if (exportFormat === 'mp4' && actualExt === 'mp4') {
          // Native MP4 recording
          triggerDownload(blob, 'mp4');
        } else {
          // Transcode WebM to MP4 using FFmpeg WASM
          runFfmpegWithTimeout(blob);
        }
      };

      if (durationMs > 0 && (mimeType.includes('webm') || !mimeType)) {
        try {
          fixWebmDuration(rawBlob, durationMs, (fixedBlob) => {
            processAndDownload(fixedBlob);
          }, { logger: false });
        } catch (e) {
          console.warn('fixWebmDuration failed, falling back:', e);
          processAndDownload(rawBlob);
        }
      } else {
        processAndDownload(rawBlob);
      }
    };

    let isExportFinished = false;

    finalRecorder.onerror = () => {
      if (audioEl) {
        audioEl.playbackRate = 1.0;
        audioEl.removeEventListener('pause', handlePauseDuringExport);
      }
      if (isCancelledRef.current) return;
      setExportResolutionOverride(null);
      setIsExporting(false);
    };

    const handlePauseDuringExport = () => {
      if (!isExportFinished && !isCancelledRef.current && audioEl && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
    };
    
    // Start playback and recording at normal 1.0x speed
    if (audioEl) {
      audioEl.currentTime = exportRangeStart;
      audioEl.playbackRate = 1.0;
      audioEl.addEventListener('pause', handlePauseDuringExport);
      audioEl.play().catch(e => console.warn('Export auto-play:', e));
    }
    setCurrentTime(exportRangeStart);
    setIsPlaying(true);
    
    try {
      finalRecorder.start(100);
    } catch (e) {
      console.error('Failed to start MediaRecorder:', e);
      alert('Could not start recording. Please try WebM format or a lower resolution.');
      setExportResolutionOverride(null);
      setIsExporting(false);
      return;
    }
    
    const pStartTime = performance.now();
    
    const finishExport = () => {
      if (isExportFinished) return;
      isExportFinished = true;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      if (audioEl) {
        audioEl.playbackRate = 1.0;
        audioEl.currentTime = 0;
        audioEl.removeEventListener('pause', handlePauseDuringExport);
        audioEl.pause();
      }

      setProgress(100);

      if (!isCancelledRef.current && finalRecorder.state !== 'inactive') {
        try {
          finalRecorder.stop();
        } catch (e) {
          console.warn('Final recorder stop error:', e);
        }
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setExportResolutionOverride(null);
    };

    let lastTimeUpdate = 0;

    const monitorProgress = () => {
      if (isCancelledRef.current || isExportFinished) return;
      if (finalRecorder.state === 'inactive') return;

      const now = performance.now();
      const realElapsed = ((now - pStartTime) / 1000) + exportRangeStart;
      const audioElapsed = audioEl ? audioEl.currentTime : realElapsed;
      const effectiveElapsed = Math.max(audioElapsed, realElapsed);

      const recordedSoFar = effectiveElapsed - exportRangeStart;
      const totalToRecord = exportRangeEnd - exportRangeStart;

      const currentProgress = Math.min((recordedSoFar / (totalToRecord || 0.1)) * 100, 100);
      setProgress(currentProgress);

      if (effectiveElapsed >= exportRangeEnd - 0.25 || (audioEl && (audioEl.ended || audioEl.currentTime >= exportRangeEnd - 0.25))) {
        finishExport();
      } else {
        if (audioEl && !isExportFinished) {
          if (audioEl.playbackRate !== 1.0) {
            audioEl.playbackRate = 1.0;
          }
          if (audioEl.paused && !isCancelledRef.current) {
            audioEl.play().catch(() => {});
          }
          if (now - lastTimeUpdate > 100) {
            setCurrentTime(audioEl.currentTime);
            lastTimeUpdate = now;
          }
        }
        animFrameRef.current = requestAnimationFrame(monitorProgress);
      }
    };
    
    animFrameRef.current = requestAnimationFrame(monitorProgress);
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

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) { if (isExporting) handleCancelExport(); else handleClose(); } }}
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="export-modal-card bg-[#0d0f12] border border-white/15 rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[88vh] my-auto">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Dynamic glow accent */}
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
              <Download size={13} style={{ color: activeColor }} />
            </div>
            <h2 className="text-xs font-mono uppercase tracking-widest font-black" style={{ color: activeColor }}>Export Video</h2>
          </div>
          
          <button 
            onClick={isExporting ? handleCancelExport : handleClose} 
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            title={isExporting ? "Cancel Export" : "Close Window"}
          >
            <X size={18} />
          </button>
        </div>

        {!audioFile ? (
          <div className="text-center text-slate-400 text-xs uppercase font-bold tracking-widest py-8 bg-white/[0.02] rounded-lg border border-white/5">
            No audio loaded
          </div>
        ) : isExporting ? (
          <div className="space-y-5 py-4 my-auto">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin" size={28} style={{ color: activeColor }} />
              <div className="text-center">
                <span className="font-mono text-xs uppercase tracking-widest font-black block" style={{ color: activeColor }}>
                  {exportPhase === 'recording' ? 'Recording Video...' : 'Encoding Video...'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase mt-0.5 block">{resolution} @ {fps}fps</span>
              </div>
            </div>

            <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
              <div 
                className="absolute top-0 bottom-0 left-0 transition-all duration-300 ease-linear rounded-full"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: activeColor,
                  boxShadow: `0 0 10px ${activeColor}80` 
                }}
              />
            </div>

            <div className="text-center text-xs font-mono text-slate-300 tabular-nums font-bold">
              {Math.round(progress)}% Complete
            </div>

            {/* Cancel Button */}
            <div className="pt-2 flex justify-center">
              <button
                onClick={handleCancelExport}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-100 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X size={14} />
                <span>Cancel Export</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3.5 pr-1 py-1">
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

            {/* Filename Input */}
            <div className="export-modal-item-anim space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-300 font-bold block">Filename</label>
              <input 
                type="text"
                value={projectName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your video file..."
                className="w-full bg-black/50 border border-white/15 focus:border-white/40 px-3 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider outline-none font-mono"
              />
            </div>

            {/* Preset Selection */}
            <div className="export-modal-item-anim space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-slate-300 font-bold block">Quality Preset</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('turbo')}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                    resolution === '360p'
                      ? "bg-white/10 border-emerald-500/80 text-white font-bold"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase text-emerald-400">⚡ Draft</span>
                  <span className="text-[9px] font-mono text-slate-400">360p • 30fps</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('balanced')}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                    resolution === '720p'
                      ? "bg-white/10 border-white/40 text-white font-bold"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                  )}
                  style={resolution === '720p' ? { borderColor: `${activeColor}80` } : {}}
                >
                  <span className="text-[10px] font-bold uppercase text-white">🚀 HD</span>
                  <span className="text-[9px] font-mono text-slate-400">720p • 30fps</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('quality')}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                    resolution === '1080p'
                      ? "bg-white/10 border-purple-500/80 text-white font-bold"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase text-purple-300">💎 Pro</span>
                  <span className="text-[9px] font-mono text-slate-400">1080p • 60fps</span>
                </button>
              </div>
            </div>

            {/* Container Format */}
            <div className="export-modal-item-anim space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-slate-300 font-bold block">Format</label>
              <div className="flex gap-2">
                {(['webm', 'mp4'] as const).map((fmt) => (
                  <button 
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      exportFormat === fmt
                        ? "text-white bg-white/10 border-white/30"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                    )}
                    style={exportFormat === fmt ? {
                      borderColor: `${activeColor}60`,
                      color: activeColor
                    } : {}}
                  >
                    {fmt === 'webm' ? 'WebM (Fast)' : 'MP4'}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Custom Settings */}
            <div className="export-modal-item-anim pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-1.5 px-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-lg text-[10px] font-mono font-bold uppercase text-slate-300 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Sliders size={12} style={{ color: activeColor }} />
                  <span>Custom Settings (Resolution, FPS, Bitrate)</span>
                </div>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3 animate-in fade-in duration-150">
                  {/* Resolution & Frame Rate */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-slate-400 font-bold block">Resolution</label>
                      <div className="flex gap-1">
                        {(['360p', '720p', '1080p'] as const).map((res) => (
                          <button 
                            key={res}
                            type="button"
                            onClick={() => setResolution(res)}
                            className={cn(
                              "flex-1 py-1.5 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer",
                              resolution === res ? "bg-white/15 border-white/40 text-white" : "bg-white/5 border-transparent text-slate-400"
                            )}
                            style={resolution === res ? { color: activeColor } : {}}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-slate-400 font-bold block">Frame Rate</label>
                      <div className="flex gap-1">
                        {([15, 30, 60] as const).map((fpsVal) => (
                          <button 
                            key={fpsVal}
                            type="button"
                            onClick={() => setFps(fpsVal)}
                            className={cn(
                              "flex-1 py-1.5 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer",
                              fps === fpsVal ? "bg-white/15 border-white/40 text-white" : "bg-white/5 border-transparent text-slate-400"
                            )}
                            style={fps === fpsVal ? { color: activeColor } : {}}
                          >
                            {fpsVal}fps
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bitrate Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-400 font-bold block">Bitrate (Quality)</label>
                    <div className="flex gap-1.5">
                      {([
                        { label: '1.5M Low', val: 1500000 as const },
                        { label: '4.0M Med', val: 4000000 as const },
                        { label: '8.0M High', val: 8000000 as const }
                      ]).map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setBitrate(item.val)}
                          className={cn(
                            "flex-1 py-1.5 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer",
                            bitrate === item.val ? "bg-white/15 border-white/40 text-white" : "bg-white/5 border-transparent text-slate-400"
                          )}
                          style={bitrate === item.val ? { color: activeColor } : {}}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Est Summary Badge */}
            <div className="export-modal-item-anim bg-white/[0.02] border border-white/10 px-3 py-2 rounded-lg flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400 font-bold">RECORDING DURATION</span>
              <span className="font-bold text-white flex items-center gap-1" style={{ color: activeColor }}>
                <Zap size={11} /> ~{Math.round((exportRangeEnd - exportRangeStart) || 0)}s ({resolution} @ {fps}fps)
              </span>
            </div>

            {/* Start Export Action */}
            <button
              onClick={handleExport}
              className="export-modal-item-anim w-full py-3 text-black font-black uppercase tracking-wider text-xs rounded-lg transition-all hover:brightness-110 active:scale-95 shadow-xl flex items-center justify-center gap-2 cursor-pointer mt-2"
              style={{
                background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                boxShadow: `0 0 20px ${activeColor}40`
              }}
            >
              <Download size={15} /> 
              <span>Start Export</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
