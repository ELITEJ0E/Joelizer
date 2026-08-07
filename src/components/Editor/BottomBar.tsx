import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, ListMusic, Music } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { audioManager } from '../../lib/audio';
import { VideoSlider } from '../ui/video-slider';

export function BottomBar() {
  const audioUrl = useStore(s => s.audioUrl);
  const audioFile = useStore(s => s.audioFile);
  const currentTime = useStore(s => s.currentTime);
  const audioDuration = useStore(s => s.audioDuration);
  const isPlaying = useStore(s => s.isPlaying);
  const isLooping = useStore(s => s.isLooping);
  const albumArt = useStore(s => s.albumArt);
  
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const nextTrack = useStore(s => s.nextTrack);
  const previousTrack = useStore(s => s.previousTrack);
  const selectTrack = useStore(s => s.selectTrack);
  
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setIsLooping = useStore(s => s.setIsLooping);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const isExporting = useStore(s => s.exportResolutionOverride !== null);
  
  const [volume, setVolume] = useState(1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const playlistRef = useRef<HTMLDivElement>(null);

  // Close playlist when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (playlistRef.current && !playlistRef.current.contains(event.target as Node)) {
        setShowPlaylist(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTrack = tracks[currentTrackIndex];

  return (
    <footer className="sticky bottom-0 left-0 right-0 z-30 shrink-0 w-full bg-[#09090b] border-t border-white/10 flex flex-col shadow-2xl py-4 sm:py-3 px-4 sm:px-6 min-h-[92px] sm:min-h-0">
      {/* Absolute high-tech accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[1.5px] transition-all duration-500" 
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${activeColor}50 50%, transparent 100%)`
        }}
      />
      
      {/* Top progress bar for mobile & desktop */}
      <div className="w-full flex items-center gap-2 mb-1.5 sm:mb-1">
        <span 
          className="text-[9px] sm:text-[10px] font-mono font-bold w-8 sm:w-9 text-right tabular-nums transition-colors shrink-0"
          style={{ color: audioUrl ? activeColor : 'rgba(255,255,255,0.3)' }}
        >
          {formatTime(currentTime)}
        </span>
        <VideoSlider 
          value={currentTime}
          min={0}
          max={audioDuration || 100}
          step={0.01}
          onChange={(time) => {
            audioManager.seek(time);
            setCurrentTime(time);
          }}
          disabled={!audioUrl}
          formatTooltip={formatTime}
          className="flex-1"
        />
        <span className="text-[9px] sm:text-[10px] font-mono font-bold w-8 sm:w-9 text-slate-400 tabular-nums shrink-0">
          {formatTime(audioDuration)}
        </span>
      </div>

      {/* Control row */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left Side: Audio Meta */}
        <div className="flex items-center gap-2 min-w-0 max-w-[120px] sm:max-w-[200px] shrink-0">
          {/* Minimal visual equalizer overlay when playing */}
          {isPlaying && (
            <div className="flex items-end gap-0.5 h-3 w-3 flex-shrink-0 mb-0.5">
              <span className="w-[1.5px] bg-current rounded-full animate-bounce h-1.5" style={{ color: activeColor, animationDelay: '0.1s', animationDuration: '0.6s' }} />
              <span className="w-[1.5px] bg-current rounded-full animate-bounce h-3" style={{ color: activeColor, animationDelay: '0.3s', animationDuration: '0.8s' }} />
              <span className="w-[1.5px] bg-current rounded-full animate-bounce h-2" style={{ color: activeColor, animationDelay: '0.5s', animationDuration: '0.7s' }} />
            </div>
          )}
          <div className="overflow-hidden min-w-0">
            {currentTrack ? (
              <>
                <p className="text-[11px] sm:text-xs font-extrabold text-white truncate hover:underline cursor-pointer tracking-wide">
                  {currentTrack.name}
                </p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate hover:text-white cursor-pointer">
                  {currentTrack.artist}
                </p>
              </>
            ) : (
              <p className="text-[9px] sm:text-[10px] font-black tracking-[1px] text-slate-500 uppercase truncate">
                NO AUDIO
              </p>
            )}
          </div>
        </div>
        
        {/* Center: Playback Controls */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 shrink-0">
          {/* Previous Button */}
          <button 
            className="text-slate-400 hover:text-white active:text-slate-300 transition-colors cursor-pointer p-1 rounded-full"
            onClick={previousTrack}
            title="Previous Track (P or Shift+←)"
          >
            <SkipBack size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          
          {/* Play/Pause Button */}
          <button 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer shadow-md"
            style={audioUrl ? {
              backgroundColor: activeColor,
              boxShadow: `0 0 16px ${activeColor}40`,
              color: '#000000'
            } : {
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)'
            }}
            onClick={() => {
              if (isExporting) return;
              setIsPlaying(!isPlaying);
              if (!isPlaying) {
                 const audioCtx = (window as any).webkitAudioContext || window.AudioContext;
                 if ((audioManager as any).ctx?.state === 'suspended') {
                   (audioManager as any).ctx.resume();
                 }
              }
            }}
            disabled={!audioUrl || isExporting}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={16} className="fill-current sm:w-[18px] sm:h-[18px]" /> : <Play size={16} className="fill-current ml-0.5 sm:w-[18px] sm:h-[18px]" />}
          </button>
          
          {/* Next Button */}
          <button 
            className="text-slate-400 hover:text-white active:text-slate-300 transition-colors cursor-pointer p-1 rounded-full"
            onClick={nextTrack}
            title="Next Track (N or Shift+→)"
          >
            <SkipForward size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          
          {/* Repeat / Looping Button */}
          <button 
            className="relative text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
            style={{ color: isLooping ? activeColor : undefined }}
            onClick={() => setIsLooping(!isLooping)}
            title={isLooping ? 'Disable Loop' : 'Enable Loop'}
          >
            <Repeat size={15} className="sm:w-[16px] sm:h-[16px]" />
          </button>
        </div>
        
        {/* Right Side: Additional controls (Queue list, volume) */}
        <div className="flex justify-end items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Playlist Drawer Button */}
          <div className="relative">
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 cursor-pointer relative"
              style={{ color: showPlaylist ? activeColor : undefined }}
              title="Toggle Queue"
            >
              <ListMusic size={16} />
            </button>
            
            {/* Floating Playlist Queue */}
            {showPlaylist && (
              <div 
                ref={playlistRef}
                className="absolute right-0 bottom-12 bg-[#0d0d0f] border border-white/10 p-3 sm:p-4 rounded-xl shadow-2xl w-72 sm:w-80 max-h-96 overflow-y-auto z-50 animate-in fade-in slide-in-from-bottom-3"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <span className="text-[10px] font-mono uppercase tracking-[3px] font-black" style={{ color: activeColor }}>
                    [ PLAYBACK QUEUE ]
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
                    {tracks.length} tracks
                  </span>
                </div>
                
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {tracks.map((track, i) => {
                    const isActive = currentTrackIndex === i;
                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          selectTrack(i);
                          setShowPlaylist(false);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isActive 
                            ? 'bg-white/[0.06] border border-white/10' 
                            : 'hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="w-6 text-[10px] font-mono text-slate-500 text-center flex-shrink-0">
                          {isActive && isPlaying ? (
                            <span className="text-xs animate-pulse" style={{ color: activeColor }}>▶</span>
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-300'}`} style={isActive ? { color: activeColor } : {}}>
                            {track.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                        
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatTime(track.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-2 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-full">
            <Volume2 size={13} className="text-slate-400" />
            <VideoSlider 
              value={volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => {
                setVolume(v);
                audioManager.setVolume(v);
              }}
              disabled={!audioUrl}
              formatTooltip={(v) => `${(v * 100).toFixed(0)}%`}
              className="w-14 sm:w-20"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
