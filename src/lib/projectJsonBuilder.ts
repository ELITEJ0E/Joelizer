import { getEffectiveMVTransition } from './mvTransitionSettings';
import { useStore } from '../store/useStore';
import { useMVStore } from '../store/useMVStore';
import { useLyricsVideoStore } from '../store/useLyricsVideoStore';
import { stageAssetIfNeeded } from './assetStaging';
import { 
  CanonicalProjectJson, 
  CanonicalLyricLine, 
  CanonicalVideoClip, 
  ExportResolutionType, 
  ExportModeType, 
  getResolutionDimensions 
} from '../types/projectJson';

export async function buildCanonicalProjectJson(options?: {
  resolution?: ExportResolutionType;
  fps?: number;
  modeOverride?: ExportModeType;
  skipStaging?: boolean;
}): Promise<CanonicalProjectJson> {
  const mainStore = useStore.getState();
  const mvStore = useMVStore.getState();
  const lyricsVideoStore = useLyricsVideoStore.getState();

  const exportMode: ExportModeType = options?.modeOverride || lyricsVideoStore.videoMode || 'lyrics-video';
  const resolution: ExportResolutionType = options?.resolution || mainStore.exportResolutionOverride || '1080p';
  const fps = options?.fps || 30;
  const aspectRatio = mainStore.aspectRatio || '16:9';

  const { width, height } = getResolutionDimensions(aspectRatio, resolution);

  // Audio track info
  const currentTrack = mainStore.tracks[mainStore.currentTrackIndex];
  const audioDuration = mainStore.audioDuration || currentTrack?.duration || 0;
  const maxMVClipEnd = exportMode === 'music-video'
    ? Math.max(0, ...mvStore.timelineClips.map(clip => clip.endTime))
    : 0;
  const maxLyricEnd = Math.max(0, ...(mainStore.lyricsSettings.lines || []).map(line => line.endTime || 0));
  const projectEnd = Math.max(audioDuration, maxMVClipEnd, maxLyricEnd) || 10;
  
  let rawAudioUrl = mainStore.audioUrl || currentTrack?.url || null;
  let stagedAudioUrl: string | null = rawAudioUrl;

  if (!options?.skipStaging) {
    try {
      if (mainStore.audioFile) {
        const staged = await stageAssetIfNeeded(mainStore.audioFile, 'track_audio');
        if (staged) stagedAudioUrl = staged;
      } else if (rawAudioUrl) {
        const staged = await stageAssetIfNeeded(rawAudioUrl, 'track_audio');
        if (staged) stagedAudioUrl = staged;
      }
    } catch (stagingErr) {
      throw new Error(`Cannot prepare soundtrack for server rendering: ${stagingErr instanceof Error ? stagingErr.message : String(stagingErr)}`);
    }
  }

  const rangeStart = Math.max(0, mainStore.exportRangeStart || 0);
  const rawRangeEnd = mainStore.exportRangeEnd;
  // The default range created when loading audio must not silently truncate a longer MV timeline.
  const inheritedAudioEnd = exportMode === 'music-video' && maxMVClipEnd > audioDuration
    && rawRangeEnd !== null && Math.abs(rawRangeEnd - audioDuration) < 0.02;
  const rangeEnd = (rawRangeEnd !== null && rawRangeEnd > rangeStart && !inheritedAudioEnd)
    ? rawRangeEnd : projectEnd;
  if (!Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    throw new Error('Export end must be greater than the start time');
  }
  const duration = Math.max(1 / fps, rangeEnd - rangeStart);

  // Process lyrics lines and word-level timestamps
  const rawLines = mainStore.lyricsSettings.lines || [];
  const canonicalLines: CanonicalLyricLine[] = rawLines.map((line, idx) => {
    const lineStart = typeof line.startTime === 'number' ? line.startTime : idx * 4;
    const lineEnd = typeof line.endTime === 'number' ? line.endTime : lineStart + 3.5;

    let canonicalWords = undefined;
    if (Array.isArray(line.words) && line.words.length > 0) {
      canonicalWords = line.words.map((w, wIdx) => {
        const wStart = w.start ?? w.startTime ?? lineStart + (wIdx * 0.3);
        const wEnd = w.end ?? w.endTime ?? wStart + 0.3;
        return {
          word: w.word,
          startTime: Number(wStart.toFixed(3)),
          endTime: Number(wEnd.toFixed(3))
        };
      });
    } else if (line.text && line.text.trim().length > 0) {
      // Auto-distribute word karaoke timing across line duration
      const tokens = line.text.trim().split(/\s+/);
      const lineDur = Math.max(0.6, lineEnd - lineStart);
      const wordDur = lineDur / tokens.length;
      canonicalWords = tokens.map((word, wIdx) => {
        const wStart = lineStart + (wIdx * wordDur);
        const wEnd = wStart + (wordDur * 0.95);
        return {
          word,
          startTime: Number(wStart.toFixed(3)),
          endTime: Number(wEnd.toFixed(3))
        };
      });
    }

    return {
      id: line.id || `line-${idx}`,
      startTime: Number(lineStart.toFixed(3)),
      endTime: Number(lineEnd.toFixed(3)),
      text: line.text || '',
      secondaryText: line.secondaryText,
      words: canonicalWords
    };
  });

  // Lyrics Video is its own canvas composition. Do not serialize unrelated
  // MV timeline clips into it; the server compositor could treat those as
  // active clips and suppress the artwork / visualizer overlay.
  const rawClips = exportMode === 'music-video' ? (mvStore.timelineClips || []) : [];
  const canonicalClips: CanonicalVideoClip[] = [];

  for (const clip of rawClips) {
    const asset = mvStore.videoAssets.find(a => a.id === clip.assetId);
    let clipUrl = asset?.url || clip.assetId;

    if (!options?.skipStaging && clipUrl) {
      if (asset?.file) {
        clipUrl = (await stageAssetIfNeeded(asset.file, `clip_${clip.id}`)) || clipUrl;
      } else {
        clipUrl = (await stageAssetIfNeeded(clipUrl, `clip_${clip.id}`)) || clipUrl;
      }
    }

    const transition = getEffectiveMVTransition(
      clip, mvStore.autoTransitions, mvStore.defaultTransition, mvStore.transitionDuration
    );
    canonicalClips.push({
      id: clip.id,
      assetId: clip.assetId,
      url: clipUrl,
      type: clip.type || asset?.type || 'video',
      startTime: Number(clip.startTime.toFixed(3)),
      endTime: Number(clip.endTime.toFixed(3)),
      duration: Number((clip.endTime - clip.startTime).toFixed(3)),
      trimStart: Number(clip.trimStart.toFixed(3)),
      trimEnd: Number(clip.trimEnd.toFixed(3)),
      fit: clip.fit,
      zoom: clip.zoom,
      heightScale: clip.heightScale,
      offsetX: clip.offsetX,
      offsetY: clip.offsetY,
      effect: clip.effect || 'none',
      transition: transition.type,
      transitionDuration: transition.duration
    });
  }

  // Typography & background configuration
  const typo = lyricsVideoStore.typographyOverride;
  const bg = lyricsVideoStore.customBackground;
  const artwork = lyricsVideoStore.artworkOverride;
  const vis = mainStore.visualizerSettings;

  let albumArtUrl = currentTrack?.albumArt || mainStore.albumArt;
  if (!options?.skipStaging && albumArtUrl) {
    albumArtUrl = (await stageAssetIfNeeded(albumArtUrl, 'album_art')) || albumArtUrl;
  }

  let bgVideoUrl = bg.videoUrl;
  if (!options?.skipStaging && bgVideoUrl) {
    bgVideoUrl = (await stageAssetIfNeeded(bgVideoUrl, 'bg_video')) || bgVideoUrl;
  }

  let bgValue = bg.value || '#111111';
  if (!options?.skipStaging && bg.type === 'image' && bgValue) {
    bgValue = (await stageAssetIfNeeded(bgValue, 'bg_image')) || bgValue;
  }

  const projectJson: CanonicalProjectJson = {
    version: '1.0',
    exportMode,
    projectName: mainStore.name || 'Joelizer Video Production',
    aspectRatio,
    fps,
    resolution,
    width,
    height,
    exportRange: {
      start: Number(rangeStart.toFixed(3)),
      end: Number(rangeEnd.toFixed(3)),
      duration: Number(duration.toFixed(3))
    },
    audio: {
      url: stagedAudioUrl,
      audioDataUri: null,
      title: currentTrack?.name || mainStore.name || 'Untitled Song',
      artist: currentTrack?.artist || 'Joelizer Studio',
      albumArt: albumArtUrl,
      duration: audioDuration,
      bpm: mvStore.songAnalysis?.bpm,
      key: mvStore.songAnalysis?.key
    },
    lyrics: {
      lines: canonicalLines,
      fontFamily: typo.fontFamily || 'Outfit',
      fontWeight: typo.fontWeight || '700',
      fontSizeScale: typo.fontSizeScale || 1.0,
      textColor: typo.textColor || '#ffffff',
      activeWordColor: typo.activeWordColor || '#fde047',
      inactiveWordColor: typo.inactiveWordColor || 'rgba(255, 255, 255, 0.7)',
      glowColor: typo.glowColor || '#eab308',
      showContainerPill: typo.showContainerPill ?? false,
      pillBgColor: typo.pillBgColor || 'rgba(10, 10, 12, 0.85)',
      animationStyle: lyricsVideoStore.animationStyle || (lyricsVideoStore.animationOverride?.wordAnimation === 'karaoke' ? 'karaoke' : 'fade'),
      position: typo.position ?? mainStore.lyricsSettings?.position,
      showBackgroundBox: mainStore.lyricsSettings?.showBackgroundBox ?? false,
      visibleLineCount: exportMode === 'music-video'
        ? (mvStore.captionLineCount ?? 2)
        : (lyricsVideoStore.visibleLineCount as 1 | 2 | 5),
      bilingualEnabled: lyricsVideoStore.bilingualEnabled ?? mainStore.lyricsSettings?.bilingualEnabled ?? false,
      fadeInDuration: lyricsVideoStore.fadeInDuration ?? mainStore.lyricsSettings?.fadeInDuration ?? 0.4,
      fadeOutDuration: lyricsVideoStore.fadeOutDuration ?? mainStore.lyricsSettings?.fadeOutDuration ?? 0.4,
      fadeEasing: lyricsVideoStore.fadeEasing ?? mainStore.lyricsSettings?.fadeEasing ?? 'smooth'
    },
    background: {
      type: bg.type || 'color',
      value: bgValue,
      videoUrl: bgVideoUrl,
      fit: bg.fit,
      zoom: bg.zoom,
      heightScale: bg.heightScale,
      offsetX: bg.offsetX,
      offsetY: bg.offsetY,
      blurAlbumArt: mainStore.backgroundSettings.blurAlbumArt,
      blur: bg.blur ?? mainStore.backgroundSettings?.blur ?? 0,
      dim: bg.dim ?? mainStore.backgroundSettings?.dim ?? 0,
      brightness: bg.brightness ?? mainStore.backgroundSettings?.brightness,
      contrast: bg.contrast ?? mainStore.backgroundSettings?.contrast,
      saturation: bg.saturation ?? mainStore.backgroundSettings?.saturation,
      vignette: typeof bg.vignette === 'number' ? bg.vignette : (mainStore.backgroundSettings?.vignette ? 0.4 : 0)
    },
    artwork: {
      style: artwork.style || 'vinyl',
      animation: artwork.animation || 'rotate',
      sizeScale: artwork.sizeScale || 1.0,
      enabled: lyricsVideoStore.showArtwork ?? (lyricsVideoStore.selectedTemplateId !== 'cinematic-clean')
    },
    visualizer: {
      style: vis.style || 'bars',
      color: vis.color || '#00e676',
      sensitivity: vis.sensitivity || 0.95,
      smoothing: vis.smoothing || 0.65,
      segments: vis.segments || 8,
      hitResponse: vis.hitResponse || 0.15,
      glitchIntensity: vis.glitchIntensity || 0,
      shakeIntensity: vis.shakeIntensity || 0,
      showGrain: vis.showGrain || false,
      showScanlines: vis.showScanlines || false,
      scale: vis.scale ?? 1.0,
      enabled: lyricsVideoStore.showVisualizer ?? (vis.enabled !== false && lyricsVideoStore.selectedTemplateId !== 'cinematic-clean')
    },
    videoClips: canonicalClips,
    effects: {
      showGrain: vis.showGrain,
      showScanlines: vis.showScanlines,
      glow: !!typo.glowColor,
      vignette: true
    },
    elementPositions: lyricsVideoStore.elementPositions,
    watermarkText: 'Made with Joelizer',
    safeArea: lyricsVideoStore.showSafeArea,
    templateId: lyricsVideoStore.selectedTemplateId,
    showArtwork: lyricsVideoStore.showArtwork ?? (lyricsVideoStore.selectedTemplateId !== 'cinematic-clean'),
    showVisualizer: lyricsVideoStore.showVisualizer ?? (vis.enabled !== false && lyricsVideoStore.selectedTemplateId !== 'cinematic-clean'),
    showLyrics: lyricsVideoStore.showLyrics ?? true,
    showMeta: lyricsVideoStore.showMeta ?? (lyricsVideoStore.selectedTemplateId !== 'cinematic-clean')
  };

  return projectJson;
}
