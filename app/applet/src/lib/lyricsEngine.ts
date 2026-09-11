import { useStore } from '../store/useStore';
import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { renderVisualizer } from './renderers';

export function renderLyricsVideoFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  currentTime: number,
  lyricsLines: any[],
  trackMeta: any,
  config: any,
  audioFrequencyData?: Uint8Array | null,
  audioTimeData?: Uint8Array | null
) {
  // Clear canvas
  ctx.clearRect(0, 0, W, H);
  
  // Render Background
  const bgType = config.customBackground?.type || config.template?.defaultBackground?.type || 'gradient';
  const bgValue = config.customBackground?.value || config.template?.defaultBackground?.value || '#121212';
  
  // NOTE: We don't render visualizer in background here anymore.
  drawBackgroundCanvas(ctx, W, H, config.template, currentTime, config.aspectRatio || '16:9', audioFrequencyData);

  // Layout setup
  const positions = config.elementPositions || {};
  const getPos = (key: string, defaultX: number, defaultY: number) => {
    const p = positions[key];
    return p ? { x: p.x * W, y: p.y * H } : { x: defaultX * W, y: defaultY * H };
  };
  
  const isVertical = H > W;

  // 1. Render Artwork
  const artworkStyle = config.artworkOverride?.style || config.template?.layout?.artworkType || 'vinyl';
  if (artworkStyle !== 'none' && artworkStyle !== 'background-blur') {
     const pos = getPos('artwork', 0.5, isVertical ? 0.32 : 0.45);
     const sizeScale = config.artworkOverride?.sizeScale || 1;
     renderArtwork(ctx, W, H, pos.x, pos.y, trackMeta.albumArtUrl, artworkStyle, sizeScale, isVertical);
  }

  // 2. Render Meta (Title & Artist)
  if (config.template?.layout?.showSongTitle || config.template?.layout?.showArtist) {
     const pos = getPos('meta', 0.5, isVertical ? 0.6 : 0.6);
     renderMeta(ctx, W, H, pos.x, pos.y, trackMeta.title, trackMeta.artist);
  }

  // 3. Render Lyrics
  const lyricsPos = getPos('lyrics', 0.5, isVertical ? 0.72 : 0.72);
  renderLyricsLines(ctx, W, H, lyricsPos.x, lyricsPos.y, lyricsLines, currentTime, config);

  // 4. Render Visualizer Widget
  if (artworkStyle !== 'glowing-disc' && artworkStyle !== 'glowing-disc-needle') {
     const visPos = getPos('visualizer', 0.5, isVertical ? 0.84 : 0.84);
     renderVisualizerWidget(ctx, W, H, visPos.x, visPos.y, audioFrequencyData, audioTimeData);
  }

  // 5. Render Watermark
  const wmPos = getPos('watermark', 0.5, isVertical ? 0.92 : 0.92);
  renderWatermarkText(ctx, W, H, wmPos.x, wmPos.y, 'Made with Joelizer');

  if (config.showSafeArea) {
     renderSafeAreaGuide(ctx, W, H);
  }
}

const imageCache = new Map<string, HTMLImageElement>();
function getImage(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  imageCache.set(url, img);
  return img;
}

function renderArtwork(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, url: string, style: string, scale: number, isVertical: boolean) {
   const img = getImage(url);
   const size = Math.min(W, H) * (isVertical ? 0.38 : 0.32) * scale;
   ctx.save();
   ctx.translate(x, y);
   
   if (img && img.complete && img.naturalWidth > 0) {
      if (style === 'vinyl') {
         ctx.beginPath();
         ctx.arc(0, 0, size/2, 0, Math.PI * 2);
         ctx.clip();
      } else {
         ctx.beginPath();
         ctx.roundRect(-size/2, -size/2, size, size, size * 0.05);
         ctx.clip();
      }
      ctx.drawImage(img, -size/2, -size/2, size, size);
   } else {
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(-size/2, -size/2, size, size, size * 0.05);
      ctx.fill();
   }
   ctx.restore();
}

function renderMeta(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, title: string, artist: string) {
   ctx.save();
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   
   const titleSize = Math.max(16, Math.round(H * 0.03));
   ctx.font = `bold ${titleSize}px sans-serif`;
   ctx.fillStyle = '#fff';
   ctx.shadowColor = 'rgba(0,0,0,0.8)';
   ctx.shadowBlur = 6;
   ctx.fillText(title, x, y - titleSize/2);
   
   const artistSize = Math.max(12, Math.round(H * 0.02));
   ctx.font = `${artistSize}px sans-serif`;
   ctx.fillStyle = 'rgba(255,255,255,0.7)';
   ctx.fillText(artist, x, y + artistSize);
   
   ctx.restore();
}

function renderLyricsLines(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, lines: any[], currentTime: number, config: any) {
   ctx.save();
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   
   const activeColor = config.typographyOverride?.activeWordColor || config.template?.typography?.activeWordColor || '#00e676';
   const inactiveColor = config.typographyOverride?.inactiveWordColor || config.template?.typography?.inactiveWordColor || 'rgba(255,255,255,0.55)';
   
   const fontSize = Math.max(16, Math.round(H * 0.04 * (config.typographyOverride?.fontSizeScale || 1)));
   const fontFamily = config.typographyOverride?.fontFamily || 'sans-serif';
   ctx.font = `bold ${fontSize}px ${fontFamily}`;
   
   const activeLine = lines.find(l => currentTime >= l.startTime && currentTime <= l.endTime) || lines[0];
   if (!activeLine) { ctx.restore(); return; }

   ctx.shadowColor = 'rgba(0,0,0,0.8)';
   ctx.shadowBlur = 8;
   
   const isKaraoke = config.animationStyle === 'karaoke' || config.template?.layout?.animationStyle === 'karaoke';

   if (isKaraoke && activeLine.words && activeLine.words.length > 0) {
       const totalWidth = ctx.measureText(activeLine.text).width;
       let currentX = x - totalWidth / 2;
       
       for (const word of activeLine.words) {
           const wordText = word.word + ' ';
           const wordWidth = ctx.measureText(wordText).width;
           
           if (currentTime >= word.startTime && currentTime <= word.endTime) {
               // Render gradient highlight during word
               const progress = (currentTime - word.startTime) / (word.endTime - word.startTime);
               const grad = ctx.createLinearGradient(currentX, 0, currentX + wordWidth, 0);
               grad.addColorStop(0, activeColor);
               grad.addColorStop(progress, activeColor);
               grad.addColorStop(progress + 0.01, inactiveColor);
               grad.addColorStop(1, inactiveColor);
               ctx.fillStyle = grad;
           } else if (currentTime > word.endTime) {
               ctx.fillStyle = activeColor;
           } else {
               ctx.fillStyle = inactiveColor;
           }
           ctx.fillText(wordText, currentX + wordWidth/2, y);
           currentX += wordWidth;
       }
   } else {
       ctx.fillStyle = activeColor;
       ctx.fillText(activeLine.text, x, y);
   }
   
   ctx.restore();
}

function renderVisualizerWidget(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, freqData?: Uint8Array | null, timeData?: Uint8Array | null) {
   const visSettings = useStore.getState().visualizerSettings;
   
   if (visSettings && visSettings.style !== 'none' && freqData && timeData) {
       const boxW = Math.max(300, W * 0.35);
       const boxH = Math.max(100, H * 0.15);
       
       ctx.save();
       ctx.translate(x - boxW/2, y - boxH/2);
       // Clip to widget size to prevent bleeding
       ctx.beginPath();
       ctx.rect(0, 0, boxW, boxH);
       ctx.clip();
       
       renderVisualizer(ctx, freqData, timeData, visSettings, boxW, boxH);
       ctx.restore();
   } else if (freqData && freqData.length > 0) {
       const color = visSettings?.color || '#00e676';
       const barCount = 16;
       const barW = Math.max(3, Math.round(W * 0.008));
       const barGap = Math.max(2, Math.round(W * 0.004));
       const totalW = barCount * (barW + barGap) - barGap;
       let currentX = x - totalW / 2;
       
       ctx.save();
       ctx.fillStyle = color;
       ctx.shadowColor = color;
       ctx.shadowBlur = 12;
       
       for (let i = 0; i < barCount; i++) {
           const val = freqData[i % freqData.length] / 255;
           const h = Math.max(3, val * 40);
           ctx.beginPath();
           if (ctx.roundRect) {
               ctx.roundRect(currentX, y - h/2, barW, h, barW/2);
           } else {
               ctx.fillRect(currentX, y - h/2, barW, h);
           }
           ctx.fill();
           currentX += barW + barGap;
       }
       ctx.restore();
   } else {
       const color = visSettings?.color || '#00e676';
       const dotCount = 8;
       const dotW = Math.max(1.5, Math.round(H * 0.0035));
       const dotGap = Math.max(6, Math.round(W * 0.015));
       const totalW = dotCount * (dotW * 2 + dotGap) - dotGap;
       let currentX = x - totalW / 2;
       
       ctx.save();
       ctx.fillStyle = color + '60';
       for (let i = 0; i < dotCount; i++) {
           ctx.beginPath();
           ctx.arc(currentX, y, dotW, 0, Math.PI * 2);
           ctx.fill();
           currentX += dotW * 2 + dotGap;
       }
       ctx.restore();
   }
}

function renderWatermarkText(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, text: string) {
   ctx.save();
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   ctx.font = '500 12px sans-serif';
   ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
   ctx.fillText(text, x, y);
   ctx.restore();
}

function renderSafeAreaGuide(ctx: CanvasRenderingContext2D, W: number, H: number) {
   ctx.save();
   ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
   ctx.lineWidth = 1.5;
   ctx.setLineDash([6, 6]);
   const mX = W * 0.05;
   const mY = H * 0.05;
   ctx.strokeRect(mX, mY, W - mX*2, H - mY*2);
   ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
   ctx.font = 'bold 10px sans-serif';
   ctx.fillText('SAFE AREA GUIDE', mX + 8, mY + 14);
   ctx.restore();
}
