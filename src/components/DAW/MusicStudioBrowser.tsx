import React, { useRef, useState } from 'react';
import { Disc3, Download, FolderOpen, Headphones, Layers, Music2, Play, Plus, SlidersHorizontal, Upload, X } from 'lucide-react';
import { useDAWStore } from '../../store/useDAWStore';
import { dawAudioEngine } from '../../lib/dawAudioEngine';
import { encodeLabWav } from '../../lib/audioLabEngine';
import { PhonkSynthDesigner } from '../Audio/PhonkSynthDesigner';
import { MusicStudioPianoRoll } from './MusicStudioPianoRoll';
import type { TrackType } from '../../types/daw';

type Sample = {
  id: string; name: string; file: File; url: string; duration: number;
  buffer: AudioBuffer;
};
type DrumLane = 'Kick' | 'Snare' | 'Hat' | 'Percussion';
const lanes: DrumLane[] = ['Kick', 'Snare', 'Hat', 'Percussion'];
const initialPatterns: Record<DrumLane, boolean[]> = {
  Kick: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0].map(Boolean),
  Snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean),
  Hat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean),
  Percussion: Array(16).fill(false)
};
const btn = 'rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40';
const accentBtn = 'rounded-md border border-cyan-400/35 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-40';
let sampleCounter = 0;
const safeName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^\w\- ()]/g, '_').slice(0, 70);

async function bounceDrumRack(
  samples: Record<DrumLane, Sample | null>,
  pattern: Record<DrumLane, boolean[]>,
  tempo: number,
  bars: number
): Promise<Blob> {
  const sampleRate = 44100;
  const stepSeconds = 60 / tempo / 4;
  const duration = stepSeconds * 16 * bars;
  const audio = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const bus = audio.createDynamicsCompressor();
  bus.threshold.value = -7;
  bus.knee.value = 10;
  bus.ratio.value = 3;
  bus.attack.value = 0.004;
  bus.release.value = 0.10;
  bus.connect(audio.destination);
  let used = 0;
  for (const lane of lanes) {
    const sample = samples[lane];
    if (!sample) continue;
    const sourceBuffer = sample.buffer;
    for (let bar = 0; bar < bars; bar++) {
      for (let step = 0; step < 16; step++) {
        if (!pattern[lane][step]) continue;
        const position = (bar * 16 + step) * stepSeconds;
        const source = audio.createBufferSource();
        source.buffer = sourceBuffer;
        const gain = audio.createGain();
        gain.gain.value = lane === 'Hat' ? 0.34 : lane === 'Percussion' ? 0.48 : 0.70;
        source.connect(gain);
        gain.connect(bus);
        source.start(position, 0, Math.max(0.001, Math.min(sourceBuffer.duration, duration - position)));
        used++;
      }
    }
  }
  if (!used) throw new Error('Assign samples and select at least one step before rendering.');
  const rendered = await audio.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const ceiling = Math.pow(10, -1 / 20);
  const multiplier = peak > 0 ? Math.min(1, ceiling / peak) : 1;
  for (let ch = 0; ch < 2; ch++) {
    const data = rendered.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= multiplier;
  }
  return encodeLabWav(rendered, 24);
}

export function MusicStudioBrowser() {
  const [tab, setTab] = useState<'samples' | 'drums' | 'piano' | 'synth'>('samples');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Import your own licensed sample packs or audio recordings.');
  const [busy, setBusy] = useState(false);
  const [pattern, setPattern] = useState<Record<DrumLane, boolean[]>>(initialPatterns);
  const [assignments, setAssignments] = useState<Record<DrumLane, string>>({
    Kick: '', Snare: '', Hat: '', Percussion: ''
  });
  const [bars, setBars] = useState(4);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const wavUrls = useRef<string[]>([]);
  const selectedTrackId = useDAWStore(s => s.selectedTrackId);
  const tracks = useDAWStore(s => s.tracks);
  const currentTime = useDAWStore(s => s.currentTime);
  const bpm = useDAWStore(s => s.bpm);
  const addTrack = useDAWStore(s => s.addTrack);
  const addClip = useDAWStore(s => s.addClip);
  const seek = useDAWStore(s => s.seek);
  const selected = tracks.find(t => t.id === selectedTrackId);

  const insertAudio = (blob: Blob, name: string, duration: number, type: TrackType = 'AUDIO') => {
    // Session URLs are deliberately kept alive for the existing multitrack audio
    // engine. Project JSON alone cannot persist in-memory imported file bytes.
    const url = URL.createObjectURL(blob);
    wavUrls.current.push(url);
    const newTrack = addTrack(type, safeName(name));
    addClip(newTrack, {
      name: safeName(name),
      audioUrl: url,
      startTime: currentTime,
      duration,
      sourceStart: 0,
      sourceEnd: duration,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0
    });
    setStatus('Inserted "' + name + '" on a new ' + type.toLowerCase() + ' track at ' + currentTime.toFixed(2) + ' seconds.');
  };

  const loadFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true);
    let loaded = 0;
    let skipped = 0;
    const newSamples: Sample[] = [];
    for (const file of files.slice(0, 150)) {
      let url: string | null = null;
      try {
        if (file.size > 120 * 1024 * 1024) throw new Error('File exceeds 120 MB.');
        url = URL.createObjectURL(file);
        const buffer = await dawAudioEngine.loadAudioBuffer(url, file);
        if (buffer.duration <= 0) throw new Error('Audio has no duration.');
        wavUrls.current.push(url);
        newSamples.push({
          id: 'sample-' + (++sampleCounter), name: file.name, file, url,
          duration: buffer.duration, buffer
        });
        loaded++;
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        skipped++;
        console.warn('Could not import sample', file.name, e);
      }
    }
    setSamples(old => [...old, ...newSamples]);
    setStatus('Loaded ' + loaded + ' audio file(s)' + (skipped ? ', skipped ' + skipped + ' unsupported or oversized.' : '.'));
    setBusy(false);
  };

  const getSample = (id: string) => samples.find(s => s.id === id) || null;
  const preview = (sample: Sample) => {
    if (previewRef.current) {
      previewRef.current.src = sample.url;
      previewRef.current.play().catch(() => setStatus('Browser blocked preview playback.'));
    }
  };
  const renderBeat = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Rendering sample-based drum rack pattern...');
    try {
      const selectedSamples = Object.fromEntries(lanes.map(lane => [lane, getSample(assignments[lane])])) as Record<DrumLane, Sample | null>;
      const blob = await bounceDrumRack(selectedSamples, pattern, bpm, bars);
      const url = URL.createObjectURL(blob);
      wavUrls.current.push(url);
      const duration = bars * 4 * 60 / bpm;
      insertAudio(blob, 'Drum Rack ' + bpm + 'BPM', duration, 'DRUMS');
      setPreviewUrl(url);
      setStatus('Rendered a ' + bars + '-bar sample-based beat and inserted it into the multitrack timeline.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Drum rack rendering failed.');
    } finally { setBusy(false); }
  };

  const filtered = samples.filter(sample => sample.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <aside aria-label="Music Studio sample and instrument browser" className="flex h-full w-full flex-col overflow-hidden border-r border-white/10 bg-[#0b0e15] text-slate-200">
      <header className="border-b border-white/10 p-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-white">
          <Layers size={16} className="text-cyan-300" /> Browser & Instruments
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
          Sample-based production · original synthesizers · multitrack clips
        </p>
        <div className="mt-3 grid grid-cols-4 gap-1">
          <button className={tab === 'samples' ? accentBtn : btn} aria-pressed={tab === 'samples'} onClick={() => setTab('samples')}>Samples</button>
          <button className={tab === 'drums' ? accentBtn : btn} aria-pressed={tab === 'drums'} onClick={() => setTab('drums')}>Drums</button>
          <button className={tab === 'piano' ? accentBtn : btn} aria-pressed={tab === 'piano'} onClick={() => setTab('piano')}>Piano</button>
          <button className={tab === 'synth' ? accentBtn : btn} aria-pressed={tab === 'synth'} onClick={() => setTab('synth')}>Synth</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'samples' && (
          <div className="space-y-3">
            <input type="file" multiple accept="audio/*,.wav,.mp3,.flac,.ogg,.aiff,.m4a"
              ref={fileInput} className="hidden"
              onChange={event => {
                void loadFiles(Array.from(event.target.files || []));
                event.target.value = '';
              }}/>
            <button type="button" onClick={() => fileInput.current?.click()} className={accentBtn + ' w-full'} disabled={busy}>
              <Upload size={13} className="mr-1 inline" /> Import audio files / sample pack
            </button>
            <div
              role="button" tabIndex={0}
              onKeyDown={event => { if (event.key === 'Enter') fileInput.current?.click(); }}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); void loadFiles(Array.from(event.dataTransfer.files)); }}
              className="rounded-lg border border-dashed border-cyan-300/25 bg-cyan-300/[0.03] px-3 py-5 text-center text-[11px] text-slate-400">
              Drop samples, loops or recordings here
            </div>
            <input type="search" aria-label="Search imported samples" value={search}
              onChange={event => setSearch(event.target.value)} placeholder="Filter sounds..."
              className="w-full rounded border border-white/15 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-400/50"/>
            {selected && <p className="text-[10px] text-slate-500">Selected track: {selected.name}. Inserted samples create separate editable tracks.</p>}
            {filtered.length === 0
              ? <p className="rounded border border-white/10 p-3 text-xs text-slate-500">No imported audio yet. Import professionally produced one-shots or samples for the sound you want; this browser will not substitute low-quality synthesized imitations.</p>
              : <div className="space-y-1">{filtered.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] p-2">
                  <button type="button" aria-label={'Preview ' + s.name} className="shrink-0 text-cyan-300" onClick={() => preview(s)}>
                    <Headphones size={15}/>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-white" title={s.name}>{s.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{s.duration.toFixed(2)} s</div>
                  </div>
                  <button type="button" aria-label={'Insert ' + s.name} title="Insert onto new DAW track at playhead"
                    className={accentBtn} onClick={() => insertAudio(s.file, s.name, s.duration, 'AUDIO')}>
                    <Plus size={14}/>
                  </button>
                </div>
              ))}</div>}
            <p className="text-[10px] text-amber-200/65">Session audio uses local browser URLs. Keep original sample files; exported project JSON cannot embed their bytes.</p>
          </div>
        )}
        {tab === 'drums' && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white">Sample-based 16-step drum rack</h4>
            <p className="text-[11px] text-slate-400">Assign imported one-shots to four pads. Each pad triggers the actual source sound, not a procedural imitation.</p>
            {samples.length === 0 && (
              <button type="button" className={accentBtn} onClick={() => { setTab('samples'); fileInput.current?.click(); }}>Import drum samples first</button>
            )}
            <div className="flex items-center gap-3 text-xs">
              <label>Bars <select aria-label="Drum rack bars" value={bars} onChange={event => setBars(Number(event.target.value))}
                className="ml-1 rounded border border-white/15 bg-[#18202d] p-1">
                {[1, 2, 4, 8].map(n => <option key={n}>{n}</option>)}
              </select></label>
              <span className="text-slate-400">{bpm} BPM (transport)</span>
            </div>
            <div className="space-y-3">{lanes.map(lane => (
              <div key={lane} className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.025] p-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 shrink-0 text-[11px] font-semibold">{lane}</div>
                  <select aria-label={lane + ' sample'} value={assignments[lane]}
                    onChange={e => setAssignments(old => ({...old,[lane]: e.target.value}))}
                    className="w-full min-w-0 rounded border border-white/10 bg-[#161e29] p-1 text-[10px]">
                    <option value="">Choose sample...</option>
                    {samples.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-16 gap-[2px]" style={{gridTemplateColumns: 'repeat(16,minmax(0,1fr))'}}>
                  {pattern[lane].map((enabled,i) => (
                    <button key={i} type="button" aria-label={lane + ' step ' + (i+1)} aria-pressed={enabled}
                      onClick={() => setPattern(old => ({
                        ...old, [lane]: old[lane].map((v,j)=>i===j?!v:v)
                      }))}
                      className={'h-6 rounded-sm border ' + (enabled
                        ? 'border-cyan-300 bg-cyan-400/85'
                        : 'border-white/10 bg-white/5 hover:bg-white/15')}/>
                  ))}
                </div>
              </div>
            ))}</div>
            <button type="button" onClick={() => void renderBeat()} disabled={busy} className={accentBtn + ' w-full'}>
              <Disc3 size={13} className="mr-1 inline"/> Render & insert beat
            </button>
          </div>
        )}
        {tab === 'piano' && (
          <MusicStudioPianoRoll samples={samples} bpm={bpm} onInsert={(blob,name,duration) =>
            insertAudio(blob,name,duration,'SYNTH')} />
        )}
        {tab === 'synth' && (
          <div className="space-y-3">
            <p className="rounded-lg border border-amber-400/20 p-2 text-[11px] text-amber-200/80">
              Experimental procedural synthesis; not a replacement for professionally produced samples or third-party VST instruments.
            </p>
            <PhonkSynthDesigner onInsert={(blob,name,duration) =>
              insertAudio(blob,name,duration,'SYNTH')} />
          </div>
        )}
      </div>
      <footer className="shrink-0 border-t border-white/10 p-2">
        <p role="status" className="text-[10px] text-slate-400">{busy ? 'Processing locally... ' : ''}{status}</p>
        <audio className="hidden" ref={previewRef} controls />
        {previewUrl && <audio src={previewUrl} aria-label="Rendered drum rack preview" className="mt-1 w-full" controls />}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">{samples.length} samples in browser</span>
          <button type="button" className={btn} onClick={() => { seek(0); }}>
            <Play size={12} className="mr-1 inline"/> Go to start
          </button>
        </div>
      </footer>
    </aside>
  );
}
