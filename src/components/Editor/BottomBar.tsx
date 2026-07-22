import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { Scrubber } from '../ui/scrubber';

export function BottomBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useStore(s => s.audioUrl);
  const audioFile = useStore(s => s.audioFile);
  const currentTime = useStore(s => s.currentTime);
  const audioDuration = useStore(s => s.audioDuration);
  const isPlaying = useStore(s => s.isPlaying);
  const isLooping = useStore(s => s.isLooping);
  
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setIsLooping = useStore(s => s.setIsLooping);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioManager.init(audioRef.current);
    }
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error('Auto-play prevented', e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  return (
    <footer className="h-24 bg-black/40 backdrop-blur-xl border-t border-white/10 flex flex-col relative z-20">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="flex-1 flex items-center px-6 gap-6 sm:gap-8">
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              if (!isLooping) setIsPlaying(false);
            }}
            crossOrigin="anonymous"
          />
        )}
        
        {/* Audio Meta */}
        <div className="hidden sm:flex items-center gap-4 w-[240px]">
          <div 
            className="w-10 h-10 rounded-md border border-white/10 flex items-center justify-center transition-all duration-300"
            style={{ 
              backgroundColor: audioUrl ? `${activeColor}15` : 'rgba(255,255,255,0.02)',
              boxShadow: audioUrl ? `0 0 15px ${activeColor}20` : 'none',
              borderColor: audioUrl ? `${activeColor}40` : 'rgba(255,255,255,0.1)'
            }}
          >
            <svg 
              className="w-5 h-5 transition-colors duration-300" 
              style={{ color: audioUrl ? activeColor : 'rgba(255,255,255,0.3)' }}
              fill="currentColor" viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          {audioFile ? (
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate max-w-[150px] tracking-wide">{audioFile.name}</p>
              <p className="text-[9px] font-mono font-bold tracking-widest mt-0.5" style={{ color: activeColor }}>READY TO RENDER</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">NO AUDIO LOADED</p>
            </div>
          )}
        </div>
        
        {/* Playback Controls */}
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="flex items-center justify-center gap-6">
            <button 
              className="text-slate-400 hover:text-white transition-colors"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
            >
              <SkipBack size={18} />
            </button>
            
            <button 
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 active:scale-90"
              style={audioUrl ? {
                background: `linear-gradient(135deg, ${activeColor}, #ffffff)`,
                boxShadow: `0 0 20px ${activeColor}50`,
                color: '#000000'
              } : {
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)'
              }}
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (!isPlaying) {
                   const audioCtx = (window as any).webkitAudioContext || window.AudioContext;
                   if ((audioManager as any).ctx?.state === 'suspended') {
                     (audioManager as any).ctx.resume();
                   }
                }
              }}
              disabled={!audioUrl}
            >
              {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
            </button>
            
            <button 
              className="text-slate-400 hover:text-white transition-colors"
              style={{ color: isLooping ? activeColor : undefined }}
              onClick={() => setIsLooping(!isLooping)}
            >
              <Repeat size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <span 
              className="text-[10px] font-mono font-bold w-10 text-right tabular-nums transition-colors"
              style={{ color: audioUrl ? activeColor : 'rgba(255,255,255,0.3)' }}
            >
              {formatTime(currentTime)}
            </span>
            <Scrubber 
              value={currentTime}
              min={0}
              max={audioDuration || 100}
              step={0.01}
              onChange={(time) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = time;
                  setCurrentTime(time);
                }
              }}
              disabled={!audioUrl}
              formatTooltip={formatTime}
              className="flex-1"
            />
            <span className="text-[10px] font-mono font-bold w-10 text-slate-400 tabular-nums">{formatTime(audioDuration)}</span>
          </div>
        </div>
        
        {/* Secondary Controls */}
        <div className="w-[120px] sm:w-[240px] flex justify-end items-center gap-4">
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-4 py-2 rounded-full">
            <Volume2 size={13} className="text-slate-400" />
            <Scrubber 
              value={volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => {
                setVolume(v);
                if (audioRef.current) {
                  audioRef.current.volume = v;
                }
              }}
              disabled={!audioUrl}
              formatTooltip={(v) => `${(v * 100).toFixed(0)}%`}
              className="w-16 sm:w-20"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
