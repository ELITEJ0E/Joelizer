import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore, TimelineClip } from '../../store/useMVStore';
import { Play, Pause, Maximize2, Monitor, Smartphone, Square } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVPreview() {
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

  const aspectClass = aspectRatio === '9:16' ? 'aspect-[9/16] h-[380px]' : aspectRatio === '1:1' ? 'aspect-square h-[360px]' : 'aspect-video w-full max-w-[720px]';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3 p-2">
      {/* Aspect Ratio Selector */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-[10px] text-slate-400">
        <button
          onClick={() => setAspectRatio('16:9')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${aspectRatio === '16:9' ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
        >
          <Monitor size={11} />
          16:9
        </button>
        <button
          onClick={() => setAspectRatio('9:16')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${aspectRatio === '9:16' ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
        >
          <Smartphone size={11} />
          9:16 Shorts
        </button>
        <button
          onClick={() => setAspectRatio('1:1')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${aspectRatio === '1:1' ? 'bg-purple-600 text-white font-bold' : 'hover:text-white'}`}
        >
          <Square size={11} />
          1:1
        </button>
      </div>

      {/* Main Stage Canvas */}
      <div className={`${aspectClass} bg-black rounded-lg overflow-hidden relative shadow-2xl ring-1 ring-white/15 flex items-center justify-center transition-all duration-300`}>
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
                src={activeAsset.url || activeAsset.thumbnail}
                alt={activeAsset.name}
                style={getKenBurnsStyle(activeClip?.effect, clipProgress)}
                className="w-full h-full object-cover transition-transform duration-100 ease-linear"
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <span className="font-mono text-xs tracking-widest uppercase">No Active Clip</span>
            <span className="text-[10px] text-slate-500">Click Auto Edit to generate timeline</span>
          </div>
        )}

        {/* Synchronized Word Captions Overlay */}
        {activeLyricLine && (
          <div className="absolute bottom-6 inset-x-4 flex flex-col items-center justify-center pointer-events-none z-20">
            <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20 text-center max-w-[90%] shadow-2xl">
              {activeLyricLine.words && activeLyricLine.words.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-base md:text-lg font-black tracking-wide">
                  {activeLyricLine.words.map((w, idx) => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <span
                        key={idx}
                        className={`transition-all duration-100 ${
                          isWordActive
                            ? 'text-yellow-300 scale-110 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)] uppercase font-extrabold'
                            : 'text-white/80'
                        }`}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white font-extrabold text-base tracking-wide drop-shadow-md">
                  {activeLyricLine.text}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Timecode Overlay */}
        <div className="absolute top-3 left-3 bg-black/75 backdrop-blur px-2 py-0.5 rounded text-white font-mono text-[11px] font-bold shadow-md border border-white/10 z-20">
          {formatTime(currentTime)} / {formatTime(audioDuration || 0)}
        </div>
      </div>

      {/* Playhead Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-transform active:scale-95"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
      </div>
    </div>
  );
}
