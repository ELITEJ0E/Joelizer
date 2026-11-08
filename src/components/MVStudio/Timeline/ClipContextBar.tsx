import React from 'react';
import { TimelineClip, isAutoManagedClip } from '../../../store/useMVStore';
import { Scissors, Trash2, Copy, Lock, Unlock, Sparkles, ChevronDown } from 'lucide-react';
import { formatTime } from '../../../lib/utils';

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
  onClose: () => void;
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
  onClose,
}: ClipContextBarProps) {
  const canSplit = currentTime > clip.startTime + 0.1 && currentTime < clip.endTime - 0.1;
  const duration = clip.endTime - clip.startTime;

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0e1115] border border-[#232933] rounded shadow-[0_8px_30px_rgba(0,0,0,0.8)] text-[11px] text-[#f0f3f6] z-50 animate-in fade-in zoom-in-95 duration-150 select-none font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Timing badge */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-[#232933] text-[#7e8999] text-[10px]">
        <span className="font-semibold text-[#f0f3f6]">{formatTime(clip.startTime)}</span>
        <span className="text-[#4b5563]">→</span>
        <span className="font-semibold text-[#f0f3f6]">{formatTime(clip.endTime)}</span>
        <span className="text-[#7e8999]">({duration.toFixed(1)}s)</span>
      </div>

      {/* Split button */}
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

      {/* Motion / Effect Selector */}
      {onUpdateEffect && (
        <div className="relative flex items-center">
          <select
            value={clip.effect || 'none'}
            onChange={(e) => onUpdateEffect(e.target.value)}
            disabled={clip.locked}
            className="bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] rounded px-2 py-0.5 text-[10px] text-[#c9d1d9] outline-none cursor-pointer appearance-none pr-4.5"
          >
            <option value="none" className="bg-[#0e1115]">FX: None</option>
            <option value="ken-burns-in" className="bg-[#0e1115]">Zoom In</option>
            <option value="ken-burns-out" className="bg-[#0e1115]">Zoom Out</option>
            <option value="pan-left" className="bg-[#0e1115]">Pan Left</option>
            <option value="pan-right" className="bg-[#0e1115]">Pan Right</option>
          </select>
          <ChevronDown size={10} className="absolute right-1 text-[#7e8999] pointer-events-none" />
        </div>
      )}

      {/* Transition Selector */}
      {onUpdateTransition && (
        <div className="relative flex items-center">
          <select
            value={clip.transition || 'crossfade'}
            onChange={(e) => onUpdateTransition(e.target.value)}
            disabled={clip.locked}
            className="bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] rounded px-2 py-0.5 text-[10px] text-[#c9d1d9] outline-none cursor-pointer appearance-none pr-4.5"
          >
            <option value="cut" className="bg-[#0e1115]">Trans: Cut</option>
            <option value="crossfade" className="bg-[#0e1115]">Crossfade / Mix</option>
            <option value="fade" className="bg-[#0e1115]">Fade</option>
            <option value="morph" className="bg-[#0e1115]">Morph</option>
            <option value="slide" className="bg-[#0e1115]">Slide</option>
            <option value="zoom" className="bg-[#0e1115]">Zoom</option>
            <option value="dissolve" className="bg-[#0e1115]">Dissolve</option>
            <option value="glitch" className="bg-[#0e1115]">Glitch</option>
          </select>
          <ChevronDown size={10} className="absolute right-1 text-[#7e8999] pointer-events-none" />
        </div>
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
