import React, { useState } from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { 
  Download, Music, Play, Pause, SkipBack, SkipForward, Repeat,
  Radio
} from 'lucide-react';
import { cn, formatTime } from '../../lib/utils';
import { AudioSourceModal } from '../Audio/AudioSourceModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface TopBarProps {
  onExport: () => void;
  onOpenAudioModal?: () => void;
}

export function TopBar({ onExport, onOpenAudioModal }: TopBarProps) {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const activeTab = useStore(s => s.activeTab);
  
  const tracks = useStore(s => s.tracks);
  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const currentTrack = tracks[currentTrackIndex] || (tracks.length > 0 ? tracks[0] : null);

  const currentTime = useStore(s => s.currentTime);
  const audioDuration = useStore(s => s.audioDuration) || 0;
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsLooping = useStore(s => s.setIsLooping);
  const previousTrack = useStore(s => s.previousTrack);
  const nextTrack = useStore(s => s.nextTrack);

  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const ratios: { id: AspectRatio; label: string }[] = [
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '1:1', label: '1:1' },
    { id: '4:5', label: '4:5' },
    { id: '3:4', label: '3:4' },
    { id: '4:3', label: '4:3' },
  ];

  const formatPrecisionTimecode = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getWorkspaceTitle = () => {
    switch (activeTab) {
      case 'lrc': return 'LRC Studio';
      case 'lyrics': return 'Lyrics Video';
      case 'mv-studio': return 'MV Studio';
      default: return 'Studio';
    }
  };

  return (
    <header
      id="top-application-bar"
      aria-label="Application Top Bar"
      className="h-11 bg-[#0b0d10] border-b border-[#232933] flex items-center justify-between px-3 z-30 shrink-0 select-none text-[#f0f3f6]"
    >
      {/* LEFT: Branding + Current Workspace & Active Song */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Joelizer Wordmark */}
        <div className="flex items-center gap-2">
          {/* Audio Waveform Emblem */}
          <div className="w-5 h-5 rounded bg-[#161a20] border border-[#262c37] flex items-center justify-center p-0.5">
            <svg viewBox="0 0 24 24" className="w-full h-full text-[#00e676]" fill="currentColor">
              <rect x="2" y="10" width="2" height="4" rx="1" />
              <rect x="6" y="6" width="2" height="12" rx="1" />
              <rect x="10" y="3" width="2" height="18" rx="1" />
              <rect x="14" y="7" width="2" height="10" rx="1" />
              <rect x="18" y="11" width="2" height="2" rx="1" />
            </svg>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-xs tracking-wider text-[#f0f3f6]">
              JOELIZER
            </span>
            <span className="text-[9px] font-mono text-[#00e676] font-semibold tracking-widest hidden sm:inline">
              PRO
            </span>
          </div>
        </div>

        <div className="h-3.5 w-[1px] bg-[#262c37] hidden sm:block" />

        {/* Current Workspace Tag */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#9aa2ae] hidden md:inline">
            {getWorkspaceTitle()}
          </span>

          {currentTrack && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#13161b] border border-[#232933] text-[10px] text-[#9aa2ae] max-w-[200px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676]" />
              <span className="truncate font-medium text-[#c4cad4]">{currentTrack.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Global Transport & Precision Timecode */}
      <div className="flex items-center gap-2">
        {/* Playback Controls */}
        <div className="flex items-center gap-0.5 bg-[#12161c] border border-[#232933] rounded px-1 py-0.5">
          <button
            type="button"
            onClick={previousTrack}
            title="Previous Track"
            className="w-6 h-6 rounded flex items-center justify-center text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#1a2028] transition-colors cursor-pointer"
          >
            <SkipBack size={12} />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause [Space]" : "Play [Space]"}
            className={cn(
              "w-7 h-6 rounded flex items-center justify-center transition-colors cursor-pointer",
              isPlaying
                ? "bg-[#00e676] text-black"
                : "bg-[#1f2530] text-[#f0f3f6] hover:bg-[#28303d]"
            )}
          >
            {isPlaying ? (
              <Pause size={12} fill="currentColor" />
            ) : (
              <Play size={12} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={nextTrack}
            title="Next Track"
            className="w-6 h-6 rounded flex items-center justify-center text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#1a2028] transition-colors cursor-pointer"
          >
            <SkipForward size={12} />
          </button>

          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            title={isLooping ? "Loop On" : "Loop Off"}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ml-0.5",
              isLooping
                ? "text-[#00e676] bg-[#00e676]/10"
                : "text-[#5e6877] hover:text-[#9aa2ae]"
            )}
          >
            <Repeat size={11} />
          </button>
        </div>

        {/* Precision Timecode Display */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#12161c] border border-[#232933] rounded font-timecode text-xs text-[#c4cad4]"
          title="Current Playback Timecode"
        >
          <span className="text-[#00e676] font-bold">
            {formatPrecisionTimecode(currentTime)}
          </span>
          <span className="text-[#5e6877]">/</span>
          <span className="text-[#7e8999]">
            {formatPrecisionTimecode(audioDuration)}
          </span>
        </div>
      </div>

      {/* RIGHT: Aspect Ratio, Audio Modal Trigger, and Export */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Aspect Ratio Segmented Control (Desktop) */}
        <div className="hidden xl:flex items-center bg-[#12161c] border border-[#232933] rounded p-0.5 gap-0.5">
          {ratios.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setAspectRatio(r.id);
                useLyricsVideoStore.getState().resetElementPositions(r.id);
              }}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono font-semibold rounded transition-colors cursor-pointer",
                aspectRatio === r.id
                  ? "bg-[#1f2530] text-[#00e676]"
                  : "text-[#7e8999] hover:text-[#c4cad4]"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Aspect Ratio Select (Small/Medium screens) */}
        <div className="flex xl:hidden">
          <Select
            value={aspectRatio}
            onValueChange={(val) => {
              const ar = val as AspectRatio;
              setAspectRatio(ar);
              useLyricsVideoStore.getState().resetElementPositions(ar);
            }}
          >
            <SelectTrigger className="h-7 w-16 px-1.5 bg-[#12161c] border-[#232933] text-[10px] font-mono font-semibold text-[#c4cad4]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#12161c] border-[#232933] text-[#f0f3f6]">
              {ratios.map(r => (
                <SelectItem key={r.id} value={r.id} className="text-[10px] font-mono">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Audio Manager Button */}
        <button
          type="button"
          onClick={() => {
            if (onOpenAudioModal) onOpenAudioModal();
            else setIsAudioModalOpen(true);
          }}
          className="h-7 px-2.5 rounded bg-[#12161c] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] text-[10px] font-semibold text-[#c4cad4] hover:text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Open Audio & Track Library"
        >
          <Music size={12} className="text-[#00e676]" />
          <span className="hidden sm:inline">Audio</span>
        </button>

        {/* Primary Export Button */}
        <button
          id="topbar-export-btn"
          type="button"
          onClick={onExport}
          className="h-7 px-3 rounded bg-[#00e676] hover:bg-[#00ff87] text-[#080a0d] text-[11px] font-bold tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-[0.98]"
          title="Export Video / Audio Production"
        >
          <Download size={12} strokeWidth={2.5} />
          <span>Export</span>
        </button>
      </div>

      <AudioSourceModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </header>
  );
}
