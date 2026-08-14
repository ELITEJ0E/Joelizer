import React, { useRef, useEffect } from 'react';
import { Plus, Trash2, Wand2, Volume2, Sparkles, Sliders, Film } from 'lucide-react';

interface TrackHeaderMenuProps {
  trackType: 'vis' | 'lyr' | 'aud';
  onClose: () => void;
  onAction: (action: string) => void;
}

export function TrackHeaderMenu({ trackType, onClose, onAction }: TrackHeaderMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute left-2 top-8 z-50 w-44 bg-[#121218]/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl py-1 text-xs text-white divide-y divide-white/10 animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {trackType === 'vis' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('add-visualizer'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Sparkles size={12} className="text-emerald-400" />
            <span>Add Visualizer Scene</span>
          </button>
          <button
            onClick={() => { onAction('add-vinyl'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Film size={12} className="text-purple-400" />
            <span>Add Vinyl Lyrics Scene</span>
          </button>
          <button
            onClick={() => { onAction('auto-fill'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Wand2 size={12} className="text-blue-400" />
            <span>Auto-Fill With Assets</span>
          </button>
          <button
            onClick={() => { onAction('clear-clips'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-500/20 flex items-center gap-2 cursor-pointer text-red-300"
          >
            <Trash2 size={12} />
            <span>Clear Visual Track</span>
          </button>
        </div>
      )}

      {trackType === 'lyr' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('add-line'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Plus size={12} className="text-purple-400" />
            <span>Add Line at Playhead</span>
          </button>
          <button
            onClick={() => { onAction('generate-words'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Wand2 size={12} className="text-amber-400" />
            <span>Auto-Generate Words</span>
          </button>
          <button
            onClick={() => { onAction('align-beats'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Sparkles size={12} className="text-cyan-400" />
            <span>Align Lines to Beats</span>
          </button>
          <button
            onClick={() => { onAction('clear-lyrics'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-500/20 flex items-center gap-2 cursor-pointer text-red-300"
          >
            <Trash2 size={12} />
            <span>Clear All Lyrics</span>
          </button>
        </div>
      )}

      {trackType === 'aud' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('reset-volume'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Volume2 size={12} className="text-emerald-400" />
            <span>Reset Volume (100%)</span>
          </button>
          <button
            onClick={() => { onAction('generate-peaks'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
          >
            <Sliders size={12} className="text-emerald-400" />
            <span>Re-analyze Audio Waveform</span>
          </button>
        </div>
      )}
    </div>
  );
}
