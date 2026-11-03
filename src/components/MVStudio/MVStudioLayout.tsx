import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { MVSettingsPanel } from './MVSettingsPanel';
import { Layers, SlidersHorizontal, Film, X, Settings2, Download, PanelLeftClose } from 'lucide-react';

type StudioPanel = 'media' | 'controls' | 'settings' | 'none';

const panels: Array<{ id: Exclude<StudioPanel, 'none'>; label: string; description: string; icon: typeof Layers }> = [
  { id: 'media', label: 'Media', description: 'Import and arrange media', icon: Layers },
  { id: 'controls', label: 'Auto Edit', description: 'Automatic cutting and effects', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', description: 'Video and scene settings', icon: Settings2 }
];

export function MVStudioLayout() {
  const rehydrateMVAssets = useMVStore(s => s.rehydrateMVAssets);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);
  const aspectRatio = useStore(s => s.aspectRatio);
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

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#080b10] text-[#e6e9ed]">
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">

        {/* Compact tab bar for small screens; keeps editing options discoverable. */}
        <nav aria-label="Music video tools" className="z-20 flex h-[52px] shrink-0 items-center gap-1 overflow-x-auto border-b border-[#28303c] bg-[#10151c] px-2 py-1.5 lg:hidden">
          <button
            type="button"
            onClick={() => setActivePanel('none')}
            aria-pressed={activePanel === 'none'}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activePanel === 'none' ? 'bg-[#26313b] text-white' : 'text-[#a3adbd] hover:bg-[#1c242e]'}`}
          >
            <Film size={14} /> Preview
          </button>
          {panels.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => togglePanel(id)}
              aria-pressed={activePanel === id}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activePanel === id ? 'bg-[#26313b] text-white' : 'text-[#a3adbd] hover:bg-[#1c242e]'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        {/* Desktop tool rail. Short readable labels replace rotated text. */}
        <nav aria-label="Music video tools" className="hidden w-[76px] shrink-0 flex-col gap-2 border-r border-[#28303c] bg-[#10151c] px-2 py-3 lg:flex">
          {panels.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={panels.find(p => p.id === id)?.description}
              aria-label={label}
              aria-pressed={activePanel === id}
              onClick={() => togglePanel(id)}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activePanel === id
                ? 'border-[#385c51] bg-[#19352c] text-[#b6f2d0]'
                : 'border-transparent text-[#a3adbd] hover:border-[#303846] hover:bg-[#1c242e] hover:text-white'}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
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

        {/* Preview occupies the remaining space and always contains its true AR. */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080b10]">
          <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[#232d38] bg-[#0f151c] px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Film size={15} className="shrink-0 text-[#a3adbd]" />
              <span className="truncate text-xs font-semibold text-[#f0f3f6]">Video preview</span>
              <span className="rounded-md border border-[#293440] px-1.5 py-0.5 font-mono text-[10px] text-[#9fa9b7]">{aspectRatio}</span>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-export-modal'))}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#325845] bg-[#173525] px-3 py-1.5 text-[11px] font-semibold text-[#baf7d2] transition-colors hover:bg-[#214b35] focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Download size={13} />
              Export
            </button>
          </header>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1.5 sm:p-2">
            <MVPreview mode="music-video" />
          </div>
          <div className="h-[clamp(160px,30vh,256px)] shrink-0 overflow-hidden border-t border-[#293440] bg-[#0f151c]">
            <MVTimeline />
          </div>
        </main>
      </div>
    </div>
  );
}
