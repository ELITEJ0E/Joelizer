import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Upload, Link2, Sparkles, Music, Check, Loader2, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AudioSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLyricsExtracted?: (lyrics: string) => void;
}

export function AudioSourceModal({ isOpen, onClose, onLyricsExtracted }: AudioSourceModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('url');
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
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  if (!isOpen) return null;

  const EXAMPLE_URL = 'https://suno.com/song/7ee8da7e-0310-4dec-ab00-f8d45f1b2156';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);
    
    tempAudio.onloadedmetadata = () => {
      setAudio(file, objectUrl, tempAudio.duration || 180, null);
      setName(file.name.replace(/\.[^/.]+$/, ''));
      setIsPlaying(true);
      onClose();
    };

    tempAudio.onerror = () => {
      setAudio(file, objectUrl, 180, null);
      setName(file.name.replace(/\.[^/.]+$/, ''));
      setIsPlaying(true);
      onClose();
    };
  };

  const handleFetchUrl = async (targetUrl?: string) => {
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
        throw new Error(data.error || 'Unable to fetch track');
      }

      setSongInfo(data);
    } catch (err: any) {
      console.error('URL fetch error:', err);
      setError(err.message || 'Unable to load audio from link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyUrlSong = async () => {
    if (!songInfo) return;
    setIsLoading(true);

    try {
      let audioBlob: Blob;
      try {
        const audioRes = await fetch(songInfo.audioUrl);
        audioBlob = audioRes.ok ? await audioRes.blob() : new Blob([], { type: 'audio/mp3' });
      } catch (e) {
        audioBlob = new Blob([], { type: 'audio/mp3' });
      }

      const fileObj = new File([audioBlob], `${songInfo.title || 'Track'}.mp3`, { type: 'audio/mp3' });
      const tempAudio = new Audio(songInfo.audioUrl);
      tempAudio.crossOrigin = 'anonymous';

      const applyAndPlay = (duration: number) => {
        setAudio(fileObj, songInfo.audioUrl, duration, songInfo.imageUrl);
        if (songInfo.title) setName(songInfo.title);
        if (songInfo.lyrics && onLyricsExtracted) onLyricsExtracted(songInfo.lyrics);
        setIsPlaying(true);
        setIsLoading(false);
        onClose();
      };

      tempAudio.onloadedmetadata = () => applyAndPlay(tempAudio.duration || 180);
      tempAudio.onerror = () => applyAndPlay(180);
    } catch (err) {
      console.warn('Error preparing track:', err);
      setAudio(new Blob([], { type: 'audio/mp3' }), songInfo.audioUrl, 180, songInfo.imageUrl);
      if (songInfo.title) setName(songInfo.title);
      if (songInfo.lyrics && onLyricsExtracted) onLyricsExtracted(songInfo.lyrics);
      setIsPlaying(true);
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-md bg-[#0d0f12] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        style={{ boxShadow: `0 0 40px ${activeColor}20, 0 16px 32px rgba(0,0,0,0.8)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-7 h-7 rounded-md flex items-center justify-center border bg-black/50 shrink-0"
              style={{ borderColor: `${activeColor}50`, color: activeColor }}
            >
              <Music size={14} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white truncate">Load Audio</h3>
              <p className="text-[10px] text-slate-400 font-mono truncate">Paste a URL or upload a file</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/40 shrink-0 text-xs">
          <button
            onClick={() => { setActiveTab('url'); setError(null); }}
            className={cn(
              "flex-1 py-2.5 font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer",
              activeTab === 'url' ? "text-white border-b-2 bg-white/[0.04]" : "text-slate-400 hover:text-white border-transparent"
            )}
            style={activeTab === 'url' ? { borderColor: activeColor, color: activeColor } : {}}
          >
            <Link2 size={13} />
            <span>Track Link</span>
          </button>

          <button
            onClick={() => { setActiveTab('upload'); setError(null); }}
            className={cn(
              "flex-1 py-2.5 font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer",
              activeTab === 'upload' ? "text-white border-b-2 bg-white/[0.04]" : "text-slate-400 hover:text-white border-transparent"
            )}
            style={activeTab === 'upload' ? { borderColor: activeColor, color: activeColor } : {}}
          >
            <Upload size={13} />
            <span>Upload File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto custom-scrollbar">
          {activeTab === 'url' ? (
            <div className="space-y-3">
              {/* URL Input Box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-300 block">
                  Track URL
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl(); }}
                      placeholder="Paste track link or MP3 URL..."
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/40 font-mono truncate"
                    />
                    {url && (
                      <button 
                        onClick={() => { setUrl(''); setSongInfo(null); setError(null); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleFetchUrl()}
                    disabled={isLoading || !url.trim()}
                    className="px-3.5 py-2 text-black font-bold uppercase text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0 active:scale-95"
                    style={{ backgroundColor: activeColor }}
                  >
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Load</span>
                  </button>
                </div>
              </div>

              {/* Sample Button */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase text-slate-500">Sample:</span>
                <button
                  onClick={() => {
                    setUrl(EXAMPLE_URL);
                    handleFetchUrl(EXAMPLE_URL);
                  }}
                  className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer truncate"
                >
                  <Music size={10} style={{ color: activeColor }} />
                  <span className="truncate">Neon Skies</span>
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Song Card */}
              {songInfo && (
                <div className="bg-white/[0.03] border border-white/15 rounded-lg p-3 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-3 min-w-0">
                    {songInfo.imageUrl ? (
                      <img 
                        src={songInfo.imageUrl} 
                        alt={songInfo.title}
                        className="w-12 h-12 rounded-md object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                        <Music size={20} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{songInfo.title}</h4>
                      {songInfo.artist && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">{songInfo.artist}</p>
                      )}
                      {songInfo.lyrics && (
                        <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 mt-0.5">
                          <FileText size={10} />
                          <span>Lyrics included</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleApplyUrlSong}
                    disabled={isLoading}
                    className="w-full py-2.5 text-black font-bold uppercase text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: activeColor }}
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
                    <span>Load & Play</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Upload File Tab */
            <div className="py-2">
              <label className="border-2 border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                <div 
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform"
                  style={{ color: activeColor }}
                >
                  <Upload size={18} />
                </div>
                <div className="text-center space-y-0.5">
                  <span className="text-xs font-bold text-white block">Drop audio file or click to browse</span>
                  <span className="text-[10px] text-slate-400 font-mono block">MP3, WAV, FLAC, M4A, AAC, OGG</span>
                </div>
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
