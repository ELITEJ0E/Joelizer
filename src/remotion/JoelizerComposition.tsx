import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  AbsoluteFill, 
  Audio, 
  Img, 
  Video, 
  interpolate, 
  spring 
} from 'remotion';
import { CanonicalProjectJson, CanonicalLyricLine, CanonicalVideoClip } from '../types/projectJson';

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

  // Find active video clip for timeline mode
  const activeClip = videoClips.find(c => currentTime >= c.startTime && currentTime < c.endTime);

  const isVinylScene = activeClip?.type === 'vinyl-lyrics' || activeClip?.assetId === 'vinyl-lyrics';
  const isVisualizerScene = activeClip?.type === 'visualizer' || activeClip?.assetId === 'visualizer';
  const isMediaClip = activeClip && (activeClip.type === 'video' || activeClip.type === 'image');

  // Calculate rotation angle for spinning artwork
  const rotationDegrees = (currentTime * 40) % 360;

  // Find current active lyric line
  const activeLineIndex = lyrics.lines.findIndex(
    l => currentTime >= l.startTime && currentTime <= l.endTime
  );
  const activeLine: CanonicalLyricLine | undefined = activeLineIndex !== -1 
    ? lyrics.lines[activeLineIndex] 
    : undefined;

  // Calculate beat pulse intensity (120 bpm fallback or analyzed bpm)
  const bpm = audio.bpm || 120;
  const beatPeriod = 60 / bpm;
  const beatPhase = (currentTime % beatPeriod) / beatPeriod;
  const beatPulse = Math.pow(Math.sin(beatPhase * Math.PI), 4);
  const artworkScale = artwork.animation === 'scale-beat' 
    ? 1.0 + beatPulse * 0.08 
    : artwork.animation === 'pulse' 
    ? 1.0 + Math.sin(currentTime * 6) * 0.03 
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', overflow: 'hidden', fontFamily: lyrics.fontFamily }}>
      
      {/* 1. BACKGROUND LAYER */}
      {isMediaClip ? (
        <BackgroundClipLayer clip={activeClip} currentTime={currentTime} width={width} height={height} />
      ) : (
        <BackgroundLayer bg={background} albumArt={audio.albumArt} width={width} height={height} currentTime={currentTime} />
      )}

      {/* 2. ARTWORK OBJECT LAYER (Vinyl, CD, Glowing Disc) */}
      {(isVinylScene || (!activeClip && mode === 'lyrics-video') || (mode === 'lyrics-video' && !isMediaClip && !isVisualizerScene)) && artwork.style !== 'none' && audio.albumArt && (
        <ArtworkLayer 
          artwork={artwork} 
          albumArt={audio.albumArt} 
          rotation={rotationDegrees} 
          scale={artworkScale * (artwork.sizeScale || 1.0)} 
          width={width} 
          height={height}
        />
      )}

      {/* 3. VISUALIZER OVERLAY */}
      {(isVisualizerScene || (!activeClip && mode === 'lyrics-video')) && (
        <VisualizerLayer visualizer={visualizer} currentTime={currentTime} beatPulse={beatPulse} width={width} height={height} />
      )}

      {/* 4. ANIMATED LYRICS LAYER */}
      {(isVinylScene || (!activeClip && mode === 'lyrics-video') || (mode === 'lyrics-video' && !isMediaClip && !isVisualizerScene)) && (
        <LyricsLayer 
          lyrics={lyrics} 
          activeLine={activeLine} 
          currentTime={currentTime} 
          width={width} 
          height={height} 
          mode={mode}
        />
      )}

      {/* 5. VIGNETTE & GRAIN EFFECTS */}
      {effects.vignette && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.7) 100%)'
          }} 
        />
      )}

      {effects.showScanlines && (
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

      {/* 6. AUDIO ELEMENT */}
      {(audio.audioDataUri || audio.url) && (
        <Audio 
          src={audio.audioDataUri || audio.url!} 
          startFrom={Math.round((projectJson.exportRange?.start || 0) * fps)}
        />
      )}
    </AbsoluteFill>
  );
}

/* Background Clip Layer for Music Video Mode */
function BackgroundClipLayer({ clip, currentTime, width, height }: { clip: CanonicalVideoClip; currentTime: number; width: number; height: number }) {
  const clipProgress = (currentTime - clip.startTime) / clip.duration;
  
  // Pan / Zoom Ken Burns effect
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

  const isVideo = clip.type === 'video' || clip.url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#000' }}>
      {isVideo ? (
        <Video
          src={clip.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform,
            transition: 'transform 0.1s linear'
          }}
          startFrom={Math.round(clip.trimStart * 30)}
        />
      ) : (
        <Img
          src={clip.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform,
            transition: 'transform 0.1s linear'
          }}
        />
      )}
    </div>
  );
}

/* Background Layer for Lyrics Video Mode */
function BackgroundLayer({ bg, albumArt, width, height, currentTime }: { bg: any; albumArt: string | null; width: number; height: number; currentTime: number }) {
  if (bg.type === 'blurred-artwork' && albumArt) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img 
          src={albumArt} 
          style={{ 
            width: '110%', 
            height: '110%', 
            objectFit: 'cover', 
            filter: 'blur(45px) brightness(0.4)',
            transform: 'scale(1.15)',
            position: 'absolute',
            top: '-5%',
            left: '-5%'
          }} 
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      </div>
    );
  }

  if (bg.type === 'gradient') {
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

  if (bg.type === 'image' && bg.value) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img src={bg.value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>
    );
  }

  if (bg.type === 'video' && bg.videoUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Video src={bg.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>
    );
  }

  // Solid Color fallback
  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: bg.value || '#09090b' }} />
  );
}

/* Spinning Artwork Layer */
function ArtworkLayer({ artwork, albumArt, rotation, scale, width, height }: { artwork: any; albumArt: string; rotation: number; scale: number; width: number; height: number }) {
  const isPortrait = height > width;
  const baseSize = Math.min(width, height) * (isPortrait ? 0.42 : 0.38) * scale;

  if (artwork.style === 'vinyl') {
    return (
      <div 
        style={{
          position: 'absolute',
          top: isPortrait ? '30%' : '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          width: baseSize,
          height: baseSize,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #1a1a1a 0%, #000000 70%, #111111 100%)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '4px solid #222'
        }}
      >
        {/* Vinyl Grooves */}
        <div 
          style={{
            position: 'absolute',
            inset: '8%',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 0 20px rgba(255,255,255,0.05)'
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

        {/* Center Album Cover Label */}
        <div 
          style={{
            width: '42%',
            height: '42%',
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            transform: `rotate(${rotation}deg)`,
            border: '3px solid #111',
            boxShadow: '0 0 15px rgba(0,0,0,0.9)'
          }}
        >
          <Img src={albumArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

  // Standard Rounded Square Artwork
  return (
    <div 
      style={{
        position: 'absolute',
        top: isPortrait ? '28%' : '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: baseSize,
        height: baseSize,
        borderRadius: artwork.style === 'circle' ? '50%' : '24px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 20px rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.15)'
      }}
    >
      <Img src={albumArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

/* Audio Waveform & Visualizer Spectrum Layer */
function VisualizerLayer({ visualizer, currentTime, beatPulse, width, height }: { visualizer: any; currentTime: number; beatPulse: number; width: number; height: number }) {
  const numBars = 32;
  const activeColor = visualizer.color || '#00e676';

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '12%',
        left: '5%',
        right: '5%',
        height: '60px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '6px',
        pointerEvents: 'none',
        opacity: 0.85
      }}
    >
      {Array.from({ length: numBars }).map((_, i) => {
        // Pseudo frequency wave simulation based on frame and index
        const freqOffset = i * 0.3;
        const wave = Math.sin(currentTime * 8 + freqOffset) * 0.5 + 0.5;
        const barHeight = Math.max(8, wave * 45 + beatPulse * 20);

        return (
          <div
            key={i}
            style={{
              width: `${Math.max(4, Math.floor(width / (numBars * 2.5)))}px`,
              height: `${barHeight}px`,
              backgroundColor: activeColor,
              borderRadius: '4px',
              boxShadow: `0 0 10px ${activeColor}`,
              transition: 'height 0.05s ease-out'
            }}
          />
        );
      })}
    </div>
  );
}

/* Animated Lyrics Captions Layer with Word Karaoke Highlighting */
function LyricsLayer({ lyrics, activeLine, currentTime, width, height, mode }: { lyrics: any; activeLine?: CanonicalLyricLine; currentTime: number; width: number; height: number; mode: string }) {
  if (!activeLine) return null;

  const fontSize = Math.round(Math.min(width, height) * 0.048 * (lyrics.fontSizeScale || 1.0));
  const isMusicVideo = mode === 'music-video';

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: isMusicVideo ? '15%' : '18%',
        left: '6%',
        right: '6%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 20
      }}
    >
      <div 
        style={{
          padding: lyrics.showContainerPill ? '14px 28px' : '0px',
          backgroundColor: lyrics.showContainerPill ? (lyrics.pillBgColor || 'rgba(0, 0, 0, 0.75)') : 'transparent',
          borderRadius: '24px',
          backdropFilter: lyrics.showContainerPill ? 'blur(12px)' : 'none',
          border: lyrics.showContainerPill ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
          boxShadow: lyrics.showContainerPill ? '0 15px 35px rgba(0,0,0,0.5)' : 'none',
          maxWidth: '92%'
        }}
      >
        <p 
          style={{
            margin: 0,
            fontSize: `${fontSize}px`,
            fontWeight: lyrics.fontWeight || '700',
            lineHeight: 1.35,
            color: lyrics.textColor || '#ffffff',
            textShadow: lyrics.glowColor ? `0 0 20px ${lyrics.glowColor}` : '0 4px 12px rgba(0,0,0,0.8)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.35em'
          }}
        >
          {activeLine.words && activeLine.words.length > 0 ? (
            activeLine.words.map((w, wIdx) => {
              const isWordActive = currentTime >= w.startTime && currentTime <= w.endTime;
              const isWordPast = currentTime > w.endTime;

              let wordColor = lyrics.inactiveWordColor || 'rgba(255,255,255,0.7)';
              let transform = 'scale(1)';
              let textShadow = 'none';

              if (isWordActive) {
                wordColor = lyrics.activeWordColor || '#fde047';
                transform = 'scale(1.12)';
                textShadow = lyrics.glowColor ? `0 0 25px ${lyrics.glowColor}, 0 0 10px ${lyrics.activeWordColor}` : '0 0 15px #fde047';
              } else if (isWordPast) {
                wordColor = lyrics.textColor || '#ffffff';
              }

              return (
                <span 
                  key={wIdx}
                  style={{
                    color: wordColor,
                    transform,
                    textShadow,
                    transition: 'all 0.08s ease-out',
                    display: 'inline-block'
                  }}
                >
                  {w.word}
                </span>
              );
            })
          ) : (
            <span>{activeLine.text}</span>
          )}
        </p>
      </div>
    </div>
  );
}
