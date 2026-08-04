import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { audioManager } from '../../lib/audio';

export function GlobalAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useStore(s => s.audioUrl);
  const isPlaying = useStore(s => s.isPlaying);
  const isLooping = useStore(s => s.isLooping);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const setCurrentTime = useStore(s => s.setCurrentTime);
  const setAudioDuration = useStore(s => s.setAudioDuration);
  const nextTrack = useStore(s => s.nextTrack);

  // Initialize audioManager with persistent element
  useEffect(() => {
    if (audioRef.current) {
      audioManager.init(audioRef.current);
    }
  }, [audioUrl]);

  // Sync play/pause state
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      const promise = el.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('Playback prevented or interrupted:', err);
          setIsPlaying(false);
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

  return (
    <audio
      ref={audioRef}
      src={audioUrl || undefined}
      preload="auto"
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
