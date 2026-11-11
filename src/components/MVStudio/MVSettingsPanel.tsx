import React, { useEffect, useState } from 'react';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { Sliders, Type, Trash2 } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { VideoFramingControls } from '../shared/VideoFramingControls';
import { OverlayEffectsPanel } from '../shared/OverlayEffectsPanel';

export function MVSettingsPanel() {
  const currentTime = useStore(s => s.currentTime);
  const timelineClips = useMVStore(s => s.timelineClips);
  const selectedClipId = useMVStore(s => s.selectedClipId);
  const videoAssets = useMVStore(s => s.videoAssets);
  const updateTimelineClip = useMVStore(s => s.updateTimelineClip);
  // Prefer the clip visible in the preview; a previously selected clip can
  // otherwise make sliders appear unresponsive to the current scene.
  const currentClip = timelineClips.find(clip => currentTime >= clip.startTime && currentTime < clip.endTime)
    ?? timelineClips.find(clip => clip.id === selectedClipId);
  const currentAsset = videoAssets.find(asset => asset.id === currentClip?.assetId);
  const framingClip = currentClip && (currentClip.type === 'video' || currentClip.type === 'image' ||
    (!currentClip.type && (currentAsset?.type === 'video' || currentAsset?.type === 'image')))
    ? currentClip : null;
  const lyricsSettings = useStore(s => s.lyricsSettings);
  const updateLyricsSettings = useStore(s => s.updateLyricsSettings);
  const setLyricsVideoAnimation = useLyricsVideoStore(s => s.setAnimationStyle);
  const lyricsVideoAnim = useLyricsVideoStore(s => s.animationStyle);
  const lyricsAnimStyle = lyricsSettings?.animationStyle || lyricsVideoAnim || 'karaoke';
  const lyricsPos = lyricsSettings?.position || 'bottom';
  const showBox = lyricsSettings?.showBackgroundBox ?? false;
  const captionLineCount = useMVStore(s => s.captionLineCount);
  const setCaptionLineCount = useMVStore(s => s.setCaptionLineCount);
  const clearSavedMVProject = useMVStore(s => s.clearSavedMVProject);
  const [isClearingProject, setIsClearingProject] = useState(false);
  const [clearError, setClearError] = useState('');
  const handleClearMVProject = async () => {
    if (isClearingProject) return;
    const confirmed = window.confirm(
      'Delete ALL MV Studio clips, saved media, timeline timings, analysis, and editing settings from this browser? This cannot be undone. Lyrics Video and audio files are not deleted.'
    );
    if (!confirmed) return;
    setIsClearingProject(true);
    setClearError('');
    try {
      await clearSavedMVProject();
      // Do not refresh: let the live store update every timeline subscriber.
    } catch (error) {
      console.error('[MVSettings] Cannot delete saved project:', error);
      setClearError('Could not clear all stored media. Check browser storage permissions and try again.');
    } finally {
      setIsClearingProject(false);
    }
  };

  
  

  useEffect(() => {
    animate('.mv-settings-anim > *', {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(40, { start: 20 }),
      duration: 400,
      easing: 'easeOutQuart'
    });
  }, []);

  return (
    <div className="w-full h-full bg-[#0e1115] text-[#f0f3f6] flex flex-col relative overflow-hidden select-none font-mono">
      {/* Panel Header */}
      <div className="p-3 border-b border-[#232933] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
          <Sliders size={13} className="text-accent" />
          <span>Music Video Settings</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        <div className="mv-settings-anim space-y-5">
          
          <OverlayEffectsPanel mode="music-video" />

          {/* Video framing is an editing setting, not part of the media library. */}
          <div className="space-y-2">
            {framingClip ? (
              <VideoFramingControls
                value={framingClip}
                label={currentAsset?.name || 'Selected timeline media'}
                disabled={framingClip.locked}
                onChange={changes => updateTimelineClip(framingClip.id, changes)}
              />
            ) : (
              <div className="rounded-lg border border-[#303846] bg-[#111820] p-3">
                <p className="text-xs font-semibold text-[#e6e9ed]">Video framing</p>
                <p className="mt-1 text-[11px] text-[#91a0b2]">Select an image or video clip on the timeline to adjust position, zoom and crop.</p>
              </div>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[#8c9aab]">
            Visual style, cutting pace and beat sync are configured in <strong>Auto Edit → Editing Aesthetics</strong>.
            Scene transitions are also in Auto Edit, so the selected blending style is grouped with the editing workflow.
          </p>

          {/* Unified Caption & Lyric Style */}
          <div className="pt-3 border-t border-[#232933] space-y-2.5">
            <span className="text-[10px] uppercase text-[#7e8999] font-semibold tracking-wider flex items-center gap-1.5">
              <Type size={12} className="text-accent" />
              <span>Lyric Animation & Subtitles</span>
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  updateLyricsSettings({ animationStyle: 'fade' });
                  setLyricsVideoAnimation('fade');
                }}
                className={`p-2 rounded text-xs font-mono border text-center transition-all cursor-pointer ${
                  lyricsAnimStyle === 'fade'
                    ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                    : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                Smooth Fade
              </button>

              <button
                type="button"
                onClick={() => {
                  updateLyricsSettings({ animationStyle: 'karaoke' });
                  setLyricsVideoAnimation('karaoke');
                }}
                className={`p-2 rounded text-xs font-mono border text-center transition-all cursor-pointer ${
                  lyricsAnimStyle === 'karaoke'
                    ? 'bg-[#161b22] border-accent/60 text-accent font-bold shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                    : 'bg-[#0a0c0f] border-[#232933] text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                Karaoke Highlight
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="block text-[11px] font-semibold text-[#b6c2cf]">Caption display lines</span>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Caption display lines">
                {([1, 2, 5] as const).map(count => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={captionLineCount === count}
                    onClick={() => setCaptionLineCount(count)}
                    className={`rounded border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      captionLineCount === count
                        ? 'border-accent bg-[#173028] text-accent'
                        : 'border-[#303846] bg-[#0a0c0f] text-[#a7b2bf] hover:border-[#64748b]'
                    }`}
                  >
                    {count} {count === 1 ? 'Line' : 'Lines'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-[#7e8999]">
                Applies to MV Studio captions in the preview and exported video.
              </p>
            </div>

            {/* Subtitle Positioning & Background Box */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const nextPos = lyricsPos === 'center' ? 'bottom' : 'center';
                  updateLyricsSettings({ position: nextPos });
                  useLyricsVideoStore.getState().updateTypographyOverride({ position: nextPos });
                  useLyricsVideoStore.getState().setElementPosition('lyrics', {
                    x: 0.5,
                    y: nextPos === 'center' ? 0.5 : 0.82
                  });
                }}
                className="p-1.5 rounded text-[10px] font-mono border bg-[#0a0c0f] border-[#232933] text-[#f0f3f6] flex items-center justify-between cursor-pointer hover:border-[#384252]"
              >
                <span className="text-[#7e8999]">Position:</span>
                <span className="text-accent font-bold uppercase">{lyricsPos}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextBox = !showBox;
                  updateLyricsSettings({ showBackgroundBox: nextBox });
                  useLyricsVideoStore.getState().updateTypographyOverride({ showContainerPill: nextBox });
                }}
                className="p-1.5 rounded text-[10px] font-mono border bg-[#0a0c0f] border-[#232933] text-[#f0f3f6] flex items-center justify-between cursor-pointer hover:border-[#384252]"
              >
                <span className="text-[#7e8999]">Box:</span>
                <span className="text-accent font-bold uppercase">{showBox ? 'Dark Box' : 'Clear (No Box)'}</span>
              </button>
            </div>
          </div>


          <section className="space-y-2 rounded-lg border border-red-500/25 bg-red-950/10 p-3" aria-label="Saved MV project data">
            <p className="text-xs font-bold text-slate-100">Saved MV Project</p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Clip positions, trimming, effects, captions and Auto Edit settings remain saved in this browser until you clear the project. Uploaded media is saved separately in this browser's media storage.
            </p>
            <button type="button" onClick={handleClearMVProject} disabled={isClearingProject}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50">
              <Trash2 size={14} />
              {isClearingProject ? 'Deleting saved project…' : 'Delete All Saved MV Project Data'}
            </button>
            <p className="text-[10px] text-slate-500">Requires confirmation. Does not delete Lyrics Video or your separate audio library.</p>
            {clearError && <p role="alert" className="text-[11px] text-red-300">{clearError}</p>}
          </section>

        </div>
      </div>
    </div>
  );
}
