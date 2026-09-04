import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  AbsoluteFill, 
  Audio, 
  Img, 
  Video 
} from 'remotion';
import { CanonicalProjectJson, CanonicalLyricLine, CanonicalVideoClip } from '../types/projectJson';
import { getDefaultPositions } from '../lib/lyricsLayout';
import { computeContinuousLineSweep, TimedWordMetric } from '../lib/karaokeSweep';

export interface JoelizerCompositionProps {
  projectJson: CanonicalProjectJson;
}

export function JoelizerComposition({ projectJson }: JoelizerCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Current time in seconds within the composition
  const compositionTime = frame / fps;
  // Offset by export range start
  const currentTime = (projectJson.exportRange?.start || 0) + compositionTime;

  const mode = projectJson.exportMode || 'lyrics-video';
  const { audio, lyrics, background, artwork, visualizer, videoClips, effects } = projectJson;

  // Resolve normalized layout positions with fallback to aspect-ratio defaults
  const defaultPositions = getDefaultPositions(projectJson.aspectRatio || '16:9');
  const elementPositions = {
    artwork: projectJson.elementPositions?.artwork || defaultPositions.artwork,
    meta: projectJson.elementPositions?.meta || defaultPositions.meta,
    lyrics: projectJson.elementPositions?.lyrics || defaultPositions.lyrics,
    visualizer: projectJson.elementPositions?.visualizer || defaultPositions.visualizer,
    watermark: projectJson.elementPositions?.watermark || defaultPositions.watermark,
  };

  // Find active video clip for timeline mode
  const activeClip = videoClips?.find(c => currentTime >= c.startTime && currentTime < c.endTime);

  const isVinylScene = activeClip?.type === 'vinyl-lyrics' || activeClip?.assetId === 'vinyl-lyrics';
  const isVisualizerScene = activeClip?.type === 'visualizer' || activeClip?.assetId === 'visualizer';
  const isMediaClip = activeClip && (activeClip.type === 'video' || activeClip.type === 'image');

  // Constant Linear Rotation for Vinyl (33 1/3 RPM -> 1 rotation per 1.8s)
  const rotationDegrees = ((currentTime / 1.8) * 360) % 360;

  // Find current active lyric line
  const activeLineIndex = lyrics?.lines?.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  ) ?? -1;
  const activeLine: CanonicalLyricLine | undefined = activeLineIndex !== -1 
    ? lyrics.lines[activeLineIndex] 
    : undefined;

  // Calculate beat pulse intensity (120 bpm fallback or analyzed bpm)
  const bpm = audio?.bpm || 120;
  const beatPeriod = 60 / bpm;
  const beatPhase = (currentTime % beatPeriod) / beatPeriod;
  const beatPulse = Math.pow(Math.sin(beatPhase * Math.PI), 4);
  const artworkScale = artwork?.animation === 'scale-beat' 
    ? 1.0 + beatPulse * 0.05 
    : artwork?.animation === 'pulse' 
    ? 1.0 + Math.sin(currentTime * 6) * 0.025 
    : 1.0;

  const showLyricsScene = isVinylScene || (!activeClip && mode === 'lyrics-video') || (mode === 'lyrics-video' && !isMediaClip && !isVisualizerScene);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', overflow: 'hidden', fontFamily: lyrics?.fontFamily || 'Outfit, sans-serif' }}>
      
      {/* 1. BACKGROUND LAYER */}
      {isMediaClip ? (
        <BackgroundClipLayer clip={activeClip} currentTime={currentTime} width={width} height={height} />
      ) : (
        <BackgroundLayer bg={background} albumArt={audio?.albumArt || null} width={width} height={height} currentTime={currentTime} />
      )}

      {/* 2. ARTWORK OBJECT LAYER (Vinyl, CD, Glowing Disc) */}
      {showLyricsScene && artwork?.style !== 'none' && audio?.albumArt && (
        <ArtworkLayer 
          artwork={artwork} 
          albumArt={audio.albumArt} 
          rotation={rotationDegrees} 
          scale={artworkScale * (artwork?.sizeScale || 1.0)} 
          width={width} 
          height={height}
          pos={elementPositions.artwork}
        />
      )}

      {/* 3. TRACK METADATA (Song Title & Artist) */}
      {showLyricsScene && (audio?.title || audio?.artist) && (
        <MetaLayer
          title={audio?.title || ''}
          artist={audio?.artist || ''}
          width={width}
          height={height}
          pos={elementPositions.meta}
        />
      )}

      {/* 4. VISUALIZER OVERLAY */}
      {(isVisualizerScene || showLyricsScene) && (
        <VisualizerLayer 
          visualizer={visualizer} 
          currentTime={currentTime} 
          beatPulse={beatPulse} 
          width={width} 
          height={height}
          pos={elementPositions.visualizer}
        />
      )}

      {/* 5. ANIMATED LYRICS LAYER */}
      {showLyricsScene && (
        <LyricsLayer 
          lyrics={lyrics} 
          activeLine={activeLine} 
          currentTime={currentTime} 
          width={width} 
          height={height} 
          pos={elementPositions.lyrics}
        />
      )}

      {/* 6. WATERMARK LAYER */}
      {showLyricsScene && (
        <WatermarkLayer
          text={projectJson.watermarkText || 'Made with Joelizer'}
          width={width}
          height={height}
          pos={elementPositions.watermark}
        />
      )}

      {/* 7. SAFE AREA GUIDE */}
      {projectJson.safeArea && (
        <SafeAreaLayer width={width} height={height} />
      )}

      {/* 8. VIGNETTE & GRAIN EFFECTS */}
      {effects?.vignette && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.7) 100%)'
          }} 
        />
      )}

      {effects?.showScanlines && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
            backgroundSize: '100% 4px'
          }} 
        />
      )}

      {/* 9. AUDIO ELEMENT (Only rendered if audioDataUri is present) */}
      {audio?.audioDataUri && (
        <Audio 
          src={audio.audioDataUri} 
          startFrom={Math.round((projectJson.exportRange?.start || 0) * fps)}
        />
      )}
    </AbsoluteFill>
  );
}

/* Background Clip Layer for Music Video Mode */
function BackgroundClipLayer({ clip, currentTime, width, height }: { clip: CanonicalVideoClip; currentTime: number; width: number; height: number }) {
  const clipProgress = (currentTime - clip.startTime) / clip.duration;
  
  let transform = 'scale(1)';
  if (clip.effect === 'ken-burns-in') {
    transform = `scale(${1 + clipProgress * 0.12})`;
  } else if (clip.effect === 'ken-burns-out') {
    transform = `scale(${1.12 - clipProgress * 0.12})`;
  } else if (clip.effect === 'pan-left') {
    transform = `scale(1.1) translateX(${(0.5 - clipProgress) * 4}%)`;
  } else if (clip.effect === 'pan-right') {
    transform = `scale(1.1) translateX(${(clipProgress - 0.5) * 4}%)`;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {clip.type === 'video' ? (
        <Video 
          src={clip.url} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform }} 
          startFrom={Math.round(clip.trimStart * 30)}
        />
      ) : (
        <Img 
          src={clip.url} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform }} 
        />
      )}
    </div>
  );
}

/* Background Layer for Lyrics Video Mode */
function BackgroundLayer({ bg, albumArt, width, height, currentTime }: { bg: any; albumArt: string | null; width: number; height: number; currentTime: number }) {
  if (bg?.type === 'blurred-artwork') {
    if (albumArt) {
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Img 
            src={albumArt} 
            style={{ 
              width: '120%', 
              height: '120%', 
              objectFit: 'cover', 
              filter: 'blur(50px) brightness(0.4)',
              transform: 'scale(1.2)',
              position: 'absolute',
              top: '-10%',
              left: '-10%'
            }} 
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
        </div>
      );
    }
    return (
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'radial-gradient(circle at 50% 40%, #1e1b4b 0%, #0f172a 60%, #020617 100%)' 
        }} 
      />
    );
  }

  if (bg?.type === 'gradient') {
    return (
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          background: bg.value || 'linear-gradient(135deg, #0f172a 0%, #020617 100%)' 
        }} 
      />
    );
  }

  if (bg?.type === 'image' && bg.value) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img src={bg.value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>
    );
  }

  if (bg?.type === 'video' && bg.videoUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Video src={bg.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: bg?.value || '#09090b' }} />
  );
}

/* Spinning Artwork Layer (Vinyl Record, CD, Album Art) */
function ArtworkLayer({ 
  artwork, 
  albumArt, 
  rotation, 
  scale, 
  width, 
  height,
  pos
}: { 
  artwork: any; 
  albumArt: string; 
  rotation: number; 
  scale: number; 
  width: number; 
  height: number;
  pos: { x: number; y: number };
}) {
  if (artwork.style === 'none' || artwork.style === 'background-blur') {
    return null;
  }

  const isPortrait = height > width;
  const baseSize = Math.min(width, height) * (isPortrait ? 0.42 : 0.35) * scale;
  const isCD = artwork.style === 'cd' || artwork.style === 'cd-needle';
  const hasNeedle = artwork.style === 'vinyl-needle' || artwork.style === 'cd-needle';

  if (artwork.style === 'vinyl' || artwork.style === 'vinyl-needle' || artwork.style === 'cd' || artwork.style === 'cd-needle') {
    return (
      <div 
        style={{
          position: 'absolute',
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          width: baseSize,
          height: baseSize,
          borderRadius: '50%',
          background: isCD 
            ? 'radial-gradient(circle, rgba(40,40,48,0.9) 0%, rgba(20,20,26,0.95) 70%, rgba(10,10,14,0.98) 100%)'
            : 'radial-gradient(circle, #18181b 0%, #09090b 70%, #000000 100%)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isCD ? '3px solid rgba(255,255,255,0.35)' : '4px solid #1c1917'
        }}
      >
        {/* Iridescent / Grooves Overlay */}
        {isCD ? (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(200,220,255,0.08) 30%, rgba(255,200,220,0.12) 50%, rgba(200,255,220,0.08) 80%, rgba(255,255,255,0.18) 100%)'
            }}
          />
        ) : (
          <>
            <div 
              style={{
                position: 'absolute',
                inset: '8%',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 0 20px rgba(255,255,255,0.04)'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                inset: '18%',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                inset: '28%',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.05)'
              }}
            />
          </>
        )}

        {/* Center Album Cover Label */}
        <div 
          style={{
            width: '42%',
            height: '42%',
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            border: '3px solid #1c1917',
            boxShadow: '0 0 15px rgba(0,0,0,0.9)'
          }}
        >
          {albumArt ? (
            <Img src={albumArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }} />
          )}
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '18%',
              height: '18%',
              borderRadius: '50%',
              backgroundColor: '#09090b',
              border: '2px solid #333'
            }}
          />
        </div>
      </div>
    );
  }

  // Standard Rounded Square or Circle Artwork
  return (
    <div 
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: baseSize,
        height: baseSize,
        borderRadius: artwork.style === 'circle' ? '50%' : '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 20px rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.15)'
      }}
    >
      {albumArt ? (
        <Img src={albumArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b, #0f172a)' }} />
      )}
    </div>
  );
}

/* Track Metadata Layer (Song Title & Artist) */
function MetaLayer({
  title,
  artist,
  width,
  height,
  pos
}: {
  title: string;
  artist: string;
  width: number;
  height: number;
  pos: { x: number; y: number };
}) {
  const isPortrait = height > width;
  const fontSize = Math.max(14, Math.round(height * (isPortrait ? 0.026 : 0.028)));

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: 'translate(-50%, 0)',
        textAlign: 'center',
        maxWidth: isPortrait ? '85%' : '40%',
        pointerEvents: 'none',
        zIndex: 20
      }}
    >
      {title && (
        <div
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {title}
        </div>
      )}
      {artist && (
        <div
          style={{
            fontSize: `${Math.round(fontSize * 0.78)}px`,
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.70)',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            marginTop: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {artist}
        </div>
      )}
    </div>
  );
}

/* Audio Waveform & Visualizer Spectrum Layer */
function VisualizerLayer({ 
  visualizer, 
  currentTime, 
  beatPulse, 
  width, 
  height,
  pos
}: { 
  visualizer: any; 
  currentTime: number; 
  beatPulse: number; 
  width: number; 
  height: number;
  pos: { x: number; y: number };
}) {
  const numBars = 16;
  const activeColor = visualizer?.color || '#00e676';
  const barWidth = Math.max(3, Math.round(width * 0.008));
  const barGap = Math.max(2, Math.round(width * 0.004));

  return (
    <div 
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${barGap}px`,
        pointerEvents: 'none',
        zIndex: 15
      }}
    >
      {Array.from({ length: numBars }).map((_, i) => {
        const freqOffset = i * 0.4;
        const wave = Math.sin(currentTime * 8 + freqOffset) * 0.5 + 0.5;
        const barHeight = Math.max(4, Math.round(wave * 28 + beatPulse * 16));

        return (
          <div
            key={i}
            style={{
              width: `${barWidth}px`,
              height: `${barHeight}px`,
              backgroundColor: activeColor,
              borderRadius: `${barWidth / 2}px`,
              boxShadow: `0 0 8px ${activeColor}`
            }}
          />
        );
      })}
    </div>
  );
}

let remotionCanvasCtx: CanvasRenderingContext2D | null = null;
function measureRemotionWord(word: string, font: string): number {
  if (typeof document !== 'undefined') {
    if (!remotionCanvasCtx) {
      const canvas = document.createElement('canvas');
      remotionCanvasCtx = canvas.getContext('2d');
    }
    if (remotionCanvasCtx) {
      remotionCanvasCtx.font = font;
      return remotionCanvasCtx.measureText(word).width;
    }
  }
  return word.length * 12;
}

/* Animated Lyrics Captions Layer: Supports Karaoke Continuous Sweep & Fade In/Out */
function LyricsLayer({ 
  lyrics, 
  activeLine, 
  currentTime, 
  width, 
  height,
  pos
}: { 
  lyrics: any; 
  activeLine?: CanonicalLyricLine; 
  currentTime: number; 
  width: number; 
  height: number;
  pos: { x: number; y: number };
}) {
  if (!activeLine) return null;

  const isPortrait = height > width;
  const fontSize = Math.max(16, Math.round(height * (isPortrait ? 0.038 : 0.045) * (lyrics?.fontSizeScale || 1.0)));

  // Smooth cross-fade transition
  const lineDuration = Math.max(0.4, activeLine.endTime - activeLine.startTime);
  const elapsed = currentTime - activeLine.startTime;
  const remaining = activeLine.endTime - currentTime;
  const transitionDuration = Math.min(0.25, lineDuration * 0.25);

  const rawFadeIn = Math.max(0, Math.min(1, elapsed / transitionDuration));
  const rawFadeOut = Math.max(0, Math.min(1, remaining / transitionDuration));
  const smoothIn = rawFadeIn * rawFadeIn * (3 - 2 * rawFadeIn);
  const smoothOut = rawFadeOut * rawFadeOut * (3 - 2 * rawFadeOut);
  const lineOpacity = Math.min(smoothIn, smoothOut);

  const isKaraoke = lyrics?.animationStyle === 'karaoke';
  const accentColor = lyrics?.activeWordColor || '#fef08a';
  const inactiveColor = lyrics?.inactiveWordColor || 'rgba(255, 255, 255, 0.55)';
  const textColor = lyrics?.textColor || '#ffffff';
  const glowColor = lyrics?.glowColor || accentColor;
  const fontFamily = lyrics?.fontFamily || 'Outfit, system-ui, sans-serif';
  const fontWeight = lyrics?.fontWeight || '700';
  const fontCss = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const spaceWidth = measureRemotionWord(' ', fontCss) || fontSize * 0.32;
  const maxLineWidth = isPortrait ? width * 0.88 : width * 0.50;

  // Build timed words list
  interface TimedWord {
    word: string;
    startTime: number;
    endTime: number;
  }

  let timedWords: TimedWord[] = [];
  if (Array.isArray(activeLine.words) && activeLine.words.length > 0) {
    timedWords = activeLine.words.map((w: any, idx: number) => {
      const s = w.startTime ?? w.start ?? (activeLine.startTime + (idx / activeLine.words.length) * lineDuration);
      const e = w.endTime ?? w.end ?? (s + lineDuration / activeLine.words.length);
      return { word: w.word || '', startTime: s, endTime: e };
    });
  } else {
    const rawWords = activeLine.text.trim().split(/\s+/).filter(Boolean);
    const totalChars = rawWords.reduce((sum, w) => sum + Math.max(1, w.length), 0);
    let currStart = activeLine.startTime;
    timedWords = rawWords.map((word) => {
      const fraction = Math.max(1, word.length) / Math.max(1, totalChars);
      const dur = lineDuration * fraction;
      const s = currStart;
      const e = s + dur;
      currStart = e;
      return { word, startTime: s, endTime: e };
    });
  }

  // Partition timed words into sublines matching canvas layout
  const sublines: TimedWordMetric[][] = [];
  let currentSubline: TimedWordMetric[] = [];
  let currentSublineWidth = 0;

  timedWords.forEach((tw) => {
    const wordWidth = measureRemotionWord(tw.word, fontCss);
    const item: TimedWordMetric = {
      word: tw.word,
      width: wordWidth,
      startTime: tw.startTime,
      endTime: tw.endTime
    };
    const addedWidth = currentSubline.length > 0 ? spaceWidth + wordWidth : wordWidth;

    if (currentSubline.length > 0 && currentSublineWidth + addedWidth > maxLineWidth) {
      sublines.push(currentSubline);
      currentSubline = [item];
      currentSublineWidth = wordWidth;
    } else {
      currentSubline.push(item);
      currentSublineWidth += addedWidth;
    }
  });
  if (currentSubline.length > 0) {
    sublines.push(currentSubline);
  }

  return (
    <div 
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 20,
        opacity: lineOpacity,
        maxWidth: isPortrait ? '90%' : '52%'
      }}
    >
      <div 
        style={{
          padding: lyrics?.showContainerPill ? '12px 24px' : '0px',
          backgroundColor: lyrics?.showContainerPill ? (lyrics?.pillBgColor || 'rgba(10, 10, 12, 0.85)') : 'transparent',
          borderRadius: '20px',
          backdropFilter: lyrics?.showContainerPill ? 'blur(12px)' : 'none',
          boxShadow: lyrics?.showContainerPill ? '0 10px 30px rgba(0,0,0,0.6)' : 'none'
        }}
      >
        <div 
          style={{
            margin: 0,
            fontSize: `${fontSize}px`,
            fontFamily,
            fontWeight,
            lineHeight: 1.35,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25em',
            textShadow: '0 4px 12px rgba(0,0,0,0.85)'
          }}
        >
          {isKaraoke ? (
            sublines.map((subline, lineIdx) => {
              const sweep = computeContinuousLineSweep(subline, spaceWidth, currentTime);
              const sublineText = subline.map(w => w.word).join(' ');

              return (
                <div 
                  key={lineIdx} 
                  style={{ 
                    position: 'relative', 
                    display: 'inline-block',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {/* Inactive Base Text (100% stable typography, zero shifts) */}
                  <span style={{ color: inactiveColor }}>
                    {sublineText}
                  </span>

                  {/* Active Continuous Highlight Layer with Hardware-Accelerated CSS Transition */}
                  {sweep.highlightProgress > 0 && (
                    <span 
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        color: accentColor,
                        textShadow: sweep.highlightProgress < 1 ? `0 0 15px ${glowColor}` : undefined,
                        clipPath: `inset(0 ${(1 - sweep.highlightProgress) * 100}% 0 0)`,
                        WebkitClipPath: `inset(0 ${(1 - sweep.highlightProgress) * 100}% 0 0)`,
                        transition: 'clip-path 0.08s linear, -webkit-clip-path 0.08s linear',
                        willChange: 'clip-path',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                      }}
                    >
                      {sublineText}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <span style={{ color: textColor }}>{activeLine.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* Watermark Layer */
function WatermarkLayer({
  text,
  width,
  height,
  pos
}: {
  text: string;
  width: number;
  height: number;
  pos: { x: number; y: number };
}) {
  const fontSize = Math.max(10, Math.round(height * 0.018));

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${fontSize}px`,
        fontWeight: 500,
        color: 'rgba(255, 255, 255, 0.40)',
        pointerEvents: 'none',
        zIndex: 25,
        whiteSpace: 'nowrap'
      }}
    >
      {text}
    </div>
  );
}

/* Safe Area Guide Overlay */
function SafeAreaLayer({ width, height }: { width: number; height: number }) {
  const marginX = width * 0.05;
  const marginY = height * 0.05;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${marginX}px`,
        top: `${marginY}px`,
        width: `${width - marginX * 2}px`,
        height: `${height - marginY * 2}px`,
        border: '1.5px dashed rgba(239, 68, 68, 0.6)',
        pointerEvents: 'none',
        zIndex: 30
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          fontSize: '10px',
          fontWeight: 700,
          color: 'rgba(239, 68, 68, 0.8)',
          letterSpacing: '0.05em'
        }}
      >
        SAFE AREA GUIDE
      </span>
    </div>
  );
}
