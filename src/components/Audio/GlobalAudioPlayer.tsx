import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';

export function GlobalAudioPlayer() {
  useGlobalKeyboardShortcuts();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useStore(s => s.audioUrl);
  const audioFile = useStore(s => s.audioFile);
  const setWaveformPeaks = useStore(s => s.setWaveformPeaks);
  const isPlaying = useStore(s => s.isPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setAudioDuration = useStore(s => s.setAudioDuration);
  const nextTrack = useStore(s => s.nextTrack);
  const previousTrack = useStore(s => s.previousTrack);

  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const currentTime = useStore(s => s.currentTime);
  const prevTrackIndexRef = useRef(currentTrackIndex);
  const prevAudioUrlRef = useRef(audioUrl);

  // Decode audio data for waveform peaks whenever audioFile or audioUrl changes
  useEffect(() => {
    let active = true;
    if (!audioFile && !audioUrl) {
      setWaveformPeaks([]);
      return;
    }

    const loadPeaks = async () => {
      try {
        const source = audioFile || audioUrl;
        if (!source) return;
        
        const { decodeAudioForWaveform, generateWaveformPeaks } = await import('../../lib/waveform');
        const buffer = await decodeAudioForWaveform(source);
        if (!active) return;

        // target points = 180 for richer timeline peaks
        const peaks = generateWaveformPeaks(buffer, 180);
        if (active) {
          setWaveformPeaks(peaks);
        }
      } catch (err) {
        console.warn('Error generating waveform peaks:', err);
        if (active) {
          // fallback with default simple peaks if decoding fails or CORS blocks
          const fallbackPeaks = Array.from({ length: 180 }, (_, i) => {
            const x = i / 180;
            return 0.15 + Math.sin(x * Math.PI * 4) * 0.15 + Math.random() * 0.2;
          });
          setWaveformPeaks(fallbackPeaks);
        }
      }
    };

    loadPeaks();

    return () => {
      active = false;
    };
  }, [audioFile, audioUrl, setWaveformPeaks]);

  // Initialize audioManager with persistent element
  useEffect(() => {
    if (audioRef.current) {
      audioManager.init(audioRef.current);
    }
  }, [audioUrl]);

  // Handle track changes and explicit rewinds
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const trackChanged = prevTrackIndexRef.current !== currentTrackIndex || prevAudioUrlRef.current !== audioUrl;
    if (trackChanged) {
      prevTrackIndexRef.current = currentTrackIndex;
      prevAudioUrlRef.current = audioUrl;
      el.currentTime = 0;
    } else if (currentTime === 0 && el.currentTime > 0.5) {
      el.currentTime = 0;
    }
  }, [currentTrackIndex, audioUrl, currentTime]);

  // Sync play/pause state safely
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      if ((audioManager as any).ctx?.state === 'suspended') {
        (audioManager as any).ctx.resume().catch(() => {});
      }
      const promise = el.play();
      if (promise !== undefined) {
        promise.catch(err => {
          // Ignore AbortError caused by rapid track changes or re-loads
          if (err.name !== 'AbortError') {
            console.warn('Playback prevented or interrupted:', err);
            setIsPlaying(false);
          }
        });
      }
    } else {
      el.pause();
    }
  }, [isPlaying, audioUrl, setIsPlaying]);

  // Sync loop state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // Sync MediaSession metadata and action handlers for browser/keyboard/bluetooth controls
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Joelizer Music Track',
        artist: 'Joelizer Studio',
        album: 'AI Music & Lyrics',
        artwork: [
          { src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          previousTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          nextTrack();
        });
      } catch (err) {
        console.warn('MediaSession handler setup:', err);
      }
    }
  }, [setIsPlaying]);

  return (
    <audio
      ref={audioRef}
      src={audioUrl || undefined}
      crossOrigin="anonymous"
      preload="auto"
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onTimeUpdate={() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }}
      onLoadedMetadata={() => {
        if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
          setAudioDuration(audioRef.current.duration);
        }
      }}
      onEnded={() => {
        if (useStore.getState().exportResolutionOverride) {
          return;
        }
        if (isLooping) {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
          }
        } else {
          nextTrack();
        }
      }}
    />
  );
}
