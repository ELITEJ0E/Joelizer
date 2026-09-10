import React, { useRef, useState, useEffect } from 'react';
import { useLyricsVideoStore, CanvasElementPositions } from '../../store/useLyricsVideoStore';
import { useStore } from '../../store/useStore';
import { RotateCcw, Move } from 'lucide-react';

interface Props {
  stageWidth: number;
  stageHeight: number;
}

type ElementKey = keyof CanvasElementPositions;

export function InteractiveStageOverlay({ stageWidth, stageHeight }: Props) {
  const selectedElement = useLyricsVideoStore(s => s.selectedElement);
  const setSelectedElement = useLyricsVideoStore(s => s.setSelectedElement);
  const elementPositions = useLyricsVideoStore(s => s.elementPositions);
  const setElementPosition = useLyricsVideoStore(s => s.setElementPosition);
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);
  const aspectRatio = useStore(s => s.aspectRatio);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const activeKeyRef = useRef<ElementKey | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialElemPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent, key: ElementKey) => {
    e.stopPropagation();
    setSelectedElement(key);
    isDraggingRef.current = true;
    activeKeyRef.current = key;

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    const currentPos = elementPositions[key] || { x: 0.5, y: 0.5 };
    initialElemPosRef.current = { ...currentPos };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !activeKeyRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = (e.clientX - dragStartPosRef.current.x) / rect.width;
    const deltaY = (e.clientY - dragStartPosRef.current.y) / rect.height;

    const newX = Math.max(0.05, Math.min(0.95, initialElemPosRef.current.x + deltaX));
    const newY = Math.max(0.05, Math.min(0.95, initialElemPosRef.current.y + deltaY));

    setElementPosition(activeKeyRef.current, { x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      activeKeyRef.current = null;
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setSelectedElement(null);
    }
  };

  // Calculate exact Canva-like bounding box sizes matching component dimensions
  const getBoxSize = (key: ElementKey) => {
    const isVertical = stageHeight > stageWidth;
    const minDim = Math.min(stageWidth, stageHeight);
    
    // Read state for dynamic sizing
    const currentTrack = useStore.getState().tracks[useStore.getState().currentTrackIndex];
    const lyricsLines = useStore.getState().lyricsSettings?.lines || [];
    const currentTime = useStore.getState().currentTime;
    const artworkOverride = useLyricsVideoStore.getState().artworkOverride;
    const typographyOverride = useLyricsVideoStore.getState().typographyOverride;

    switch (key) {
      case 'artwork': {
        if (artworkOverride.style === 'none') {
          return { w: 90, h: 28 };
        }
        const artScale = artworkOverride.sizeScale || 1.0;
        const size = minDim * (isVertical ? 0.38 : 0.32) * artScale;
        return { w: Math.round(size + 12), h: Math.round(size + 12) };
      }
      case 'meta': {
        const title = currentTrack?.name || 'Untitled Track';
        const artist = currentTrack?.artist || 'Joelizer Studio';
        const fontSize = Math.max(12, Math.round(stageHeight * 0.024));
        const titleW = title.length * fontSize * 0.55;
        const artistW = artist.length * (fontSize * 0.8) * 0.55;
        const w = Math.min(stageWidth * 0.88, Math.max(110, Math.max(titleW, artistW) + 28));
        const h = Math.max(28, Math.round(fontSize * 2.5 + 8));
        return { w, h };
      }
      case 'lyrics': {
        let activeLine = lyricsLines.find(l => currentTime >= l.startTime && currentTime <= l.endTime);
        if (!activeLine) activeLine = lyricsLines[0];
        const lineText = activeLine?.text || 'Your synchronized lyrics line';
        
        const fontSizeScale = typographyOverride.fontSizeScale || 1.0;
        const baseFontSize = Math.max(14, Math.round(fontSizeScale * (stageHeight * 0.042)));
        const textW = lineText.length * baseFontSize * 0.55;
        const w = Math.min(stageWidth * 0.9, Math.max(120, textW + 36));
        const h = Math.max(34, Math.round(baseFontSize * 1.8 + 10));
        return { w, h };
      }
      case 'visualizer':
        return { w: Math.min(stageWidth * 0.7, 240), h: Math.max(24, Math.round(stageHeight * 0.06)) };
      case 'watermark': {
        const text = 'Made with Joelizer';
        const fontSize = Math.max(10, Math.round(stageHeight * 0.018));
        const w = Math.min(stageWidth * 0.7, Math.max(80, text.length * fontSize * 0.55 + 20));
        const h = Math.max(20, Math.round(fontSize * 1.6 + 6));
        return { w, h };
      }
    }
  };

  const artworkStyle = useLyricsVideoStore(s => s.artworkOverride.style);
  const keys: ElementKey[] = (['artwork', 'meta', 'lyrics', 'visualizer', 'watermark'] as ElementKey[]).filter(
    k => {
      if (k === 'artwork') return artworkStyle !== 'none' && artworkStyle !== 'background-blur';
      if (k === 'visualizer') return artworkStyle !== 'glowing-disc' && artworkStyle !== 'glowing-disc-needle';
      return true;
    }
  );

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="absolute inset-0 z-20 pointer-events-auto cursor-default select-none overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Reset Layout Floating Button */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            resetElementPositions(aspectRatio);
          }}
          className="px-2.5 py-1 rounded-md bg-[#12161c]/90 hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md cursor-pointer"
          title="Reset elements to default positions"
        >
          <RotateCcw size={11} className="text-accent" />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* Render Draggable Bounding Overlays */}
      {keys.map((key) => {
        const pos = elementPositions[key] || { x: 0.5, y: 0.5 };
        const size = getBoxSize(key);
        const isSelected = selectedElement === key;

        const leftPx = pos.x * stageWidth - size.w / 2;
        const topPx = pos.y * stageHeight - size.h / 2;

        return (
          <div
            key={key}
            onPointerDown={(e) => handlePointerDown(e, key)}
            className={`absolute rounded transition-shadow cursor-grab active:cursor-grabbing flex items-center justify-center ${
              isSelected
                ? 'border border-accent shadow-[0_0_16px_rgba(0,230,118,0.2)] z-30'
                : 'border border-dashed border-transparent hover:border-accent/40 z-10'
            }`}
            style={{
              left: `${leftPx}px`,
              top: `${topPx}px`,
              width: `${size.w}px`,
              height: `${size.h}px`,
              touchAction: 'none'
            }}
          >
            {/* Label Badge on Hover / Selection */}
            {isSelected && (
              <>
                {/* Drag Handle Tag */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-accent text-black px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-md whitespace-nowrap">
                  <Move size={9} />
                  <span>{key}</span>
                </div>

                {/* Precision Corner & Edge Handles */}
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-accent border border-black rounded-none" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent border border-black rounded-none" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-accent border border-black rounded-none" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-accent border border-black rounded-none" />
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-accent border border-black rounded-none" />
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 bg-accent border border-black rounded-none" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-accent border border-black rounded-none" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-accent border border-black rounded-none" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
