import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, TimelineClip } from '../../store/useMVStore';
import { Play, Pause, Maximize2, Monitor, Smartphone, Square } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVPreview() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const currentTime = useStore(s => s.currentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const audioDuration = useStore(s => s.audioDuration);

  const timelineClips = useMVStore(s => s.timelineClips);
  const videoAssets = useMVStore(s => s.videoAssets);
  const wordTimings = useMVStore(s => s.wordTimings);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeClip, setActiveClip] = useState<TimelineClip | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  // Find active clip on timeline
  useEffect(() => {
    const currentClip = timelineClips.find(c => currentTime >= c.startTime && currentTime <= c.endTime);

    if (currentClip) {
      if (activeClip?.id !== currentClip.id) {
        setActiveClip(currentClip);
        const asset = videoAssets.find(v => v.id === currentClip.assetId);

        if (asset && currentClip.mediaType === 'video' && videoRef.current) {
          videoRef.current.src = asset.url;
          const offsetInsideClip = currentTime - currentClip.startTime;
          videoRef.current.currentTime = currentClip.trimStart + offsetInsideClip;
          if (isPlaying) {
            videoRef.current.play().catch(() => {});
          }
        }
      } else if (currentClip.mediaType === 'video' && videoRef.current && isPlaying) {
        const expectedTime = currentClip.trimStart + (currentTime - currentClip.startTime);
        if (Math.abs(videoRef.current.currentTime - expectedTime) > 0.25) {
          videoRef.current.currentTime = expectedTime;
        }
      }
    } else {
      if (activeClip !== null) {
        setActiveClip(null);
        if (videoRef.current) {
          videoRef.current.src = '';
        }
      }
    }
  }, [currentTime, timelineClips, activeClip, videoAssets, isPlaying]);

  useEffect(() => {
    if (videoRef.current && activeClip?.mediaType === 'video') {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, activeClip]);

  // Find active lyrics line and highlighted word
  const activeLyricLine = wordTimings.find(t => currentTime >= t.startTime && currentTime <= t.endTime);

  const activeAsset = activeClip ? videoAssets.find(v => v.id === activeClip.assetId) : null;

  // Compute Ken Burns CSS class for images
  const getKenBurnsStyle = (effect?: string, clipProgress = 0) => {
    switch (effect) {
      case 'ken-burns-in':
        return { transform: `scale(${1 + clipProgress * 0.18})` };
      case 'ken-burns-out':
        return { transform: `scale(${1.18 - clipProgress * 0.18})` };
      case 'pan-left':
        return { transform: `translateX(${-clipProgress * 10}%) scale(1.1)` };
      case 'pan-right':
        return { transform: `translateX(${clipProgress * 10}%) scale(1.1)` };
      case 'pan-up':
        return { transform: `translateY(${-clipProgress * 10}%) scale(1.1)` };
      case 'pan-down':
        return { transform: `translateY(${clipProgress * 10}%) scale(1.1)` };
      default:
        return { transform: 'scale(1.05)' };
    }
  };

  const clipProgress = activeClip ? (currentTime - activeClip.startTime) / (activeClip.endTime - activeClip.startTime || 1) : 0;

  const aspectRatioVal = aspectRatio === '9:16' ? '9/16' : aspectRatio === '1:1' ? '1/1' : '16/9';

  // Hidden Canvas for Exporting via ExportModal
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animFrame: number;
    
    const drawToExportCanvas = () => {
      const canvas = exportCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set resolution based on aspect ratio (e.g. 1080p base)
      const baseRes = 1080;
      if (aspectRatio === '16:9') {
        canvas.width = baseRes * (16/9);
        canvas.height = baseRes;
      } else if (aspectRatio === '9:16') {
        canvas.width = baseRes * (9/16);
        canvas.height = baseRes;
      } else {
        canvas.width = baseRes;
        canvas.height = baseRes;
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (activeAsset) {
        if (activeAsset.mediaType === 'video' && videoRef.current && videoRef.current.readyState >= 2) {
          // Draw video covering canvas
          const vRatio = (canvas.width / canvas.height) > (videoRef.current.videoWidth / videoRef.current.videoHeight) 
            ? canvas.width / videoRef.current.videoWidth 
            : canvas.height / videoRef.current.videoHeight;
          const cx = (canvas.width - videoRef.current.videoWidth * vRatio) / 2;
          const cy = (canvas.height - videoRef.current.videoHeight * vRatio) / 2;
          ctx.drawImage(videoRef.current, cx, cy, videoRef.current.videoWidth * vRatio, videoRef.current.videoHeight * vRatio);
        } else if (activeAsset.mediaType === 'image') {
          // Find image element in DOM
          const imgEl = document.getElementById('mv-active-image') as HTMLImageElement;
          if (imgEl && imgEl.complete) {
            ctx.save();
            // Apply simple Ken Burns approximation for export canvas
            const scale = 1 + (clipProgress * 0.15); // Base scale animation
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            
            const iRatio = (canvas.width / canvas.height) > (imgEl.naturalWidth / imgEl.naturalHeight) 
              ? canvas.width / imgEl.naturalWidth 
              : canvas.height / imgEl.naturalHeight;
            
            ctx.drawImage(imgEl, -(imgEl.naturalWidth * iRatio) / 2, -(imgEl.naturalHeight * iRatio) / 2, imgEl.naturalWidth * iRatio, imgEl.naturalHeight * iRatio);
            ctx.restore();
          }
        }
      }

      // Draw lyrics on export canvas
      const currentLyricLine = useMVStore.getState().wordTimings.find(t => currentTime >= t.startTime && currentTime <= t.endTime);
      if (currentLyricLine) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height - 120, canvas.width, 100);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(currentLyricLine.text, canvas.width / 2, canvas.height - 60);
      }

      animFrame = requestAnimationFrame(drawToExportCanvas);
    };

    animFrame = requestAnimationFrame(drawToExportCanvas);
    return () => cancelAnimationFrame(animFrame);
  }, [activeAsset, aspectRatio, clipProgress, currentTime]);

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-1.5 sm:p-2 overflow-hidden gap-1.5 sm:gap-2">
      <canvas id="visualizer-canvas" ref={exportCanvasRef} style={{ display: 'none' }} />
      {/* Top Header Controls: Aspect Ratio */}
      <div className="flex items-center justify-center w-full shrink-0 px-2.5 py-1 bg-black/60 border border-white/10 rounded-full text-[10px] text-slate-400 backdrop-blur-md max-w-[280px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAspectRatio('16:9')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '16:9' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Monitor size={11} />
            <span>16:9</span>
          </button>
          <button
            onClick={() => setAspectRatio('9:16')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '9:16' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Smartphone size={11} />
            <span>9:16</span>
          </button>
          <button
            onClick={() => setAspectRatio('1:1')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium"
            style={aspectRatio === '1:1' ? { backgroundColor: activeColor, color: '#000', fontWeight: 'bold' } : {}}
          >
            <Square size={11} />
            <span>1:1</span>
          </button>
        </div>
      </div>

      {/* Main Stage Canvas Area - Perfectly Proportional & Non-Overflowing */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative overflow-hidden p-1">
        <div 
          className="bg-black rounded-xl overflow-hidden relative shadow-2xl ring-1 ring-white/20 flex items-center justify-center transition-all duration-300"
          style={{
            aspectRatio: aspectRatioVal,
            maxHeight: '100%',
            maxWidth: '100%',
            height: '100%',
            width: 'auto',
          }}
        >
          {activeAsset ? (
            activeAsset.mediaType === 'video' ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : (
              <div className="w-full h-full overflow-hidden relative">
                <img
                  id="mv-active-image"
                  src={activeAsset.url || activeAsset.thumbnail}
                  alt={activeAsset.name}
                  style={getKenBurnsStyle(activeClip?.effect, clipProgress)}
                  className="w-full h-full object-cover transition-transform duration-100 ease-linear"
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-4 text-center text-slate-600 select-none">
              <span className="font-mono text-[11px] tracking-widest uppercase text-slate-400 font-bold">No Active Clip</span>
              <span className="text-[10px] text-slate-500 max-w-[200px]">Click Auto Edit on the right panel to generate music video clips</span>
            </div>
          )}

          {/* Synchronized Word Captions Overlay */}
          {activeLyricLine && (
            <div className="absolute bottom-4 inset-x-3 flex flex-col items-center justify-center pointer-events-none z-20">
              <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-center max-w-[95%] shadow-2xl">
                {activeLyricLine.words && activeLyricLine.words.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1 text-xs sm:text-sm md:text-base font-black tracking-wide">
                    {activeLyricLine.words.map((w, idx) => {
                      const isWordActive = currentTime >= w.start && currentTime <= w.end;
                      return (
                        <span
                          key={idx}
                          className={`transition-all duration-100 ${
                            isWordActive
                              ? 'text-yellow-300 scale-110 drop-shadow-[0_0_10px_rgba(253,224,71,0.9)] uppercase font-extrabold'
                              : 'text-white/80'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white font-extrabold text-xs sm:text-sm tracking-wide drop-shadow-md">
                    {activeLyricLine.text}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timecode & Studio Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
            <div className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-white font-mono text-[9px] font-bold shadow-md border border-white/10">
              {formatTime(currentTime)} / {formatTime(audioDuration || 0)}
            </div>
            <div className="bg-purple-900/80 backdrop-blur-md px-2 py-0.5 rounded text-purple-200 font-mono text-[8px] font-extrabold shadow-md border border-purple-500/40 uppercase tracking-wider">
              Auto MV Preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
