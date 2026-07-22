import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
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
  
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  
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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }

  return (
    <footer className="h-24 bg-[#0a0a0a] border-t border-white/5 flex flex-col relative z-20">
      <div className="flex-1 flex items-center px-6 gap-6 sm:gap-8">
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            crossOrigin="anonymous"
          />
        )}
        
        {/* Audio Meta */}
        <div className="hidden sm:flex items-center gap-4 w-[240px]">
          <div className="w-10 h-10 bg-white/5 rounded border border-white/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          {audioFile ? (
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate max-w-[150px]">{audioFile.name}</p>
              <p className="text-[10px] font-mono text-slate-500">READY</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-500">NO AUDIO</p>
            </div>
          )}
        </div>
        
        {/* Playback Controls */}
        <div className="flex-1 flex flex-col gap-2">
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
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
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
            
            <button className="text-slate-400 hover:text-white transition-colors">
              <SkipForward size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono w-10 text-right text-slate-400">{formatTime(currentTime)}</span>
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
            <span className="text-[10px] font-mono w-10 text-slate-400">{formatTime(audioDuration)}</span>
          </div>
        </div>
        
        {/* Secondary Controls */}
        <div className="w-[120px] sm:w-[240px] flex justify-end items-center gap-4">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-slate-500" />
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
