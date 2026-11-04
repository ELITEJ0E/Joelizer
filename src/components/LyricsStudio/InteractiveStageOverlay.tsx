import React, { useRef, useState } from 'react';
import { useLyricsVideoStore, CanvasElementPositions } from '../../store/useLyricsVideoStore';
import { useStore } from '../../store/useStore';
import { RotateCcw, Move, Sliders, Magnet, Eye, ShieldCheck, Check } from 'lucide-react';

interface Props {
  stageWidth: number;
  stageHeight: number;
  filterKeys?: ElementKey[];
  mode?: 'lyrics-video' | 'music-video';
}

type ElementKey = keyof CanvasElementPositions;
type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

interface ActiveGuide {
  id: string;
  type: 'x' | 'y';
  posPx: number;
  color: 'magenta' | 'cyan';
  label: string;
}

interface SpacingGuide {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gapPx: number;
}

export function InteractiveStageOverlay({ stageWidth, stageHeight, filterKeys, mode }: Props) {
  const selectedElement = useLyricsVideoStore(s => s.selectedElement);
  const setSelectedElement = useLyricsVideoStore(s => s.setSelectedElement);
  const elementPositions = useLyricsVideoStore(s => s.elementPositions);
  const setElementPosition = useLyricsVideoStore(s => s.setElementPosition);
  const resetElementPositions = useLyricsVideoStore(s => s.resetElementPositions);
  const artworkOverride = useLyricsVideoStore(s => s.artworkOverride);
  const updateArtworkOverride = useLyricsVideoStore(s => s.updateArtworkOverride);
  const showSafeArea = useLyricsVideoStore(s => s.showSafeArea);
  const setShowSafeArea = useLyricsVideoStore(s => s.setShowSafeArea);

  const aspectRatio = useStore(s => s.aspectRatio);
  const visualizerSettings = useStore(s => s.visualizerSettings);
  const updateVisualizerSettings = useStore(s => s.updateVisualizerSettings);

  // Canva / CapCut Style Smart Alignment Settings
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState(true);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [showCenterGuidesEnabled, setShowCenterGuidesEnabled] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Active runtime guide lines during dragging
  const [activeGuides, setActiveGuides] = useState<ActiveGuide[]>([]);
  const [activeSpacing, setActiveSpacing] = useState<SpacingGuide[]>([]);

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

  // Match the actual rendered lyric position while a Top/Center/Bottom
  // preset is active. The selection box must sit on the text, not the old
  // normalized coordinates from a previous template.
  const getDisplayedPos = (key: ElementKey) => {
    const original = elementPositions[key] || { x: 0.5, y: 0.5 };
    // Lyrics Studio now renders from elementPositions, so its hit box must
    // always use that same anchor even when old preset state is persisted.
    if (key !== 'lyrics' || mode === 'lyrics-video') return original;
    const preset = useLyricsVideoStore.getState().typographyOverride.position ||
      useStore.getState().lyricsSettings?.position;
    if (preset === 'center') return { x: 0.5, y: 0.5 };
    if (preset === 'top') return { x: 0.5, y: 0.2 };
    if (preset === 'bottom') return { x: 0.5, y: stageHeight > stageWidth ? 0.82 : 0.80 };
    return original;
  };

  // Body drag to move
  const handlePointerDown = (e: React.PointerEvent, key: ElementKey) => {
    e.stopPropagation();
    setSelectedElement(key);
    const startPos = getDisplayedPos(key);
    if (key === 'lyrics') {
      // Transfer the currently visible position to the drag state before
      // releasing the preset, so grabbing the text cannot make it jump.
      setElementPosition('lyrics', startPos);
      useLyricsVideoStore.getState().updateTypographyOverride({ position: undefined });
      useStore.getState().updateLyricsSettings({ position: undefined });
    }
    isDraggingRef.current = true;
    activeKeyRef.current = key;

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    initialElemPosRef.current = { ...startPos };

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

  const artworkStyle = useLyricsVideoStore(s => s.artworkOverride.style);
  const showArtwork = useLyricsVideoStore(s => s.showArtwork);
  const showVisualizer = useLyricsVideoStore(s => s.showVisualizer);
  const showLyrics = useLyricsVideoStore(s => s.showLyrics);
  const showMeta = useLyricsVideoStore(s => s.showMeta);
  const allAvailableKeys: ElementKey[] = (['artwork', 'meta', 'lyrics', 'visualizer', 'watermark'] as ElementKey[]).filter(
    k => {
      if (k === 'artwork') return showArtwork !== false && artworkStyle !== 'none' && artworkStyle !== 'background-blur';
      if (k === 'visualizer') return showVisualizer !== false && artworkStyle !== 'glowing-disc' && artworkStyle !== 'glowing-disc-needle';
      if (k === 'lyrics') return showLyrics !== false;
      if (k === 'meta') return showMeta !== false;
      return true;
    }
  );

  const keys: ElementKey[] = filterKeys
    ? allAvailableKeys.filter(k => filterKeys.includes(k))
    : allAvailableKeys;

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

    // 2. Handle Element Position Dragging with Canva-Style Alignment Guides & Snapping
    if (isDraggingRef.current && activeKeyRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaX = (e.clientX - dragStartPosRef.current.x) / rect.width;
      const deltaY = (e.clientY - dragStartPosRef.current.y) / rect.height;

      const rawX = initialElemPosRef.current.x + deltaX;
      const rawY = initialElemPosRef.current.y + deltaY;

      let finalCx = rawX * stageWidth;
      let finalCy = rawY * stageHeight;

      const activeKey = activeKeyRef.current;
      const activeBox = getBoxSize(activeKey);
      const halfW = activeBox.w / 2;
      const halfH = activeBox.h / 2;

      const guides: ActiveGuide[] = [];
      const spacing: SpacingGuide[] = [];

      // Snap threshold in screen pixels (visually consistent across preview sizes)
      const SNAP_PX = 7;

      let snappedX = false;
      let snappedY = false;

      if (snappingEnabled) {
        // --- A. Center Alignment Lines (4.1) ---
        const canvasCenterX = stageWidth / 2;
        const canvasCenterY = stageHeight / 2;

        if (showCenterGuidesEnabled || smartGuidesEnabled) {
          // Horizontal Center Snap (Vertical magenta line at X=50%)
          if (Math.abs(finalCx - canvasCenterX) <= SNAP_PX) {
            finalCx = canvasCenterX;
            snappedX = true;
            guides.push({
              id: 'center-x',
              type: 'x',
              posPx: canvasCenterX,
              color: 'magenta',
              label: 'CENTER'
            });
          }

          // Vertical Center Snap (Horizontal magenta line at Y=50%)
          if (Math.abs(finalCy - canvasCenterY) <= SNAP_PX) {
            finalCy = canvasCenterY;
            snappedY = true;
            guides.push({
              id: 'center-y',
              type: 'y',
              posPx: canvasCenterY,
              color: 'magenta',
              label: 'MIDDLE'
            });
          }
        }

        // --- B. Mutual Element-to-Element Snapping (4.2) ---
        if (smartGuidesEnabled) {
          for (const otherKey of keys) {
            if (otherKey === activeKey) continue;
            const otherPos = elementPositions[otherKey] || { x: 0.5, y: 0.5 };
            const otherBox = getBoxSize(otherKey);
            const otherCx = otherPos.x * stageWidth;
            const otherCy = otherPos.y * stageHeight;
            const otherHalfW = otherBox.w / 2;
            const otherHalfH = otherBox.h / 2;

            // X-axis alignment
            if (!snappedX) {
              // Center to Center
              if (Math.abs(finalCx - otherCx) <= SNAP_PX) {
                finalCx = otherCx;
                snappedX = true;
                guides.push({
                  id: `align-cx-${otherKey}`,
                  type: 'x',
                  posPx: otherCx,
                  color: 'cyan',
                  label: 'CENTER'
                });
              }
              // Left edge to Left edge
              else if (Math.abs((finalCx - halfW) - (otherCx - otherHalfW)) <= SNAP_PX) {
                finalCx = (otherCx - otherHalfW) + halfW;
                snappedX = true;
                guides.push({
                  id: `align-left-${otherKey}`,
                  type: 'x',
                  posPx: otherCx - otherHalfW,
                  color: 'cyan',
                  label: 'LEFT'
                });
              }
              // Right edge to Right edge
              else if (Math.abs((finalCx + halfW) - (otherCx + otherHalfW)) <= SNAP_PX) {
                finalCx = (otherCx + otherHalfW) - halfW;
                snappedX = true;
                guides.push({
                  id: `align-right-${otherKey}`,
                  type: 'x',
                  posPx: otherCx + otherHalfW,
                  color: 'cyan',
                  label: 'RIGHT'
                });
              }
            }

            // Y-axis alignment
            if (!snappedY) {
              // Middle to Middle
              if (Math.abs(finalCy - otherCy) <= SNAP_PX) {
                finalCy = otherCy;
                snappedY = true;
                guides.push({
                  id: `align-cy-${otherKey}`,
                  type: 'y',
                  posPx: otherCy,
                  color: 'cyan',
                  label: 'MIDDLE'
                });
              }
              // Top edge to Top edge
              else if (Math.abs((finalCy - halfH) - (otherCy - otherHalfH)) <= SNAP_PX) {
                finalCy = (otherCy - otherHalfH) + halfH;
                snappedY = true;
                guides.push({
                  id: `align-top-${otherKey}`,
                  type: 'y',
                  posPx: otherCy - otherHalfH,
                  color: 'cyan',
                  label: 'TOP'
                });
              }
              // Bottom edge to Bottom edge
              else if (Math.abs((finalCy + halfH) - (otherCy + otherHalfH)) <= SNAP_PX) {
                finalCy = (otherCy + otherHalfH) - halfH;
                snappedY = true;
                guides.push({
                  id: `align-bottom-${otherKey}`,
                  type: 'y',
                  posPx: otherCy + otherHalfH,
                  color: 'cyan',
                  label: 'BOTTOM'
                });
              }
            }
          }

          // --- C. Equal-Spacing Guide Detection (4.3) ---
          const otherElements = keys
            .filter(k => k !== activeKey)
            .map(k => {
              const pos = elementPositions[k] || { x: 0.5, y: 0.5 };
              const box = getBoxSize(k);
              return {
                key: k,
                cx: pos.x * stageWidth,
                cy: pos.y * stageHeight,
                top: pos.y * stageHeight - box.h / 2,
                bottom: pos.y * stageHeight + box.h / 2
              };
            })
            .sort((a, b) => a.cy - b.cy);

          // Check if active element is dragged vertically between two other elements
          for (let i = 0; i < otherElements.length - 1; i++) {
            const above = otherElements[i];
            const below = otherElements[i + 1];

            if (finalCy > above.bottom && finalCy < below.top) {
              const gapAbove = (finalCy - halfH) - above.bottom;
              const gapBelow = below.top - (finalCy + halfH);

              if (gapAbove > 0 && gapBelow > 0 && Math.abs(gapAbove - gapBelow) <= SNAP_PX) {
                const targetGap = (gapAbove + gapBelow) / 2;
                finalCy = above.bottom + targetGap + halfH;
                snappedY = true;
                spacing.push({
                  id: `equal-spacing-v`,
                  x1: finalCx,
                  y1: above.bottom,
                  x2: finalCx,
                  y2: below.top,
                  gapPx: Math.round(targetGap)
                });
                break;
              }
            }
          }
        }
      }

      // Safe bounds within visible stage: 0.05 to 0.95
      const newX = Math.max(0.04, Math.min(0.96, finalCx / stageWidth));
      const newY = Math.max(0.04, Math.min(0.96, finalCy / stageHeight));

      setElementPosition(activeKey, { x: newX, y: newY });
      setActiveGuides(guides);
      setActiveSpacing(spacing);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      activeKeyRef.current = null;
      // 4.1 & 4.6 Guides must disappear when dragging ends
      setActiveGuides([]);
      setActiveSpacing([]);
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

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="absolute inset-0 z-20 pointer-events-auto cursor-default select-none overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ========================================================================= */}
      {/* CANVA / CAPCUT STYLE SMART GUIDES CONTROLS TOOLBAR (4.4) */}
      {/* ========================================================================= */}
      <div className="absolute top-2.5 right-2.5 z-40 flex items-center gap-1.5 pointer-events-auto">
        {/* Toggleable Settings Pill */}
        <div className="flex items-center rounded-lg bg-[#0e1115]/90 border border-[#232933] shadow-xl backdrop-blur-md p-0.5 text-[#9aa2ae]">
          {/* Smart Guides Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSmartGuidesEnabled(!smartGuidesEnabled);
            }}
            title={smartGuidesEnabled ? 'Smart Guides Active (Click to Disable)' : 'Smart Guides Inactive (Click to Enable)'}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
              smartGuidesEnabled ? 'text-accent bg-accent/15' : 'text-[#6e7787] hover:text-[#f0f3f6]'
            }`}
          >
            <Magnet size={11} className={smartGuidesEnabled ? 'text-accent' : ''} />
            <span className="hidden sm:inline">Guides</span>
          </button>

          {/* Safe Area Guide Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSafeArea(!showSafeArea);
            }}
            title="Safe Area Guides Toggle"
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
              showSafeArea ? 'text-[#38bdf8] bg-[#38bdf8]/15' : 'text-[#6e7787] hover:text-[#f0f3f6]'
            }`}
          >
            <ShieldCheck size={11} />
            <span className="hidden sm:inline">Safe</span>
          </button>

          {/* Quick Settings Dropdown */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSettingsMenu(!showSettingsMenu);
            }}
            title="Alignment Settings"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              showSettingsMenu ? 'text-accent bg-[#1c222c]' : 'text-[#6e7787] hover:text-[#f0f3f6]'
            }`}
          >
            <Sliders size={12} />
          </button>
        </div>

        {/* RESET LAYOUT renamed to RESET (Prompt Requirement) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetElementPositions(aspectRatio);
            // Reset returns to the template layout, not a stale global positioning preset.
            useLyricsVideoStore.getState().updateTypographyOverride({ position: undefined });
            useStore.getState().updateLyricsSettings({ position: undefined });
            updateVisualizerSettings({ scale: 1.0 });
            updateArtworkOverride({ sizeScale: 1.0 });
          }}
          className="px-2.5 py-1.5 rounded-lg bg-[#0e1115]/90 hover:bg-[#161b22] border border-[#232933] text-[#7e8999] hover:text-[#f0f3f6] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md cursor-pointer"
          title="Reset elements positions and scales to 100%"
        >
          <RotateCcw size={11} className="text-accent" />
          <span>Reset</span>
        </button>

        {/* Settings Popover Dropdown */}
        {showSettingsMenu && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute top-9 right-0 w-48 rounded-xl bg-[#0e1115] border border-[#28313e] p-2 shadow-2xl backdrop-blur-xl flex flex-col gap-1 z-50 text-[11px] font-mono animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2 py-1 text-[9px] uppercase font-bold text-[#626e80] border-b border-[#1f2631] mb-1">
              Snapping & Guides
            </div>

            <button
              type="button"
              onClick={() => setSmartGuidesEnabled(!smartGuidesEnabled)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#161b22] text-[#c4cad4] cursor-pointer"
            >
              <span>Smart Guides</span>
              {smartGuidesEnabled && <Check size={12} className="text-accent" />}
            </button>

            <button
              type="button"
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#161b22] text-[#c4cad4] cursor-pointer"
            >
              <span>Magnetic Snapping</span>
              {snappingEnabled && <Check size={12} className="text-accent" />}
            </button>

            <button
              type="button"
              onClick={() => setShowCenterGuidesEnabled(!showCenterGuidesEnabled)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#161b22] text-[#c4cad4] cursor-pointer"
            >
              <span>Center Guides</span>
              {showCenterGuidesEnabled && <Check size={12} className="text-accent" />}
            </button>

            <button
              type="button"
              onClick={() => setShowSafeArea(!showSafeArea)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#161b22] text-[#c4cad4] cursor-pointer"
            >
              <span>Safe Area Guide</span>
              {showSafeArea && <Check size={12} className="text-[#38bdf8]" />}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4.1 & 4.2 CANVA-STYLE ALIGNMENT GUIDE LINES (EDITOR ONLY, NEVER IN EXPORT) */}
      {/* ========================================================================= */}
      {activeGuides.map((guide) => {
        const isMagenta = guide.color === 'magenta';
        const lineColor = isMagenta ? '#ec4899' : '#00e5ff';
        const glowColor = isMagenta ? 'rgba(236,72,153,0.6)' : 'rgba(0,229,255,0.6)';

        if (guide.type === 'x') {
          return (
            <div
              key={guide.id}
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center justify-between"
              style={{
                left: `${guide.posPx}px`,
                width: '1px',
                backgroundColor: lineColor,
                boxShadow: `0 0 6px ${glowColor}`
              }}
            >
              {/* Top Guide Indicator Pill */}
              <div 
                className="mt-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase tracking-wider text-black shadow-lg"
                style={{ backgroundColor: lineColor }}
              >
                {guide.label}
              </div>
              {/* Bottom Guide Indicator Pill */}
              <div 
                className="mb-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase tracking-wider text-black shadow-lg"
                style={{ backgroundColor: lineColor }}
              >
                {guide.label}
              </div>
            </div>
          );
        } else {
          return (
            <div
              key={guide.id}
              className="absolute left-0 right-0 pointer-events-none z-30 flex items-center justify-between"
              style={{
                top: `${guide.posPx}px`,
                height: '1px',
                backgroundColor: lineColor,
                boxShadow: `0 0 6px ${glowColor}`
              }}
            >
              {/* Left Guide Indicator Pill */}
              <div 
                className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase tracking-wider text-black shadow-lg"
                style={{ backgroundColor: lineColor }}
              >
                {guide.label}
              </div>
              {/* Right Guide Indicator Pill */}
              <div 
                className="mr-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold uppercase tracking-wider text-black shadow-lg"
                style={{ backgroundColor: lineColor }}
              >
                {guide.label}
              </div>
            </div>
          );
        }
      })}

      {/* ========================================================================= */}
      {/* 4.3 EQUAL-SPACING GUIDES INDICATOR (EDITOR ONLY) */}
      {/* ========================================================================= */}
      {activeSpacing.map((sp) => (
        <div
          key={sp.id}
          className="absolute pointer-events-none z-30 flex flex-col items-center justify-center border-l-2 border-dashed border-[#c084fc] shadow-[0_0_8px_rgba(192,132,252,0.4)]"
          style={{
            left: `${sp.x1}px`,
            top: `${sp.y1}px`,
            height: `${Math.max(10, sp.y2 - sp.y1)}px`
          }}
        >
          <div className="bg-[#c084fc] text-black px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider shadow-md">
            Equal {sp.gapPx}px
          </div>
        </div>
      ))}

      {/* ========================================================================= */}
      {/* SAFE AREA GUIDES OVERLAY (OPTIONAL) */}
      {/* ========================================================================= */}
      {showSafeArea && (
        <div 
          className="absolute inset-[8%] border border-dashed border-[#38bdf8]/40 rounded pointer-events-none z-20 flex items-start justify-end p-2"
        >
          <span className="text-[8px] font-mono uppercase tracking-widest text-[#38bdf8]/75 bg-[#0e1115]/80 px-1.5 py-0.5 rounded border border-[#38bdf8]/30">
            Safe Zone (90%)
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RENDER DRAGGABLE & RESIZABLE BOUNDING OVERLAYS */}
      {/* ========================================================================= */}
      {keys.map((key) => {
        const pos = getDisplayedPos(key);
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
