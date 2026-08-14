import React, { useState } from 'react';
import { Edit3, Trash2, Plus, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { formatTime } from '../../../lib/utils';

interface WordContextBarProps {
  word: { word: string; start: number; end: number };
  lineId: string;
  wordIndex: number;
  activeColor: string;
  onEditWordText: (newWord: string) => void;
  onInsertWordBefore: (word: string) => void;
  onInsertWordAfter: (word: string) => void;
  onDeleteWord: () => void;
  onClose: () => void;
}

export function WordContextBar({
  word,
  lineId,
  wordIndex,
  activeColor,
  onEditWordText,
  onInsertWordBefore,
  onInsertWordAfter,
  onDeleteWord,
  onClose,
}: WordContextBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(word.word);
  const [isInserting, setIsInserting] = useState<'before' | 'after' | null>(null);
  const [insertText, setInsertText] = useState('');

  const handleSaveText = () => {
    if (editText.trim()) {
      onEditWordText(editText.trim());
    }
    setIsEditing(false);
  };

  const handleConfirmInsert = () => {
    if (insertText.trim()) {
      if (isInserting === 'before') {
        onInsertWordBefore(insertText.trim());
      } else if (isInserting === 'after') {
        onInsertWordAfter(insertText.trim());
      }
    }
    setIsInserting(null);
    setInsertText('');
  };

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141416]/95 backdrop-blur-md border border-amber-500/40 rounded-lg shadow-2xl text-[11px] text-white z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
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
            className="px-2 py-0.5 bg-black/60 border border-amber-400/50 rounded text-xs text-white outline-none w-28 font-medium"
          />
          <button
            onClick={handleSaveText}
            className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
            title="Save word"
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
      ) : isInserting ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-300 font-bold">
            {isInserting === 'before' ? '+ Before:' : '+ After:'}
          </span>
          <input
            type="text"
            value={insertText}
            onChange={(e) => setInsertText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmInsert();
              if (e.key === 'Escape') setIsInserting(null);
            }}
            autoFocus
            placeholder="New word..."
            className="px-2 py-0.5 bg-black/60 border border-amber-400/50 rounded text-xs text-white outline-none w-28 font-medium"
          />
          <button
            onClick={handleConfirmInsert}
            className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
            title="Add word"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setIsInserting(null)}
            className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white cursor-pointer"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          {/* Word badge */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-white/10 text-amber-300 font-mono text-[10px]">
            <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded font-sans">{word.word}</span>
            <span>{word.start.toFixed(2)}s - {word.end.toFixed(2)}s</span>
            <span className="text-amber-400/70">({(word.end - word.start).toFixed(2)}s)</span>
          </div>

          {/* Edit Word */}
          <button
            onClick={() => {
              setEditText(word.word);
              setIsEditing(true);
            }}
            title="Edit word spelling"
            className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Edit3 size={11} />
            <span>Edit</span>
          </button>

          {/* Insert Before */}
          <button
            onClick={() => {
              setInsertText('');
              setIsInserting('before');
            }}
            title="Insert word before this word"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-0.5 transition-all cursor-pointer"
          >
            <ArrowLeft size={10} />
            <span>+Word</span>
          </button>

          {/* Insert After */}
          <button
            onClick={() => {
              setInsertText('');
              setIsInserting('after');
            }}
            title="Insert word after this word"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-0.5 transition-all cursor-pointer"
          >
            <span>+Word</span>
            <ArrowRight size={10} />
          </button>

          {/* Delete word */}
          <button
            onClick={onDeleteWord}
            title="Delete this word"
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
