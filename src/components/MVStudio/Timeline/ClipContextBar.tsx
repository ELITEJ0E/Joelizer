import React from 'react';
import { TimelineClip } from '../../../store/useMVStore';
import { Scissors, Trash2, Copy, Lock, Unlock, Sparkles, ChevronDown } from 'lucide-react';
import { formatTime } from '../../../lib/utils';

interface ClipContextBarProps {
  clip: TimelineClip;
  currentTime: number;
  activeColor: string;
  onSplit: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
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
  onToggleLock,
  onDelete,
  onUpdateEffect,
  onUpdateTransition,
  onClose,
}: ClipContextBarProps) {
  const canSplit = currentTime > clip.startTime + 0.1 && currentTime < clip.endTime - 0.1;
  const duration = clip.endTime - clip.startTime;

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#121218]/95 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl text-[11px] text-white z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Timing badge */}
      <div className="flex items-center gap-1 pr-2 border-r border-white/10 text-slate-300 font-mono text-[10px]">
        <span className="font-bold text-white">{formatTime(clip.startTime)}</span>
        <span className="text-slate-500">→</span>
        <span className="font-bold text-white">{formatTime(clip.endTime)}</span>
        <span className="text-slate-500">({duration.toFixed(1)}s)</span>
      </div>

      {/* Split button */}
      <button
        onClick={onSplit}
        disabled={!canSplit || clip.locked}
        title="Split at playhead"
        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white font-bold flex items-center gap-1 transition-all cursor-pointer"
      >
        <Scissors size={11} style={{ color: canSplit ? activeColor : undefined }} />
        <span>Split</span>
      </button>

      {/* Duplicate button */}
      <button
        onClick={onDuplicate}
        disabled={clip.locked}
        title="Duplicate clip"
        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold flex items-center gap-1 transition-all cursor-pointer"
      >
        <Copy size={11} />
        <span>Dup</span>
      </button>

      {/* Lock toggle */}
      <button
        onClick={onToggleLock}
        title={clip.locked ? 'Unlock clip' : 'Lock clip'}
        className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all cursor-pointer ${
          clip.locked ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {clip.locked ? <Lock size={11} className="text-amber-400" /> : <Unlock size={11} />}
        <span>{clip.locked ? 'Locked' : 'Lock'}</span>
      </button>

      {/* Motion / Effect Selector */}
      {onUpdateEffect && (
        <div className="relative flex items-center">
          <select
            value={clip.effect || 'none'}
            onChange={(e) => onUpdateEffect(e.target.value)}
            disabled={clip.locked}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-bold text-white outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="none" className="bg-[#181820]">FX: None</option>
            <option value="ken-burns-in" className="bg-[#181820]">Zoom In</option>
            <option value="ken-burns-out" className="bg-[#181820]">Zoom Out</option>
            <option value="pan-left" className="bg-[#181820]">Pan Left</option>
            <option value="pan-right" className="bg-[#181820]">Pan Right</option>
          </select>
          <ChevronDown size={10} className="absolute right-1 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Transition Selector */}
      {onUpdateTransition && (
        <div className="relative flex items-center">
          <select
            value={clip.transition || 'cut'}
            onChange={(e) => onUpdateTransition(e.target.value)}
            disabled={clip.locked}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-bold text-white outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="cut" className="bg-[#181820]">Trans: Cut</option>
            <option value="fade" className="bg-[#181820]">Fade</option>
            <option value="dissolve" className="bg-[#181820]">Dissolve</option>
            <option value="glitch" className="bg-[#181820]">Glitch</option>
          </select>
          <ChevronDown size={10} className="absolute right-1 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        title="Delete clip"
        className="px-2 py-0.5 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 font-bold flex items-center gap-1 transition-all cursor-pointer ml-1"
      >
        <Trash2 size={11} />
        <span>Del</span>
      </button>
    </div>
  );
}
