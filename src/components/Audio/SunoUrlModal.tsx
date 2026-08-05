import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Link2, Sparkles, Music, Check, Loader2, FileText, Image as ImageIcon } from 'lucide-react';

interface SunoUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLyricsExtracted?: (lyrics: string) => void;
}

export function SunoUrlModal({ isOpen, onClose, onLyricsExtracted }: SunoUrlModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [songInfo, setSongInfo] = useState<{
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    imageUrl: string | null;
    lyrics: string;
    tags: string;
    source: string;
  } | null>(null);

  const setAudio = useStore(s => s.setAudio);
  const setName = useStore(s => s.setName);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  if (!isOpen) return null;

  const EXAMPLE_SUNO_URL = 'https://suno.com/song/7ee8da7e-0310-4dec-ab00-f8d45f1b2156';

  const handleFetch = async (targetUrl?: string) => {
    const inputUrl = targetUrl || url;
    if (!inputUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setSongInfo(null);

    try {
      const res = await fetch('/api/suno-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch song from URL');
      }

      setSongInfo(data);
    } catch (err: any) {
      console.error('Suno fetch error:', err);
      setError(err.message || 'Could not load song from provided URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!songInfo) return;

    // Create synthetic file blob for store compatibility
    const dummyBlob = new Blob([], { type: 'audio/mp3' });
    
    // Probe audio duration
    const tempAudio = new Audio(songInfo.audioUrl);
    tempAudio.onloadedmetadata = () => {
      const duration = tempAudio.duration || 180;
      setAudio(dummyBlob, songInfo.audioUrl, duration, songInfo.imageUrl);
      if (songInfo.title) {
        setName(songInfo.title);
      }
      if (songInfo.lyrics && onLyricsExtracted) {
        onLyricsExtracted(songInfo.lyrics);
      }
      onClose();
    };

    tempAudio.onerror = () => {
      // Fallback if CORS or metadata probe fails initially
      setAudio(dummyBlob, songInfo.audioUrl, 180, songInfo.imageUrl);
      if (songInfo.title) {
        setName(songInfo.title);
      }
      if (songInfo.lyrics && onLyricsExtracted) {
        onLyricsExtracted(songInfo.lyrics);
      }
      onClose();
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0d0f12] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: `0 0 50px ${activeColor}15, 0 20px 40px rgba(0,0,0,0.8)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center border bg-black/50"
              style={{ borderColor: `${activeColor}50`, color: activeColor }}
            >
              <Link2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Load Suno or Audio URL</h3>
              <p className="text-[10px] text-slate-400 font-mono">Import Suno songs, artwork, and lyrics via URL</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Input Box */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 block">
              Paste Suno Song URL or MP3 Link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFetch();
                  }}
                  placeholder="https://suno.com/song/7ee8da7e-0310-4dec-ab00-f8d45f1b2156"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/40 transition-colors font-mono"
                />
                {url && (
                  <button 
                    onClick={() => { setUrl(''); setSongInfo(null); setError(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={() => handleFetch()}
                disabled={isLoading || !url.trim()}
                className="px-4 py-2.5 text-black font-black uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 active:scale-95 shadow-md"
                style={{ backgroundColor: activeColor }}
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Fetch</span>
              </button>
            </div>
          </div>

          {/* Preset / Example Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">Try Example:</span>
            <button
              onClick={() => {
                setUrl(EXAMPLE_SUNO_URL);
                handleFetch(EXAMPLE_SUNO_URL);
              }}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            >
              <Music size={11} style={{ color: activeColor }} />
              <span>Neon Skies (Suno V4)</span>
            </button>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Fetched Song Card Preview */}
          {songInfo && (
            <div className="bg-white/[0.03] border border-white/15 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3.5">
                {songInfo.imageUrl ? (
                  <img 
                    src={songInfo.imageUrl} 
                    alt={songInfo.title}
                    className="w-16 h-16 rounded-lg object-cover border border-white/10 shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                    <Music size={24} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider bg-white/10 text-white"
                      style={songInfo.source === 'suno' ? { backgroundColor: `${activeColor}30`, color: activeColor } : {}}
                    >
                      {songInfo.source === 'suno' ? 'Suno AI Song' : 'Direct Audio'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white truncate mt-1">{songInfo.title}</h4>
                  {songInfo.artist && (
                    <p className="text-xs text-slate-400 font-mono">{songInfo.artist}</p>
                  )}
                  {songInfo.tags && (
                    <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{songInfo.tags}</p>
                  )}
                </div>
              </div>

              {/* Lyrics Preview if detected */}
              {songInfo.lyrics && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-slate-400">
                    <FileText size={12} style={{ color: activeColor }} />
                    <span>Auto-Extracted Suno Lyrics Detected ({songInfo.lyrics.split('\n').length} lines)</span>
                  </div>
                  <pre className="text-[10px] text-slate-300 font-mono line-clamp-3 whitespace-pre-wrap leading-relaxed opacity-80">
                    {songInfo.lyrics}
                  </pre>
                </div>
              )}

              {/* Confirm / Apply Button */}
              <button
                onClick={handleApply}
                className="w-full py-3 text-black font-black uppercase text-xs tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer hover:scale-[1.01] active:scale-95"
                style={{ backgroundColor: activeColor }}
              >
                <Check size={16} strokeWidth={3} />
                <span>Load Song into Studio & Player</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
