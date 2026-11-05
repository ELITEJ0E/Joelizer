import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AudioLines, Download, FileAudio, FileSearch, ShieldCheck, SlidersHorizontal, Upload, X } from 'lucide-react';
import {
  MASTER_PRESETS, SPECTRAL_BANDS, cleanMasterFilename, decodeLabFile, encodeLabWav,
  masterLabAudio, measureAudio, type AudioLabMetrics, type MasterPreset, type MasterSettings
} from '../../lib/audioLabEngine';
import {
  calculateFileSha256, inspectAudioFile, waveformStructureCorrelation, type AudioFileInspection
} from '../../lib/audioProvenance';

type Slot = 'original' | 'comparison' | 'master';
type LoadedFile = {
  file: File;
  inspection: AudioFileInspection;
  metrics: AudioLabMetrics;
  url: string;
};
type MasteredFile = {
  url: string;
  blob: Blob;
  metrics: AudioLabMetrics;
  settings: MasterSettings;
  gainDb: number;
};

interface Props {
  onClose: () => void;
  currentAudio?: Blob | null;
  currentName?: string;
}

const numberText = (number: number | null | undefined, decimals = 1) =>
  number === null || number === undefined || !Number.isFinite(number)
    ? '—' : number.toFixed(decimals);
const panelStyle = 'rounded-xl border border-white/10 bg-[#10161c] p-3 sm:p-4';
const actionStyle = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const accentStyle = 'rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

function Stat({ title, value, unit = '' }: { title: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
      <div className="text-[10px] text-slate-400">{title}</div>
      <div className="text-sm font-semibold tabular-nums text-slate-100">{value} <span className="text-[10px] font-normal text-slate-500">{unit}</span></div>
    </div>
  );
}

function Metrics({ label, metrics }: { label: string; metrics: AudioLabMetrics }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-slate-100">{label}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat title="RMS level (not LUFS)" value={numberText(metrics.rmsDbfs)} unit="dBFS" />
        <Stat title="Sample peak (not true peak)" value={numberText(metrics.samplePeakDbfs)} unit="dBFS" />
        <Stat title="Crest factor" value={numberText(metrics.crestDb)} unit="dB" />
        <Stat title="Samples near clipping" value={numberText(metrics.clippedPercent, 3)} unit="%" />
        <Stat title="Sample rate" value={numberText(metrics.sampleRate / 1000)} unit="kHz" />
        <Stat title="Stereo correlation" value={numberText(metrics.stereoCorrelation, 2)} />
      </div>
    </div>
  );
}

function Waveform({ values, color }: { values: number[]; color: string }) {
  const peak = Math.max(0.001, ...values);
  return (
    <div className="flex h-12 items-center gap-[1px] overflow-hidden rounded bg-black/35 p-1" aria-label="Amplitude overview">
      {values.map((value, index) => (
        <div key={index} className="min-w-[1px] flex-1 rounded-sm" style={{
          backgroundColor: color,
          opacity: 0.4 + 0.6 * value / peak,
          height: String(Math.max(2, Math.round(100 * value / peak))) + '%'
        }} />
      ))}
    </div>
  );
}

function RangeField({ label, value, min, max, step, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-3 text-slate-300">
        <span>{label}</span><span className="font-mono tabular-nums text-emerald-300">{numberText(value)}{unit}</span>
      </div>
      <input type="range" className="w-full cursor-pointer accent-emerald-400" value={value} min={min} max={max} step={step}
        onChange={event => onChange(Number(event.target.value))} />
    </label>
  );
}

export function AudioMasteringLabModal({ onClose, currentAudio, currentName }: Props) {
  const [original, setOriginal] = useState<LoadedFile | null>(null);
  const [comparison, setComparison] = useState<LoadedFile | null>(null);
  const [master, setMaster] = useState<MasteredFile | null>(null);
  const [settings, setSettings] = useState<MasterSettings>({ ...MASTER_PRESETS.balanced });
  const [preset, setPreset] = useState<MasterPreset>('balanced');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [rmsMatch, setRmsMatch] = useState(true);
  const [sourceHash, setSourceHash] = useState('');
  const originalBuffer = useRef<AudioBuffer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const compareInput = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Record<Slot, HTMLAudioElement | null>>({ original: null, comparison: null, master: null });
  const activeAudio = useRef<Slot | null>(null);
  const objectUrls = useRef<string[]>([]);
  const operationSequence = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', esc);
    return () => {
      operationSequence.current++;
      window.removeEventListener('keydown', esc);
      Object.values(audioRefs.current).forEach(audio => audio?.pause());
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const setUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    return url;
  };
  const resetMaster = () => {
    setMaster(null);
    if (activeAudio.current === 'master') {
      audioRefs.current.master?.pause();
      activeAudio.current = null;
      setActiveSlot(null);
    }
  };

  const loadFile = async (file: File, slot: 'original' | 'comparison') => {
    const sequence = ++operationSequence.current;
    setBusy('Analyzing ' + file.name);
    setError('');
    try {
      if (file.size > 512 * 1024 * 1024) throw new Error('File is over 512 MB. Use a shorter recording for local browser analysis.');
      const buffer = await decodeLabFile(file);
      const metrics = measureAudio(buffer);
      const inspection = await inspectAudioFile(file);
      if (sequence !== operationSequence.current) return;
      const value = { file, metrics, inspection, url: setUrl(file) };
      if (slot === 'original') {
        originalBuffer.current = buffer;
        setOriginal(value);
        setSourceHash('');
        resetMaster();
      } else {
        setComparison(value);
      }
    } catch (e) {
      if (sequence === operationSequence.current)
        setError(e instanceof Error ? e.message : 'Could not decode this audio file.');
    } finally {
      if (sequence === operationSequence.current) setBusy('');
    }
  };

  const useCurrent = () => {
    if (!currentAudio) return;
    const file = currentAudio instanceof File ? currentAudio :
      new File([currentAudio], (currentName || 'current-track') + '.wav',
        { type: currentAudio.type || 'application/octet-stream' });
    void loadFile(file, 'original');
  };

  const processMaster = async () => {
    if (!originalBuffer.current || !original) return;
    const sequence = ++operationSequence.current;
    setBusy('Rendering full-resolution local master');
    setError('');
    try {
      const result = await masterLabAudio(originalBuffer.current, settings);
      const blob = encodeLabWav(result.buffer, settings.bitDepth);
      if (sequence !== operationSequence.current) return;
      resetMaster();
      setMaster({ url: setUrl(blob), blob, metrics: result.metrics, settings: { ...settings }, gainDb: result.appliedGainDb });
    } catch (e) {
      if (sequence === operationSequence.current)
        setError(e instanceof Error ? e.message : 'Mastering failed; original audio is unchanged.');
    } finally {
      if (sequence === operationSequence.current) setBusy('');
    }
  };

  const metricsFor = (slot: Slot): AudioLabMetrics | null =>
    slot === 'original' ? original?.metrics || null :
      slot === 'comparison' ? comparison?.metrics || null : master?.metrics || null;
  const playSlot = async (slot: Slot) => {
    const audio = audioRefs.current[slot];
    const metrics = metricsFor(slot);
    if (!audio || !metrics) return;
    const previous = activeAudio.current;
    const last = previous ? audioRefs.current[previous] : null;
    if (previous === slot && !audio.paused) {
      audio.pause(); setActiveSlot(null); activeAudio.current = null; return;
    }
    const requestedPosition = last && previous !== slot ? last.currentTime : audio.currentTime;
    if (last && last !== audio) last.pause();
    audio.currentTime = Math.min(Math.max(0, requestedPosition), Math.max(0, metrics.duration - 0.05));
    const levels = [original?.metrics.rmsDbfs, comparison?.metrics.rmsDbfs, master?.metrics.rmsDbfs]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const quietest = levels.length ? Math.min(...levels) : metrics.rmsDbfs;
    audio.volume = rmsMatch ? Math.min(1, Math.pow(10, (quietest - metrics.rmsDbfs) / 20)) : 1;
    try {
      await audio.play();
      activeAudio.current = slot;
      setActiveSlot(slot);
    } catch {
      setError('Audio playback was blocked by this browser. Select the track and try again.');
    }
  };

  const calculateHash = async () => {
    if (!original) return;
    setBusy('Computing SHA-256 file identity');
    try { setSourceHash(await calculateFileSha256(original.file)); }
    catch (e) { setError(e instanceof Error ? e.message : 'SHA-256 unavailable'); }
    finally { setBusy(''); }
  };

  const download = (blob: Blob, name: string) => {
    const url = setUrl(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };
  const downloadReport = () => {
    if (!original) return;
    const report = {
      tool: 'Joelizer Audio Mastering & Provenance Lab', createdAt: new Date().toISOString(),
      disclaimer: 'Audio feature measurements are not AI-origin or hidden watermark detection. Processing does not imply human authorship.',
      source: { filename: original.file.name, bytes: original.file.size, sha256: sourceHash || null,
        format: original.inspection, metrics: original.metrics },
      comparison: comparison ? { filename: comparison.file.name, metrics: comparison.metrics } : null,
      master: master ? { settings: master.settings, gainDb: master.gainDb, metrics: master.metrics } : null
    };
    download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'joelizer-audio-analysis.json');
  };

  const peer = master?.metrics || comparison?.metrics;
  const structure = original && peer
    ? waveformStructureCorrelation(original.metrics.waveform, peer.waveform) : null;
  const sameDuration = original && peer && Math.abs(original.metrics.duration - peer.duration) < 0.1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-2 sm:p-5" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-label="Joelizer Audio Mastering and Provenance Lab"
        className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0e13] text-slate-200 shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AudioLines size={23} className="shrink-0 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Audio Mastering & Provenance Lab</h2>
              <p className="text-[10px] text-slate-400">Local A/B analysis · professional audio processing · honest provenance inspection</p>
            </div>
          </div>
          <button type="button" aria-label="Close Audio Lab" onClick={onClose} className={actionStyle}><X size={16} /></button>
        </header>

        <div className="space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-100">
            <strong>Important:</strong> This tool cannot authenticate human authorship, detect every hidden fingerprint, or erase an audio watermark.
            A missing local metadata marker is not a negative C2PA verification. Mastering changes sound but does not erase the history of its creation.
          </div>
          {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/35 p-3 text-xs text-red-200">{error}</div>}
          {busy && <div role="status" className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2 text-xs text-emerald-300">{busy}…</div>}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={panelStyle}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Upload size={15} /> Source audio</div>
              <input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" className="hidden"
                onChange={event => { const f = event.target.files?.[0]; if (f) void loadFile(f, 'original'); event.target.value = ''; }} />
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" className={accentStyle} disabled={!!busy} onClick={() => fileInput.current?.click()}>Upload original</button>
                {currentAudio && <button type="button" className={actionStyle} disabled={!!busy} onClick={useCurrent}>Use current Joelizer track</button>}
              </div>
              <p className="break-all text-[11px] text-slate-400">{original?.file.name || 'No original audio selected'}</p>
              {original && <div className="mt-3 space-y-3">
                <Waveform values={original.metrics.waveform} color="#34d399" />
                <Metrics label="Original" metrics={original.metrics} />
              </div>}
            </section>

            <section className={panelStyle}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Activity size={15} /> Comparison master</div>
              <input ref={compareInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" className="hidden"
                onChange={event => { const f = event.target.files?.[0]; if (f) void loadFile(f, 'comparison'); event.target.value = ''; }} />
              <div className="mb-3 flex gap-2">
                <button type="button" className={actionStyle} disabled={!!busy} onClick={() => compareInput.current?.click()}>Upload BandLab / alternate master</button>
              </div>
              <p className="break-all text-[11px] text-slate-400">{comparison?.file.name || 'Optional: upload the processed version of the SAME recording'}</p>
              {comparison && <div className="mt-3 space-y-3">
                <Waveform values={comparison.metrics.waveform} color="#60a5fa" />
                <Metrics label="Comparison" metrics={comparison.metrics} />
              </div>}
            </section>
          </div>

          {(original && (comparison || master)) && (
            <section className={panelStyle}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">A/B listening & spectral comparison</h3>
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" className="accent-emerald-400" checked={rmsMatch} onChange={event => setRmsMatch(event.target.checked)} />
                  RMS-match playback levels
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={activeSlot === 'original' ? accentStyle : actionStyle} onClick={() => void playSlot('original')}>Listen original</button>
                {comparison && <button type="button" className={activeSlot === 'comparison' ? accentStyle : actionStyle} onClick={() => void playSlot('comparison')}>Listen BandLab / comparison</button>}
                {master && <button type="button" className={activeSlot === 'master' ? accentStyle : actionStyle} onClick={() => void playSlot('master')}>Listen Joelizer master</button>}
              </div>
              {original && <audio ref={el => { audioRefs.current.original = el; }} src={original.url} preload="metadata" onEnded={() => { activeAudio.current = null; setActiveSlot(null); }} />}
              {comparison && <audio ref={el => { audioRefs.current.comparison = el; }} src={comparison.url} preload="metadata" onEnded={() => { activeAudio.current = null; setActiveSlot(null); }} />}
              {master && <audio ref={el => { audioRefs.current.master = el; }} src={master.url} preload="metadata" onEnded={() => { activeAudio.current = null; setActiveSlot(null); }} />}
              {original && peer && (
                <div className="mt-3 space-y-2">
                  {!sameDuration && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-200">
                      Different durations: these files are not a controlled mastering comparison. Musical changes may affect every measured difference.
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Whole-song RMS change: <span className="text-slate-100">{numberText(peer.rmsDbfs - original.metrics.rmsDbfs)} dB</span>
                    {' · '}Envelope-shape correlation: <span className="text-slate-100">{numberText(structure, 2)}</span>
                    {' · '}Not an acoustic fingerprint, similarity verdict, or AI score.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SPECTRAL_BANDS.map((band, idx) => (
                      <div key={band} className="rounded border border-white/5 bg-black/20 px-2 py-1">
                        <div className="mb-1 text-[10px] text-slate-400">{band}</div>
                        <div className="h-1.5 rounded bg-white/5 overflow-hidden">
                          <div className="h-full bg-emerald-400" style={{ width: String(Math.max(0, (original.metrics.spectrumDb[idx] + 90) / 90 * 100)) + '%' }} />
                        </div>
                        <div className="mt-1 h-1.5 rounded bg-white/5 overflow-hidden">
                          <div className="h-full bg-blue-400" style={{ width: String(Math.max(0, (peer.spectrumDb[idx] + 90) / 90 * 100)) + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">Green: original · blue: comparison or Joelizer master. Relative spectral energy only; not a validated detector.</p>
                </div>
              )}
            </section>
          )}

          <section className={panelStyle}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><SlidersHorizontal size={16} /> Mastering workstation</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {(Object.keys(MASTER_PRESETS) as MasterPreset[]).map(item => (
                <button key={item} type="button" aria-pressed={preset === item}
                  className={preset === item ? accentStyle : actionStyle}
                  onClick={() => { setPreset(item); setSettings({ ...MASTER_PRESETS[item] }); }}>
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <RangeField label="Low-cut filter" value={settings.highPassHz} min={20} max={80} step={1} unit=" Hz" onChange={v => setSettings(s => ({ ...s, highPassHz: v }))} />
              <RangeField label="Warmth / low shelf" value={settings.lowShelfDb} min={-6} max={6} step={0.5} unit=" dB" onChange={v => setSettings(s => ({ ...s, lowShelfDb: v }))} />
              <RangeField label="Presence" value={settings.presenceDb} min={-6} max={6} step={0.5} unit=" dB" onChange={v => setSettings(s => ({ ...s, presenceDb: v }))} />
              <RangeField label="Air / high shelf" value={settings.airDb} min={-6} max={6} step={0.5} unit=" dB" onChange={v => setSettings(s => ({ ...s, airDb: v }))} />
              <RangeField label="Compression threshold" value={settings.compressorThresholdDb} min={-35} max={-6} step={1} unit=" dB" onChange={v => setSettings(s => ({ ...s, compressorThresholdDb: v }))} />
              <RangeField label="Compression ratio" value={settings.compressorRatio} min={1} max={6} step={0.2} unit=":1" onChange={v => setSettings(s => ({ ...s, compressorRatio: v }))} />
              <RangeField label="RMS target (not LUFS)" value={settings.targetRmsDbfs} min={-24} max={-10} step={0.5} unit=" dBFS" onChange={v => setSettings(s => ({ ...s, targetRmsDbfs: v }))} />
              <RangeField label="Sample-peak ceiling (not true-peak)" value={settings.samplePeakCeilingDbfs} min={-6} max={-0.5} step={0.5} unit=" dBFS" onChange={v => setSettings(s => ({ ...s, samplePeakCeilingDbfs: v }))} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.compressionEnabled} className="accent-emerald-400" onChange={e => setSettings(s => ({ ...s, compressionEnabled: e.target.checked }))} /> Compression</label>
                <label className="flex items-center gap-2 text-xs">WAV depth
                  <select className="rounded border border-white/15 bg-[#111b24] px-2 py-1" value={settings.bitDepth}
                    onChange={e => setSettings(s => ({ ...s, bitDepth: Number(e.target.value) as 16 | 24 }))}>
                    <option value={16}>16-bit</option><option value={24}>24-bit</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className={accentStyle} disabled={!original || !!busy} onClick={() => void processMaster()}>
                Render local master
              </button>
              {master && <button type="button" className={accentStyle}
                onClick={() => download(master.blob, cleanMasterFilename(original?.file.name || 'song'))}>
                <Download size={14} className="mr-1 inline" />Download WAV
              </button>}
            </div>
            {master && <div className="mt-3">
              <p className="mb-3 text-xs text-slate-400">
                Applied gain: {numberText(master.gainDb)} dB. Peak ceiling is sample-level, not inter-sample true-peak limiting.
              </p>
              <Metrics label="Joelizer-rendered master" metrics={master.metrics} />
            </div>}
            <p className="mt-3 text-[11px] text-slate-500">
              Non-destructive EQ, Web Audio compression, peak-safe normalization and dithered PCM WAV export.
              Complex mastering may benefit from dedicated DAW tools and professional review.
            </p>
          </section>

          <section className={panelStyle}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><FileSearch size={16} /> File integrity & provenance</h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Local file-format inspection checks a limited set of readable markers. It does not cryptographically validate C2PA credentials
              or detect embedded watermarks, robust acoustic matches, or AI-generated timbres.
            </p>
            {original && (
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div>Container: <strong>{original.inspection.container}</strong> · {Math.round(original.inspection.sizeBytes / 1024 / 1024 * 10) / 10} MB</div>
                <div>Readable marker hints: {original.inspection.markerHints.length
                  ? original.inspection.markerHints.join(' · ') : 'No known text markers seen in sampled ranges (NOT a clean provenance result)'}</div>
                <p className="text-[11px] text-slate-500">{original.inspection.scopeNote}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={actionStyle} onClick={() => void calculateHash()} disabled={!!busy}>
                    <ShieldCheck size={13} className="mr-1 inline" />Compute file SHA-256
                  </button>
                  <button type="button" className={actionStyle} onClick={downloadReport}>Download analysis report (JSON)</button>
                  <a href="https://suno.com/suno-credentials" target="_blank" rel="noopener noreferrer" className={actionStyle}>
                    Open official Suno C2PA checker
                  </a>
                </div>
                {sourceHash && <div className="break-all rounded bg-black/30 p-2 font-mono text-[10px] text-slate-400">SHA-256: {sourceHash}</div>}
                <p className="text-[11px] text-slate-500">
                  External verification requires the user to open the provider's website and choose whether to upload a file.
                  Joelizer does not submit audio to detector services.
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>, document.body
  );
}
