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

  const keys: ElementKey[] = ['artwork', 'meta', 'lyrics', 'watermark'];

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
          className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black border border-white/15 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all shadow-lg cursor-pointer"
          title="Reset elements to default positions"
        >
          <RotateCcw size={12} />
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
            className={`absolute rounded-lg transition-shadow cursor-grab active:cursor-grabbing flex items-center justify-center ${
              isSelected
                ? 'border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] z-30'
                : 'border border-transparent hover:border-white/40 z-10'
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
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md whitespace-nowrap">
                  <Move size={10} />
                  <span>{key}</span>
                </div>

                {/* 8 Corner & Edge Handles */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-full" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-full" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-black rounded-full" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-black rounded-full" />
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-black rounded-full" />
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 bg-white border border-black rounded-full" />
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-black rounded-full" />
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-black rounded-full" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
