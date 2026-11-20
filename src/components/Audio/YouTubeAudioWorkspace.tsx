import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileAudio, Loader2, Music2, Youtube } from 'lucide-react';
import { useStore } from '../../store/useStore';

type OutputFormat = 'mp3' | 'wav';

function parseYouTubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      id = url.searchParams.get('v') || (/^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function YouTubeAudioWorkspace() {
  const [link, setLink] = useState('');
  const [format, setFormat] = useState<OutputFormat>('wav');
  const [authorized, setAuthorized] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; blob: Blob; filename: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setAudio = useStore(s => s.setAudio);
  const setName = useStore(s => s.setName);
  const accent = useStore(s => s.visualizerSettings.color) || '#00e676';
  const videoId = parseYouTubeId(link);

  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const convert = async () => {
    if (!videoId || !authorized || busy) return;
    setError(''); setBusy(true);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const base = ((import.meta as any).env?.VITE_RENDER_SERVER_URL || '').replace(/\/$/, '');
      if (base && !base.startsWith('https://') && !/^http:\/\/localhost(?::\d+)?$/.test(base)) {
        throw new Error('Converter backend must use HTTPS to protect the access key.');
      }
      const response = await fetch(`${base}/api/youtube-audio/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Youtube-Import-Key': key } : {}) },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, format, authorized: true }),
        signal: controller.signal
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || (response.status === 404
          ? 'The YouTube converter is not available on this deployment. Connect a persistent Joelizer Node render server.'
          : `Audio conversion failed (HTTP ${response.status}).`));
      }
      const blob = await response.blob();
      if (blob.size < 100) throw new Error('The converter returned an empty audio file.');
      const filename = `youtube-${videoId}.${format}`;
      setResult({ url: URL.createObjectURL(blob), blob, filename });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Conversion failed.');
    } finally { setBusy(false); abortRef.current = null; }
  };

  const useAsSource = async () => {
    if (!result) return;
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = result.url;
    const duration = await new Promise<number>(resolve => {
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => resolve(0);
    });
    const file = new File([result.blob], result.filename, { type: result.blob.type });
    // The preview URL is revoked when leaving this workspace; the global
    // audio source needs its own independently owned object URL.
    const sourceUrl = URL.createObjectURL(result.blob);
    setAudio(file, sourceUrl, duration, null, { name: result.filename.replace(/\.[^.]+$/, ''), artist: 'YouTube Import' });
    setName(result.filename.replace(/\.[^.]+$/, ''));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0e1115] p-4 sm:p-7 text-[#f0f3f6]">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Youtube size={24} style={{ color: accent }} />
          <div><h1 className="text-lg font-bold">YouTube Audio</h1>
            <p className="text-xs text-slate-400">Convert authorized YouTube videos to MP3 or uncompressed WAV.</p></div>
        </header>

        <div className="space-y-4 rounded-xl border border-white/10 bg-[#12161c] p-4 sm:p-5">
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>YouTube video or YouTube Music link</span>
            <input value={link} onChange={e => { setLink(e.target.value); setError(''); }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-11 w-full rounded-lg border border-white/15 bg-[#0a0c0f] px-3 text-sm text-white outline-none focus:border-emerald-400" />
          </label>
          {link.trim() && !videoId && <p className="text-xs text-amber-300">Enter a single valid YouTube video link.</p>}
          {videoId && <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
            <iframe title="YouTube video preview" src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              className="aspect-video w-full" allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
          </div>}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs"><span className="text-slate-300">Audio format</span>
              <select value={format} onChange={e => setFormat(e.target.value as OutputFormat)}
                className="h-9 rounded-lg border border-white/20 bg-[#0a0c0f] px-3 text-white">
                <option value="wav">WAV · Uncompressed PCM</option>
                <option value="mp3">MP3 · 320 kbps</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="text-slate-300">Private converter access key (if your server requires one)</span>
            <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}
              placeholder="Access key" className="h-9 w-full rounded-lg border border-white/15 bg-[#0a0c0f] px-3 text-white" />
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-300">
            <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} className="mt-0.5" />
            <span>I own this video or have permission from the rights holder and the platform to download and convert it.</span>
          </label>
          <button type="button" disabled={!videoId || !authorized || busy} onClick={convert}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: accent }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileAudio size={16} />}
            {busy ? 'Converting audio…' : `Convert to ${format.toUpperCase()}`}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Requires a configured Joelizer Node render service with yt-dlp and FFmpeg. Vercel-only deployments cannot run this converter.
            Protected, unavailable, private or restricted videos may fail. WAV does not restore quality missing from the original stream.
          </p>
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
          {result && <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Music2 size={14} /> Audio ready · {result.filename} · {(result.blob.size / (1024 * 1024)).toFixed(1)} MB</p>
            <audio src={result.url} controls className="w-full" />
            <div className="flex flex-wrap gap-2">
              <a href={result.url} download={result.filename} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black"><Download size={14} /> Download {format.toUpperCase()}</a>
              <button type="button" onClick={useAsSource} className="rounded-lg border border-white/20 bg-[#171c23] px-3 py-2 text-xs font-semibold text-white">Use in Joelizer</button>
            </div>
          </div>}
        </div>
        <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ExternalLink size={13} /> Download your own uploaded videos from YouTube Studio
        </a>
      </div>
    </div>
  );
}
