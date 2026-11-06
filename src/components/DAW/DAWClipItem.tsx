import React, { useRef, useEffect } from 'react';
import { Scissors, Copy, Trash2, VolumeX } from 'lucide-react';
import { DAWClip, DAWTrack } from '../../types/daw';
import { useDAWStore } from '../../store/useDAWStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';
import { gridSeconds } from '../../lib/dawArrangement';
import { getClipEnvelope, normalizedClipFades } from '../../lib/dawAudioProcessing';

interface DAWClipItemProps {
  key?: React.Key;
  clip: DAWClip; track: DAWTrack; isSelected: boolean; zoom: number; onSelect: (clipId: string) => void;
}
type Gesture = { pointerId: number; x: number; mode: 'move' | 'left' | 'right'; clip: DAWClip; changed: boolean };

export function DAWClipItem({ clip, track, isSelected, zoom, onSelect }: DAWClipItemProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const updateClip = useDAWStore(s => s.updateClip);
  const removeClip = useDAWStore(s => s.removeClip);
  const splitClip = useDAWStore(s => s.splitClip);
  const duplicateClip = useDAWStore(s => s.duplicateClip);
  const commitHistory = useDAWStore(s => s.commitHistory);
  const activeTool = useDAWStore(s => s.activeTool);
  const snapToGrid = useDAWStore(s => s.snapToGrid);
  const division = useDAWStore(s => s.gridDivision);
  const bpm = useDAWStore(s => s.bpm);
  const clipWidth = Math.max(8, clip.duration * zoom);
  const step = snapToGrid ? gridSeconds(bpm, division) : 0;
  const snap = (time: number) => step > 0 ? Math.round(time / step) * step : time;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    // Bound backing allocation even for long, highly zoomed clips.
    const width = Math.max(1, Math.min(4096, canvas.clientWidth));
    const height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr; canvas.height = height * dpr;
    context.scale(dpr, dpr); context.clearRect(0, 0, width, height);
    const peaks = clip.peaks || [];
    context.fillStyle = isSelected ? '#ffffff' : track.color;
    if (!peaks.length) { context.fillRect(0, height / 2, width, 1); return; }
    const sourceDuration = dawAudioEngine.getCachedBuffer(clip.audioUrl)?.duration || Math.max(clip.sourceEnd, clip.duration);
    const startPeak = clip.sourceStart / sourceDuration * peaks.length;
    const endPeak = clip.sourceEnd / sourceDuration * peaks.length;
    for (let x = 0; x < width; x += 2) {
      const from = Math.max(0, Math.floor(startPeak + x / width * (endPeak - startPeak)));
      const to = Math.min(peaks.length, Math.max(from + 1, Math.ceil(startPeak + (x + 2) / width * (endPeak - startPeak))));
      let value = 0;
      for (let index = from; index < to; index++) value = Math.max(value, Math.abs(peaks[index] || 0));
      const amplitude = Math.max(1, Math.min(1, value) * height * 0.43);
      context.fillRect(x, height / 2 - amplitude, 1.5, amplitude * 2);
    }
  }, [clip.peaks, clip.audioUrl, clip.sourceStart, clip.sourceEnd, clip.duration, clipWidth, track.color, isSelected]);

  const beginGesture = (event: React.PointerEvent<HTMLElement>, mode: Gesture['mode']) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.preventDefault(); onSelect(clip.id); event.currentTarget.focus({ preventScroll: true });
    if (mode === 'move' && activeTool === 'split') { splitClip(clip.id, useDAWStore.getState().currentTime); return; }
    if (mode === 'move' && activeTool === 'erase') { removeClip(clip.id); return; }
    gesture.current = { pointerId: event.pointerId, x: event.clientX, mode, clip: { ...clip }, changed: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const initial = active.clip;
    const movement = (event.clientX - active.x) / zoom;
    let updates: Partial<DAWClip>;
    if (active.mode === 'move') {
      updates = { startTime: Math.max(0, snap(initial.startTime + movement)) };
    } else if (active.mode === 'left') {
      const minDuration = Math.min(0.02, initial.duration);
      const delta = Math.max(-Math.min(initial.startTime, initial.sourceStart), Math.min(initial.duration - minDuration, snap(initial.startTime + movement) - initial.startTime));
      const duration = initial.duration - delta;
      updates = { startTime: initial.startTime + delta, duration, sourceStart: initial.sourceStart + delta, fadeIn: Math.min(initial.fadeIn, duration), fadeOut: Math.min(initial.fadeOut, duration) };
    } else {
      const sourceDuration = dawAudioEngine.getCachedBuffer(initial.audioUrl)?.duration || initial.sourceEnd;
      const maxDuration = Math.max(0.001, sourceDuration - initial.sourceStart);
      const duration = Math.max(Math.min(0.02, maxDuration), Math.min(maxDuration, snap(initial.startTime + initial.duration + movement) - initial.startTime));
      updates = { duration, sourceEnd: initial.sourceStart + duration, fadeIn: Math.min(initial.fadeIn, duration), fadeOut: Math.min(initial.fadeOut, duration) };
    }
    if (Object.entries(updates).some(([key, value]) => initial[key as keyof DAWClip] !== value)) active.changed = true;
    updateClip(initial.id, updates);
  };
  const finishGesture = (event: React.PointerEvent<HTMLElement>, cancel = false) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.stopPropagation(); gesture.current = null;
    if (cancel) updateClip(active.clip.id, active.clip);
    else if (active.changed) commitHistory();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); onSelect(clip.id);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') removeClip(clip.id);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const increment = (step || 0.1) * (event.shiftKey ? 4 : 1);
      const startTime = Math.max(0, clip.startTime + (event.key === 'ArrowRight' ? increment : -increment));
      if (startTime !== clip.startTime) { updateClip(clip.id, { startTime }); commitHistory(); }
    }
  };
  const trimHandle = (side: 'left' | 'right') => (
    <button type="button" aria-label={`Trim ${side === 'left' ? 'start' : 'end'} of ${clip.name}`} title={`Drag to trim ${side === 'left' ? 'start' : 'end'}`}
      onPointerDown={event => beginGesture(event, side)} onPointerMove={moveGesture}
      onPointerUp={event => finishGesture(event)} onPointerCancel={event => finishGesture(event, true)} onLostPointerCapture={event => finishGesture(event)}
      onClick={event => event.stopPropagation()}
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-2 cursor-ew-resize touch-none bg-white/15 hover:bg-white/50 focus-visible:bg-white/50 opacity-40 group-hover:opacity-100 z-30`} />
  );
  // Use the same envelope as playback, including a split's retained source offset.
  // Unit gain keeps the fade shape independent of the clip's gain control.
  const unitGainClip = { ...clip, volume: 1 };
  const envelope = normalizedClipFades(clip.fadeEnvelope ?? clip);
  const offset = Math.max(0, clip.fadeEnvelope?.offset || 0);
  const fadeTimes = [...new Set([0, envelope.fadeIn - offset, envelope.duration - envelope.fadeOut - offset, clip.duration])]
    .filter(time => time >= 0 && time <= clip.duration).sort((a, b) => a - b);
  const fadePoints = fadeTimes.map(time => ({ x: time / Math.max(.001, clip.duration) * 100, y: (1 - getClipEnvelope(unitGainClip, time)) * 100 }));
  const fadePath = `M0 0 ${fadePoints.map(point => `L${Number(point.x.toFixed(6))} ${Number(point.y.toFixed(6))}`).join(' ')} L100 0 Z`;
  return (
    <div role="group" tabIndex={0} aria-label={`${clip.name}, ${clip.startTime.toFixed(2)} seconds, ${clip.duration.toFixed(2)} seconds long`} aria-current={isSelected ? true : undefined}
      data-testid="daw-clip" onFocus={() => onSelect(clip.id)} onKeyDown={handleKeyDown} onClick={event => { event.stopPropagation(); onSelect(clip.id); }}
      onPointerDown={event => beginGesture(event, 'move')} onPointerMove={moveGesture} onPointerUp={event => finishGesture(event)}
      onPointerCancel={event => finishGesture(event, true)} onLostPointerCapture={event => finishGesture(event)}
      className={`absolute top-2 bottom-2 rounded-lg overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing border group transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 ${isSelected ? 'border-white ring-1 ring-white/50 shadow-xl z-20' : 'border-white/20 hover:border-white/40 z-10'} ${clip.isMuted ? 'opacity-45' : ''}`}
      style={{ left: clip.startTime * zoom, width: clipWidth, backgroundColor: `${track.color}25` }}>
      <div className="h-5 px-2 flex items-center justify-between gap-1 text-[10px] font-bold text-white font-mono" style={{ backgroundColor: `${track.color}cc` }}>
        <span className="truncate">{clip.name}</span>{clip.isMuted && <VolumeX size={10} className="shrink-0" />}
        <span className="text-[9px] opacity-80 shrink-0">{clip.duration.toFixed(1)}s</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-[calc(100%-20px)] block" />
      <svg className="absolute inset-x-0 bottom-0 w-full pointer-events-none" style={{ height: 'calc(100% - 20px)' }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {fadePoints.some(point => point.y > 0) && <path data-testid="clip-fade-envelope" d={fadePath} fill="rgba(0,0,0,0.42)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" />}
      </svg>
      {trimHandle('left')}{trimHandle('right')}
      <div onPointerDown={event => event.stopPropagation()} className={`absolute right-2 top-1 flex items-center gap-0.5 transition-opacity z-30 bg-black/85 rounded p-0.5 border border-white/20 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
        <button type="button" aria-label={`Split ${clip.name} at playhead`} onClick={event => { event.stopPropagation(); splitClip(clip.id, useDAWStore.getState().currentTime); }} className="p-1 hover:bg-white/20 rounded text-white" title="Split at playhead"><Scissors size={11} /></button>
        <button type="button" aria-label={`Duplicate ${clip.name}`} onClick={event => { event.stopPropagation(); duplicateClip(clip.id); }} className="p-1 hover:bg-white/20 rounded text-white" title="Duplicate clip"><Copy size={11} /></button>
        <button type="button" aria-label={`Delete ${clip.name}`} onClick={event => { event.stopPropagation(); removeClip(clip.id); }} className="p-1 hover:bg-rose-500/40 text-rose-300 rounded" title="Delete clip"><Trash2 size={11} /></button>
      </div>
    </div>
  );
}
