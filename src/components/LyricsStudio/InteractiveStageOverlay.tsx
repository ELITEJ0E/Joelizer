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

  // Element Bounding Box Sizes (Approximate for bounding handle visualization)
  const getBoxSize = (key: ElementKey) => {
    const isVertical = stageHeight > stageWidth;
    const minDim = Math.min(stageWidth, stageHeight);
    
    switch (key) {
      case 'artwork': {
        const size = minDim * (isVertical ? 0.42 : 0.35); // slightly larger than actual to cover shadows/rotations
        return { w: size, h: size };
      }
      case 'meta':
        return { w: stageWidth * 0.6, h: stageHeight * 0.08 };
      case 'lyrics':
        return { w: stageWidth * 0.85, h: stageHeight * 0.16 };
      case 'visualizer':
        return { w: stageWidth * 0.8, h: stageHeight * 0.1 };
      case 'watermark':
        return { w: stageWidth * 0.3, h: Math.max(20, stageHeight * 0.05) };
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
