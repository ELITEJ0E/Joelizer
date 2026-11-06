import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines, Download, Drum, Music2, Pause, Play, RotateCcw, Save,
  SlidersHorizontal, Sparkles, WandSparkles
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { encodeLabWav } from '../../lib/audioLabEngine';
import {
  createPhonkAudioBuffer, filenameForPhonk, makePhonkSettings,
  normalizePhonkPCM, PHONK_LANES, PHONK_PATTERNS, PHONK_SOUNDS,
  renderPhonkBeat, renderPhonkOneShot,
  type PhonkLane, type PhonkPCM, type PhonkPattern,
  type PhonkSettings, type PhonkSound, type PhonkStyle
} from '../../lib/phonkSynthEngine';

const action = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition';
const primary = 'rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition';
const card = 'rounded-xl border border-white/10 bg-[#111821] p-3 sm:p-4';
const label = 'text-[11px] font-medium text-slate-300';
const laneColor: Record<PhonkLane, string> = {
  kick: 'bg-rose-400', snare: 'bg-amber-400', hat: 'bg-sky-400', cowbell: 'bg-violet-400'
};
const midiNotes = Array.from({ length: 61 }, (_, i) => i + 36);
const noteName = (note: number) =>
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][note % 12] + (Math.floor(note / 12) - 1);

type Exported = { name: string; blob: Blob; url: string; duration: number; kind: 'sound' | 'beat' };

function Knob({ title, value, min, max, step = 1, unit = '%', onChange }: {
  title: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex justify-between gap-3 text-[11px]">
        <span className="text-slate-300">{title}</span>
        <span className="font-mono text-violet-300">{Number(value.toFixed(2))}{unit}</span>
      </div>
      <input className="w-full cursor-pointer accent-violet-400" type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}

function previewPeaks(pcm: PhonkPCM): number[] {
  const points = 110;
  const result: number[] = [];
  const stride = Math.max(1, Math.floor(pcm.left.length / points));
  for (let k = 0; k < points; k++) {
    const start = k * stride;
    const end = Math.min(pcm.left.length, start + stride);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]));
    result.push(peak);
  }
  return result;
}

export function PhonkSynthDesigner() {
  const [mode, setMode] = useState<'sound' | 'beat'>('sound');
  const [style, setStyle] = useState<PhonkStyle>('drift');
  const [settings, setSettings] = useState<PhonkSettings>(() => makePhonkSettings('drift', 'cowbell'));
  const [pattern, setPattern] = useState<PhonkPattern>(() =>
    Object.fromEntries(PHONK_LANES.map(lane => [lane, [...PHONK_PATTERNS.drift[lane]]])) as PhonkPattern
  );
  const [tempo, setTempo] = useState(140);
  const [bars, setBars] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [exported, setExported] = useState<Exported | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const player = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);
  const destroyed = useRef(false);
  const renderId = useRef(0);
  const setAudio = useStore(s => s.setAudio);

  useEffect(() => () => {
    destroyed.current = true;
    renderId.current++;
    player.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const selectStyle = (next: PhonkStyle) => {
    setStyle(next);
    setSettings(makePhonkSettings(next, settings.type));
    setPattern(Object.fromEntries(PHONK_LANES.map(lane => [
      lane, [...PHONK_PATTERNS[next][lane]]
    ])) as PhonkPattern);
    setTempo(next === 'brazilian' ? 158 : next === 'dark' ? 115 : 140);
    setStatus('');
  };
  const selectSound = (next: PhonkSound) => {
    // Longer effects need enough tail room to be audible and exportable.
    const duration = next === 'riser' ? 3 : next === 'atmosphere' ? 6 :
      next === 'impact' ? 2 : next === 'bass' ? 1.5 :
      next === 'hat' ? 0.3 : next === 'snare' ? 0.5 :
      next === 'kick' ? 0.7 : settings.duration;
    setSettings(current => ({ ...current, type: next, duration }));
    setStatus('');
  };
  const update = (key: keyof PhonkSettings, value: number) =>
    setSettings(current => ({ ...current, [key]: value }));
  const toggleStep = (lane: PhonkLane, step: number) =>
    setPattern(old => ({ ...old, [lane]: old[lane].map((v, index) => index === step ? !v : v) }));

  const render = async (kind: 'sound' | 'beat') => {
    if (busy) return;
    const sequence = ++renderId.current;
    setBusy(true); setStatus('Synthesizing original audio locally...');
    // Yield once so the busy indicator can paint before sample generation.
    await new Promise<void>(resolve => setTimeout(resolve, 25));
    try {
      const pcm = kind === 'beat'
        ? renderPhonkBeat(pattern, tempo, settings, bars)
        : normalizePhonkPCM(renderPhonkOneShot(settings));
      const audio = createPhonkAudioBuffer(pcm);
      const blob = encodeLabWav(audio, 24);
      if (destroyed.current || sequence !== renderId.current) return;
      if (player.current) {
        player.current.pause();
        player.current.currentTime = 0;
      }
      setPlaying(false);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const name = filenameForPhonk(kind === 'sound' ? settings.type : 'beat', style);
      setExported({ blob, url, name, duration: pcm.duration, kind });
      setWaveform(previewPeaks(pcm));
      setStatus('Generated ' + name + ' · ' + pcm.duration.toFixed(2) + ' s · 24-bit stereo WAV');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Audio synthesis failed.');
    } finally {
      if (!destroyed.current && sequence === renderId.current) setBusy(false);
    }
  };
  const play = async () => {
    const el = player.current;
    if (!el || !exported) return;
    if (!el.paused) { el.pause(); setPlaying(false); return; }
    try {
      await el.play(); setPlaying(true); setStatus('Playing ' + exported.name);
    } catch {
      setStatus('Browser playback unavailable. Try downloading the WAV file.');
    }
  };
  const download = () => {
    if (!exported) return;
    const a = document.createElement('a');
    a.href = exported.url;
    a.download = exported.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const addToPlaylist = () => {
    if (!exported) return;
    // Persist a distinct object URL: the transient preview URL is released on
    // unmount and cannot be shared with the global playlist.
    const trackUrl = URL.createObjectURL(exported.blob);
    setAudio(exported.blob, trackUrl, exported.duration, null, {
      name: exported.name.replace(/\.wav$/i, ''),
      artist: 'Joelizer Phonk Designer'
    });
    setStatus('Added the generated audio to the Joelizer playlist.');
  };

  return (
    <div className="space-y-4">
      <section className={card + ' space-y-3'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Sparkles size={17} className="text-violet-400" /> Phonk Synth & FX Designer
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Generate original cowbells, screaming leads, sliding 808s, risers, impacts, atmospheres and drum loops.
              No purchased packs or third-party recordings required.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={mode === 'sound' ? primary : action}
              aria-pressed={mode === 'sound'} onClick={() => setMode('sound')}>
              <Music2 size={13} className="mr-1 inline" /> Sound designer
            </button>
            <button type="button" className={mode === 'beat' ? primary : action}
              aria-pressed={mode === 'beat'} onClick={() => setMode('beat')}>
              <Drum size={13} className="mr-1 inline" /> 16-step beat maker
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>Phonk style</span>
          {(['drift', 'brazilian', 'dark'] as const).map(item => (
            <button key={item} type="button" aria-pressed={style === item}
              className={style === item ? primary : action} onClick={() => selectStyle(item)}>
              {item === 'drift' ? 'Drift Phonk' : item === 'brazilian' ? 'Brazilian Phonk' : 'Dark Phonk'}
            </button>
          ))}
        </div>
      </section>

      {mode === 'sound' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={card}>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-200">Sound library</h4>
            <div className="grid grid-cols-2 gap-2">
              {PHONK_SOUNDS.map(sound => (
                <button key={sound.id} type="button" onClick={() => selectSound(sound.id)}
                  aria-pressed={settings.type === sound.id}
                  className={'min-h-16 rounded-lg border px-3 py-2 text-left transition ' + (
                    settings.type === sound.id
                      ? 'border-violet-400/70 bg-violet-400/15'
                      : 'border-white/10 bg-black/25 hover:border-white/25'
                  )}>
                  <div className="text-xs font-semibold text-white">{sound.label}</div>
                  <div className="mt-1 text-[10px] leading-snug text-slate-400">{sound.description}</div>
                </button>
              ))}
            </div>
          </section>
          <section className={card}>
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-200">
              <SlidersHorizontal size={14} /> Synthesis parameters
            </h4>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-2">
                <span className={label}>Pitch / key</span>
                <select aria-label="Synth pitch" value={settings.note}
                  className="rounded border border-white/15 bg-[#121a24] px-3 py-1.5 text-xs text-white"
                  onChange={e => update('note', Number(e.target.value))}>
                  {midiNotes.map(n => <option key={n} value={n}>{noteName(n)}</option>)}
                </select>
              </label>
              <Knob title="Sound length" value={settings.duration} min={0.2} max={8} step={0.1}
                unit=" s" onChange={v => update('duration', v)} />
              <Knob title="Distortion / drive" value={settings.drive} min={0} max={100} onChange={v => update('drive', v)} />
              <Knob title="Brightness / tone" value={settings.tone} min={0} max={100} onChange={v => update('tone', v)} />
              <Knob title="Pitch glide / sweep" value={settings.glide} min={0} max={100} onChange={v => update('glide', v)} />
              <Knob title="Echo / stereo space" value={settings.space} min={0} max={100} onChange={v => update('space', v)} />
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className={action} onClick={() => update('seed', (settings.seed + 6151) >>> 0)}>
                  <WandSparkles size={13} className="mr-1 inline" /> New sound variation
                </button>
                <span className="font-mono text-[10px] text-slate-500">Seed {settings.seed}</span>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className={card + ' space-y-4'}>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-200">16-step drum and cowbell sequencer</h4>
              <p className="mt-1 text-[11px] text-slate-400">Toggle steps to make your own 4/4 phonk groove. Export a seamless 1–8 bar loop.</p>
            </div>
            <label className={label}>Tempo
              <input aria-label="Beat tempo" type="number" min={60} max={220}
                className="ml-2 w-16 rounded border border-white/15 bg-[#121a24] px-2 py-1.5 text-white"
                value={tempo} onChange={e => setTempo(Math.max(60, Math.min(220, Number(e.target.value) || 60)))} /> BPM
            </label>
            <label className={label}>Bars
              <select aria-label="Loop bars" value={bars} onChange={e => setBars(Number(e.target.value))}
                className="ml-2 rounded border border-white/15 bg-[#121a24] px-2 py-1.5 text-white">
                {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className={action} onClick={() =>
              setPattern(Object.fromEntries(PHONK_LANES.map(lane => [lane, [...PHONK_PATTERNS[style][lane]]])) as PhonkPattern)}>
              <RotateCcw size={13} className="mr-1 inline" /> Reset pattern
            </button>
            <button type="button" className={action}
              onClick={() => setPattern(Object.fromEntries(PHONK_LANES.map(lane => [lane, Array(16).fill(false)])) as PhonkPattern)}>
              Clear
            </button>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[600px] space-y-2">
              <div className="grid grid-cols-[74px_repeat(16,minmax(0,1fr))] gap-1 text-center font-mono text-[9px] text-slate-500">
                <span></span>{Array.from({ length: 16 }, (_, i) => <span key={i}>{i + 1}</span>)}
              </div>
              {PHONK_LANES.map(lane => (
                <div key={lane} className="grid grid-cols-[74px_repeat(16,minmax(0,1fr))] items-center gap-1">
                  <div className="truncate text-[11px] font-semibold capitalize text-slate-300">{lane}</div>
                  {pattern[lane].map((checked, step) => (
                    <button type="button" key={step} aria-label={lane + ' step ' + (step + 1)}
                      aria-pressed={checked} onClick={() => toggleStep(lane, step)}
                      className={'h-9 rounded border transition ' + (checked
                        ? laneColor[lane] + ' border-transparent text-slate-900 shadow-sm'
                        : 'border-white/10 bg-black/30 hover:border-white/30')} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Use style presets for a starting beat, then edit each instrument lane. Individual sounds use the same synthesis engine as Sound Designer.</p>
        </section>
      )}

      <section className={card + ' space-y-3'}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={primary} disabled={busy} onClick={() => void render(mode)}>
            <WandSparkles size={14} className="mr-1 inline" /> {busy ? 'Rendering...' : mode === 'beat' ? 'Generate beat loop' : 'Generate sound'}
          </button>
          {exported && (
            <>
              <button type="button" className={action} onClick={() => void play()}>
                {playing ? <Pause size={14} className="mr-1 inline" /> : <Play size={14} className="mr-1 inline" />}
                {playing ? 'Pause preview' : 'Play preview'}
              </button>
              <button type="button" className={primary} onClick={download}>
                <Download size={14} className="mr-1 inline" /> Download 24-bit WAV
              </button>
              <button type="button" className={action} onClick={addToPlaylist}>
                <Save size={14} className="mr-1 inline" /> Add to Joelizer playlist
              </button>
            </>
          )}
        </div>
        {exported && (
          <div aria-label="Generated audio waveform"
            className="flex h-16 items-center gap-[1px] overflow-hidden rounded-lg bg-black/35 px-1">
            {waveform.map((value, index) => (
              <div key={index} className="min-w-[1px] flex-1 rounded-sm bg-violet-400/90"
                style={{ height: Math.max(2, Math.min(100, value * 115)) + '%' }} />
            ))}
          </div>
        )}
        <p className="min-h-4 text-[11px] text-slate-400" role="status">
          {status || 'Choose a sound or beat, adjust the controls, then generate audio to preview and download.'}
        </p>
        <audio ref={player} src={exported?.url} preload="metadata"
          onEnded={() => setPlaying(false)} />
        <p className="text-[10px] text-slate-500">
          Everything is synthesized in your browser from mathematical waveforms and noise.
          No audio samples are downloaded or uploaded, and results are provided as original sound-design building blocks.
          Preview does not play automatically.
        </p>
      </section>
    </div>
  );
}
