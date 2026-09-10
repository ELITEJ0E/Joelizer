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
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0e1115] border border-[#232933] rounded shadow-[0_8px_30px_rgba(0,0,0,0.8)] text-[11px] text-[#f0f3f6] z-50 animate-in fade-in zoom-in-95 duration-150 select-none font-mono"
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
            className="px-2 py-0.5 bg-[#0a0c0f] border border-[#00e676] rounded text-xs text-[#f0f3f6] outline-none w-48 font-sans"
          />
          <button
            onClick={handleSaveText}
            className="p-1 rounded bg-[#00e676] hover:bg-[#00c853] text-[#0a0c0f] font-bold cursor-pointer transition-colors"
            title="Save text"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          {/* Timing & text badge */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-[#232933] text-[#7e8999] text-[10px]">
            <span className="font-semibold text-[#f0f3f6]">{formatTime(line.startTime)}</span>
            <span className="text-[#4b5563]">→</span>
            <span className="font-semibold text-[#f0f3f6]">{formatTime(line.endTime)}</span>
            <span className="text-[#7e8999]">({duration.toFixed(1)}s)</span>
          </div>

          {/* Quick Edit Text */}
          <button
            onClick={() => {
              setEditText(line.text);
              setIsEditing(true);
            }}
            title="Edit lyric line text"
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit3 size={11} className="text-[#00e676]" />
            <span>EDIT</span>
          </button>

          {/* Expand / Collapse Words */}
          <button
            onClick={onToggleExpandWords}
            title={isWordsExpanded ? 'Hide word timeline layer' : 'Expand word timeline layer'}
            className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
              isWordsExpanded 
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' 
                : 'bg-[#161b22] hover:bg-[#1c222b] border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6]'
            }`}
          >
            <Layers size={11} className={isWordsExpanded ? 'text-[#00e676]' : undefined} />
            <span>{isWordsExpanded ? 'WORDS ▲' : 'WORDS ▼'}</span>
          </button>

          {/* Split button */}
          <button
            onClick={onSplit}
            disabled={!canSplit}
            title="Split lyric at playhead"
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] disabled:opacity-30 text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Scissors size={11} style={{ color: canSplit ? activeColor : undefined }} />
            <span>SPLIT</span>
          </button>

          {/* Merge with next */}
          <button
            onClick={onMergeNext}
            title="Merge with next lyric line"
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Merge size={11} />
            <span>MERGE</span>
          </button>

          {/* Duplicate button */}
          <button
            onClick={onDuplicate}
            title="Duplicate lyric line"
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Copy size={11} />
            <span>DUP</span>
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            title="Delete lyric line"
            className="px-2 py-0.5 rounded bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 font-medium flex items-center gap-1 transition-colors cursor-pointer ml-1"
          >
            <Trash2 size={11} />
            <span>DEL</span>
          </button>
        </>
      )}
    </div>
  );
}
