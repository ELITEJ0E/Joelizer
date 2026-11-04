import { CanonicalProjectJson } from '../../types/projectJson';
import { layoutMVCaption, drawMVCaption } from '../mvCaptionLayout';
import { FastMp4Source } from './FastMp4Source';
import { OfflineAudioAnalysis } from './offlineAudioAnalysis';
import { renderLyricsVideoFrame, getOrLoadImage } from '../lyricsEngine';
import { LYRIC_VIDEO_TEMPLATES } from '../lyricsTemplates';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { useMVStore } from '../../store/useMVStore';
import { useStore } from '../../store/useStore';
import { renderVisualizer } from '../renderers';

type StageMedia = { element: HTMLVideoElement; lastFrame: number };

function waitForEvent(target: EventTarget, ok: string, failure: string, timeout = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Timed out decoding media; source may be unsupported')), timeout);
    const success = () => done();
    const error = () => done(new Error('Unable to decode the selected video or image source'));
    const done = (err?: Error) => {
      clearTimeout(timer);
      target.removeEventListener(ok, success);
      target.removeEventListener(failure, error);
      err ? reject(err) : resolve();
    };
    target.addEventListener(ok, success, { once: true });
    target.addEventListener(failure, error, { once: true });
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  if (!img.complete || !img.naturalWidth) await waitForEvent(img, 'load', 'error');
  if (!img.naturalWidth) throw new Error('Cannot decode image source: ' + url);
  return img;
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  if (video.readyState < 2) await waitForEvent(video, 'loadeddata', 'error', 30000);
  video.pause();
  return video;
}

async function atTime(media: StageMedia, seconds: number): Promise<void> {
  const video = media.element;
  const target = Math.max(0, Math.min(seconds, Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : seconds));
  // Once decoded, reusing a frame at the exact same source timestamp avoids extra seeks.
  if ((Math.abs(media.lastFrame - target) < 0.0001 ||
      Math.abs(video.currentTime - target) < 0.0001) && video.readyState >= 2) {
    media.lastFrame = target;
    return;
  }
  const ready = waitForEvent(video, 'seeked', 'error', 25000);
  video.currentTime = target;
  await ready;
  if (video.readyState < 2) await waitForEvent(video, 'loadeddata', 'error');
  media.lastFrame = target;
}

function cover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, sw: number, sh: number) {
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

function caption(ctx: CanvasRenderingContext2D, project: CanonicalProjectJson, time: number) {
  const line = project.lyrics.lines.find(l => time >= l.startTime && time < l.endTime);
  if (!line?.text) return;
  const layout = layoutMVCaption(line, ctx.canvas.width, ctx.canvas.height, (value, size) => {
    ctx.font = `700 ${size}px sans-serif`;
    return ctx.measureText(value).width;
  });
  drawMVCaption(ctx, layout, time);
}

export class OfflineFrameCompositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videos = new Map<string, StageMedia>();
  private fastVideos = new Map<string, FastMp4Source>();
  private images = new Map<string, HTMLImageElement>();
  private loaded = false;
  private audioAnalysis = new OfflineAudioAnalysis();

  setAudioBuffer(audio: AudioBuffer | null): void {
    this.audioAnalysis.setBuffer(audio);
  }

  constructor(private project: CanonicalProjectJson) {
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
    const videoUrls = new Set(clips.filter(c => c.type === 'video').map(c => c.url));
    const imageUrls = new Set(clips.filter(c => c.type === 'image').map(c => c.url));
    const backgroundVideoUrl = project.background.type === 'video'
      ? (project.background.videoUrl || project.background.value) : null;
    if (backgroundVideoUrl) videoUrls.add(backgroundVideoUrl);
    if (project.background.type === 'image') imageUrls.add(project.background.value);
    if (project.audio.albumArt) imageUrls.add(project.audio.albumArt);
    await Promise.all([
      ...[...videoUrls].map(async url => {
        // Fast WebCodecs decoding is supported for MP4/MOV. Keep HTMLVideo
        // fallback for other containers, codecs and browser implementations.
        const eligible = (clips.some(clip => clip.type === 'video' && clip.url === url) ||
          backgroundVideoUrl === url) &&
          (url.startsWith('blob:') || /\.(mp4|m4v|mov)(?:[?#]|$)/i.test(url));
        if (eligible) {
          try {
            this.fastVideos.set(url, await FastMp4Source.open(url));
            return;
          } catch (error) {
            console.warn('[MV export] Fast MP4 decoder unavailable, falling back to seeking:', error);
          }
        }
        this.videos.set(url, { element: await loadVideo(url), lastFrame: NaN });
      }),
      ...[...imageUrls].map(async url => this.images.set(url, await loadImage(url)))
    ]);
    if (project.audio.albumArt) {
      const album = getOrLoadImage(project.audio.albumArt);
      if (album && (!album.complete || !album.naturalWidth)) {
        await waitForEvent(album, 'load', 'error');
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
      ? project.videoClips.find(c => time >= c.startTime && time < c.endTime)
      : null;

    if (project.exportMode === 'lyrics-video' || clip?.type === 'vinyl-lyrics') {
      const lyricsState = useLyricsVideoStore.getState();
      const template = LYRIC_VIDEO_TEMPLATES[project.templateId || lyricsState.selectedTemplateId || 'vinyl'] || LYRIC_VIDEO_TEMPLATES.vinyl;
      const bg: typeof lyricsState.customBackground & { videoElement?: HTMLVideoElement | VideoFrame; imageElement?: HTMLImageElement } = {
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
      if (fastBackground) {
        const duration = fastBackground.durationSeconds;
        const loopTime = Number.isFinite(duration) && duration > 0
          ? ((time % duration) + duration) % duration : time;
        // Sequential decoder reuses frames across 30/60fps output, avoiding
        // hundreds of expensive HTML video seeks per second of footage.
        bg.videoElement = await fastBackground.frameAt(loopTime);
        bg.videoUrl = undefined;
      } else if (bgVideo) {
        const duration = bgVideo.element.duration;
        const loopTime = Number.isFinite(duration) && duration > 0
          ? ((time % duration) + duration) % duration : time;
        await atTime(bgVideo, loopTime);
        bg.videoElement = bgVideo.element;
        bg.videoUrl = undefined;
      } else if (backgroundUrl) {
        throw new Error('The looping background video could not be prepared for export.');
      }
      if (project.background.type === 'image') {
        bg.imageElement = this.images.get(project.background.value);
      }
      const adaptedLines = project.lyrics.lines.map(line => ({
        ...line,
        words: line.words?.map(w => ({ word: w.word, start: w.startTime, end: w.endTime }))
      }));
      renderLyricsVideoFrame(ctx, W, H, time, adaptedLines as any, {
        title: project.audio.title,
        artist: project.audio.artist,
        albumArtUrl: project.audio.albumArt || undefined
      }, {
        template,
        aspectRatio: project.aspectRatio,
        animationStyle: project.lyrics.animationStyle,
        visibleLineCount: lyricsState.visibleLineCount,
        customBackground: bg,
        typographyOverride: project.lyrics,
        artworkOverride: project.artwork,
        animationOverride: lyricsState.animationOverride,
        elementPositions: { ...lyricsState.elementPositions, ...project.elementPositions },
        watermarkText: project.watermarkText,
        showSafeArea: false,
        offlineExport: true
      }, audio.frequency, audio.waveform);
    } else if (clip) {
      if (clip.type === 'video') {
        const sourceTime = clip.trimStart + time - clip.startTime;
        const fast = this.fastVideos.get(clip.url);
        let renderedFastFrame = false;
        if (fast) {
          try {
            // Broken or variable-frame-rate imported MP4 clips can stall a
            // WebCodecs decoder. Fall back to normal browser video decoding.
            const frame = await Promise.race([
              fast.frameAt(sourceTime),
              new Promise<never>((_, reject) => setTimeout(() =>
                reject(new Error('VideoDecoder stalled on imported clip')), 12000))
            ]);
            cover(ctx, frame, W, H, frame.displayWidth, frame.displayHeight);
            renderedFastFrame = true;
          } catch (error) {
            console.warn('[MV export] Switching stalled clip to browser decoder:', clip.id, error);
            fast.dispose();
            this.fastVideos.delete(clip.url);
            const fallback = await loadVideo(clip.url);
            this.videos.set(clip.url, { element: fallback, lastFrame: NaN });
          }
        }
        if (!renderedFastFrame) {
          const media = this.videos.get(clip.url);
          if (!media) throw new Error('Missing prepared video clip ' + clip.id);
          await atTime(media, sourceTime);
          cover(ctx, media.element, W, H, media.element.videoWidth, media.element.videoHeight);
        }
      } else if (clip.type === 'image') {
        const image = this.images.get(clip.url);
        if (!image) throw new Error('Missing prepared image clip ' + clip.id);
        const duration = Math.max(0.01, clip.endTime - clip.startTime);
        const progress = Math.max(0, Math.min(1, (time - clip.startTime) / duration));
        let zoom = 1.05, x = 0, y = 0;
        switch (clip.effect) {
          case 'ken-burns-in': zoom = 1 + progress * 0.18; break;
          case 'ken-burns-out': zoom = 1.18 - progress * 0.18; break;
          case 'pan-left': zoom = 1.12; x = -progress * W * 0.08; break;
          case 'pan-right': zoom = 1.12; x = progress * W * 0.08; break;
          case 'pan-up': zoom = 1.12; y = -progress * H * 0.08; break;
          case 'pan-down': zoom = 1.12; y = progress * H * 0.08; break;
        }
        ctx.save();
        ctx.translate(W / 2 + x, H / 2 + y);
        ctx.scale(zoom, zoom);
        const factor = Math.max(W / image.naturalWidth, H / image.naturalHeight);
        ctx.drawImage(image, -image.naturalWidth * factor / 2, -image.naturalHeight * factor / 2,
          image.naturalWidth * factor, image.naturalHeight * factor);
        ctx.restore();
      } else if (clip.type === 'visualizer') {
        // Deterministic non-live export. Audio-reactive animation needs
        // precomputed PCM analysis, not the unrelated preview AudioContext.
        renderVisualizer(ctx, audio.frequency, audio.waveform,
          useStore.getState().visualizerSettings, W, H);
      }
      caption(ctx, project, time);
    }
    ctx.restore();
    return this.canvas;
  }

  dispose(): void {
    for (const media of this.videos.values()) {
      media.element.pause();
      media.element.removeAttribute('src');
      media.element.load();
    }
    this.videos.clear();
    for (const source of this.fastVideos.values()) source.dispose();
    this.fastVideos.clear();
    this.images.clear();
  }
}
