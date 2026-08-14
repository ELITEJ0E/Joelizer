import React, { useState } from 'react';
import { LyricLine } from '../../../store/useStore';
import { Scissors, Trash2, Copy, Edit3, Merge, Layers, Check, X } from 'lucide-react';
import { formatTime } from '../../../lib/utils';

interface LyricContextBarProps {
  line: LyricLine;
  currentTime: number;
  activeColor: string;
  isWordsExpanded: boolean;
  onToggleExpandWords: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onMergeNext: () => void;
  onDelete: () => void;
  onEditText: (newText: string) => void;
  onClose: () => void;
}

export function LyricContextBar({
  line,
  currentTime,
  activeColor,
  isWordsExpanded,
  onToggleExpandWords,
  onSplit,
  onDuplicate,
  onMergeNext,
  onDelete,
  onEditText,
  onClose,
}: LyricContextBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(line.text);
  const canSplit = currentTime > line.startTime + 0.1 && currentTime < line.endTime - 0.1;
  const duration = line.endTime - line.startTime;

  const handleSaveText = () => {
    if (editText.trim()) {
      onEditText(editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#12121a]/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-2xl text-[11px] text-white z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveText();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            autoFocus
            className="px-2 py-0.5 bg-black/60 border border-purple-400/50 rounded text-xs text-white outline-none w-48 font-medium"
          />
          <button
            onClick={handleSaveText}
            className="p-1 rounded bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
            title="Save text"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white cursor-pointer"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          {/* Timing & text badge */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-white/10 text-purple-200 font-mono text-[10px]">
            <span className="font-bold text-white">{formatTime(line.startTime)}</span>
            <span className="text-slate-500">→</span>
            <span className="font-bold text-white">{formatTime(line.endTime)}</span>
            <span className="text-purple-300/80">({duration.toFixed(1)}s)</span>
          </div>

          {/* Quick Edit Text */}
          <button
            onClick={() => {
              setEditText(line.text);
              setIsEditing(true);
            }}
            title="Edit lyric line text"
            className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Edit3 size={11} />
            <span>Edit</span>
          </button>

          {/* Expand / Collapse Words */}
          <button
            onClick={onToggleExpandWords}
            title={isWordsExpanded ? 'Hide word timeline layer' : 'Expand word timeline layer'}
            className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all cursor-pointer ${
              isWordsExpanded ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Layers size={11} />
            <span>{isWordsExpanded ? 'Words ▲' : 'Words ▼'}</span>
          </button>

          {/* Split button */}
          <button
            onClick={onSplit}
            disabled={!canSplit}
            title="Split lyric at playhead"
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Scissors size={11} style={{ color: canSplit ? activeColor : undefined }} />
            <span>Split</span>
          </button>

          {/* Merge with next */}
          <button
            onClick={onMergeNext}
            title="Merge with next lyric line"
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Merge size={11} />
            <span>Merge</span>
          </button>

          {/* Duplicate button */}
          <button
            onClick={onDuplicate}
            title="Duplicate lyric line"
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Copy size={11} />
            <span>Dup</span>
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            title="Delete lyric line"
            className="px-2 py-0.5 rounded bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 font-bold flex items-center gap-1 transition-all cursor-pointer ml-1"
          >
            <Trash2 size={11} />
            <span>Del</span>
          </button>
        </>
      )}
    </div>
  );
}
