import { CanonicalProjectJson } from '../../types/projectJson';
import { layoutMVCaption, drawMVCaption } from '../mvCaptionLayout';
import { FastMp4Source } from './FastMp4Source';
import { OfflineAudioAnalysis } from './offlineAudioAnalysis';
import { drawPositionedLyricsVisualizer } from '../positionedLyricsVisualizer';
import { getDefaultPositions } from '../lyricsLayout';
import { renderLyricsVideoFrame, renderLyricsOverlayFrame, registerCachedImage } from '../lyricsEngine';
import { LYRIC_VIDEO_TEMPLATES } from '../lyricsTemplates';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useMVStore } from '../../store/useMVStore';
import { useStore, type LyricLine } from '../../store/useStore';
import { renderVisualizer } from '../renderers';
import { drawFramedMedia } from '../lyricsBackgrounds';
import { drawOverlayEffects } from '../overlayEffects';
import { lyricsVideoLoopFrame } from '../lyricsVideoLoop';
import { getMVActiveClip, getMVTransitionLead, getMVTransitionSourceTime, getMVTransitionProgress, applyMVTransitionVisual } from '../mvTransitionTiming';
import { getMVClipMotion, applyMVClipMotion } from '../mvClipMotion';

type StageMedia = { element: HTMLVideoElement; lastFrame: number };

function mediaLabel(url: string): string {
  if (url.startsWith('blob:')) return 'uploaded local file';
  if (url.startsWith('data:')) return 'embedded media';
  try {
    const parsed = new URL(url, window.location.href);
    return decodeURIComponent(parsed.pathname.split('/').pop() || parsed.hostname).slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

function describeMediaFailure(url: string, kind: 'video' | 'image', reason: string): Error {
  return new Error(`Cannot decode ${kind} "${mediaLabel(url)}": ${reason}`);
}

function waitForEvent(target: EventTarget, ok: string, failure: string,
  timeout = 20000, detail = 'Media'): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const done = (err?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      target.removeEventListener(ok, success);
      target.removeEventListener(failure, error);
      err ? reject(err) : resolve();
    };
    const success = () => done();
    const error = () => {
      const media = target instanceof HTMLMediaElement ? target : null;
      const code = media?.error?.code;
      const message = media?.error?.message;
      done(new Error(`${detail}: browser decoder error${code ? ` (code ${code})` : ''}${message ? ` - ${message}` : ''}.`));
    };
    const timer = setTimeout(() => done(new Error(`${detail}: timed out while decoding after ${timeout / 1000}s.`)), timeout);
    target.addEventListener(ok, success, { once: true });
    target.addEventListener(failure, error, { once: true });
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  if (!url.startsWith('blob:') && !url.startsWith('data:')) img.crossOrigin = 'anonymous';
  img.src = url;
  try {
    if (!img.complete || !img.naturalWidth) {
      await waitForEvent(img, 'load', 'error', 15000, 'Image ' + mediaLabel(url));
    }
    if (!img.naturalWidth) throw new Error('Image has no decoded pixels');
    return img;
  } catch (error) {
    throw describeMediaFailure(url, 'image',
      `${error instanceof Error ? error.message : String(error)}. Check image format and CORS access.`);
  }
}

async function loadVideo(url: string, retryTranscode = true): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  if (!url.startsWith('blob:') && !url.startsWith('data:')) video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  try {
    video.src = url;
    video.load();
    if (video.readyState < 2) {
      await waitForEvent(video, 'loadeddata', 'error', 25000, 'Video ' + mediaLabel(url));
    }
    if (!video.videoWidth || !video.videoHeight) throw new Error('No decodable video frames');
    video.pause();
    return video;
  } catch (error) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (retryTranscode && (url.startsWith('blob:') || url.startsWith('http') || /\.(mp4|mov|webm|mkv|m4v)/i.test(url))) {
      try {
        console.warn(`[Video Decoder] Attempting client-side FFmpeg transcode for incompatible video: ${mediaLabel(url)}`);
        const { transcodeToH264Mp4 } = await import('../videoTranscoder');
        const transcodedUrl = await transcodeToH264Mp4(url);
        return await loadVideo(transcodedUrl, false);
      } catch (transcodeErr) {
        console.warn('[Video Decoder] Transcoding fallback failed:', transcodeErr);
      }
    }
    throw describeMediaFailure(url, 'video',
      `${error instanceof Error ? error.message : String(error)}. Try converting this clip to H.264 MP4 (yuv420p) and import it again; HEVC, some MOV codecs, and restricted URLs may not decode in Chrome.`);
  }
}

async function atTime(media: StageMedia, seconds: number): Promise<void> {
  const video = media.element;
  const target = Math.max(0, Math.min(seconds,
    Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : seconds));
  // A 60 FPS output may revisit a 30 FPS source frame. Avoid decoder churn
  // for genuinely identical positions; don't silently reuse stale frames.
  if ((Math.abs(media.lastFrame - target) < 0.0001 ||
       Math.abs(video.currentTime - target) < 0.0001) && video.readyState >= 2) {
    media.lastFrame = target;
    return;
  }
  // Explicitly bounded recovery: a source's HTMLVideoElement can sometimes
  // stop emitting seeked while remaining readyState >= 2.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ready = waitForEvent(video, 'seeked', 'error', attempt === 0 ? 7000 : 10000,
        'Seeking video ' + mediaLabel(video.currentSrc || video.src));
      video.currentTime = target;
      await ready;
      if (Math.abs(video.currentTime - target) > 0.055) {
        throw new Error(`Source decoder returned ${video.currentTime.toFixed(3)}s instead of ${target.toFixed(3)}s`);
      }
      if (video.readyState < 2) {
        await waitForEvent(video, 'loadeddata', 'error', 8000,
          'Decoding frame ' + mediaLabel(video.currentSrc || video.src));
      }
      media.lastFrame = target;
      return;
    } catch (error) {
      if (attempt === 1 || video.error) throw error;
      console.warn('[Video export] Seek stalled; retrying source frame', target, error);
      // A new seek after a short event-loop yield frequently recovers Chrome's
      // seek state without destroying the already-loaded video element.
      await new Promise(resolve => setTimeout(resolve, 80));
      try { video.currentTime = Math.max(0, target - 0.05); } catch {}
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
}

export class OfflineFrameCompositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videos = new Map<string, StageMedia>();
  private fastVideos = new Map<string, FastMp4Source>();
  private loopFastVideos = new Map<string, FastMp4Source>();
  private loopVideos = new Map<string, StageMedia>();
  private fastDecodeErrors = new Map<string, string>();
  private images = new Map<string, HTMLImageElement>();
  private loaded = false;
  private audioAnalysis = new OfflineAudioAnalysis();
  private readonly preparedLyrics: LyricLine[];

  setAudioBuffer(audio: AudioBuffer | null): void {
    this.audioAnalysis.setBuffer(audio);
  }

  constructor(private project: CanonicalProjectJson) {
    // Match the live AnalyserNode's temporal smoothing during MP4 exports.
    this.audioAnalysis.setSmoothing(project.visualizer?.smoothing ?? 0.65);
    // Adapt and cache lyric timing once per export, not on every 1080p frame.
    this.preparedLyrics = (project.lyrics?.lines || []).map(line => ({
      ...line,
      words: line.words?.map(w => ({
        word: w.word, start: w.startTime, end: w.endTime
      }))
    }));
    this.canvas = document.createElement('canvas');
    this.canvas.width = project.width;
    this.canvas.height = project.height;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas rendering is unavailable in this browser.');
    this.ctx = ctx;
  }

  async prepare(): Promise<void> {
    const project = this.project;
    // Only prepare media that actually occurs in the exported range.
    // Importing many long clips should not block a short section export.
    const clips = project.exportMode === 'music-video'
      ? project.videoClips.filter(c =>
          c.startTime < project.exportRange.end && c.endTime > project.exportRange.start)
      : [];
    // Prepare incoming media even if the selected export range ends during
    // its pre-cut transition, before its nominal timeline start.
    if (project.exportMode === 'music-video') {
      const sorted = [...project.videoClips].sort((a, b) => a.startTime - b.startTime);
      for (const visible of [...clips]) {
        const index = sorted.findIndex(c => c.id === visible.id);
        const next = sorted[index + 1];
        const lead = getMVTransitionLead(visible, next, next?.transition, next?.transitionDuration);
        if (next && lead > 0 && next.startTime - lead < project.exportRange.end &&
          !clips.some(c => c.id === next.id)) clips.push(next);
      }
    }
    const videoUrls = new Set(clips.filter(c => c.type === 'video').map(c => c.url));
    const imageUrls = new Set(clips.filter(c => c.type === 'image').map(c => c.url));
    const backgroundVideoUrl = project.background.type === 'video'
      ? (project.background.videoUrl || (project.background.value && !project.background.value.startsWith('#') ? project.background.value : null)) : null;
    if (backgroundVideoUrl) videoUrls.add(backgroundVideoUrl);
    if (project.background.type === 'image') imageUrls.add(project.background.value);
    // Album art is decorative, not required for an MV timeline export.
    // A third-party album-art URL can be blocked by CORS even when every
    // user-uploaded video clip is valid. Never fail the entire export for it.
    const requiredImageUrls = new Set(imageUrls);
    await Promise.all([
      ...[...videoUrls].map(async url => {
        // Fast WebCodecs decoding is supported for MP4/MOV. Keep HTMLVideo
        // fallback for other containers, codecs and browser implementations.
        const eligible = (clips.some(clip => clip.type === 'video' && clip.url === url) ||
          backgroundVideoUrl === url) &&
          (url.startsWith('blob:') || /\.(mp4|m4v|mov|webm|mkv)(?:[?#]|$)/i.test(url));
        if (eligible) {
          try {
            this.fastVideos.set(url, await FastMp4Source.open(url));
            return;
          } catch (error) {
            this.fastDecodeErrors.set(url, error instanceof Error ? error.message : String(error));
            console.warn('[MV export] Fast MP4 decoder unavailable, falling back to seeking:', error);
          }
        }
        try {
          this.videos.set(url, { element: await loadVideo(url), lastFrame: NaN });
        } catch (error) {
          if (backgroundVideoUrl === url) {
            console.warn(`[Lyrics export] Looping background video "${mediaLabel(url)}" failed: ${error instanceof Error ? error.message : String(error)}. Falling back to styled background.`);
            project.background.type = 'color';
            project.background.value = project.background.value?.startsWith('#') ? project.background.value : '#0e1115';
            return;
          }
          const matchingClip = clips.find(clip => clip.url === url);
          const friendly = matchingClip ? `timeline clip "${matchingClip.id}"` : 'looping background';
          const fastReason = this.fastDecodeErrors.get(url);
          throw new Error(`Cannot prepare ${friendly}: ${error instanceof Error ? error.message : String(error)}${fastReason ? ` Fast decoder: ${fastReason}` : ''}`);
        }
      }),
      ...[...requiredImageUrls].map(async url => this.images.set(url, await loadImage(url)))
    ]);
    // The end/start overlap needs simultaneous frames from two timestamps.
    // Independent decoders avoid seeking the same source backwards per frame.
    if (backgroundVideoUrl && (project.exportMode === 'lyrics-video' || clips.some(c => c.type === 'vinyl-lyrics'))) {
      if (this.fastVideos.has(backgroundVideoUrl)) {
        try {
          this.loopFastVideos.set(backgroundVideoUrl, await FastMp4Source.open(backgroundVideoUrl));
        } catch (error) { console.warn('[Lyrics export] Loop decoder unavailable:', error); }
      } else if (this.videos.has(backgroundVideoUrl)) {
        try {
          this.loopVideos.set(backgroundVideoUrl, { element: await loadVideo(backgroundVideoUrl, false), lastFrame: NaN });
        } catch (error) { console.warn('[Lyrics export] Loop video unavailable:', error); }
      }
    }
    const needsArtwork = project.exportMode === 'lyrics-video' ||
      clips.some(clip => clip.type === 'vinyl-lyrics');
    if (project.audio.albumArt && needsArtwork) {
      // Only artwork scenes need the cover. A blocked optional cover should
      // not prevent custom video clips from rendering and exporting.
      try {
        const art = await loadImage(project.audio.albumArt);
        this.images.set(project.audio.albumArt, art);
        registerCachedImage(project.audio.albumArt, art);
      } catch (error) {
        console.warn('[MV export] Optional album art unavailable; continuing export:', error);
        project.audio.albumArt = null;
      }
    }
    this.loaded = true;
  }

  async frame(time: number): Promise<HTMLCanvasElement> {
    if (!this.loaded) throw new Error('Export frame renderer has not loaded source media.');
    const { project, ctx } = { project: this.project, ctx: this.ctx };
    const W = project.width, H = project.height;
    const audio = this.audioAnalysis.atTime(time - project.exportRange.start);
    ctx.save();
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);
    const clip = project.exportMode === 'music-video'
      ? getMVActiveClip(project.videoClips, time)
      : null;

    if (project.exportMode === 'lyrics-video' || clip?.type === 'vinyl-lyrics') {
      const lyricsState = useLyricsVideoStore.getState();
      const template = LYRIC_VIDEO_TEMPLATES[project.templateId || lyricsState.selectedTemplateId || 'vinyl'] || LYRIC_VIDEO_TEMPLATES.vinyl;
      const bg: typeof lyricsState.customBackground & {
        videoElement?: HTMLVideoElement | VideoFrame;
        videoCrossfadeElement?: HTMLVideoElement | VideoFrame;
        videoCrossfadeAlpha?: number;
        imageElement?: HTMLImageElement;
      } = {
        ...lyricsState.customBackground,
        type: project.background.type,
        value: project.background.value,
        videoUrl: project.background.videoUrl
      };
      // The shared lyrics drawing engine can use a pre-decoded background
      // instead of starting an unclocked HTML video during export.
      const backgroundUrl = project.background.type === 'video'
        ? (project.background.videoUrl || project.background.value)
        : null;
      const fastBackground = backgroundUrl ? this.fastVideos.get(backgroundUrl) : null;
      const bgVideo = backgroundUrl ? this.videos.get(backgroundUrl) : null;
      const duration = fastBackground?.durationSeconds || bgVideo?.element.duration || 0;
      const loop = lyricsVideoLoopFrame(time, duration);
      if (fastBackground) {
        try {
          // Sequential decoder reuses frames across 30/60fps output, avoiding
          // hundreds of expensive HTML video seeks per second of footage.
          bg.videoElement = await fastBackground.frameAt(loop.primaryTime);
          const incoming = backgroundUrl ? this.loopFastVideos.get(backgroundUrl) : null;
          if (incoming && loop.incomingTime !== null) {
            bg.videoCrossfadeElement = await incoming.frameAt(loop.incomingTime);
            bg.videoCrossfadeAlpha = loop.mix;
          }
        } catch (error) {
          console.warn('[Lyrics export] Fast background decoder unavailable; using video element:', error);
          fastBackground.dispose();
          this.fastVideos.delete(backgroundUrl!);
          const fallback = await loadVideo(backgroundUrl!, false);
          const media = { element: fallback, lastFrame: NaN };
          this.videos.set(backgroundUrl!, media);
          await atTime(media, lyricsVideoLoopFrame(time, fallback.duration).primaryTime);
          bg.videoElement = fallback;
        }
        bg.videoUrl = undefined;
      } else if (bgVideo) {
        await atTime(bgVideo, loop.primaryTime);
        bg.videoElement = bgVideo.element;
        const incoming = backgroundUrl ? this.loopVideos.get(backgroundUrl) : null;
        if (incoming && loop.incomingTime !== null) {
          await atTime(incoming, loop.incomingTime);
          bg.videoCrossfadeElement = incoming.element;
          bg.videoCrossfadeAlpha = loop.mix;
        }
        bg.videoUrl = undefined;
      } else if (backgroundUrl) {
        throw new Error('The looping background video could not be prepared for export.');
      }
      if (project.background.type === 'image') {
        bg.imageElement = this.images.get(project.background.value);
      }
      const adaptedLines = this.preparedLyrics;
      renderLyricsVideoFrame(ctx, W, H, time, adaptedLines as any, {
        title: project.audio.title,
        artist: project.audio.artist,
        albumArtUrl: project.audio.albumArt || undefined
      }, {
        template,
        aspectRatio: project.aspectRatio,
        animationStyle: project.lyrics.animationStyle,
        kineticPalette: project.lyrics.kineticPalette,
        kineticColor: project.lyrics.kineticColor,
        kineticGlow: project.lyrics.kineticGlow,
        kineticIntensity: project.lyrics.kineticIntensity,
        visibleLineCount: lyricsState.visibleLineCount,
        showArtwork: project.showArtwork ?? (project.templateId !== 'cinematic-clean'),
        // Draw with the same shared layer used by Lyrics Studio preview.
        showVisualizer: false,
        showArtworkVisualizer: project.showVinylRing !== false,
        // Offline export must use its serialized visualizer config, not a
        // possibly stale global Zustand flag from the preview/editor session.
        visualizerSettingsOverride: {
          ...project.visualizer,
          enabled: project.showVisualizer ?? project.visualizer?.enabled ?? true
        },
        showLyrics: project.showLyrics ?? true,
        showMeta: project.showMeta ?? (project.templateId !== 'cinematic-clean'),
        bilingualEnabled: project.lyrics.bilingualEnabled,
        fadeInDuration: project.lyrics.fadeInDuration,
        fadeOutDuration: project.lyrics.fadeOutDuration,
        fadeEasing: project.lyrics.fadeEasing,
        customBackground: {
          ...bg,
          blur: project.background.blur,
          dim: project.background.dim,
          brightness: project.background.brightness,
          contrast: project.background.contrast,
          saturation: project.background.saturation,
          vignette: project.background.vignette,
          fit: project.background.fit,
          zoom: project.background.zoom,
          heightScale: project.background.heightScale,
          offsetX: project.background.offsetX,
          offsetY: project.background.offsetY
        },
        typographyOverride: project.lyrics,
        artworkOverride: project.artwork,
        animationOverride: lyricsState.animationOverride,
        elementPositions: { ...lyricsState.elementPositions, ...project.elementPositions },
        preferElementPosition: true,
        watermarkText: project.watermarkText,
        showSafeArea: false,
        offlineExport: true
      }, audio.frequency, audio.waveform);
      if (project.showVisualizer ?? project.visualizer?.enabled ?? true) {
        const visualizerPos = project.elementPositions?.visualizer ??
          getDefaultPositions(project.aspectRatio, template.id).visualizer;
        drawPositionedLyricsVisualizer(
          ctx, W, H, visualizerPos,
          { ...project.visualizer, enabled: true },
          audio.frequency, audio.waveform, time
        );
      }
      if (bg.videoElement && typeof (bg.videoElement as any).close === 'function') {
        try { (bg.videoElement as any).close(); } catch {}
      }
    } else if (clip) {
      if (clip.type === 'video') {
        const ordered = [...project.videoClips].sort((a, b) => a.startTime - b.startTime);
        const clipIndex = ordered.findIndex(c => c.id === clip.id);
        const previous = ordered[clipIndex - 1];
        const lead = getMVTransitionLead(previous, clip, clip.transition, clip.transitionDuration);
        const sourceTime = getMVTransitionSourceTime(clip, time, lead);
        const fast = this.fastVideos.get(clip.url);
        let renderedFastFrame = false;
        const clipProgress = (time - clip.startTime) / Math.max(0.01, clip.endTime - clip.startTime);
        ctx.save();
        applyMVClipMotion(ctx, getMVClipMotion(clip.effect, clipProgress, W, H), W, H);
        if (fast) {
          try {
            // Sequential fast WebCodecs decoding for MP4 clips.
            // Bounded queue in FastMp4Source prevents 1080p decoder pool deadlock.
            const frame = await Promise.race([
              fast.frameAt(sourceTime),
              new Promise<never>((_, reject) => setTimeout(() =>
                reject(new Error(`VideoDecoder stalled on clip "${clip.id}" at ${sourceTime.toFixed(2)}s`)), 25000))
            ]);
            try {
              drawFramedMedia(ctx, frame, W, H, frame.displayWidth, frame.displayHeight, clip);
            } finally {
              try { frame.close(); } catch {}
            }
            renderedFastFrame = true;
          } catch (error) {
            console.warn('[MV export] Switching stalled clip to browser decoder:', clip.id, error);
            fast.dispose();
            this.fastVideos.delete(clip.url);
            const fallback = await loadVideo(clip.url, false);
            this.videos.set(clip.url, { element: fallback, lastFrame: NaN });
          }
        }
        if (!renderedFastFrame) {
          const media = this.videos.get(clip.url);
          if (!media) throw new Error('Missing prepared video clip ' + clip.id);
          await atTime(media, sourceTime);
          drawFramedMedia(ctx, media.element, W, H, media.element.videoWidth, media.element.videoHeight, clip);
        }
        ctx.restore();
      } else if (clip.type === 'image') {
        const image = this.images.get(clip.url);
        if (!image) throw new Error('Missing prepared image clip ' + clip.id);
        const duration = Math.max(0.01, clip.endTime - clip.startTime);
        const progress = Math.max(0, Math.min(1, (time - clip.startTime) / duration));
        ctx.save();
        applyMVClipMotion(ctx, getMVClipMotion(clip.effect, progress, W, H), W, H);
        drawFramedMedia(ctx, image, W, H, image.naturalWidth, image.naturalHeight, clip);
        ctx.restore();
      } else if (clip.type === 'visualizer') {
        // Deterministic non-live export. Audio-reactive animation needs
        // precomputed PCM analysis, not the unrelated preview AudioContext.
        // Export the recorded project settings, never transient live editor state.
        if (project.showVisualizer ?? project.visualizer?.enabled ?? true) {
          renderVisualizer(ctx, audio.frequency, audio.waveform,
            { ...project.visualizer, enabled: true } as Parameters<typeof renderVisualizer>[3], W, H, time);
        }
      }
    // Cross into the next moving clip *before* the cut, while the outgoing
    // footage is still playing. No cached/frozen outgoing frame is used.
    if (project.exportMode === 'music-video' && clip) {
      const ordered = [...project.videoClips].sort((a, b) => a.startTime - b.startTime);
      const index = ordered.findIndex(c => c.id === clip.id);
      const next = ordered[index + 1];
      const type = next?.transition || 'cut';
      const seconds = getMVTransitionLead(clip, next, type, next?.transitionDuration);
      if (next && seconds > 0 && time >= next.startTime - seconds && time < next.startTime) {
        const progress = getMVTransitionProgress(time, next.startTime, seconds);
        ctx.save();
        try {
        applyMVTransitionVisual(ctx, type, progress, W, H);
        applyMVClipMotion(ctx, getMVClipMotion(next.effect, 0, W, H), W, H);
        if (next.type === 'image') {
          const image = this.images.get(next.url);
          if (!image) throw new Error('Missing incoming transition image ' + next.id);
          drawFramedMedia(ctx, image, W, H, image.naturalWidth, image.naturalHeight, next);
        } else if (next.type === 'video') {
          const sourceTime = getMVTransitionSourceTime(next, time, seconds);
          const fast = this.fastVideos.get(next.url);
          let decoded = false;
          if (fast) {
            try {
              const frame = await Promise.race([
                fast.frameAt(sourceTime),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Incoming transition decoder stalled')), 25000))
              ]);
              try { drawFramedMedia(ctx, frame, W, H, frame.displayWidth, frame.displayHeight, next); }
              finally { frame.close(); }
              decoded = true;
            } catch (error) {
              console.warn('[MV export] Incoming transition decoder fallback:', error);
              fast.dispose();
              this.fastVideos.delete(next.url);
            }
          }
          if (!decoded) {
            let media = this.videos.get(next.url);
            if (!media) {
              media = { element: await loadVideo(next.url), lastFrame: NaN };
              this.videos.set(next.url, media);
            }
            await atTime(media, sourceTime);
            drawFramedMedia(ctx, media.element, W, H, media.element.videoWidth, media.element.videoHeight, next);
          }
        }
        } finally { ctx.restore(); }
      }
    }
      if (project.showLyrics !== false && project.lyrics.lines.length > 0) {
        const lyricsState = useLyricsVideoStore.getState();
        const storeState = useStore.getState();
        const template = LYRIC_VIDEO_TEMPLATES[project.templateId || lyricsState.selectedTemplateId || 'vinyl'] || LYRIC_VIDEO_TEMPLATES.vinyl;
        const lyricPosSetting = project.lyrics.position || lyricsState.typographyOverride?.position || 'bottom';
        const effectiveShowBox = project.lyrics.showBackgroundBox ?? lyricsState.typographyOverride?.showContainerPill ?? true;

        // Only draw timed text on top of the decoded clip. Calling the full
        // lyrics-video renderer here needlessly redraws an entire frame's
        // background and decorations, slowing 1080p export.
        renderLyricsOverlayFrame(ctx, W, H, time, this.preparedLyrics, {
          template,
          aspectRatio: project.aspectRatio,
          animationStyle: project.lyrics.animationStyle,
          kineticPalette: project.lyrics.kineticPalette,
          kineticColor: project.lyrics.kineticColor,
          kineticGlow: project.lyrics.kineticGlow,
          kineticIntensity: project.lyrics.kineticIntensity,
          visibleLineCount: project.lyrics.visibleLineCount ?? 2,
          showLyrics: true,
          bilingualEnabled: project.lyrics.bilingualEnabled,
          fadeInDuration: project.lyrics.fadeInDuration,
          fadeOutDuration: project.lyrics.fadeOutDuration,
          fadeEasing: project.lyrics.fadeEasing,
          typographyOverride: {
            ...lyricsState.typographyOverride,
            ...project.lyrics,
            showContainerPill: effectiveShowBox,
            position: lyricPosSetting
          },
          animationOverride: lyricsState.animationOverride,
          elementPositions: { ...lyricsState.elementPositions, ...project.elementPositions },
          preferElementPosition: true,
          offlineExport: true
        });
      }
    }
    drawOverlayEffects(ctx, W, H, project.overlayEffects, time);
    ctx.restore();
    return this.canvas;
  }

  dispose(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.audioAnalysis.setBuffer(null);
    for (const media of this.videos.values()) {
      media.element.pause();
      media.element.removeAttribute('src');
      media.element.load();
    }
    this.videos.clear();
    for (const source of this.fastVideos.values()) source.dispose();
    this.fastVideos.clear();
    for (const source of this.loopFastVideos.values()) source.dispose();
    this.loopFastVideos.clear();
    for (const media of this.loopVideos.values()) {
      media.element.pause();
      media.element.removeAttribute('src');
      media.element.load();
    }
    this.loopVideos.clear();
    this.fastDecodeErrors.clear();
    this.images.clear();
  }
}
