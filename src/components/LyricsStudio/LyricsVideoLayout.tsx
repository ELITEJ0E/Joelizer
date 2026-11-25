import React, { useState, useRef, useEffect } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useStore, AspectRatio } from '../../store/useStore';
import { useMVStore } from '../../store/useMVStore';
import { MVPreview } from '../MVStudio/MVPreview';
import { MVDialogPortal } from '../MVStudio/MVDialogPortal';
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem, SelectGroup, SelectLabel } from '../ui/select';
import { VideoFramingControls } from '../shared/VideoFramingControls';
import { OverlayEffectsPanel } from '../shared/OverlayEffectsPanel';
import { GlobalSettingsPanel } from '../MVStudio/GlobalSettingsPanel';
import { InteractiveStageOverlay } from './InteractiveStageOverlay';
import { LyricSizeControl } from './LyricSizeControl';
import { useOverlayEffectsStore } from '../../store/useOverlayEffectsStore';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES } from '../../lib/lyricsTemplates';
import { BACKGROUND_PRESETS } from '../../lib/lyricsBackgrounds';
import { CURATED_FONTS, FONT_OPTIONS } from '../../lib/curatedFonts';
import { cn, formatTime } from '../../lib/utils';
import { SongListSection } from './SongListSection';
import { SongListPopover } from '../Audio/SongListPopover';
import { VideoSlider } from '../ui/video-slider';
import { AppColorPicker } from '../ui/color-picker';
import { audioManager } from '../../lib/audio';
import { saveLyricsBackgroundImage, loadLyricsBackgroundImage, clearLyricsBackgroundImage } from '../../lib/storage';
import {
  Play, Pause, Check, Upload, RotateCcw, RotateCw, Maximize2, Minimize2,
  Sparkles, Type, Film, Image as ImageIcon, Music, Sliders, Palette,
  SkipBack, SkipForward, Repeat, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderPlus
} from 'lucide-react';

/**
 * Visible in the Lyrics Studio itself (desktop and mobile), not only inside
 * the secondary Artwork settings tab. These independent switches are shared
 * by live preview and canonical MP4 export.
 */
function LyricsBackdropControl() {
  const showBox = useLyricsVideoStore(s => s.typographyOverride.showContainerPill ?? false);
  const updateTypography = useLyricsVideoStore(s => s.updateTypographyOverride);

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-[#232933] bg-[#0e1115] p-2.5">
      <div>
        <div className="text-[11px] font-semibold text-[#f0f3f6]">Lyrics Background Box</div>
        <div className="text-[10px] text-[#7e8999]">Transparent by default; optional dark backdrop</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={showBox}
        onClick={() => updateTypography({ showContainerPill: !showBox })}
        className={cn(
          "shrink-0 rounded border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors",
          showBox ? "border-accent bg-[#181d26] text-accent" : "border-[#303947] bg-[#12161c] text-[#aab5c4]"
        )}
      >
        {showBox ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

/** Shared quick-access controls on mobile and desktop Lyrics Video panels. */
function KineticQuickControls() {
  const animationStyle = useLyricsVideoStore(s => s.animationStyle);
  const setAnimationStyle = useLyricsVideoStore(s => s.setAnimationStyle);
  const palette = useLyricsVideoStore(s => s.kineticPalette);
  const solidColor = useLyricsVideoStore(s => s.kineticColor || '#ffffff');
  const glowSetting = useLyricsVideoStore(s => s.kineticGlow);
  const intensity = useLyricsVideoStore(s => s.kineticIntensity);
  const update = useLyricsVideoStore(s => s.setKineticSettings);
  const [colorDraft, setColorDraft] = useState(solidColor);
  useEffect(() => setColorDraft(solidColor), [solidColor]);
  const glow = glowSetting ?? (palette !== 'solid');

  const saveHex = () => {
    const candidate = colorDraft.trim();
    if (/^#[0-9a-f]{6}$/i.test(candidate)) update({ kineticColor: candidate });
    else setColorDraft(solidColor);
  };

  return (
    <div className="space-y-2">
      <button type="button" aria-pressed={animationStyle === 'kinetic'}
        onClick={() => setAnimationStyle('kinetic')}
        className={cn('w-full rounded border px-3 py-2 text-left cursor-pointer transition-colors',
          animationStyle === 'kinetic' ? 'border-fuchsia-400 text-fuchsia-200 bg-fuchsia-500/15' : 'border-[#303947] bg-[#12161c] text-[#c7cbd5] hover:border-fuchsia-400/50')}>
        <span className="block text-[11px] font-bold uppercase">✦ Kinetic Word Pop</span>
        <span className="block text-[10px] opacity-75">Words appear at their timestamps. Choose one fixed color or a changing palette.</span>
      </button>
      {animationStyle === 'kinetic' && (
        <div className="space-y-2 rounded border border-fuchsia-400/30 bg-fuchsia-500/5 p-2.5">
          <span className="text-[10px] uppercase font-bold text-[#aeb8c5]">Kinetic text color</span>
          <div className="grid grid-cols-5 gap-1">
            {(['solid', 'neon', 'sunset', 'candy', 'rainbow'] as const).map(p => (
              <button key={p} type="button" aria-pressed={palette === p}
                onClick={() => update({ kineticPalette: p })}
                className={cn('rounded border px-1 py-1.5 text-[10px] capitalize cursor-pointer',
                  palette === p ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200' : 'border-[#303947] text-[#9ba8ba]')}>
                {p === 'solid' ? 'Solid' : p}
              </button>
            ))}
          </div>
          {palette === 'solid' && (
            <div className="space-y-1.5 rounded border border-[#303947] bg-[#0e1115] p-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="kinetic-solid-color" className="text-[10px] text-[#aeb8c5]">Fixed text color</label>
                <button type="button" onClick={() => update({ kineticColor: '#ffffff' })}
                  className="rounded border border-[#566172] bg-[#19202a] px-2 py-1 text-[10px] text-white">
                  White
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input id="kinetic-solid-color" aria-label="Choose a fixed kinetic lyric color"
                  type="color" value={solidColor} onChange={e => update({ kineticColor: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-[#566172] bg-transparent" />
                <input aria-label="Kinetic lyric hex color" type="text" value={colorDraft}
                  maxLength={7} spellCheck={false} onChange={e => setColorDraft(e.target.value)}
                  onBlur={saveHex}
                  onKeyDown={e => { if (e.key === 'Enter') { saveHex(); e.currentTarget.blur(); } }}
                  className="min-w-0 flex-1 rounded border border-[#303947] bg-[#10151d] px-2 py-1.5 font-mono text-[11px] text-white"
                  placeholder="#ffffff" />
              </div>
              <p className="text-[10px] text-[#8b98a9]">All words keep this color, even while popping in.</p>
            </div>
          )}
          <label className="flex items-center justify-between gap-2 text-[10px] text-[#aeb8c5]">
            <span>Text glow</span>
            <input aria-label="Kinetic lyric glow" type="checkbox" checked={glow}
              onChange={e => update({ kineticGlow: e.target.checked })}
              className="h-4 w-4 accent-fuchsia-400" />
          </label>
          <label className="flex justify-between text-[10px] text-[#aeb8c5]">
            Pop intensity <span className="text-fuchsia-200">{intensity.toFixed(1)}×</span>
          </label>
          <input aria-label="Kinetic lyric pop intensity" type="range" min="0.3" max="2" step="0.1"
            value={intensity} onChange={e => update({ kineticIntensity: Number(e.target.value) })}
            className="w-full accent-fuchsia-400" />
        </div>
      )}
    </div>
  );
}

function CenterStageLyricsPreset() {
  const setPosition = useLyricsVideoStore(s => s.setElementPosition);
  const updateTypography = useLyricsVideoStore(s => s.updateTypographyOverride);
  const setVisibleCount = useLyricsVideoStore(s => s.setVisibleLineCount);
  const setAnimation = useLyricsVideoStore(s => s.setAnimationStyle);
  const setShowArtwork = useLyricsVideoStore(s => s.setShowArtwork);
  const setShowVisualizer = useLyricsVideoStore(s => s.setShowVisualizer);
  const setShowMeta = useLyricsVideoStore(s => s.setShowMeta);

  return (
    <button type="button" onClick={() => {
      setPosition('lyrics', { x: 0.5, y: 0.5 });
      updateTypography({ fontSizeScale: 2.1, position: undefined, showContainerPill: false });
      useStore.getState().updateLyricsSettings({ position: undefined, showBackgroundBox: false });
      setVisibleCount(1);
      setAnimation('fade');
      setShowArtwork(false);
      setShowVisualizer(false);
      setShowMeta(false);
    }}
      className="w-full rounded-lg border border-sky-400/40 bg-sky-500/10 p-2.5 text-left hover:border-sky-300 cursor-pointer"
      title="Apply large centered lyrics and hide artwork, spectrum and song metadata; all layers can be turned back on">
      <span className="block text-[11px] font-bold text-sky-200">✧ Center Stage Lyrics</span>
      <span className="block text-[10px] text-[#99a8bb] mt-0.5">Large full lines in the middle · Focus on text · Re-enable layers anytime</span>
    </button>
  );
}

/** Reusable arrangements based on the two reference videos. Media remains user's choice. */
function ReferenceLyricPresets() {
  const setPosition = useLyricsVideoStore(s => s.setElementPosition);
  const updateTypography = useLyricsVideoStore(s => s.updateTypographyOverride);
  const updateArtwork = useLyricsVideoStore(s => s.updateArtworkOverride);
  const setVisibleCount = useLyricsVideoStore(s => s.setVisibleLineCount);
  const setAnimation = useLyricsVideoStore(s => s.setAnimationStyle);
  const setShowArtwork = useLyricsVideoStore(s => s.setShowArtwork);
  const setShowVisualizer = useLyricsVideoStore(s => s.setShowVisualizer);
  const setShowMeta = useLyricsVideoStore(s => s.setShowMeta);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);
  const applyBase = () => {
    setVisibleCount(1);
    setAnimation('fade');
    setShowVisualizer(false);
    setShowMeta(false);
    useStore.getState().updateLyricsSettings({ position: undefined, showBackgroundBox: false });
  };

  return (
    <div className="space-y-1.5 rounded border border-[#303846] bg-[#10151c] p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#8d9aab]">TikTok-inspired lyric layouts</div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => {
          applyBase();
          setCustomBackground({ type: 'color', value: '#000000', blur: 0, dim: 0 });
          setShowArtwork(true);
          updateArtwork({ style: 'sticker', animation: 'none', sizeScale: 1.6 });
          setPosition('artwork', { x: 0.71, y: 0.5 });
          setPosition('lyrics', { x: 0.38, y: 0.5 });
          updateTypography({ fontFamily: 'Playfair Display', fontWeight: 'italic 700', fontSizeScale: 1.65,
            textColor: '#fff5e9', showContainerPill: false, position: undefined });
        }} className="rounded border border-rose-400/35 bg-rose-500/10 p-2 text-left text-[11px] text-rose-100 hover:border-rose-300 cursor-pointer">
          <span className="block font-bold">🌸 Sweetie Bloom</span>
          <span className="block text-[10px] opacity-75 mt-0.5">Black backdrop · elegant cream text · right-side cutout</span>
        </button>
        <button type="button" onClick={() => {
          applyBase();
          setShowArtwork(false);
          setPosition('lyrics', { x: 0.5, y: 0.51 });
          updateTypography({ fontFamily: 'Kalam', fontWeight: '400', fontSizeScale: 1.4,
            textColor: '#ffffff', showContainerPill: false, position: undefined });
          useOverlayEffectsStore.getState().update('lyrics-video', { effect: 'cinematic', intensity: 0.18 });
        }} className="rounded border border-amber-400/35 bg-amber-500/10 p-2 text-left text-[11px] text-amber-100 hover:border-amber-300 cursor-pointer">
          <span className="block font-bold">🌅 Sunset Handwriting</span>
          <span className="block text-[10px] opacity-75 mt-0.5">White ink text · centered on your uploaded footage</span>
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-[#8191a3]">Bloom uses your track artwork as the cutout: use a transparent PNG for a flower. Sunset keeps your current background video. All styles and layers remain editable.</p>
    </div>
  );
}

function LayerVisibilityControls() {
  const showArtwork = useLyricsVideoStore(s => s.showArtwork !== false);
  const setShowArtwork = useLyricsVideoStore(s => s.setShowArtwork);
  const showVisualizer = useLyricsVideoStore(s => s.showVisualizer !== false);
  const setShowVisualizer = useLyricsVideoStore(s => s.setShowVisualizer);
  const showVinylRing = useLyricsVideoStore(s => s.showVinylRing !== false);
  const setShowVinylRing = useLyricsVideoStore(s => s.setShowVinylRing);
  const showMeta = useLyricsVideoStore(s => s.showMeta !== false);
  const setShowMeta = useLyricsVideoStore(s => s.setShowMeta);

  return (
    <div className="space-y-2 rounded border border-[#232933] bg-[#0e1115] p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7e8999]">
        Visible Layers
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowArtwork(!showArtwork)}
          aria-pressed={showArtwork}
          title="Show or hide the vinyl and album artwork"
          className={cn("rounded border px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer",
            showArtwork ? "border-accent text-accent bg-[#181d26]" : "border-[#232933] text-[#7e8999] bg-[#12161c]")}
        >
          Vinyl / Artwork {showArtwork ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setShowVisualizer(!showVisualizer)}
          aria-pressed={showVisualizer}
          title="Show or hide the spectrum / waveform visualizer independently"
          className={cn("rounded border px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer",
            showVisualizer ? "border-accent text-accent bg-[#181d26]" : "border-[#232933] text-[#7e8999] bg-[#12161c]")}
        >
          Visualizer {showVisualizer ? 'ON' : 'OFF'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowVinylRing(!showVinylRing)}
        aria-pressed={showVinylRing}
        disabled={!showArtwork}
        title="Toggle the audio-reactive ring around vinyl and CD artwork (independent of the lower visualizer)"
        className={cn("w-full rounded border px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40",
          showVinylRing ? "border-accent text-accent bg-[#181d26]" : "border-[#232933] text-[#7e8999] bg-[#12161c]")}
      >
        Vinyl Spectrum Ring {showVinylRing ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        onClick={() => setShowMeta(!showMeta)}
        aria-pressed={showMeta}
        title="Show or hide the song title and artist on preview and exported video"
        className={cn("w-full rounded border px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer",
          showMeta ? "border-accent text-accent bg-[#181d26]" : "border-[#232933] text-[#7e8999] bg-[#12161c]")}
      >
        Song Title / Artist {showMeta ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function LyricsVideoFramingControls() {
  const bg = useLyricsVideoStore(s => s.customBackground);
  const update = useLyricsVideoStore(s => s.setCustomBackground);
  if (bg.type !== 'video' && bg.type !== 'image') return null;
  return <VideoFramingControls value={bg} onChange={update} label={bg.type === "image" ? "Uploaded image" : "Uploaded video"} />;
}

export function LyricsVideoLayout() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const setVisualizerColor = (color: string) => useStore.getState().updateVisualizerSettings({ color });

  const [sidebarTab, setSidebarTab] = useState<'design' | 'settings'>('design');
  const [mobileTab, setMobileTab] = useState<'layout' | 'bg' | 'style' | 'settings' | 'songs'>('layout');
  const [isMobileCanvasMaximized, setIsMobileCanvasMaximized] = useState(false);

  const videoMode = useLyricsVideoStore(s => s.videoMode);
  const setVideoMode = useLyricsVideoStore(s => s.setVideoMode);

  useEffect(() => {
    setVideoMode('lyrics-video');
  }, [setVideoMode]);

  const selectedTemplateId = useLyricsVideoStore(s => s.selectedTemplateId);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

  const selectedBackgroundPresetId = useLyricsVideoStore(s => s.selectedBackgroundPresetId);
  const setSelectedBackgroundPresetId = useLyricsVideoStore(s => s.setSelectedBackgroundPresetId);
  const customBackground = useLyricsVideoStore(s => s.customBackground);
  const setCustomBackground = useLyricsVideoStore(s => s.setCustomBackground);

  const typographyOverride = useLyricsVideoStore(s => s.typographyOverride);
  const updateTypographyOverride = useLyricsVideoStore(s => s.updateTypographyOverride);

  const visibleLineCount = useLyricsVideoStore(s => s.visibleLineCount);
  const setVisibleLineCount = useLyricsVideoStore(s => s.setVisibleLineCount);
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);

  const animationStyle = useLyricsVideoStore(s => s.animationStyle);
  const setAnimationStyle = useLyricsVideoStore(s => s.setAnimationStyle);

  const currentTime = useStore(s => s.currentTime);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsLooping = useStore(s => s.setIsLooping);
  const previousTrack = useStore(s => s.previousTrack);
  const nextTrack = useStore(s => s.nextTrack);
  const audioDuration = useStore(s => s.audioDuration) || 180;

  const handleSeek = (time: number) => {
    const t = Math.max(0, Math.min(audioDuration, time));
    setCurrentTime(t);
    audioManager.seek(t);
  };

  const aspectRatio = useStore(s => s.aspectRatio);
  const setAspectRatio = useStore(s => s.setAspectRatio);

  const currentTrack = useStore(s => s.tracks[s.currentTrackIndex] || s.tracks[0]);
  const globalAlbumArt = useStore(s => s.albumArt);
  const albumArt = currentTrack?.albumArt || globalAlbumArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
  const lyricsLines = useStore(s => s.lyricsSettings?.lines) || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const backgroundStripRef = useRef<HTMLDivElement>(null);
  const mobileBackgroundStripRef = useRef<HTMLDivElement>(null);
  const [showBackgroundImport, setShowBackgroundImport] = useState(false);
  const [isDraggingBackground, setIsDraggingBackground] = useState(false);
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);
  const [hasSavedBackgroundImage, setHasSavedBackgroundImage] = useState(false);
  const imageLoadEpoch = useRef(0);

  // Blob URLs are temporary, so restore uploaded image bytes from IndexedDB
  // (the same durable storage approach used by MV Studio) after a reload.
  useEffect(() => {
    // Previous versions used localStorage. Do not carry that selection across
    // new browser sessions now that Lyrics Studio is session-scoped.
    localStorage.removeItem('joelizer-lyrics-bg-image-active');
    const sessionSelection = sessionStorage.getItem('joelizer-lyrics-bg-image-active');
    if (!sessionSelection) return;
    let cancelled = false;
    const epoch = ++imageLoadEpoch.current;
    void loadLyricsBackgroundImage().then(blob => {
      if (cancelled || epoch !== imageLoadEpoch.current || !blob) return;
      setHasSavedBackgroundImage(true);
      if (sessionSelection === 'true') {
        const url = URL.createObjectURL(blob);
        setCustomBackground({ type: 'image', value: url, videoUrl: undefined });
      }
    }).catch(err => console.warn('Could not restore Lyrics Video background:', err));
    return () => { cancelled = true; };
  }, [setCustomBackground]);

  const restoreSavedBackgroundImage = async () => {
    const epoch = ++imageLoadEpoch.current;
    try {
      const blob = await loadLyricsBackgroundImage();
      if (!blob || epoch !== imageLoadEpoch.current) return;
      const url = URL.createObjectURL(blob);
      setCustomBackground({ type: 'image', value: url, videoUrl: undefined });
      sessionStorage.setItem('joelizer-lyrics-bg-image-active', 'true');
      setBackgroundUploadError(null);
    } catch { setBackgroundUploadError('Could not load your saved background image.'); }
  };

  const removeSavedBackgroundImage = async () => {
    ++imageLoadEpoch.current;
    sessionStorage.removeItem('joelizer-lyrics-bg-image-active');
    setHasSavedBackgroundImage(false);
    if (customBackground.type === 'image' && customBackground.value.startsWith('blob:')) {
      setCustomBackground({ type: 'gradient', value: BACKGROUND_PRESETS.find(p => p.type === 'gradient')?.value || '#18181b', videoUrl: undefined });
    }
    try { await clearLyricsBackgroundImage(); }
    catch { setBackgroundUploadError('Could not remove the saved image from browser storage.'); }
  };

  const selectBackgroundPreset = (preset: typeof BACKGROUND_PRESETS[number]) => {
    sessionStorage.setItem('joelizer-lyrics-bg-image-active', 'inactive');
    setSelectedBackgroundPresetId(preset.id);
    if (preset.id === 'cover') setCustomBackground({ type: 'blurred-artwork', value: albumArt });
    else setCustomBackground({ type: preset.type as any, value: preset.value });
  };

  // Layout Styles Presets mapped to Mureka layout cards
  const LAYOUT_PRESETS: Array<{ id: LyricTemplateId }> = [
    { id: 'full' },
    { id: 'square' },
    { id: 'circle' },
    { id: 'vinyl' },
    { id: 'glowing-disc' },
    { id: 'vinyl-needle' },
    { id: 'glowing-disc-needle' },
    { id: 'cd' },
    { id: 'cd-needle' },
  ];

  const applyCustomBackgroundFile = (file?: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/') || (!file.type && /\.(mp4|webm|mov|m4v)$/i.test(file.name));
    const isImage = file.type.startsWith('image/') || (!file.type && /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name));
    if (!isVideo && !isImage) {
      setBackgroundUploadError('Please drop an image or video file.');
      return;
    }
    setBackgroundUploadError(null);

    const url = URL.createObjectURL(file);

    if (isVideo) {
      sessionStorage.setItem('joelizer-lyrics-bg-image-active', 'inactive');
      setCustomBackground({ type: 'video', value: url, videoUrl: url, blur: 0, dim: 0, vignette: 0 });
    } else {
      ++imageLoadEpoch.current;
      setCustomBackground({ type: 'image', value: url, videoUrl: undefined, blur: 0, dim: 0, vignette: 0 });
      sessionStorage.setItem('joelizer-lyrics-bg-image-active', 'true');
      void saveLyricsBackgroundImage(file).then(() => {
        setHasSavedBackgroundImage(true);
      }).catch(() => {
        sessionStorage.removeItem('joelizer-lyrics-bg-image-active');
        setBackgroundUploadError('Image is usable now, but could not be saved for future visits.');
      });
    }
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.currentTarget.files ?? []);
    const firstMedia = files.find(file => file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name));
    applyCustomBackgroundFile(firstMedia || files[0]);
    if (firstMedia) setShowBackgroundImport(false);
    e.target.value = ''; // Allow selecting the same file again.
  };

  const handleBackgroundDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingBackground(true);
  };

  const handleBackgroundDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBackground(false);
    const files: File[] = Array.from(e.dataTransfer.files);
    const firstMedia = files.find(file => file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name));
    applyCustomBackgroundFile(firstMedia || files[0]);
    if (firstMedia) setShowBackgroundImport(false);
  };

  const fontOptions = ['Outfit', 'Inter', 'Playfair Display', 'Space Grotesk', 'Plus Jakarta Sans', 'Cinzel'];
  const colorSwatches = ['#00e676', '#38bdf8', '#06b6d4', '#c084fc', '#f472b6', '#fef08a', '#ffffff'];

  // Waveform bars data for bottom timeline visualizer
  const WAVEFORM_BARS = [
    0.25, 0.40, 0.65, 0.85, 0.45, 0.30, 0.55, 0.75, 0.90, 0.60,
    0.35, 0.50, 0.70, 0.95, 0.80, 0.40, 0.25, 0.60, 0.85, 0.50,
    0.30, 0.45, 0.75, 0.90, 0.65, 0.35, 0.50, 0.80, 1.00, 0.70,
    0.40, 0.25, 0.60, 0.85, 0.55, 0.35, 0.50, 0.75, 0.90, 0.60,
    0.30, 0.45, 0.70, 0.95, 0.80, 0.40, 0.25, 0.55, 0.85, 0.50,
    0.30, 0.50, 0.75, 0.90, 0.65, 0.35, 0.45, 0.80, 0.95, 0.70,
    0.40, 0.25, 0.55, 0.85, 0.50, 0.30, 0.45, 0.75, 0.60, 0.35
  ];

  const handleWaveformScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    handleSeek(ratio * audioDuration);
  };

  const playbackProgress = Math.max(0, Math.min(1, currentTime / (audioDuration || 1)));

  return (
    <div className="flex flex-col h-full bg-[#0a0c0f] text-[#f0f3f6] font-sans select-none overflow-hidden relative">
      
      {/* MAIN WORKSPACE: LEFT CONTROL SIDEBAR + RIGHT STAGE */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* ========================================================================= */}
        {/* MOBILE WORKSPACE (< md) */}
        {/* ========================================================================= */}
        <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden relative bg-[#0a0c0f]">
          {/* 1. Mobile Canvas Stage at Top */}
          <div className={cn(
            "w-full bg-[#0a0c0f] flex flex-col items-center justify-center relative overflow-hidden transition-all duration-200 shrink-0 border-b border-[#232933]",
            isMobileCanvasMaximized ? "flex-1" : "h-[38vh] min-h-[220px] max-h-[350px]"
          )}>
            <div className="w-full h-full p-1 relative flex items-center justify-center">
              <MVPreview mode="lyrics-video" />
            </div>
            {/* Mobile Stage Top Bar (Aspect Ratio Pills + Maximize/Controls Toggle) */}
            <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none z-30">
              {/* Ratio Pills */}
              <div className="flex items-center gap-1 bg-[#0e1115]/90 backdrop-blur-md p-0.5 rounded border border-[#232933] pointer-events-auto shadow-md">
                {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => {
                      setAspectRatio(ar);
                      resetElementPositions(ar);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer",
                      aspectRatio === ar ? "bg-accent text-black" : "text-[#7e8999] hover:text-[#f0f3f6]"
                    )}
                  >
                    {ar}
                  </button>
                ))}
              </div>

              {/* Expand / Minimize Canvas Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileCanvasMaximized(!isMobileCanvasMaximized)}
                className="px-2 py-1 rounded bg-[#0e1115]/90 hover:bg-[#161b22] text-[#c9d1d9] hover:text-white border border-[#232933] pointer-events-auto transition-colors shadow-md cursor-pointer flex items-center gap-1 text-[9px] font-mono font-bold"
                title={isMobileCanvasMaximized ? "Show editing controls" : "Expand video preview"}
              >
                {isMobileCanvasMaximized ? <Minimize2 size={11} className="text-accent" /> : <Maximize2 size={11} className="text-accent" />}
                <span>{isMobileCanvasMaximized ? "Controls" : "Expand"}</span>
              </button>
            </div>
          </div>

          {/* 2. Mobile Controls Panel (Visible when canvas is not maximized) */}
          {!isMobileCanvasMaximized && (
            <div className="flex-1 min-h-0 flex flex-col bg-[#12161c] overflow-hidden">
              {/* Mobile Segmented Navigation Bar */}
              <div className="flex items-center bg-[#0e1115] border-b border-[#232933] px-2 py-1 gap-1 shrink-0 overflow-x-auto no-scrollbar">
                {[
                  { id: 'layout' as const, label: 'Layout', icon: Sparkles },
                  { id: 'bg' as const, label: 'Background', icon: ImageIcon },
                  { id: 'style' as const, label: 'Style & Font', icon: Type },
                  { id: 'settings' as const, label: 'Settings', icon: Sliders },
                  { id: 'songs' as const, label: 'Songs', icon: Music },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = mobileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileTab(tab.id)}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer shrink-0",
                        isActive
                          ? "bg-[#181d26] text-accent border border-accent/40 shadow-sm"
                          : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                      )}
                    >
                      <Icon size={11} className={isActive ? "text-accent" : ""} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Tab Content Panel */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3.5 custom-scrollbar">
                {mobileTab === 'layout' && (
                  <div className="space-y-3.5">
                    <LayerVisibilityControls />
                    <LyricsBackdropControl />
                    {/* Layout Cards */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                          <Sparkles size={12} className="text-accent" />
                          <span>Layout Templates</span>
                        </span>
                        <span className="text-[9px] font-mono text-[#5e6877]">9 Styles</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                        {LAYOUT_PRESETS.map((layout) => {
                          const isSelected = selectedTemplateId === layout.id;
                          return (
                            <button
                              key={layout.id}
                              type="button"
                              onClick={() => setSelectedTemplateId(layout.id)}
                              className={cn(
                                "relative shrink-0 w-[72px] h-[94px] rounded overflow-hidden border transition-all cursor-pointer group bg-[#181d26]",
                                isSelected
                                  ? "border-accent ring-1 ring-accent"
                                  : "border-[#232933] hover:border-[#2b3442]"
                              )}
                            >
                              {layout.id !== 'full' && (
                                <div className="absolute inset-0 z-0">
                                  <img src={albumArt} alt="" className="w-full h-full object-cover blur-sm brightness-40" />
                                </div>
                              )}
                              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-1">
                                {layout.id === 'full' && (
                                  <img src={albumArt} alt="" className="w-full h-full object-cover rounded" />
                                )}
                                {layout.id === 'square' && (
                                  <div className="w-9 h-9 rounded overflow-hidden shadow mb-1.5 relative border border-white/10">
                                    <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                {layout.id === 'circle' && (
                                  <div className="w-9 h-9 rounded-full overflow-hidden shadow mb-1.5 relative border border-white/20">
                                    <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                {(layout.id === 'glowing-disc' || layout.id === 'glowing-disc-needle') && (
                                  <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#232933] mb-1.5 relative flex items-center justify-center border border-accent/40">
                                    <div className="w-full h-full rounded-full bg-[#111317] relative overflow-hidden flex items-center justify-center border border-white/10">
                                      <div className="absolute inset-1 rounded-full border border-white/10"></div>
                                      <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                        <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {(layout.id === 'vinyl' || layout.id === 'vinyl-needle') && (
                                  <div className="w-11 h-11 rounded-full bg-[#111317] shadow mb-1.5 relative flex items-center justify-center border border-[#232933]">
                                    <div className="absolute inset-1 rounded-full border border-white/10"></div>
                                    <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                      <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  </div>
                                )}
                                {(layout.id === 'cd' || layout.id === 'cd-needle') && (
                                  <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#1d222b] mb-1.5 relative flex items-center justify-center border border-[#232933]">
                                    <div className="w-full h-full rounded-full bg-[#14171d] relative overflow-hidden flex items-center justify-center">
                                      <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20">
                                        <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                                  <Check size={9} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Visible Lines Count */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-[#7e8999]">Lyrics Display Lines</span>
                      <div className="grid grid-cols-3 gap-1 bg-[#0e1115] p-1 rounded border border-[#232933]">
                        {[1, 2, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setVisibleLineCount(count)}
                            className={cn(
                              "py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer",
                              visibleLineCount === count
                                ? "bg-[#181d26] text-accent border border-accent"
                                : "text-[#7e8999] hover:text-[#f0f3f6]"
                            )}
                          >
                            {count} {count === 1 ? 'Line' : 'Lines'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation Style */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#7e8999]">Animation Style</span>
                        <span className="text-[10px] font-mono text-accent font-bold uppercase">
                          {animationStyle === 'kinetic' ? 'Kinetic' : animationStyle === 'karaoke' ? 'Karaoke' : animationStyle === 'none' ? 'None' : 'Fade'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 bg-[#0e1115] p-1 rounded border border-[#232933]">
                        <button
                          type="button"
                          onClick={() => setAnimationStyle('karaoke')}
                          className={cn(
                            "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                            animationStyle === 'karaoke'
                              ? "bg-[#181d26] text-accent border border-accent"
                              : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                          )}
                        >
                          <span className="font-bold text-[11px] uppercase tracking-wider">Karaoke</span>
                          <span className="text-[9px] text-[#7e8999]">Word Highlight</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnimationStyle('fade')}
                          className={cn(
                            "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                            animationStyle === 'fade'
                              ? "bg-[#181d26] text-accent border border-accent"
                              : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                          )}
                        >
                          <span className="font-bold text-[11px] uppercase tracking-wider">Fade In / Out</span>
                          <span className="text-[9px] text-[#7e8999]">Line Crossfade</span>
                        </button>
                        <button type="button" aria-pressed={animationStyle === 'none'}
                          onClick={() => setAnimationStyle('none')}
                          className={cn(
                            "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                            animationStyle === 'none'
                              ? "bg-[#181d26] text-accent border border-accent"
                              : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                          )}>
                          <span className="font-bold text-[11px] uppercase tracking-wider">None</span>
                          <span className="text-[9px] text-[#7e8999]">Instant / Fast Songs</span>
                        </button>
                      </div>
                      <KineticQuickControls />
                      <CenterStageLyricsPreset />
                      <ReferenceLyricPresets />
                      <LyricSizeControl />
                    </div>
                  </div>
                )}

                {mobileTab === 'bg' && (
                  <div className="space-y-3">
                    <LyricsVideoFramingControls />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                        <ImageIcon size={12} className="text-accent" />
                        <span>Backgrounds</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 bg-accent/15 border border-accent/40 text-accent rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Upload size={10} />
                        <span>Upload Custom</span>
                      </button>
                    </div>
                    {hasSavedBackgroundImage && <div className="flex items-center gap-2 text-[10px]">
                      <button type="button" onClick={() => void restoreSavedBackgroundImage()} className="rounded border border-accent/40 px-2 py-1.5 text-accent">Use saved image</button>
                      <button type="button" onClick={() => void removeSavedBackgroundImage()} className="rounded border border-red-500/30 px-2 py-1.5 text-red-300">Remove saved image</button>
                    </div>}

                    {/* 3-Row Horizontal Scrolling Carousel for Mobile */}
                    <div ref={mobileBackgroundStripRef} aria-label="Background presets, scroll horizontally"
                      className="grid grid-rows-3 grid-flow-col auto-cols-[100px] gap-1.5 overflow-x-auto pb-3 select-none h-[200px]"
                      style={{ scrollbarWidth: 'auto', scrollbarColor: '#4b596b #151c24' }}>
                      {BACKGROUND_PRESETS.map((bg) => {
                        const isSongCover = bg.id === 'cover';
                        const isSelected = isSongCover
                          ? customBackground.type === 'blurred-artwork' || (selectedBackgroundPresetId === 'cover' && !customBackground.videoUrl)
                          : (customBackground.value === bg.value && customBackground.type === bg.type) || selectedBackgroundPresetId === bg.id;

                        return (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => selectBackgroundPreset(bg)}
                            className={cn(
                              "relative rounded overflow-hidden border p-1 text-left transition-colors cursor-pointer flex flex-col justify-between shrink-0 bg-[#181d26]",
                              isSelected ? "border-accent ring-1 ring-accent" : "border-[#232933] hover:border-[#2b3442]"
                            )}
                            style={{ background: bg.previewGradient || bg.value || '#12161c' }}
                          >
                            {isSongCover && (
                              <img src={albumArt} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none" />
                            )}
                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-[7px] font-bold text-[#f0f3f6] bg-[#0a0c0f]/80 px-1 py-0.5 rounded uppercase">
                                {bg.category || (bg.type === 'particles' ? 'Anim' : bg.type === 'waveform' ? 'Wave' : 'Grad')}
                              </span>
                            </div>
                            <span className="relative z-10 text-[8px] font-bold text-[#f0f3f6] uppercase truncate bg-[#0a0c0f]/70 px-1 py-0.5 rounded">
                              {bg.name}
                            </span>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                                <Check size={9} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mobileTab === 'style' && (
                  <div className="space-y-3.5">
                    {/* Font Family Selector */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#7e8999]">Font Family</span>
                        <span className="text-[10px] font-mono text-accent">{typographyOverride.fontFamily}</span>
                      </div>
                      <Select value={typographyOverride.fontFamily}
                    onValueChange={fontFamily => updateTypographyOverride({ fontFamily })}>
                    <SelectTrigger aria-label="Lyric font" className="w-full border-[#303846] bg-[#0e1115] h-10 text-xs text-[#f0f3f6] normal-case">
                      <SelectValue placeholder="Choose font" />
                    </SelectTrigger>
                    <SelectContent className="z-[110] max-h-[65vh] bg-[#111820] border-[#303846]">
                      {['Modern Sans', 'Display / Urban', 'Retro / Synth', 'Serif & Luxury', 'Bold Poster'].map(groupName => {
                        const groupFonts = CURATED_FONTS.filter(f => f.category === groupName);
                        if (!groupFonts.length) return null;
                        return (
                          <SelectGroup key={groupName}>
                            <SelectLabel>{groupName}</SelectLabel>
                            {groupFonts.map(f => (
                              <SelectItem key={f.family} value={f.family}>{f.family} — {f.previewText}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                    </div>

                    {/* Accent Color Swatches & Picker */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#7e8999]">Accent Color</span>
                        <span className="text-[10px] font-mono text-[#4a5568]">{activeColor}</span>
                      </div>
                      <div className="bg-[#0e1115] p-2.5 rounded border border-[#232933]">
                        <AppColorPicker
                          value={activeColor}
                          onChange={(c) => setVisualizerColor(c)}
                          boxShadow={`0 0 15px ${activeColor}30`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {mobileTab === 'settings' && (
                  <div className="space-y-3">
                    <OverlayEffectsPanel mode="lyrics-video" />
                    <GlobalSettingsPanel />
                  </div>
                )}

                {mobileTab === 'songs' && (
                  <div className="space-y-3">
                    <SongListSection />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Mobile Bottom Transport Bar */}
          <div className="bg-[#0e1115] border-t border-[#232933] px-2.5 py-1.5 flex flex-col gap-1 shrink-0 z-30">
            <div className="flex items-center justify-between gap-2">
              {/* Transport controls */}
              <div className="flex items-center gap-1 shrink-0">
                <SongListPopover align="left" />
                <button
                  type="button"
                  onClick={previousTrack}
                  className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                  title="Previous Track"
                >
                  <SkipBack size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-md"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={nextTrack}
                  className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                  title="Next Track"
                >
                  <SkipForward size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLooping(!isLooping)}
                  className={cn(
                    "p-1.5 rounded transition-colors cursor-pointer shrink-0 relative",
                    isLooping ? "bg-[#181d26] border border-accent text-accent" : "text-[#7e8999] hover:text-[#f0f3f6]"
                  )}
                  title={isLooping ? "Disable Loop" : "Enable Loop"}
                >
                  <Repeat size={13} />
                </button>
              </div>

              {/* Timecode display */}
              <div className="text-[10px] font-mono font-medium text-[#7e8999] tracking-wider shrink-0 text-right">
                <span className="text-[#c4cad4] font-bold">{formatTime(currentTime)}</span> / {formatTime(audioDuration)}
              </div>
            </div>

            {/* Scrubber slider */}
            <div className="w-full flex items-center px-1">
              <VideoSlider
                value={currentTime}
                min={0}
                max={audioDuration || 100}
                step={0.01}
                onChange={handleSeek}
                formatTooltip={formatTime}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* LEFT CONTROL SIDEBAR (Desktop md+) */}
        <div className="hidden md:flex md:w-80 lg:w-96 bg-[#12161c] border-r border-[#232933] flex-col shrink-0 overflow-y-auto no-scrollbar p-3.5 gap-4 z-20">
          
          {/* Sidebar Tab Toggle */}
          <div className="flex gap-1 p-0.5 bg-[#0e1115] rounded border border-[#232933] shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab('design')}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center",
                sidebarTab === 'design'
                  ? "bg-[#181d26] text-accent border border-[#2b3442]"
                  : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/50"
              )}
            >
              Quick Design
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('settings')}
              className={cn(
                "flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-center",
                sidebarTab === 'settings'
                  ? "bg-[#181d26] text-accent border border-[#2b3442]"
                  : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/50"
              )}
            >
              Advanced Settings
            </button>
          </div>

          {sidebarTab === 'settings' ? (
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto custom-scrollbar pb-4">
              <p className="text-[11px] leading-relaxed text-[#9caabd]">Fine-tune effects and video settings. Expand only what you need.</p>
              <OverlayEffectsPanel mode="lyrics-video" />
              <GlobalSettingsPanel />
            </div>
          ) : (
            <>
              {/* 0. SONG LIST SECTION */}
              <div className="pb-3 border-b border-[#232933]">
                <SongListSection />
              </div>

              <LayerVisibilityControls />
              <LyricsBackdropControl />

              {/* 1. LAYOUT SELECTOR SECTION */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  <span>Layout</span>
                </label>

                {/* Layout Cards Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                  {LAYOUT_PRESETS.map((layout) => {
                    const isSelected = selectedTemplateId === layout.id;
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(layout.id)}
                        className={cn(
                          "relative shrink-0 w-[72px] h-[94px] rounded overflow-hidden border transition-all cursor-pointer group bg-[#181d26]",
                          isSelected
                            ? "border-accent ring-1 ring-accent"
                            : "border-[#232933] hover:border-[#2b3442]"
                        )}
                      >
                        {/* Blurred Background Base for all except full */}
                        {layout.id !== 'full' && (
                          <div className="absolute inset-0 z-0">
                            <img src={albumArt} alt="" className="w-full h-full object-cover blur-sm brightness-40" />
                          </div>
                        )}

                        {/* Content Layers */}
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-1">
                          
                          {layout.id === 'full' && (
                            <img src={albumArt} alt="" className="w-full h-full object-cover rounded" />
                          )}

                          {layout.id === 'square' && (
                            <div className="w-9 h-9 rounded overflow-hidden shadow mb-1.5 relative border border-white/10">
                               <img src={albumArt} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {layout.id === 'circle' && (
                            <div className="w-9 h-9 rounded-full overflow-hidden shadow mb-1.5 relative border border-white/20">
                               <img src={albumArt} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {(layout.id === 'glowing-disc' || layout.id === 'glowing-disc-needle') && (
                            <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#232933] mb-1.5 relative flex items-center justify-center border border-accent/40">
                              <div className="w-full h-full rounded-full bg-[#111317] relative overflow-hidden flex items-center justify-center border border-white/10">
                                <div className="absolute inset-1 rounded-full border border-white/10"></div>
                                <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                  <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                </div>
                                {layout.id === 'glowing-disc-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(layout.id === 'vinyl' || layout.id === 'vinyl-needle') && (
                            <div className="w-11 h-11 rounded-full bg-[#111317] shadow mb-1.5 relative flex items-center justify-center border border-[#232933]">
                               <div className="absolute inset-1 rounded-full border border-white/10"></div>
                               <div className="absolute inset-2 rounded-full border border-white/10"></div>
                               <div className="w-3.5 h-3.5 rounded-full overflow-hidden relative z-10 border border-white/40">
                                  <img src={albumArt} alt="" className="w-full h-full object-cover" />
                               </div>
                               {layout.id === 'vinyl-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                               )}
                            </div>
                          )}

                          {(layout.id === 'cd' || layout.id === 'cd-needle') && (
                            <div className="w-11 h-11 rounded-full p-[1.5px] bg-[#1d222b] mb-1.5 relative flex items-center justify-center border border-[#232933]">
                               <div className="w-full h-full rounded-full bg-[#14171d] relative overflow-hidden flex items-center justify-center">
                                 <div className="w-4 h-4 rounded-full overflow-hidden border border-white/20">
                                    <img src={albumArt} alt="" className="w-full h-full object-cover" />
                                 </div>
                                 <div className="w-1.5 h-1.5 rounded-full bg-black border border-white/20 absolute"></div>
                               </div>
                               {layout.id === 'cd-needle' && (
                                  <div className="absolute -top-1 -right-1 w-5 h-7 border-r-2 border-t-2 border-[#c4cad4] rounded-tr z-20 origin-top-right rotate-12">
                                    <div className="absolute bottom-0 right-[-2px] w-1.5 h-2 bg-[#12161c] rounded-xs border border-white/20">
                                      <div className="w-full h-0.5 bg-accent"></div>
                                    </div>
                                  </div>
                               )}
                            </div>
                          )}

                          {/* Mock Text Lines */}
                          <div className="flex flex-col gap-0.5 items-center w-full px-2 opacity-50">
                            <div className="h-0.5 w-full max-w-[36px] bg-white rounded-full"></div>
                            <div className="h-0.5 w-full max-w-[26px] bg-white rounded-full"></div>
                          </div>
                        </div>

                        {/* Active Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                            <Check size={9} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. BACKGROUND SELECTOR SECTION - 3 ROWS HORIZONTAL SCROLL */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-accent" />
                    <span>Background</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#5e6877]">
                    {BACKGROUND_PRESETS.length + 1} presets
                  </span>
                </div>

                <LyricsVideoFramingControls />
                {hasSavedBackgroundImage && <div className="flex items-center gap-2 text-[10px]">
                  <button type="button" onClick={() => void restoreSavedBackgroundImage()} className="rounded border border-accent/40 px-2 py-1.5 text-accent">Use saved image</button>
                  <button type="button" onClick={() => void removeSavedBackgroundImage()} className="rounded border border-red-500/30 px-2 py-1.5 text-red-300">Remove saved image</button>
                </div>}

                {/* Mouse users can drag the visible scrollbar or use arrows. */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#8fa0b3]">Browse backdrops</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label="Scroll backgrounds left"
                      onClick={() => backgroundStripRef.current?.scrollBy({ left: -270, behavior: 'smooth' })}
                      className="rounded border border-[#354153] bg-[#18212b] p-1.5 text-[#c5d3e2] hover:text-accent cursor-pointer">
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" aria-label="Scroll backgrounds right"
                      onClick={() => backgroundStripRef.current?.scrollBy({ left: 270, behavior: 'smooth' })}
                      className="rounded border border-[#354153] bg-[#18212b] p-1.5 text-[#c5d3e2] hover:text-accent cursor-pointer">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                <div ref={backgroundStripRef} aria-label="Background presets, scroll horizontally"
                  className="grid grid-rows-3 grid-flow-col auto-cols-[104px] sm:auto-cols-[112px] gap-1.5 overflow-x-auto pb-3 select-none h-[216px]"
                  style={{ scrollbarWidth: 'auto', scrollbarColor: '#4b596b #151c24' }}>
                  {/* Upload Custom File Card */}
                  <button
                    type="button"
                    onClick={() => { setBackgroundUploadError(null); setShowBackgroundImport(true); }}
                    className="relative rounded border border-dashed border-[#2b3442] hover:border-accent p-2 flex flex-col items-center justify-center gap-1 text-[#7e8999] hover:text-accent bg-[#0e1115] hover:bg-[#181d26] transition-colors cursor-pointer group shrink-0"
                  >
                    <Upload size={13} className="text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#f0f3f6]">Upload</span>
                    <span className="text-[8px] text-[#5e6877]">Img / Video</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.mov,.m4v"
                    onChange={handleCustomFileUpload}
                    className="hidden"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    // @ts-ignore Chromium folder picker attribute
                    webkitdirectory=""
                    onChange={handleCustomFileUpload}
                    className="hidden"
                  />

                  {/* Background Preset Cards flowing into 3 rows */}
                  {BACKGROUND_PRESETS.map((bg) => {
                    const isSongCover = bg.id === 'cover';
                    const isSelected = isSongCover
                      ? customBackground.type === 'blurred-artwork' || (selectedBackgroundPresetId === 'cover' && !customBackground.videoUrl)
                      : (customBackground.value === bg.value && customBackground.type === bg.type) || selectedBackgroundPresetId === bg.id;

                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => selectBackgroundPreset(bg)}
                        className={cn(
                          "relative rounded overflow-hidden border p-1.5 text-left transition-colors cursor-pointer flex flex-col justify-between shrink-0 group bg-[#181d26]",
                          isSelected
                            ? "border-accent ring-1 ring-accent"
                            : "border-[#232933] hover:border-[#2b3442]"
                        )}
                        style={{
                          background: bg.previewGradient || bg.value || '#12161c'
                        }}
                      >
                        {isSongCover && (
                          <img 
                            src={albumArt} 
                            alt="Song Cover" 
                            className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none group-hover:opacity-70 transition-opacity" 
                          />
                        )}

                        {/* Top Row: Category/Duration Pill */}
                        <div className="relative z-10 flex items-center justify-between w-full">
                          <span className="text-[7px] font-bold text-[#f0f3f6] bg-[#0a0c0f]/80 px-1 py-0.5 rounded uppercase tracking-widest">
                            {bg.category || (bg.type === 'particles' ? 'Anim' : bg.type === 'waveform' ? 'Wave' : 'Grad')}
                          </span>
                          {bg.duration && (
                            <span className="text-[7px] font-mono text-[#7e8999] bg-[#0a0c0f]/80 px-1 py-0.5 rounded">
                              {bg.duration}
                            </span>
                          )}
                        </div>

                        {/* Bottom Title */}
                        <div className="relative z-10 mt-auto flex items-center justify-between w-full">
                          <span className="text-[8px] font-bold text-[#f0f3f6] uppercase tracking-wider truncate bg-[#0a0c0f]/70 px-1 py-0.5 rounded max-w-full">
                            {bg.name}
                          </span>
                        </div>

                        {/* Dark Vignette Overlay */}
                        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

                        {/* Active Checkmark Badge */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-accent text-[#0a0c0f] flex items-center justify-center z-20">
                            <Check size={9} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. ASPECT RATIO SECTION - ALL 6 RATIOS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <Film size={13} className="text-accent" />
                    <span>Aspect Ratio</span>
                  </label>
                  <span className="text-[10px] font-mono text-accent font-bold">
                    {aspectRatio}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1 bg-[#0e1115] p-1 rounded border border-[#232933]">
                  {(['16:9', '9:16', '1:1', '4:5', '3:4', '4:3'] as AspectRatio[]).map((ar) => {
                    const isSelected = aspectRatio === ar;
                    return (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => {
                          setAspectRatio(ar);
                          resetElementPositions(ar);
                        }}
                        className={cn(
                          "py-1.5 px-0.5 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center justify-center",
                          isSelected
                            ? "bg-[#181d26] text-accent border border-accent"
                            : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                        )}
                      >
                        <span className="text-[10px] font-mono whitespace-nowrap">{ar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. LYRIC ANIMATION STYLE SECTION */}
              <div className="space-y-2 pt-2 border-t border-[#232933]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                    <Sparkles size={13} className="text-accent" />
                    <span>Animation Style</span>
                  </label>
                  <span className="text-[10px] font-mono text-accent font-bold uppercase">
                    {animationStyle === 'kinetic' ? 'Kinetic' : animationStyle === 'karaoke' ? 'Karaoke' : animationStyle === 'none' ? 'None' : 'Fade In/Out'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 bg-[#0e1115] p-1 rounded border border-[#232933]">
                  <button
                    type="button"
                    onClick={() => setAnimationStyle('karaoke')}
                    className={cn(
                      "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                      animationStyle === 'karaoke'
                        ? "bg-[#181d26] text-accent border border-accent"
                        : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">Karaoke</span>
                    <span className="text-[9px] text-[#7e8999]">Word Highlight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnimationStyle('fade')}
                    className={cn(
                      "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                      animationStyle === 'fade'
                        ? "bg-[#181d26] text-accent border border-accent"
                        : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">Fade In / Out</span>
                    <span className="text-[9px] text-[#7e8999]">Line Crossfade</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationStyle('none')}
                    aria-pressed={animationStyle === 'none'}
                    className={cn(
                      "py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5",
                      animationStyle === 'none'
                        ? "bg-[#181d26] text-accent border border-accent"
                        : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]/40"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">None</span>
                    <span className="text-[9px] text-[#7e8999]">Instant / Fast Songs</span>
                  </button>
                </div>
                <KineticQuickControls />
                <CenterStageLyricsPreset />
                <ReferenceLyricPresets />
                <LyricSizeControl />
              </div>

              {/* 5. STYLE & TYPOGRAPHY SECTION */}
              <div className="space-y-2.5 pt-2 border-t border-[#232933]">
                <label className="text-xs font-bold uppercase tracking-wider text-[#f0f3f6] flex items-center gap-1.5">
                  <Type size={13} className="text-accent" />
                  <span>Style & Typography</span>
                </label>

                {/* Font Family Selector */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#7e8999]">Font Family</span>
                    <span className="text-[10px] font-mono text-accent">{typographyOverride.fontFamily}</span>
                  </div>
                  <Select value={typographyOverride.fontFamily}
                    onValueChange={fontFamily => updateTypographyOverride({ fontFamily })}>
                    <SelectTrigger aria-label="Lyric font" className="w-full border-[#303846] bg-[#0e1115] h-9 text-xs text-[#f0f3f6] normal-case">
                      <SelectValue placeholder="Choose font" />
                    </SelectTrigger>
                    <SelectContent className="z-[110] max-h-[65vh] bg-[#111820] border-[#303846]">
                      {['Modern Sans', 'Display / Urban', 'Retro / Synth', 'Serif & Luxury', 'Bold Poster'].map(groupName => {
                        const groupFonts = CURATED_FONTS.filter(f => f.category === groupName);
                        if (!groupFonts.length) return null;
                        return (
                          <SelectGroup key={groupName}>
                            <SelectLabel>{groupName}</SelectLabel>
                            {groupFonts.map(f => (
                              <SelectItem key={f.family} value={f.family}>{f.family} — {f.previewText}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Visible Lines Selector */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#7e8999]">Lyrics Display Lines</span>
                  <div className="grid grid-cols-3 gap-1 bg-[#0e1115] p-1 rounded border border-[#232933]">
                    {[1, 2, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setVisibleLineCount(count)}
                        className={cn(
                          "py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                          visibleLineCount === count
                            ? "bg-[#181d26] text-accent border border-accent"
                            : "text-[#7e8999] hover:text-[#f0f3f6]"
                        )}
                      >
                        {count} {count === 1 ? 'Line' : 'Lines'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color Swatches */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#7e8999]">Accent Color</span>
                    <span className="text-[10px] font-mono text-[#4a5568]">{activeColor}</span>
                  </div>
                  <div className="bg-[#0e1115] p-2 rounded border border-[#232933]">
                    <AppColorPicker
                      value={activeColor}
                      onChange={(c) => setVisualizerColor(c)}
                      boxShadow={`0 0 15px ${activeColor}30`}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* RIGHT CANVAS STAGE (Desktop md+) */}
        <div className="hidden md:flex flex-1 min-w-0 bg-[#0a0c0f] flex-col relative overflow-hidden">
          <div className="flex-1 min-h-[320px] relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <MVPreview mode="lyrics-video" />
          </div>
          {/* BOTTOM VISUALIZER RANGE DISPLAY PLAYER */}
          <div className="bg-[#0e1115] border-t border-[#232933] px-3 sm:px-4 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 z-30 min-h-[56px]">
            
            {/* Transport & Playlist Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Song List Dropdown / Popup */}
              <SongListPopover align="left" />

              <div className="h-5 w-[1px] bg-[#232933] mx-1" />

              {/* Previous Track Button */}
              <button
                type="button"
                onClick={previousTrack}
                className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                title="Previous Track"
              >
                <SkipBack size={15} />
              </button>

              {/* Circular Play / Pause Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Next Track Button */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-1.5 text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26] transition-colors cursor-pointer shrink-0 rounded"
                title="Next Track"
              >
                <SkipForward size={15} />
              </button>

              {/* Looping / Repeat Button */}
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                className={cn(
                  "p-1.5 rounded transition-colors cursor-pointer shrink-0 relative",
                  isLooping
                    ? "bg-[#181d26] border border-accent text-accent"
                    : "text-[#7e8999] hover:text-[#f0f3f6] hover:bg-[#181d26]"
                )}
                title={isLooping ? "Disable Loop" : "Enable Loop (Repeat Current Song)"}
              >
                <Repeat size={14} />
                {isLooping && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 text-[#0a0c0f] text-[8px] font-bold rounded-full bg-accent flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Standardized Scrubber / Seek Bar */}
            <div className="flex-1 min-w-[160px] flex items-center gap-3">
              <div className="flex-1 flex items-center">
                <VideoSlider
                  value={currentTime}
                  min={0}
                  max={audioDuration || 100}
                  step={0.01}
                  onChange={handleSeek}
                  formatTooltip={formatTime}
                  className="w-full"
                />
              </div>

              {/* Time & Duration */}
              <div className="text-[10px] sm:text-[11px] font-mono font-medium text-[#7e8999] tracking-wider shrink-0 min-w-[80px] text-right">
                <span className="text-[#c4cad4] font-bold">{formatTime(currentTime)}</span> / {formatTime(audioDuration)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showBackgroundImport && (
        <MVDialogPortal title="Import local media" onClose={() => setShowBackgroundImport(false)}>
          <div className="flex min-w-0 flex-col gap-4 font-mono text-[#d1d5db]">
            <div className="flex items-center justify-between border-b border-[#232933] pb-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#f0f3f6]">
                <FolderPlus size={15} className="text-accent" /> Import Local Media
              </h3>
              <button type="button" onClick={() => setShowBackgroundImport(false)} className="cursor-pointer p-1 text-xs text-[#7e8999] hover:text-white" aria-label="Close import dialog">✕</button>
            </div>
            <div
              onDragEnter={handleBackgroundDragOver}
              onDragOver={handleBackgroundDragOver}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingBackground(false); }}
              onDrop={handleBackgroundDrop}
              className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-[#0a0c0f] p-6 text-center transition-colors', isDraggingBackground ? 'border-accent bg-accent/10' : 'border-[#232933] hover:border-accent/60')}
            >
              <FolderPlus size={30} className="text-accent opacity-70" />
              <div>
                <p className="text-xs font-semibold text-[#f0f3f6]">Drag & drop files or an entire folder here</p>
                <p className="mt-1 font-sans text-[10px] text-[#7e8999]">Supports MP4, WebM, MOV, JPG, PNG, WEBP</p>
                <p className="mt-1 font-sans text-[10px] text-[#7e8999]">The first supported image or video becomes your background.</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="cursor-pointer rounded bg-accent px-3.5 py-1.5 text-xs font-semibold text-[#0a0c0f] hover:bg-accent/80">Choose Files</button>
                <button type="button" onClick={() => folderInputRef.current?.click()} className="cursor-pointer rounded border border-[#232933] bg-[#161b22] px-3.5 py-1.5 text-xs font-semibold text-[#f0f3f6] hover:bg-[#1c222b]">Choose Folder</button>
              </div>
            </div>
            {backgroundUploadError && <p role="alert" className="text-xs text-red-400">{backgroundUploadError}</p>}
          </div>
        </MVDialogPortal>
      )}
    </div>
  );
}
