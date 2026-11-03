import { CanonicalProjectJson, CanonicalVideoClip } from '../../types/projectJson';
import { renderLyricsVideoFrame } from '../lyricsEngine';
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
  if (Math.abs(media.lastFrame - target) < 0.0001 && video.readyState >= 2) return;
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
  const { width: W, height: H } = ctx.canvas;
  const fontSize = Math.round(H * 0.045);
  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  const words = line.words || [];
  const totalWidth = words.length
    ? words.reduce((w, word) => w + ctx.measureText(word.word + ' ').width, 0)
    : ctx.measureText(line.text).width;
  const boxW = Math.min(W * 0.92, totalWidth + 48);
  const boxH = fontSize * 1.8;
  const y = H - Math.round(H * 0.12);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.roundRect((W - boxW) / 2, y - boxH / 1.5, boxW, boxH, 12);
  ctx.fill();
  ctx.textBaseline = 'middle';
  if (!words.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(line.text, W / 2, y, W * 0.88);
  } else {
    let x = (W - totalWidth) / 2;
    ctx.textAlign = 'left';
    for (const word of words) {
      const content = word.word + ' ';
      const advance = ctx.measureText(content).width;
      ctx.fillStyle = time >= word.startTime && time < word.endTime ? '#fde047' : '#fff';
      ctx.fillText(content, x, y);
      x += advance;
    }
  }
  ctx.restore();
}

export class OfflineFrameCompositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videos = new Map<string, StageMedia>();
  private images = new Map<string, HTMLImageElement>();
  private loaded = false;

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
    const clips = project.exportMode === 'music-video' ? project.videoClips : [];
    const videoUrls = new Set(clips.filter(c => c.type === 'video').map(c => c.url));
    const imageUrls = new Set(clips.filter(c => c.type === 'image').map(c => c.url));
    if (project.background.type === 'video' && project.background.videoUrl) videoUrls.add(project.background.videoUrl);
    if (project.background.type === 'image') imageUrls.add(project.background.value);
    if (project.audio.albumArt) imageUrls.add(project.audio.albumArt);
    await Promise.all([
      ...[...videoUrls].map(async url => this.videos.set(url, { element: await loadVideo(url), lastFrame: NaN })),
      ...[...imageUrls].map(async url => this.images.set(url, await loadImage(url)))
    ]);
    this.loaded = true;
  }

  async frame(time: number): Promise<HTMLCanvasElement> {
    if (!this.loaded) throw new Error('Export frame renderer has not loaded source media.');
    const { project, ctx } = { project: this.project, ctx: this.ctx };
    const W = project.width, H = project.height;
    ctx.save();
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, W, H);
    const clip = project.exportMode === 'music-video'
      ? project.videoClips.find(c => time >= c.startTime && time < c.endTime)
      : null;

    if (project.exportMode === 'lyrics-video' || clip?.type === 'vinyl-lyrics') {
      const lyricsState = useLyricsVideoStore.getState();
      const template = LYRIC_VIDEO_TEMPLATES[project.templateId || lyricsState.selectedTemplateId || 'vinyl'] || LYRIC_VIDEO_TEMPLATES.vinyl;
      const bg = { ...lyricsState.customBackground };
      // The shared lyrics drawing engine can use a pre-decoded background
      // instead of starting an unclocked HTML video during export.
      const bgVideo = project.background.videoUrl && this.videos.get(project.background.videoUrl);
      if (bgVideo) {
        await atTime(bgVideo, time);
        bg.videoElement = bgVideo.element;
        bg.videoUrl = undefined;
      }
      renderLyricsVideoFrame(ctx, W, H, time, project.lyrics.lines as any, {
        title: project.audio.title,
        artist: project.audio.artist,
        albumArtUrl: project.audio.albumArt || undefined
      }, {
        template,
        aspectRatio: project.aspectRatio,
        animationStyle: project.lyrics.animationStyle,
        visibleLineCount: lyricsState.visibleLineCount,
        customBackground: bg,
        typographyOverride: lyricsState.typographyOverride,
        artworkOverride: lyricsState.artworkOverride,
        animationOverride: lyricsState.animationOverride,
        elementPositions: lyricsState.elementPositions,
        watermarkText: project.watermarkText,
        showSafeArea: false
      }, new Uint8Array(1024), new Uint8Array(1024).fill(128));
    } else if (clip) {
      if (clip.type === 'video') {
        const media = this.videos.get(clip.url);
        if (!media) throw new Error('Missing prepared video clip ' + clip.id);
        const sourceTime = clip.trimStart + time - clip.startTime;
        await atTime(media, sourceTime);
        cover(ctx, media.element, W, H, media.element.videoWidth, media.element.videoHeight);
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
        renderVisualizer(ctx, new Uint8Array(1024), new Uint8Array(1024).fill(128),
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
    this.images.clear();
  }
}
