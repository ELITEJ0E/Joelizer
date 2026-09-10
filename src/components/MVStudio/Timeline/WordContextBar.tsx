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
            className="px-2 py-0.5 bg-[#0a0c0f] border border-accent rounded text-xs text-[#f0f3f6] outline-none w-28 font-sans"
          />
          <button
            onClick={handleSaveText}
            className="p-1 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] font-bold cursor-pointer transition-colors"
            title="Save word"
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
      ) : isInserting ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-accent font-semibold">
            {isInserting === 'before' ? '+ PRE:' : '+ POST:'}
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
            className="px-2 py-0.5 bg-[#0a0c0f] border border-accent rounded text-xs text-[#f0f3f6] outline-none w-28 font-sans"
          />
          <button
            onClick={handleConfirmInsert}
            className="p-1 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] font-bold cursor-pointer transition-colors"
            title="Add word"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setIsInserting(null)}
            className="p-1 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] cursor-pointer transition-colors"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          {/* Word badge */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-[#232933] text-[#7e8999] text-[10px]">
            <span className="font-semibold text-[#f0f3f6] bg-[#161b22] border border-[#232933] px-1.5 py-0.5 rounded font-sans">{word.word}</span>
            <span>{word.start.toFixed(2)}s - {word.end.toFixed(2)}s</span>
            <span className="text-accent">({(word.end - word.start).toFixed(2)}s)</span>
          </div>

          {/* Edit Word */}
          <button
            onClick={() => {
              setEditText(word.word);
              setIsEditing(true);
            }}
            title="Edit word spelling"
            className="px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit3 size={11} className="text-accent" />
            <span>EDIT</span>
          </button>

          {/* Insert Before */}
          <button
            onClick={() => {
              setInsertText('');
              setIsInserting('before');
            }}
            title="Insert word before this word"
            className="px-1.5 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={10} />
            <span>+WORD</span>
          </button>

          {/* Insert After */}
          <button
            onClick={() => {
              setInsertText('');
              setIsInserting('after');
            }}
            title="Insert word after this word"
            className="px-1.5 py-0.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#c9d1d9] hover:text-[#f0f3f6] font-medium flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <span>+WORD</span>
            <ArrowRight size={10} />
          </button>

          {/* Delete word */}
          <button
            onClick={onDeleteWord}
            title="Delete this word"
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
