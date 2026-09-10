import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { AlignLeft, Film, Disc3, Music2, Keyboard } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WorkspaceRailProps {
  onOpenAudioModal: () => void;
  onOpenShortcutsModal?: () => void;
}

export function WorkspaceRail({ onOpenAudioModal, onOpenShortcutsModal }: WorkspaceRailProps) {
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);

  // Keyboard shortcut to switch workspaces (1: LRC, 2: Lyrics Video, 3: MV Studio)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea or contenteditable element
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === '1') {
        setActiveTab('lrc');
      } else if (e.key === '2') {
        setActiveTab('lyrics');
      } else if (e.key === '3') {
        setActiveTab('mv-studio');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const workspaces = [
    {
      id: 'lrc' as const,
      label: 'LRC',
      title: 'LRC Studio — Precision Timestamping [1]',
      icon: AlignLeft,
      shortcut: '1'
    },
    {
      id: 'lyrics' as const,
      label: 'VIDEO',
      title: 'Lyrics Video — Typography & Visualizer Canvas [2]',
      icon: Disc3,
      shortcut: '2'
    },
    {
      id: 'mv-studio' as const,
      label: 'MV',
      title: 'MV Studio — Cinematic Video Timeline [3]',
      icon: Film,
      shortcut: '3'
    }
  ];

  return (
    <aside
      id="workspace-rail"
      aria-label="Workspace Navigation"
      className="w-14 bg-[#0e1115] border-r border-[#232933] flex flex-col items-center justify-between py-2 shrink-0 select-none z-30"
    >
      {/* Primary 3 Workspaces */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {workspaces.map(ws => {
          const isActive = activeTab === ws.id;
          const Icon = ws.icon;

          return (
            <button
              key={ws.id}
              id={`rail-tab-${ws.id}`}
              type="button"
              onClick={() => setActiveTab(ws.id)}
              title={ws.title}
              className={cn(
                "relative w-12 h-12 rounded flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group",
                isActive
                  ? "bg-[#181d24] text-[#f0f3f6]"
                  : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#14181f]"
              )}
            >
              {/* Crisp Emerald Active Indicator on left border */}
              {isActive && (
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-accent rounded-r"
                />
              )}

              <Icon
                size={18}
                className={cn(
                  "transition-colors",
                  isActive ? "text-accent" : "text-[#7e8999] group-hover:text-[#c4cad4]"
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className="text-[9px] font-mono font-semibold tracking-wider leading-none">
                {ws.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Utility Actions */}
      <div className="flex flex-col items-center gap-1 w-full px-1 pt-2 border-t border-[#232933]/70">
        <button
          id="rail-audio-source-btn"
          type="button"
          onClick={onOpenAudioModal}
          title="Audio Source Manager"
          className="w-10 h-10 rounded flex items-center justify-center text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#14181f] transition-colors cursor-pointer"
        >
          <Music2 size={16} />
        </button>

        {onOpenShortcutsModal && (
          <button
            id="rail-shortcuts-btn"
            type="button"
            onClick={onOpenShortcutsModal}
            title="Keyboard Shortcuts [?]"
            className="w-10 h-10 rounded flex items-center justify-center text-[#5e6877] hover:text-[#9aa2ae] hover:bg-[#14181f] transition-colors cursor-pointer"
          >
            <Keyboard size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
