import React from 'react';
import { TimelineClip, isAutoManagedClip } from '../../../store/useMVStore';
import { Scissors, Trash2, Copy, Lock, Unlock, Sparkles, Gauge, Volume2, VolumeX } from 'lucide-react';
import { getClipSpeed } from '../../../lib/clipSpeed';
import { formatTime } from '../../../lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';

interface ClipContextBarProps {
  clip: TimelineClip;
  currentTime: number;
  activeColor: string;
  onSplit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onToggleLock: () => void;
  onToggleAutoManaged: () => void;
  onDelete: () => void;
  onUpdateEffect?: (effect: any) => void;
  onUpdateTransition?: (transition: any) => void;
  onToggleAudio?: () => void;
  onAudioVolume?: (value: number) => void;
  onAudioCommit?: () => void;
  onClose: () => void;
  onOpenSpeed: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ClipContextBar({
  clip,
  currentTime,
  activeColor,
  onSplit,
  onDuplicate,
  onCopy,
  onPaste,
  canPaste,
  onToggleLock,
  onToggleAutoManaged,
  onDelete,
  onUpdateEffect,
  onUpdateTransition,
  onToggleAudio,
  onAudioVolume,
  onAudioCommit,
  onClose,
  onOpenSpeed,
}: ClipContextBarProps) {
  const canSplit = currentTime > clip.startTime + 0.1 && currentTime < clip.endTime - 0.1;
  const duration = clip.endTime - clip.startTime;

  return (
    <div 
      className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 max-w-[calc(100vw-16px)] px-2.5 py-1 bg-[#0e1115] border border-[#232933] rounded shadow-[0_8px_30px_rgba(0,0,0,0.8)] text-[11px] text-[#f0f3f6] z-50 animate-in fade-in zoom-in-95 duration-150 select-none font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Timing badge */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-[#232933] text-[#7e8999] text-[10px]">
        <span className="font-semibold text-[#f0f3f6]">{formatTime(clip.startTime)}</span>
        <span className="text-[#4b5563]">→</span>
        <span className="font-semibold text-[#f0f3f6]">{formatTime(clip.endTime)}</span>
        <span className="text-[#7e8999]">({duration.toFixed(1)}s)</span>
      </div>

      {onToggleAudio && <div className="flex items-center gap-1 pr-1 border-r border-[#232933]">
        <button type="button" onClick={onToggleAudio} disabled={clip.locked}
          aria-label={clip.audioMuted === false ? 'Mute clip audio' : 'Unmute clip audio'}
          title={clip.audioMuted === false ? 'Mute clip audio' : 'Unmute clip audio'}
          className="px-1.5 py-0.5 rounded border border-[#303846] disabled:opacity-40 text-[#c9d1d9] hover:text-white cursor-pointer">
          {clip.audioMuted === false ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
        {clip.audioMuted === false && <input type="range" min="0" max="1" step="0.05"
          aria-label="Clip volume" title={`Clip volume ${Math.round((clip.audioVolume ?? 1)*100)}%`}
          disabled={clip.locked} value={clip.audioVolume ?? 1} onChange={e => onAudioVolume?.(Number(e.target.value))}
          onPointerUp={onAudioCommit} onKeyUp={onAudioCommit} className="w-14 accent-accent" />}
      </div>}
      {/* Split button */}
      <button type="button" onClick={onOpenSpeed} disabled={clip.locked}
        title="Edit this clip’s playback speed"
        className="px-2 py-0.5 rounded border border-emerald-700/50 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40 flex items-center gap-1 font-semibold cursor-pointer">
        <Gauge size={12} /> {getClipSpeed(clip).toFixed(2).replace(/0$/, '')}×
      </button>
      <button
        onClick={onSplit}
        disabled={!canSplit || clip.locked}
        title="Split at playhead"
        className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] disabled:opacity-30 disabled:hover:bg-[#161b22] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
      >
        <Scissors size={11} style={{ color: canSplit ? activeColor : undefined }} />
        <span>SPLIT</span>
      </button>

      <button type="button" onClick={onCopy} title="Copy clip (Ctrl+C / Cmd+C)"
        className="px-2 py-0.5 rounded border border-[#303846] bg-[#161b22] hover:bg-[#202b38] text-[#d4dee9] text-[10px] font-medium cursor-pointer">
        COPY
      </button>
      <button type="button" onClick={onPaste} disabled={!canPaste}
        title="Paste at playhead (Ctrl+V / Cmd+V)"
        className="px-2 py-0.5 rounded border border-[#303846] bg-[#161b22] hover:bg-[#202b38] text-[#d4dee9] text-[10px] font-medium cursor-pointer disabled:opacity-30">
        PASTE
      </button>

      {/* Duplicate button */}
      <button
        onClick={onDuplicate}
        title="Duplicate clip (Ctrl+D / Cmd+D)"
        className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] disabled:opacity-30 text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
      >
        <Copy size={11} />
        <span>DUP</span>
      </button>

      {/* Lock toggle */}
      <button
        onClick={onToggleLock}
        title={clip.locked ? 'Unlock clip' : 'Lock clip'}
        className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
          clip.locked 
            ? 'bg-amber-950/40 text-amber-300 border-amber-800/50' 
            : 'bg-[#161b22] hover:bg-[#1c222b] border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6]'
        }`}
      >
        {clip.locked ? <Lock size={11} className="text-amber-400" /> : <Unlock size={11} />}
        <span>{clip.locked ? 'LOCKED' : 'LOCK'}</span>
      </button>

      {/* Auto Edit ownership: manual clips are preserved during regeneration. */}
      <button
        type="button"
        onClick={onToggleAutoManaged}
        disabled={clip.locked}
        aria-pressed={!isAutoManagedClip(clip)}
        title={isAutoManagedClip(clip)
          ? 'Protect this clip from Auto Edit'
          : 'Allow Auto Edit to regenerate this clip'}
        className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer disabled:opacity-40 ${
          isAutoManagedClip(clip)
            ? 'border-[#344557] bg-[#161b22] text-[#aab5c5]'
            : 'border-amber-700/60 bg-amber-950/30 text-amber-300'
        }`}
      >
        {isAutoManagedClip(clip) ? 'AUTO · PROTECT' : 'MANUAL · KEEP'}
      </button>

      {/* Styled Radix selects stay above the timeline and close on outside click/Escape. */}
      {onUpdateEffect && (
        <Select value={clip.effect || 'none'} disabled={clip.locked} onValueChange={onUpdateEffect}>
          <SelectTrigger aria-label="Clip motion effect"
            className="h-7 w-[106px] border-[#303846] bg-[#161b22] px-2 text-[10px] normal-case">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[110] bg-[#10151c]">
            <SelectItem value="none">FX: None</SelectItem>
            <SelectItem value="ken-burns-in">Zoom In</SelectItem>
            <SelectItem value="ken-burns-out">Zoom Out</SelectItem>
            <SelectItem value="pan-left">Pan Left</SelectItem>
            <SelectItem value="pan-right">Pan Right</SelectItem>
          </SelectContent>
        </Select>
      )}
      {onUpdateTransition && (
        <Select value={clip.transition || 'crossfade'} disabled={clip.locked} onValueChange={onUpdateTransition}>
          <SelectTrigger aria-label="Clip transition"
            className="h-7 w-[120px] border-[#303846] bg-[#161b22] px-2 text-[10px] normal-case">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[110] bg-[#10151c]">
            <SelectItem value="cut">Trans: Cut</SelectItem>
            <SelectItem value="crossfade">Crossfade / Mix</SelectItem>
            <SelectItem value="fade">Fade</SelectItem>
            <SelectItem value="morph">Morph</SelectItem>
            <SelectItem value="slide">Slide</SelectItem>
            <SelectItem value="zoom">Zoom</SelectItem>
            <SelectItem value="dissolve">Dissolve</SelectItem>
            <SelectItem value="glitch">Glitch</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        title="Delete clip"
        className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 font-medium flex items-center gap-1 transition-colors cursor-pointer ml-1"
      >
        <Trash2 size={11} />
        <span>DEL</span>
      </button>
    </div>
  );
}
