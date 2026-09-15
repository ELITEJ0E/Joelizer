import React, { useRef, useState } from 'react';
import { useLyricsVideoStore, CanvasElementPositions } from '../../store/useLyricsVideoStore';
import { useStore } from '../../store/useStore';
import { RotateCcw, Move } from 'lucide-react';

interface Props {
  stageWidth: number;
  stageHeight: number;
}

type ElementKey = keyof CanvasElementPositions;
type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

export function InteractiveStageOverlay({ stageWidth, stageHeight }: Props) {
  const selectedElement = useLyricsVideoStore(s => s.selectedElement);
  const setSelectedElement = useLyricsVideoStore(s => s.setSelectedElement);
  const elementPositions = useLyricsVideoStore(s => s.elementPositions);
  const setElementPosition = useLyricsVideoStore(s => s.setElementPosition);
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);
  const artworkOverride = useLyricsVideoStore(s => s.artworkOverride);
  const updateArtworkOverride = useLyricsVideoStore(s => s.updateArtworkOverride);

  const aspectRatio = useStore(s => s.aspectRatio);
  const visualizerSettings = useStore(s => s.visualizerSettings);
  const updateVisualizerSettings = useStore(s => s.updateVisualizerSettings);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const activeKeyRef = useRef<ElementKey | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialElemPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canva / PPT Style Drag-to-Resize State
  const isResizingRef = useRef(false);
  const resizeKeyRef = useRef<ElementKey | null>(null);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const resizeStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elemCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDistRef = useRef<number>(1);
  const initialScaleRef = useRef<number>(1);

  const [activeResizeTooltip, setActiveResizeTooltip] = useState<{
    key: ElementKey;
    scalePercent: number;
    width: number;
    height: number;
  } | null>(null);

  // Calculate exact Canva-like bounding box sizes matching component dimensions
  const getBoxSize = (key: ElementKey) => {
    const isVertical = stageHeight > stageWidth;
    const minDim = Math.min(stageWidth, stageHeight);
    
    // Read state for dynamic sizing
    const currentTrack = useStore.getState().tracks[useStore.getState().currentTrackIndex];
    const lyricsLines = useStore.getState().lyricsSettings?.lines || [];
    const currentTime = useStore.getState().currentTime;
    const typo = useLyricsVideoStore.getState().typographyOverride;
    const art = useLyricsVideoStore.getState().artworkOverride;

    switch (key) {
      case 'artwork': {
        if (art.style === 'none') {
          return { w: 90, h: 28 };
        }
        const artScale = art.sizeScale || 1.0;
        // Matches lyricsEngine: Math.min(W, H) * (isPortrait ? 0.42 : 0.35) * sizeScale
        const size = minDim * (isVertical ? 0.42 : 0.35) * artScale;
        const padding = art.style.includes('needle') ? 16 : 8;
        return { w: Math.round(size + padding), h: Math.round(size + padding) };
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
        
        const fontSizeScale = typo.fontSizeScale || 1.0;
        const baseFontSize = Math.max(14, Math.round(fontSizeScale * (stageHeight * 0.042)));
        const textW = lineText.length * baseFontSize * 0.55;
        const w = Math.min(stageWidth * 0.9, Math.max(120, textW + 36));
        const h = Math.max(34, Math.round(baseFontSize * 1.8 + 10));
        return { w, h };
      }
      case 'visualizer': {
        const isVert = stageHeight > stageWidth;
        const visScale = Math.max(0.2, visualizerSettings?.scale ?? 1.0);
        const baseW = isVert ? Math.min(stageWidth * 0.62, 280) : Math.min(stageWidth * 0.28, 300);
        const baseH = Math.min(stageHeight * 0.082, 52);
        const w = Math.round(baseW * visScale);
        const h = Math.round(baseH * visScale);
        return { w: Math.max(100, w), h: Math.max(26, h) };
      }
      case 'watermark': {
        const text = 'Made with Joelizer';
        const fontSize = Math.max(10, Math.round(stageHeight * 0.018));
        const w = Math.min(stageWidth * 0.7, Math.max(80, text.length * fontSize * 0.55 + 20));
        const h = Math.max(20, Math.round(fontSize * 1.6 + 6));
        return { w, h };
      }
    }
  };

  // Body drag to move
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

  // Canva / PPT corner or edge handle drag to resize
  const handleResizePointerDown = (e: React.PointerEvent, key: ElementKey, handle: ResizeHandle) => {
    e.stopPropagation();
    setSelectedElement(key);
    isResizingRef.current = true;
    resizeKeyRef.current = key;
    resizeHandleRef.current = handle;
    resizeStartPointerRef.current = { x: e.clientX, y: e.clientY };

    const currentScale = key === 'visualizer'
      ? (visualizerSettings?.scale ?? 1.0)
      : (artworkOverride?.sizeScale ?? 1.0);
    initialScaleRef.current = currentScale;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pos = elementPositions[key] || { x: 0.5, y: 0.5 };
      const centerX = rect.left + pos.x * rect.width;
      const centerY = rect.top + pos.y * rect.height;
      elemCenterRef.current = { x: centerX, y: centerY };
      initialDistRef.current = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    }

    const box = getBoxSize(key);
    setActiveResizeTooltip({
      key,
      scalePercent: Math.round(currentScale * 100),
      width: box.w,
      height: box.h
    });

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Handle Canvas Resize (Canva / PPT style)
    if (isResizingRef.current && resizeKeyRef.current && resizeHandleRef.current) {
      const key = resizeKeyRef.current;
      const handle = resizeHandleRef.current;
      const center = elemCenterRef.current;
      const initialDist = Math.max(15, initialDistRef.current);
      const initialScale = initialScaleRef.current;

      let scaleMultiplier = 1.0;

      // Corner handles: proportional diagonal distance from center
      if (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw') {
        const currentDist = Math.hypot(e.clientX - center.x, e.clientY - center.y);
        scaleMultiplier = currentDist / initialDist;
      } else if (handle === 'e' || handle === 'w') {
        // Horizontal handles: width scaling
        const initX = Math.max(12, Math.abs(resizeStartPointerRef.current.x - center.x));
        const currX = Math.abs(e.clientX - center.x);
        scaleMultiplier = currX / initX;
      } else if (handle === 'n' || handle === 's') {
        // Vertical handles: height scaling
        const initY = Math.max(12, Math.abs(resizeStartPointerRef.current.y - center.y));
        const currY = Math.abs(e.clientY - center.y);
        scaleMultiplier = currY / initY;
      }

      let nextScale = initialScale * scaleMultiplier;

      if (key === 'visualizer') {
        nextScale = Math.max(0.35, Math.min(2.8, Math.round(nextScale * 100) / 100));
        updateVisualizerSettings({ scale: nextScale });
      } else if (key === 'artwork') {
        nextScale = Math.max(0.35, Math.min(2.5, Math.round(nextScale * 100) / 100));
        updateArtworkOverride({ sizeScale: nextScale });
      }

      const box = getBoxSize(key);
      setActiveResizeTooltip({
        key,
        scalePercent: Math.round(nextScale * 100),
        width: box.w,
        height: box.h
      });
      return;
    }

    // 2. Handle Element Position Dragging
    if (isDraggingRef.current && activeKeyRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaX = (e.clientX - dragStartPosRef.current.x) / rect.width;
      const deltaY = (e.clientY - dragStartPosRef.current.y) / rect.height;

      const newX = Math.max(0.05, Math.min(0.95, initialElemPosRef.current.x + deltaX));
      const newY = Math.max(0.05, Math.min(0.95, initialElemPosRef.current.y + deltaY));

      setElementPosition(activeKeyRef.current, { x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      activeKeyRef.current = null;
    }
    if (isResizingRef.current) {
      isResizingRef.current = false;
      resizeKeyRef.current = null;
      resizeHandleRef.current = null;
      setTimeout(() => setActiveResizeTooltip(null), 350);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setSelectedElement(null);
    }
  };

  // Double click resets scale to 100%
  const handleDoubleClick = (e: React.MouseEvent, key: ElementKey) => {
    e.stopPropagation();
    if (key === 'visualizer') {
      updateVisualizerSettings({ scale: 1.0 });
    } else if (key === 'artwork') {
      updateArtworkOverride({ sizeScale: 1.0 });
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
            updateVisualizerSettings({ scale: 1.0 });
            updateArtworkOverride({ sizeScale: 1.0 });
          }}
          className="px-2.5 py-1 rounded-md bg-[#12161c]/90 hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md cursor-pointer"
          title="Reset elements positions and scales to 100%"
        >
          <RotateCcw size={11} className="text-accent" />
          <span>Reset Layout</span>
        </button>
      </div>

      {/* Render Draggable & Resizable Bounding Overlays */}
      {keys.map((key) => {
        const pos = elementPositions[key] || { x: 0.5, y: 0.5 };
        const size = getBoxSize(key);
        const isSelected = selectedElement === key;
        const isScalable = key === 'visualizer' || key === 'artwork';

        const currentScale = key === 'visualizer' 
          ? (visualizerSettings?.scale ?? 1.0) 
          : (artworkOverride?.sizeScale ?? 1.0);

        const leftPx = pos.x * stageWidth - size.w / 2;
        const topPx = pos.y * stageHeight - size.h / 2;

        return (
          <div
            key={key}
            onPointerDown={(e) => handlePointerDown(e, key)}
            onDoubleClick={(e) => handleDoubleClick(e, key)}
            className={`absolute rounded transition-shadow cursor-move select-none flex items-center justify-center ${
              isSelected
                ? 'border-[1.5px] border-accent shadow-[0_0_16px_rgba(0,230,118,0.22)] z-30'
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
            {isSelected && (
              <>
                {/* Element Badge (Canva / PPT Header) */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-accent text-black px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-md whitespace-nowrap pointer-events-none">
                  <Move size={9} />
                  <span>{key === 'artwork' ? 'Vinyl / Artwork' : key}</span>
                </div>

                {/* Canva / PPT Resizing Handles for Scalable Elements (Visualizer & Vinyl) */}
                {isScalable && (
                  <>
                    {/* Corner Handles (nw, ne, se, sw) */}
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'nw')}
                      className="absolute -top-[6px] -left-[6px] w-3 h-3 bg-white border-[1.5px] border-accent rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-40 touch-none"
                      title="Drag corner to scale (NW)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'ne')}
                      className="absolute -top-[6px] -right-[6px] w-3 h-3 bg-white border-[1.5px] border-accent rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-40 touch-none"
                      title="Drag corner to scale (NE)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'se')}
                      className="absolute -bottom-[6px] -right-[6px] w-3 h-3 bg-white border-[1.5px] border-accent rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-40 touch-none"
                      title="Drag corner to scale (SE)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'sw')}
                      className="absolute -bottom-[6px] -left-[6px] w-3 h-3 bg-white border-[1.5px] border-accent rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-40 touch-none"
                      title="Drag corner to scale (SW)"
                    />

                    {/* Edge Handles (n, s, w, e) */}
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'n')}
                      className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-accent rounded-full shadow-sm cursor-ns-resize hover:scale-110 transition-transform z-40 touch-none"
                      title="Drag to scale (Top)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 's')}
                      className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-accent rounded-full shadow-sm cursor-ns-resize hover:scale-110 transition-transform z-40 touch-none"
                      title="Drag to scale (Bottom)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'w')}
                      className="absolute top-1/2 -left-[4px] -translate-y-1/2 w-2 h-4 bg-white border border-accent rounded-full shadow-sm cursor-ew-resize hover:scale-110 transition-transform z-40 touch-none"
                      title="Drag to scale (Left)"
                    />
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, key, 'e')}
                      className="absolute top-1/2 -right-[4px] -translate-y-1/2 w-2 h-4 bg-white border border-accent rounded-full shadow-sm cursor-ew-resize hover:scale-110 transition-transform z-40 touch-none"
                      title="Drag to scale (Right)"
                    />

                    {/* Canva / PPT Style Live Dimension Pill */}
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-[#0a0c10]/95 text-white font-mono text-[9px] font-semibold px-2 py-0.5 rounded shadow-lg border border-[#232933] pointer-events-none backdrop-blur-md whitespace-nowrap flex items-center gap-1.5 z-40">
                      <span className="text-accent">{Math.round(currentScale * 100)}%</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300">{size.w} × {size.h}px</span>
                      {currentScale !== 1.0 && (
                        <span className="text-slate-400 text-[8px] pl-0.5">(2x-click 100%)</span>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
