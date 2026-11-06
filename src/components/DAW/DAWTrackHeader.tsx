import React, { useState, useRef } from 'react';
import { Mic, Sliders, Volume2, Circle, Trash2, Plus, Disc, Zap, Activity, AudioLines } from 'lucide-react';
import { DAWTrack } from '../../types/daw';
import { useDAWStore } from '../../store/useDAWStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';

interface DAWTrackHeaderProps { key?: React.Key; track: DAWTrack; isSelected: boolean }
export function DAWTrackHeader({ track, isSelected }: DAWTrackHeaderProps) {
  const setSelectedTrackId = useDAWStore(s => s.setSelectedTrackId);
  const updateTrack = useDAWStore(s => s.updateTrack);
  const removeTrack = useDAWStore(s => s.removeTrack);
  const toggleTrackMute = useDAWStore(s => s.toggleTrackMute);
  const toggleTrackSolo = useDAWStore(s => s.toggleTrackSolo);
  const toggleTrackArmed = useDAWStore(s => s.toggleTrackArmed);
  const setTrackVolume = useDAWStore(s => s.setTrackVolume);
  const setTrackPan = useDAWStore(s => s.setTrackPan);
  const addClip = useDAWStore(s => s.addClip);
  const commitHistory = useDAWStore(s => s.commitHistory);
  const [isEditingName, setIsEditingName] = useState(false);
  const [trackName, setTrackName] = useState(track.name);
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const sliderChanged = useRef(false);
  const finishSlider = () => { if (sliderChanged.current) { commitHistory(); sliderChanged.current = false; } };
  const Icon = track.type === 'VOCAL' ? Mic : track.type === 'GUITAR' ? Activity : track.type === 'DRUMS' ? Disc : track.type === 'AI' ? Zap : track.type === 'SYNTH' || track.type === 'KEYS' ? Sliders : AudioLines;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importing) return;
    setImporting(true); setNotice('Importing audio…');
    const url = URL.createObjectURL(file);
    try {
      const buffer = await dawAudioEngine.loadAudioBuffer(url, file);
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('The audio file has no playable duration.');
      addClip(track.id, { name: file.name.replace(/\.[^/.]+$/, ''), audioUrl: url,
        startTime: useDAWStore.getState().currentTime, duration: buffer.duration, sourceStart: 0, sourceEnd: buffer.duration,
        volume: 1, fadeIn: 0, fadeOut: 0, peaks: dawAudioEngine.computePeaks(buffer) });
      setNotice('');
    } catch (error) {
      URL.revokeObjectURL(url);
      setNotice(error instanceof Error ? error.message : 'Could not decode this audio file.');
    } finally { setImporting(false); }
  };

  return (
    <div data-testid="daw-track-header" onClick={() => setSelectedTrackId(track.id)}
      className={`h-24 w-full min-w-0 border-b border-white/10 border-l-2 p-2 flex flex-col justify-between select-none transition-colors relative group shrink-0 ${isSelected ? 'bg-[#151926]' : 'bg-[#0d0f16] hover:bg-[#11151e]'}`}
      style={{ borderLeftColor: isSelected ? track.color : 'transparent' }}>
      <div className="flex items-center justify-between gap-1 min-w-0">
        <Icon size={13} style={{ color: track.color }} className="shrink-0 hidden sm:block" />
        {isEditingName ? (
          <input type="text" aria-label={`Rename ${track.name}`} value={trackName} maxLength={80} autoFocus
            onChange={event => setTrackName(event.target.value)} onClick={event => event.stopPropagation()}
            onBlur={event => { const name = event.currentTarget.value.trim() || track.name; setIsEditingName(false); if (name !== track.name) { updateTrack(track.id, { name }); commitHistory(); } }}
            onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = track.name; event.currentTarget.blur(); } }}
            className="bg-black/60 min-w-0 text-xs font-semibold text-white px-1 py-0.5 rounded border border-white/30 focus:outline-emerald-400 w-full" />
        ) : (
          <button type="button" onClick={event => { event.stopPropagation(); setSelectedTrackId(track.id); setTrackName(track.name); setIsEditingName(true); }}
            className="text-xs font-semibold text-slate-200 text-left truncate min-w-0 flex-1 hover:text-white rounded focus-visible:outline-emerald-400" title="Rename track" aria-label={`Rename ${track.name}`}>{track.name}</button>
        )}
        <label className={`p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer focus-within:outline focus-within:outline-emerald-400 ${importing ? 'opacity-40' : ''}`} title="Import audio at playhead">
          <Plus size={12} /><input type="file" accept="audio/*" className="sr-only" aria-label={`Import audio to ${track.name}`} disabled={importing} onChange={handleFileUpload} />
        </label>
        <button type="button" onClick={event => { event.stopPropagation(); removeTrack(track.id); }} aria-label={`Delete ${track.name} track`} title="Delete track"
          className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"><Trash2 size={12} /></button>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={event => { event.stopPropagation(); toggleTrackMute(track.id); commitHistory(); }} aria-pressed={track.muted} aria-label={`Mute ${track.name}`} title="Mute track"
          className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${track.muted ? 'bg-amber-400 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>M</button>
        <button type="button" onClick={event => { event.stopPropagation(); toggleTrackSolo(track.id); commitHistory(); }} aria-pressed={track.solo} aria-label={`Solo ${track.name}`} title="Solo track"
          className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${track.solo ? 'bg-cyan-400 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>S</button>
        <button type="button" onClick={event => { event.stopPropagation(); toggleTrackArmed(track.id); }} aria-pressed={track.armed} aria-label={`Arm ${track.name} for recording`} title="Arm for recording"
          className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${track.armed ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}><Circle size={8} className="fill-current" /><span>REC</span></button>
        <span className="ml-auto text-[9px] font-mono text-slate-500 hidden sm:inline">{track.clips.length}</span>
      </div>
      {notice ? <span role="status" className="text-[9px] text-amber-300 truncate" title={notice}>{notice}</span> : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <Volume2 size={11} className="text-slate-500 shrink-0 hidden sm:block" />
            <input type="range" min="0" max="1.5" step="0.01" value={track.volume} aria-label={`${track.name} volume`}
              onChange={event => { sliderChanged.current = true; setTrackVolume(track.id, parseFloat(event.target.value)); }}
              onPointerUp={finishSlider} onKeyUp={finishSlider} onBlur={finishSlider} onClick={event => event.stopPropagation()}
              className="w-full min-w-0 h-1 rounded-lg cursor-pointer accent-emerald-400" title={`Volume ${Math.round(track.volume * 100)}%`} />
            <span className="text-[9px] font-mono text-slate-400 w-7 text-right shrink-0">{Math.round(track.volume * 100)}%</span>
          </div>
          <input type="range" min="-1" max="1" step="0.05" value={track.pan} aria-label={`${track.name} pan`}
            onChange={event => { sliderChanged.current = true; setTrackPan(track.id, parseFloat(event.target.value)); }}
            onPointerUp={finishSlider} onKeyUp={finishSlider} onBlur={finishSlider} onClick={event => event.stopPropagation()}
            className="w-7 sm:w-10 h-1 rounded-lg cursor-pointer accent-cyan-400" title={`Pan ${track.pan === 0 ? 'center' : `${Math.round(Math.abs(track.pan) * 100)}% ${track.pan < 0 ? 'left' : 'right'}`}`} />
        </div>
      )}
    </div>
  );
}
