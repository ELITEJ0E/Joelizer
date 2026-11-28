import React from 'react';
import { TimelinePopover, type TimelinePopupAnchor } from '../../ui/timeline-popover';
import { Plus, Trash2, Wand2, Volume2, Sparkles, Sliders, Film } from 'lucide-react';

interface TrackHeaderMenuProps {
  trackType: 'vis' | 'lyr' | 'aud';
  anchor: TimelinePopupAnchor;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function TrackHeaderMenu({trackType,anchor,onClose,onAction}:TrackHeaderMenuProps) {
  return <TimelinePopover anchor={anchor} title={trackType==='vis'?'Visual track options':trackType==='lyr'?'Lyrics track options':'Audio track options'} onClose={onClose} width={216}>
    <div className="py-1 text-xs text-[#c9d1d9] divide-y divide-[#232933]">
      {trackType === 'vis' && (
        <div className="py-1">
          <button
            onClick={() => { onAction('add-visualizer'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sparkles size={12} className="text-accent" />
            <span>Add Visualizer Scene</span>
          </button>
          <button
            onClick={() => { onAction('add-vinyl'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Film size={12} className="text-[#a78bfa]" />
            <span>Add Vinyl Lyrics Scene</span>
          </button>
          <button
            onClick={() => { onAction('auto-fill'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Wand2 size={12} className="text-[#38bdf8]" />
            <span>Auto-Fill With Assets</span>
          </button>
          <button
            onClick={() => { onAction('clear-clips'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-950/40 flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 transition-colors"
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
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Plus size={12} className="text-accent" />
            <span>Add Line at Playhead</span>
          </button>
          <button
            onClick={() => { onAction('generate-words'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Wand2 size={12} className="text-[#fbbf24]" />
            <span>Auto-Generate Words</span>
          </button>
          <button
            onClick={() => { onAction('align-beats'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sparkles size={12} className="text-[#2dd4bf]" />
            <span>Align Lines to Beats</span>
          </button>
          <button
            onClick={() => { onAction('clear-lyrics'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-950/40 flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 transition-colors"
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
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Volume2 size={12} className="text-accent" />
            <span>Reset Volume (100%)</span>
          </button>
          <button
            onClick={() => { onAction('generate-peaks'); onClose(); }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#161b22] flex items-center gap-2 cursor-pointer text-[#c9d1d9] hover:text-[#f0f3f6] transition-colors"
          >
            <Sliders size={12} className="text-accent" />
            <span>Re-analyze Audio Waveform</span>
          </button>
        </div>
      )}
    </div>
  </TimelinePopover>;
}
