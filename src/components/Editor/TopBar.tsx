import React, { useState } from 'react';
import { useStore, AspectRatio } from '../../store/useStore';
import { 
  Download, Music, AlignLeft, Disc3, Film, Keyboard, Monitor
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AudioSourceModal } from '../Audio/AudioSourceModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface TopBarProps {
  onExport: () => void;
  onOpenAudioModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

export function TopBar({ onExport, onOpenAudioModal, onOpenShortcutsModal }: TopBarProps) {
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);
  const activeColor = useStore(s => s.visualizerSettings?.color) || '#00e676';

  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const workspaces = [
    {
      id: 'lrc' as const,
      label: 'LRC Studio',
      title: 'LRC Studio — Lyrics & Word-Level Timestamping',
      icon: AlignLeft
    },
    {
      id: 'lyrics' as const,
      label: 'Lyrics Video',
      title: 'Lyrics Video — Typography & Visualizer Canvas',
      icon: Disc3
    },
    {
      id: 'mv-studio' as const,
      label: 'MV Studio',
      title: 'MV Studio — Cinematic Multi-Track Video Timeline',
      icon: Film
    }
  ];

  return (
    <header
      id="top-application-bar"
      aria-label="Application Top Bar"
      className="h-11 bg-[#0b0d10] border-b border-[#232933] flex items-center justify-between px-3 z-30 shrink-0 select-none text-[#f0f3f6]"
    >
      {/* LEFT: Branding + Studio Switcher Tabs */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Joelizer Wordmark */}
        <div className="flex items-center gap-2">
          {/* Audio Waveform Emblem */}
          <div className="w-5 h-5 rounded bg-[#161a20] border border-[#262c37] flex items-center justify-center p-0.5">
            <svg viewBox="0 0 24 24" className="w-full h-full" style={{ color: activeColor }} fill="currentColor">
              <rect x="2" y="10" width="2" height="4" rx="1" />
              <rect x="6" y="6" width="2" height="12" rx="1" />
              <rect x="10" y="3" width="2" height="18" rx="1" />
              <rect x="14" y="7" width="2" height="10" rx="1" />
              <rect x="18" y="11" width="2" height="2" rx="1" />
            </svg>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-xs tracking-wider text-[#f0f3f6]">
              JOELIZER
            </span>
            <span 
              className="text-[9px] font-mono font-semibold tracking-widest hidden sm:inline"
              style={{ color: activeColor }}
            >
              PRO
            </span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-[#232933]" />

        {/* Studio Switcher Tabs (LRC Studio, Lyrics Video, MV Studio) */}
        <nav aria-label="Studio Navigation" className="flex items-center bg-[#12161c] border border-[#232933] rounded p-0.5 gap-0.5">
          {workspaces.map(ws => {
            const isActive = activeTab === ws.id;
            const Icon = ws.icon;

            return (
              <button
                key={ws.id}
                id={`topbar-tab-${ws.id}`}
                type="button"
                onClick={() => setActiveTab(ws.id)}
                title={ws.title}
                className={cn(
                  "h-7 px-3 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                  isActive
                    ? "bg-[#181d24] text-[#f0f3f6] shadow-sm border"
                    : "text-[#7e8999] hover:text-[#c4cad4] hover:bg-[#151a21] border border-transparent"
                )}
                style={isActive ? { borderColor: `${activeColor}40` } : undefined}
              >
                <Icon
                  size={13}
                  className="transition-colors"
                  style={isActive ? { color: activeColor } : undefined}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="font-medium tracking-wide">{ws.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* RIGHT: Aspect Ratio, Audio Modal Trigger, Shortcuts, and Export */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Aspect Ratio Selector Dropdown */}
        <div className="flex items-center">
          <Select value={aspectRatio} onValueChange={(val: AspectRatio) => setAspectRatio(val)}>
            <SelectTrigger
              id="topbar-aspect-ratio-select"
              className="h-7 px-2.5 bg-[#12161c] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] text-[10px] font-mono font-semibold text-[#c4cad4] hover:text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer rounded"
              title="Change Canvas Aspect Ratio"
            >
              <Monitor size={12} style={{ color: activeColor }} />
              <SelectValue placeholder="Ratio" />
            </SelectTrigger>
            <SelectContent className="bg-[#12161c] border-[#232933] text-[#f0f3f6] text-[11px] font-mono z-50">
              <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
              <SelectItem value="9:16">9:16 (Shorts/TikTok)</SelectItem>
              <SelectItem value="1:1">1:1 (Square)</SelectItem>
              <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
              <SelectItem value="3:4">3:4 (Vertical)</SelectItem>
              <SelectItem value="4:3">4:3 (Standard)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audio Manager Button */}
        <button
          id="topbar-audio-btn"
          type="button"
          onClick={() => {
            if (onOpenAudioModal) onOpenAudioModal();
            else setIsAudioModalOpen(true);
          }}
          className="h-7 px-2.5 rounded bg-[#12161c] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] text-[10px] font-semibold text-[#c4cad4] hover:text-[#f0f3f6] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Open Audio & Track Library"
        >
          <Music size={12} style={{ color: activeColor }} />
          <span className="hidden sm:inline">Audio</span>
        </button>

        {/* Shortcuts Button */}
        {onOpenShortcutsModal && (
          <button
            id="topbar-shortcuts-btn"
            type="button"
            onClick={onOpenShortcutsModal}
            className="h-7 px-2 rounded bg-[#12161c] hover:bg-[#1a2028] border border-[#232933] hover:border-[#323b49] text-[10px] font-semibold text-[#7e8999] hover:text-[#c4cad4] flex items-center gap-1 transition-colors cursor-pointer"
            title="Keyboard Shortcuts [?]"
          >
            <Keyboard size={12} />
            <span className="hidden md:inline font-mono">?</span>
          </button>
        )}

        {/* Primary Export Button */}
        <button
          id="topbar-export-btn"
          type="button"
          onClick={onExport}
          className="h-7 px-3 rounded text-[#080a0d] text-[11px] font-bold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          style={{ backgroundColor: activeColor }}
          title="Export Video / Audio Production"
        >
          <Download size={12} strokeWidth={2.5} />
          <span>Export</span>
        </button>
      </div>

      <AudioSourceModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </header>
  );
}
