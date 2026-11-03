import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { MVSettingsPanel } from './MVSettingsPanel';
import { Layers, SlidersHorizontal, Film, X, Settings2, PanelLeftClose } from 'lucide-react';
import { StudioButton } from '../ui/StudioButton';

type StudioPanel = 'media' | 'controls' | 'settings' | 'none';

const panels: Array<{ id: Exclude<StudioPanel, 'none'>; label: string; description: string; icon: typeof Layers }> = [
  { id: 'media', label: 'Media', description: 'Import and arrange media', icon: Layers },
  { id: 'controls', label: 'Auto Edit', description: 'Automatic cutting and effects', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', description: 'Video and scene settings', icon: Settings2 }
];

export function MVStudioLayout() {
  const rehydrateMVAssets = useMVStore(s => s.rehydrateMVAssets);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);
  const editorRef = useRef<HTMLElement>(null);
  const [timelineHeight, setTimelineHeight] = useState<number | null>(null);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const [activePanel, setActivePanel] = useState<StudioPanel>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'none' : 'media'
  );

  useEffect(() => {
    rehydrateMVAssets();
    setVideoMode('music-video');
  }, [rehydrateMVAssets, setVideoMode]);

  // The small-screen editor uses an in-workspace drawer instead of a fixed
  // viewport drawer. The preview and timeline keep their own layout when it
  // opens and it never competes with the global dialog portal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-mv-dialog]') &&
          window.innerWidth < 1024) {
        setActivePanel('none');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const togglePanel = (panel: Exclude<StudioPanel, 'none'>) =>
    setActivePanel(current => current === panel ? 'none' : panel);

  // More room for editing by default, without losing the preview. Users can
  // resize the vertical split by dragging its divider or using arrow keys.
  const boundTimelineHeight = useCallback((height: number) => {
    const available = editorRef.current?.clientHeight || 700;
    const minimum = Math.min(190, Math.floor(available * 0.38));
    const maximum = Math.max(minimum, Math.min(Math.floor(available * 0.68), available - 160));
    return Math.round(Math.max(minimum, Math.min(maximum, height)));
  }, []);

  const startTimelineResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    const startY = event.clientY;
    const startHeight = timelineHeight ?? editor.clientHeight * 0.4;
    setIsResizingTimeline(true);
    const move = (moveEvent: PointerEvent) => {
      setTimelineHeight(boundTimelineHeight(startHeight + startY - moveEvent.clientY));
    };
    const stop = () => {
      setIsResizingTimeline(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  };

  const onTimelineResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return;
    event.preventDefault();
    if (event.key === 'Home') {
      setTimelineHeight(null);
      return;
    }
    setTimelineHeight(current => boundTimelineHeight(
      (current ?? (editorRef.current?.clientHeight || 700) * 0.4) +
      (event.key === 'ArrowUp' ? 24 : -24)
    ));
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#080b10] text-[#e6e9ed]">
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">

        {/* Compact tab bar for small screens; keeps editing options discoverable. */}
        <nav aria-label="Music video tools" className="z-20 flex h-[52px] shrink-0 items-center gap-1 overflow-x-auto border-b border-[#28303c] bg-[#10151c] px-2 py-1.5 lg:hidden">
          <StudioButton
            variant="tab"
            size="compact"
            type="button"
            onClick={() => setActivePanel('none')}
            active={activePanel === 'none'}
          >
            <Film size={14} /> Preview
          </StudioButton>
          {panels.map(({ id, label, icon: Icon }) => (
            <StudioButton
              key={id}
              variant="tab"
              size="compact"
              active={activePanel === id}
              onClick={() => togglePanel(id)}
            >
              <Icon size={14} /> {label}
            </StudioButton>
          ))}
        </nav>

        {/* Desktop tool rail. Short readable labels replace rotated text. */}
        <nav aria-label="Music video tools" className="hidden w-[76px] shrink-0 flex-col gap-2 border-r border-[#28303c] bg-[#10151c] px-2 py-3 lg:flex">
          {panels.map(({ id, label, icon: Icon }) => (
            <StudioButton
              key={id}
              variant="tab"
              active={activePanel === id}
              title={panels.find(p => p.id === id)?.description}
              aria-label={label}
              onClick={() => togglePanel(id)}
              className="min-h-[64px] w-full flex-col gap-1.5 px-1 py-2 text-[10px]"
            >
              <Icon size={18} />
              <span>{label}</span>
            </StudioButton>
          ))}
        </nav>

        {activePanel !== 'none' && (
          <>
            <button
              type="button"
              aria-label="Close editor panel"
              onClick={() => setActivePanel('none')}
              className="absolute inset-x-0 top-[52px] bottom-0 z-30 bg-black/70 backdrop-blur-[2px] lg:hidden"
            />
            <aside
              aria-label={panels.find(p => p.id === activePanel)?.description}
              className="absolute top-[52px] bottom-0 left-0 z-40 flex w-[min(90vw,370px)] min-w-0 flex-col overflow-hidden border-r border-[#303846] bg-[#111820] shadow-[15px_0_50px_rgba(0,0,0,0.4)] lg:relative lg:inset-auto lg:z-10 lg:w-[300px] xl:w-[340px] lg:shrink-0 lg:shadow-none"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#303846] bg-[#10151c] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#f4f6f9]">
                    {panels.find(p => p.id === activePanel)?.label}
                  </p>
                  <p className="text-[10px] text-[#8f9bac]">
                    {panels.find(p => p.id === activePanel)?.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  aria-label="Close panel"
                  title="Close panel"
                  className="rounded-lg p-2 text-[#9da8b7] transition-colors hover:bg-[#26313b] hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <PanelLeftClose size={16} className="hidden lg:block" />
                  <X size={16} className="lg:hidden" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {activePanel === 'media' && <MVAssetLibrary />}
                {activePanel === 'controls' && <MVWorkflow />}
                {activePanel === 'settings' && <MVSettingsPanel />}
              </div>
            </aside>
          </>
        )}

        {/* No redundant preview toolbar. The video has its own on-hover controls. */}
        <main ref={editorRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080b10]">
          <div data-mv-preview-area className="relative flex min-h-[120px] flex-1 items-center justify-center overflow-hidden p-2 sm:p-3">
            <MVPreview mode="music-video" />
          </div>

          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize video preview and timeline"
            aria-orientation="horizontal"
            aria-valuetext="Drag up to expand timeline, or down to enlarge video preview"
            title="Drag to resize timeline · Double-click to reset"
            onPointerDown={startTimelineResize}
            onKeyDown={onTimelineResizeKeyDown}
            onDoubleClick={() => setTimelineHeight(null)}
            className={`group relative z-10 flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-[#28313c] bg-[#10161d] outline-none transition-colors hover:bg-[#18242e] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${isResizingTimeline ? 'bg-[#193128]' : ''}`}
          >
            <div className="h-[3px] w-12 rounded-full bg-[#4b5969] transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
          </div>

          <div
            data-mv-timeline-area
            className="min-h-0 shrink-0 overflow-hidden bg-[#0f151c]"
            style={{ height: timelineHeight === null ? 'clamp(220px, 40%, 480px)' : `${timelineHeight}px` }}
          >
            <MVTimeline />
          </div>
        </main>
      </div>
    </div>
  );
}
