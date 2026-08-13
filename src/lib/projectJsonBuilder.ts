import { useStore } from '../store/useStore';
import { useMVStore } from '../store/useMVStore';
import { useLyricsVideoStore } from '../store/useLyricsVideoStore';
import { 
  CanonicalProjectJson, 
  CanonicalLyricLine, 
  CanonicalVideoClip, 
  ExportResolutionType, 
  ExportModeType, 
  getResolutionDimensions 
} from '../types/projectJson';

export async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function urlToDataUriIfNeeded(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await blobToDataUri(blob);
    } catch (e) {
      console.warn('Failed to convert blob URL to data URI:', url, e);
      return url;
    }
  }
  return url;
}

export async function buildCanonicalProjectJson(options?: {
  resolution?: ExportResolutionType;
  fps?: number;
  modeOverride?: ExportModeType;
  embedMediaAsDataUri?: boolean;
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
  const audioDuration = mainStore.audioDuration || currentTrack?.duration || 10;
  
  let rawAudioUrl = mainStore.audioUrl || currentTrack?.url || null;
  let audioDataUri: string | null = null;

  if (options?.embedMediaAsDataUri || (rawAudioUrl && rawAudioUrl.startsWith('blob:'))) {
    if (mainStore.audioFile && mainStore.audioFile instanceof Blob) {
      audioDataUri = await blobToDataUri(mainStore.audioFile);
    } else if (rawAudioUrl) {
      audioDataUri = await urlToDataUriIfNeeded(rawAudioUrl);
    }
  }

  const rangeStart = mainStore.exportRangeStart || 0;
  const rawRangeEnd = mainStore.exportRangeEnd;
  const rangeEnd = (rawRangeEnd !== null && rawRangeEnd > rangeStart) ? rawRangeEnd : audioDuration;
  const duration = Math.max(1, rangeEnd - rangeStart);

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
    }

    return {
      id: line.id || `line-${idx}`,
      startTime: Number(lineStart.toFixed(3)),
      endTime: Number(lineEnd.toFixed(3)),
      text: line.text || '',
      words: canonicalWords
    };
  });

  // Process video timeline clips
  const rawClips = mvStore.timelineClips || [];
  const canonicalClips: CanonicalVideoClip[] = [];

  for (const clip of rawClips) {
    const asset = mvStore.videoAssets.find(a => a.id === clip.assetId);
    let clipUrl = asset?.url || clip.assetId;

    if (options?.embedMediaAsDataUri && clipUrl && clipUrl.startsWith('blob:')) {
      if (asset?.file) {
        clipUrl = await blobToDataUri(asset.file);
      } else {
        clipUrl = (await urlToDataUriIfNeeded(clipUrl)) || clipUrl;
      }
    }

    canonicalClips.push({
      id: clip.id,
      assetId: clip.assetId,
      url: clipUrl,
      mediaType: clip.mediaType || asset?.mediaType || 'video',
      startTime: Number(clip.startTime.toFixed(3)),
      endTime: Number(clip.endTime.toFixed(3)),
      duration: Number((clip.endTime - clip.startTime).toFixed(3)),
      trimStart: Number(clip.trimStart.toFixed(3)),
      trimEnd: Number(clip.trimEnd.toFixed(3)),
      effect: clip.effect || 'none',
      transition: clip.transition || 'cut'
    });
  }

  // Typography & background configuration
  const typo = lyricsVideoStore.typographyOverride;
  const bg = lyricsVideoStore.customBackground;
  const artwork = lyricsVideoStore.artworkOverride;
  const vis = mainStore.visualizerSettings;

  let albumArtUrl = currentTrack?.albumArt || mainStore.albumArt;
  if (options?.embedMediaAsDataUri && albumArtUrl && albumArtUrl.startsWith('blob:')) {
    albumArtUrl = (await urlToDataUriIfNeeded(albumArtUrl)) || albumArtUrl;
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
      url: rawAudioUrl,
      audioDataUri,
      title: currentTrack?.name || mainStore.name || 'Untitled Song',
      artist: currentTrack?.artist || 'Joelizer Studio',
      albumArt: albumArtUrl,
      duration: audioDuration,
      bpm: mvStore.songAnalysis?.bpm,
      key: mvStore.songAnalysis?.key
    },
    lyrics: {
      lines: canonicalLines,
      fontFamily: typo.fontFamily || 'Inter',
      fontWeight: typo.fontWeight || '700',
      fontSizeScale: typo.fontSizeScale || 1.0,
      textColor: typo.textColor || '#ffffff',
      activeWordColor: typo.activeWordColor || '#fde047',
      inactiveWordColor: typo.inactiveWordColor || 'rgba(255, 255, 255, 0.7)',
      glowColor: typo.glowColor || '#eab308',
      showContainerPill: typo.showContainerPill ?? true,
      pillBgColor: typo.pillBgColor || 'rgba(10, 10, 12, 0.85)',
      animationStyle: lyricsVideoStore.animationOverride.wordAnimation === 'karaoke' ? 'karaoke' : 'fade'
    },
    background: {
      type: bg.type || 'color',
      value: bg.value || '#111111',
      videoUrl: bg.videoUrl,
      blurAlbumArt: mainStore.backgroundSettings.blurAlbumArt
    },
    artwork: {
      style: artwork.style || 'vinyl',
      animation: artwork.animation || 'rotate',
      sizeScale: artwork.sizeScale || 1.0
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
      showScanlines: vis.showScanlines || false
    },
    videoClips: canonicalClips,
    effects: {
      showGrain: vis.showGrain,
      showScanlines: vis.showScanlines,
      glow: !!typo.glowColor,
      vignette: true
    },
    safeArea: lyricsVideoStore.showSafeArea,
    templateId: lyricsVideoStore.selectedTemplateId
  };

  return projectJson;
}
