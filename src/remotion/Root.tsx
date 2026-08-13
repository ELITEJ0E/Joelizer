import React from 'react';
import { Composition } from 'remotion';
import { JoelizerComposition } from './JoelizerComposition';
import { CanonicalProjectJson } from '../types/projectJson';

export const defaultSampleProjectJson: CanonicalProjectJson = {
  version: '1.0',
  exportMode: 'lyrics-video',
  projectName: 'Joelizer Render Test',
  aspectRatio: '16:9',
  fps: 30,
  resolution: '1080p',
  width: 1920,
  height: 1080,
  exportRange: {
    start: 0,
    end: 10,
    duration: 10
  },
  audio: {
    url: null,
    title: 'Sample Track',
    artist: 'Joelizer Studio',
    albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop',
    duration: 10,
    bpm: 120
  },
  lyrics: {
    lines: [
      {
        id: 'line-1',
        startTime: 1.0,
        endTime: 4.5,
        text: 'Welcome to Joelizer Studio Production',
        words: [
          { word: 'Welcome', startTime: 1.0, endTime: 1.8 },
          { word: 'to', startTime: 1.8, endTime: 2.2 },
          { word: 'Joelizer', startTime: 2.2, endTime: 3.2 },
          { word: 'Studio', startTime: 3.2, endTime: 4.0 },
          { word: 'Production', startTime: 4.0, endTime: 4.5 }
        ]
      },
      {
        id: 'line-2',
        startTime: 5.0,
        endTime: 9.0,
        text: 'High Precision Server Video Rendering Engine',
        words: [
          { word: 'High', startTime: 5.0, endTime: 5.6 },
          { word: 'Precision', startTime: 5.6, endTime: 6.5 },
          { word: 'Server', startTime: 6.5, endTime: 7.2 },
          { word: 'Video', startTime: 7.2, endTime: 8.0 },
          { word: 'Rendering', startTime: 8.0, endTime: 8.6 },
          { word: 'Engine', startTime: 8.6, endTime: 9.0 }
        ]
      }
    ],
    fontFamily: 'Inter',
    fontWeight: '700',
    fontSizeScale: 1.0,
    textColor: '#ffffff',
    activeWordColor: '#fde047',
    inactiveWordColor: 'rgba(255, 255, 255, 0.7)',
    glowColor: '#eab308',
    showContainerPill: true,
    pillBgColor: 'rgba(10, 10, 12, 0.85)',
    animationStyle: 'karaoke'
  },
  background: {
    type: 'blurred-artwork',
    value: '#111111',
    blurAlbumArt: true
  },
  artwork: {
    style: 'vinyl',
    animation: 'rotate',
    sizeScale: 1.0
  },
  visualizer: {
    style: 'bars',
    color: '#00e676',
    sensitivity: 0.95,
    smoothing: 0.65,
    segments: 8,
    hitResponse: 0.15,
    glitchIntensity: 0,
    shakeIntensity: 0,
    showGrain: false,
    showScanlines: false
  },
  videoClips: [],
  effects: {
    showGrain: false,
    showScanlines: false,
    glow: true,
    vignette: true
  },
  safeArea: false
};

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="JoelizerVideo"
        component={JoelizerComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          projectJson: defaultSampleProjectJson
        }}
        calculateMetadata={({ props }) => {
          const json = props.projectJson || defaultSampleProjectJson;
          const dur = json.exportRange?.duration || 10;
          const fps = json.fps || 30;
          return {
            durationInFrames: Math.max(30, Math.round(dur * fps)),
            width: json.width || 1920,
            height: json.height || 1080,
            fps
          };
        }}
      />
    </>
  );
}
