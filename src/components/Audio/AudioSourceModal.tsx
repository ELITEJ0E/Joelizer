import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import { usePopstateModal } from '../../hooks/usePopstateModal';
import { X, Upload, Link2, Sparkles, Music, Check, Loader2, FileText, Disc3, Tag, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { audioManager } from '../../lib/audio';

interface AudioSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLyricsExtracted?: (lyrics: string) => void;
  onAutoTranscribe?: () => void;
}

// Client-side direct audio probe fallback for static hosting / Vercel
function probeDirectAudioUrl(inputUrl: string): Promise<{
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  proxiedAudioUrl?: string;
  imageUrl: string | null;
  lyrics: string;
  tags: string;
  duration?: number;
  source: string;
} | null> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const timer = setTimeout(() => {
        audio.src = '';
        resolve(null);
      }, 3500);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const urlParts = inputUrl.split('/');
        const rawFileName = urlParts[urlParts.length - 1].split('?')[0] || 'Audio Track';
        const cleanName = decodeURIComponent(rawFileName).replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
        resolve({
          id: `url-${Date.now()}`,
          title: cleanName || 'Audio Stream',
          artist: 'Web Audio',
          audioUrl: inputUrl,
          proxiedAudioUrl: inputUrl,
          imageUrl: null,
          lyrics: '',
          tags: 'Direct Audio Stream',
          duration: audio.duration && !isNaN(audio.duration) && audio.duration > 0 ? audio.duration : 180,
          source: 'direct'
        });
      };

      audio.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      audio.preload = 'metadata';
      audio.src = inputUrl;
    } catch {
      resolve(null);
    }
  });
}

export function AudioSourceModal({ isOpen, onClose, onLyricsExtracted, onAutoTranscribe }: AudioSourceModalProps) {
  const { handleClose } = usePopstateModal(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [songInfo, setSongInfo] = useState<{
    id: string;
    title: string;
    artist: string;
    audioUrl: string;
    proxiedAudioUrl?: string;
    imageUrl: string | null;
    lyrics: string;
    tags: string;
    duration?: number;
    source: string;
  } | null>(null);

  const setAudio = useStore(s => s.setAudio);
  const setName = useStore(s => s.setName);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  if (!isOpen) return null;

  const SAMPLE_TRACKS = [
    {
      name: 'Neon Skies',
      genre: 'Synthwave / Pop',
      url: 'https://suno.com/song/7ee8da7e-0310-4dec-ab00-f8d45f1b2156'
    },
    {
      name: 'Midnight Echoes',
      genre: 'Lo-Fi Chill',
      url: 'https://suno.com/song/b4e6d24f-96a9-4b67-9c98-1e0f06f7df20'
    },
    {
      name: 'Cyber Horizon',
      genre: 'Cyberpunk EDM',
      url: 'https://suno.com/song/f3c83407-7d9a-4712-8e10-6cbb607673c2'
    }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(objectUrl);
    
    tempAudio.onloadedmetadata = () => {
      audioManager.resume().catch(() => {});
      setAudio(file, objectUrl, tempAudio.duration || 180, null, {
        name: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Uploaded Audio'
      });
      setName(file.name.replace(/\.[^/.]+$/, ''));
      setIsPlaying(true);
      handleClose();
    };

    tempAudio.onerror = () => {
      audioManager.resume().catch(() => {});
      setAudio(file, objectUrl, 180, null, {
        name: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Uploaded Audio'
      });
      setName(file.name.replace(/\.[^/.]+$/, ''));
      setIsPlaying(true);
      handleClose();
    };
  };

  const handleFetchUrl = async (targetUrl?: string) => {
    const inputUrl = targetUrl || url;
    if (!inputUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setSongInfo(null);

    try {
      let data: any = null;
      let serverError = '';

      try {
        const res = await fetch('/api/suno-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputUrl.trim() })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => null);
        } else if (!res.ok) {
          const rawText = await res.text().catch(() => '');
          serverError = rawText.slice(0, 100);
        }

        if (res.ok && data && !data.error && data.audioUrl) {
          setSongInfo({
            ...data,
            artist: (data.artist && data.artist !== 'Suno AI') ? data.artist : 'Online Artist',
            source: 'online'
          });
          return;
        }
      } catch (fetchErr: any) {
        console.warn('API route fetch error, trying client-side audio probe:', fetchErr);
      }

      // Fallback: If server route failed (e.g. on Vercel deployment or network issue),
      // probe direct audio in browser
      const directProbe = await probeDirectAudioUrl(inputUrl.trim());
      if (directProbe) {
        setSongInfo(directProbe);
        return;
      }

      const message = data?.error || (serverError ? `Server response: ${serverError}` : null) || 'Unable to load audio from link. Make sure the URL is accessible.';
      throw new Error(message);
    } catch (err: any) {
      console.error('URL fetch error:', err);
      setError(err.message || 'Unable to load audio from link. Please ensure the URL is accessible.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyUrlSong = async (autoTranscribe = false) => {
    if (!songInfo) return;

    try {
      audioManager.resume().catch(() => {});
    } catch (e) {}

    setIsApplying(true);
    setError(null);

    try {
      let audioBlob: Blob | null = null;
      
      // Fetch audio via proxied media or direct URL
      const fetchTarget = songInfo.proxiedAudioUrl || songInfo.audioUrl;
      try {
        const audioRes = await fetch(fetchTarget);
        if (audioRes.ok) {
          const resBlob = await audioRes.blob();
          if (resBlob && resBlob.size >= 64) {
            audioBlob = resBlob;
          }
        }
      } catch (e) {
        console.warn('Audio fetch direct fallback:', e);
      }

      const blobUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
      const audioStreamUrl = blobUrl || songInfo.proxiedAudioUrl || songInfo.audioUrl;
      const fileObj = audioBlob
        ? new File([audioBlob], `${songInfo.title || 'Audio Track'}.m4a`, { type: audioBlob.type || 'audio/mp4' })
        : null;

      let finalized = false;
      const applyAndFinalize = (duration: number) => {
        if (finalized) return;
        finalized = true;

        const finalDuration = duration && !isNaN(duration) && duration > 0 
          ? duration 
          : (songInfo.duration && songInfo.duration > 0 ? songInfo.duration : 180);

        audioManager.resume().catch(() => {});
        setAudio(fileObj as any, audioStreamUrl, finalDuration, songInfo.imageUrl, {
          name: songInfo.title || 'Audio Track',
          artist: songInfo.artist || 'Online Artist',
          lyrics: songInfo.lyrics,
          tags: songInfo.tags,
          sunoId: songInfo.id
        });
        if (songInfo.title) setName(songInfo.title);
        if (songInfo.lyrics && onLyricsExtracted) {
          onLyricsExtracted(songInfo.lyrics);
        }
        setIsPlaying(true);
        setIsApplying(false);
        handleClose();

        if (autoTranscribe && onAutoTranscribe) {
          setTimeout(() => {
            onAutoTranscribe();
          }, 300);
        }
      };

      const fallbackDuration = songInfo.duration && songInfo.duration > 0 ? songInfo.duration : 180;
      const tempAudio = new Audio(audioStreamUrl);
      if (!audioStreamUrl.startsWith('blob:')) {
        tempAudio.crossOrigin = 'anonymous';
      }

      tempAudio.onloadedmetadata = () => applyAndFinalize(tempAudio.duration || fallbackDuration);
      tempAudio.onerror = () => applyAndFinalize(fallbackDuration);

      // Safety timeout: finalize with known duration if network metadata hangs
      setTimeout(() => {
        applyAndFinalize(fallbackDuration);
      }, 1500);
    } catch (err: any) {
      console.warn('Error applying track:', err);
      const audioStreamUrl = songInfo.proxiedAudioUrl || songInfo.audioUrl;
      const fallbackDuration = songInfo.duration && songInfo.duration > 0 ? songInfo.duration : 180;
      audioManager.resume().catch(() => {});
      setAudio(null as any, audioStreamUrl, fallbackDuration, songInfo.imageUrl, {
        name: songInfo.title || 'Audio Track',
        artist: songInfo.artist || 'Online Artist',
        lyrics: songInfo.lyrics,
        tags: songInfo.tags,
        sunoId: songInfo.id
      });
      if (songInfo.title) setName(songInfo.title);
      if (songInfo.lyrics && onLyricsExtracted) onLyricsExtracted(songInfo.lyrics);
      setIsPlaying(true);
      setIsApplying(false);
      handleClose();
      
      if (autoTranscribe && onAutoTranscribe) {
        setTimeout(() => {
          onAutoTranscribe();
        }, 300);
      }
    }
  };

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div 
        className="relative w-full max-w-lg bg-[#0d0f12] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        style={{ boxShadow: `0 0 40px ${activeColor}20, 0 16px 32px rgba(0,0,0,0.8)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center border bg-black/50 shrink-0"
              style={{ borderColor: `${activeColor}50`, color: activeColor }}
            >
              <Disc3 size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white truncate">Import Audio</h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">Import audio from URL or local file for lyric transcription</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-white/10 bg-black/40">
          <button
            onClick={() => setActiveTab('url')}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'url'
                ? "text-white border-emerald-400 bg-white/[0.04]"
                : "text-slate-400 border-transparent hover:text-slate-200"
            )}
            style={{ borderBottomColor: activeTab === 'url' ? activeColor : 'transparent' }}
          >
            <Link2 size={13} style={{ color: activeColor }} />
            <span>URL Import</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'upload'
                ? "text-white border-emerald-400 bg-white/[0.04]"
                : "text-slate-400 border-transparent hover:text-slate-200"
            )}
            style={{ borderBottomColor: activeTab === 'upload' ? activeColor : 'transparent' }}
          >
            <Upload size={13} />
            <span>Local Audio File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {activeTab === 'url' && (
            <div className="space-y-4">
              {/* URL Input Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-300 flex items-center justify-between">
                  <span>Audio Stream or Song URL</span>
                  <span className="text-[9px] text-slate-500 lowercase font-normal">e.g. direct audio URL or web song link</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl(); }}
                      placeholder="Paste audio link or song URL (https://...)"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/80 font-mono truncate transition-colors"
                    />
                    {url && (
                      <button 
                        onClick={() => { setUrl(''); setSongInfo(null); setError(null); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleFetchUrl()}
                    disabled={isLoading || !url.trim()}
                    className="px-4 py-2.5 text-black font-bold uppercase text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 active:scale-95 shadow-md"
                    style={{ backgroundColor: activeColor }}
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Fetch</span>
                  </button>
                </div>
              </div>

              {/* Sample Songs */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Quick Sample Audio Links:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SAMPLE_TRACKS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setUrl(sample.url);
                        handleFetchUrl(sample.url);
                      }}
                      className="p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl text-left transition-all cursor-pointer group flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Music size={11} className="shrink-0 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-white truncate">{sample.name}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono truncate">{sample.genre}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Song Preview Card */}
              {songInfo && (
                <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/20 rounded-xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {songInfo.imageUrl ? (
                      <img 
                        src={songInfo.imageUrl} 
                        alt={songInfo.title}
                        className="w-16 h-16 rounded-xl object-cover border border-white/20 shrink-0 shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-slate-500 shrink-0">
                        <Disc3 size={24} style={{ color: activeColor }} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{songInfo.title}</h4>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                          Online Audio
                        </span>
                      </div>
                      
                      {songInfo.artist && (
                        <p className="text-[11px] text-slate-400 font-mono truncate">By {songInfo.artist}</p>
                      )}

                      {songInfo.tags && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-300 truncate">
                          <Tag size={10} className="text-slate-500 shrink-0" />
                          <span className="truncate">{songInfo.tags}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lyrics Extraction status */}
                  {songInfo.lyrics ? (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-mono text-emerald-300">
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} className="text-emerald-400" />
                        <span>Lyrics text extracted from audio source</span>
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                        Ready
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <Bot size={13} className="text-slate-400" />
                      <span>Lyrics will be transcribed automatically with Gemini AI audio analysis.</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleApplyUrlSong(true)}
                      disabled={isApplying}
                      className="py-3 px-4 text-black font-bold uppercase text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-lg"
                      style={{ backgroundColor: activeColor }}
                    >
                      {isApplying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      <span>⚡ Import & Auto-Transcribe</span>
                    </button>

                    <button
                      onClick={() => handleApplyUrlSong(false)}
                      disabled={isApplying}
                      className="py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold uppercase text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isApplying ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      <span>Load into Studio</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-emerald-400/60 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group"
              >
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border bg-black/60 group-hover:scale-110 transition-all shadow-lg"
                  style={{ borderColor: `${activeColor}40`, color: activeColor }}
                >
                  <Upload size={24} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">Choose Audio File</p>
                  <p className="text-xs text-slate-400 font-mono">Supports MP3, WAV, M4A, FLAC, AAC, OGG</p>
                </div>
                <button 
                  type="button"
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-black transition-all"
                  style={{ backgroundColor: activeColor }}
                >
                  Browse Files
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
