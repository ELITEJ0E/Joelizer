import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { getStreamableAudioUrl } from '../../lib/utils';
import { useDAWStore } from '../../store/useDAWStore';
import { useMVStore } from '../../store/useMVStore';
import { playbackRateForTab, sourceTimeToTimelineTime } from '../../lib/playbackClock';

export function GlobalAudioPlayer() {
  useGlobalKeyboardShortcuts();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const isDAW = useStore(s => s.activeTab === 'daw');
  const activeTab = useStore(s => s.activeTab);
  const mvSoundtrackSpeed = useMVStore(s => s.soundtrackSpeed);
  const mvMuted = useMVStore(s => s.soundtrackMuted);
  const mvVolume = useMVStore(s => s.soundtrackVolume);
  const lrcPlaybackRate = useStore(s => s.lrcPlaybackRate);
  const audioRate = playbackRateForTab(activeTab, lrcPlaybackRate, mvSoundtrackSpeed);
  const audioUrl = useStore(s => s.audioUrl);
  const streamUrl = getStreamableAudioUrl(audioUrl);
  const audioFile = useStore(s => s.audioFile);
  const setWaveformPeaks = useStore(s => s.setWaveformPeaks);
  const isPlaying = useStore(s => s.isPlaying);
  const isLooping = useStore(s => s.isLooping);
  const visualizerSmoothing = useStore(s => s.visualizerSettings.smoothing);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setAudioDuration = useStore(s => s.setAudioDuration);
  const nextTrack = useStore(s => s.nextTrack);
  const previousTrack = useStore(s => s.previousTrack);

  const currentTrackIndex = useStore(s => s.currentTrackIndex);
  const currentTime = useStore(s => s.currentTime);
  const prevTrackIndexRef = useRef(currentTrackIndex);
  const prevAudioUrlRef = useRef(audioUrl);
  const prevAudioRateRef = useRef(1);
  const prevClockTabRef = useRef(activeTab);
  const skipOldTimeSeekRef = useRef(false);

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

  // The visualizer smoothing slider must control the shared analyser even
  // when Lyrics Video / MV Studio is open (Editor Preview may be unmounted).
  useEffect(() => { audioManager.setSmoothing(visualizerSmoothing); }, [visualizerSmoothing, audioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || activeTab !== 'mv-studio') return;
    const original = { muted: el.muted, volume: el.volume };
    el.muted = mvMuted;
    el.volume = mvVolume;
    return () => { el.muted = original.muted; el.volume = original.volume; };
  }, [activeTab, mvMuted, mvVolume, streamUrl]);

  // Only the MV Studio master soundtrack is retimed. Switching back to LRC,
  // Lyrics Video or Audio Lab restores normal speed and the raw source clock.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const rate = audioRate;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    // Keep audio exports consistent across native playback, Web Audio and Remotion.
    if ('preservesPitch' in el) el.preservesPitch = false;
    const tabChanged = prevClockTabRef.current !== activeTab;
    if (prevAudioRateRef.current !== rate || tabChanged) {
      // The timestamp of the song never changes when its playback rate does.
      // Only MV has a separate stretched video timeline coordinate system.
      prevAudioRateRef.current = rate;
      skipOldTimeSeekRef.current = true;
      setCurrentTime(sourceTimeToTimelineTime(el.currentTime, activeTab, mvSoundtrackSpeed));
    }
    prevClockTabRef.current = activeTab;
  }, [activeTab, audioRate, mvSoundtrackSpeed, setCurrentTime]);

  // Handle track changes and explicit rewinds
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isDAW) return;
    const trackChanged = prevTrackIndexRef.current !== currentTrackIndex || prevAudioUrlRef.current !== streamUrl;
    if (trackChanged) {
      prevTrackIndexRef.current = currentTrackIndex;
      prevAudioUrlRef.current = streamUrl;
      skipOldTimeSeekRef.current = false;
      el.currentTime = 0;
      el.load();
      return;
    }
    if (skipOldTimeSeekRef.current) {
      skipOldTimeSeekRef.current = false;
      return;
    }
    if (activeTab !== 'mv-studio') {
      // LRC and Lyrics Video seek directly via audioManager. Never feed the
      // displayed playback position back as a new media seek.
      return;
    }
    const sourceTarget = currentTime * audioRate;
    // Keep MV's existing stretched-timeline mapping without affecting lyrics.
    if (Number.isFinite(el.duration) && sourceTarget >= el.duration) return;
    if (Math.abs(el.currentTime - sourceTarget) > 0.35) el.currentTime = sourceTarget;
  }, [currentTrackIndex, streamUrl, currentTime, isDAW, audioRate, activeTab]);

  // Sync play/pause state safely
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isDAW) { el.pause(); return; }

    let isSubscribed = true;

    if (isPlaying && streamUrl) {
      audioManager.resume().catch(() => {});

      const executePlay = () => {
        if (!isSubscribed) return;
        const promise = el.play();
        if (promise !== undefined) {
          promise.catch(err => {
            if (!isSubscribed) return;
            if (err.name === 'NotAllowedError') {
              console.warn('Playback prevented by browser policy, awaiting user gesture:', err);
              setIsPlaying(false);
            } else if (err.name !== 'AbortError') {
              console.warn('Playback notice:', err);
            }
          });
        }
      };

      if (el.readyState >= 2) {
        executePlay();
      } else {
        const handleCanPlay = () => {
          el.removeEventListener('canplay', handleCanPlay);
          executePlay();
        };
        el.addEventListener('canplay', handleCanPlay, { once: true });
        const handleLoadedData = () => {
          el.removeEventListener('loadeddata', handleLoadedData);
          if (el.readyState >= 2) {
            executePlay();
          }
        };
        el.addEventListener('loadeddata', handleLoadedData, { once: true });
      }
    } else {
      el.pause();
    }

    return () => {
      isSubscribed = false;
    };
  }, [isPlaying, streamUrl, setIsPlaying, isDAW]);

  // Sync loop state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // High-frequency continuous clock sync during active playback (eliminates 250ms ontimeupdate stutter)
  useEffect(() => {
    if (!isPlaying || isDAW) return;

    let animId: number;
    let lastDispatchedTime = -1;

    const tick = () => {
      const preciseTime = sourceTimeToTimelineTime(audioManager.getPreciseCurrentTime(), activeTab, mvSoundtrackSpeed);
      // Only dispatch if time progressed by at least 15ms to keep UI performant
      if (Math.abs(preciseTime - lastDispatchedTime) >= 0.015) {
        lastDispatchedTime = preciseTime;
        useStore.getState().setCurrentTime(preciseTime);
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isDAW, activeTab, mvSoundtrackSpeed]);

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
          if (useStore.getState().activeTab === 'daw') useDAWStore.getState().play();
          else setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (useStore.getState().activeTab === 'daw') useDAWStore.getState().pause();
          else setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          if (useStore.getState().activeTab === 'daw') useDAWStore.getState().stop();
          else setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (useStore.getState().activeTab === 'daw') useDAWStore.getState().navigateMarker(-1);
          else previousTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (useStore.getState().activeTab === 'daw') useDAWStore.getState().navigateMarker(1);
          else nextTrack();
        });
      } catch (err) {
        console.warn('MediaSession handler setup:', err);
      }
    }
  }, [setIsPlaying]);

  return (
    <audio
      ref={audioRef}
      src={streamUrl || undefined}
      crossOrigin={(!streamUrl || streamUrl.startsWith('blob:') || streamUrl.startsWith('/')) ? undefined : "anonymous"}
      preload="auto"
      onPlay={() => { if (useStore.getState().activeTab !== 'daw') setIsPlaying(true); }}
      onPause={() => { if (useStore.getState().activeTab !== 'daw') setIsPlaying(false); }}
      onTimeUpdate={() => {
        if (audioRef.current && audioRef.current.paused && !audioRef.current.seeking && useStore.getState().activeTab !== 'daw') {
          setCurrentTime(sourceTimeToTimelineTime(audioRef.current.currentTime,
            useStore.getState().activeTab, useMVStore.getState().soundtrackSpeed));
        }
      }}
      onSeeked={() => {
        const el = audioRef.current;
        if (el && useStore.getState().activeTab !== 'daw') {
          setCurrentTime(sourceTimeToTimelineTime(el.currentTime,
            useStore.getState().activeTab, useMVStore.getState().soundtrackSpeed));
        }
      }}
      onLoadedMetadata={() => {
        if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
          const state = useStore.getState();
          const rate = playbackRateForTab(state.activeTab, state.lrcPlaybackRate,
            useMVStore.getState().soundtrackSpeed);
          audioRef.current.defaultPlaybackRate = rate;
          audioRef.current.playbackRate = rate;
          setAudioDuration(audioRef.current.duration);
        }
      }}
      onEnded={() => {
        if (useStore.getState().activeTab === 'daw') return;
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
