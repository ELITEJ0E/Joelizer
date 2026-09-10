import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Workspaces', items: [
      { keys: ['1'], label: 'Switch to LRC Studio' },
      { keys: ['2'], label: 'Switch to Lyrics Video' },
      { keys: ['3'], label: 'Switch to MV Studio' },
    ]},
    { category: 'Transport & Playback', items: [
      { keys: ['Space'], label: 'Play / Pause' },
      { keys: ['←', '→'], label: 'Seek -1s / +1s' },
      { keys: ['L'], label: 'Toggle Loop playback' },
    ]},
    { category: 'LRC Synchronization', items: [
      { keys: ['['], label: 'Stamp current line start time' },
      { keys: [']'], label: 'Stamp current line end time' },
      { keys: ['↑', '↓'], label: 'Navigate through lyric lines' },
    ]},
    { category: 'Project & Export', items: [
      { keys: ['⌘', 'E'], label: 'Open Export production modal' },
      { keys: ['Esc'], label: 'Close active modal / dialog' },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md bg-[#12161c] border border-[#232933] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="h-10 px-4 bg-[#0e1115] border-b border-[#232933] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f3f6]">
            <Keyboard size={14} className="text-[#00e676]" />
            <span id="shortcuts-title">Workstation Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#7e8999] hover:text-[#f0f3f6] p-1 rounded transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {shortcuts.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#5e6877] font-bold">
                {section.category}
              </span>
              <div className="bg-[#171b22] border border-[#232933] rounded divide-y divide-[#232933]">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[#9aa2ae]">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 min-w-[20px] text-center font-mono text-[10px] font-bold text-[#c4cad4] bg-[#0e1115] border border-[#232933] rounded shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-9 px-4 bg-[#0e1115] border-t border-[#232933] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1c2128] hover:bg-[#252c36] text-[#c4cad4] hover:text-white rounded text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
