import React, { useState } from 'react';
import { useStore } from '../../../store/useStore';
import { useMVStore } from '../../../store/useMVStore';
import { pollinationsProvider } from '../../../lib/providers/PollinationsImageProvider';
import { perchanceProvider } from '../../../lib/providers/PerchanceImageProvider';
import { Sparkles, AlertTriangle, Image as ImageIcon, Loader2, Wand2, Copy, ExternalLink } from 'lucide-react';
import { GenerateImageParams, ImageGenerationProvider } from '../../../lib/providers/ImageGenerationProvider';

const PROVIDERS: ImageGenerationProvider[] = [
  pollinationsProvider,
  perchanceProvider
];

export function ImageGeneratorPanel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const lyrics = useStore(s => s.lyricsSettings.lines);

  const [activeProviderName, setActiveProviderName] = useState<string>(PROVIDERS[0].name);
  const activeProvider = PROVIDERS.find(p => p.name === activeProviderName) || PROVIDERS[0];

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<GenerateImageParams['aspectRatio']>('16:9');
  const [amount, setAmount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const capabilities = activeProvider.getCapabilities();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (capabilities.externalGenerator) {
      // Should not be called directly, handled by specific UI
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const generated = await activeProvider.generateImages({
        prompt,
        negativePrompt,
        aspectRatio,
        amount
      });

      generated.forEach(img => {
        addVideoAsset({
          id: img.id,
          file: undefined as any,
          url: img.url,
          name: `Generated - ${prompt.substring(0, 20)}...`,
          type: 'image',
          duration: 8,
          thumbnail: img.url,
          isStock: true,
          sourceType: 'generated',
          status: 'ready'
        });
      });
      
      setPrompt('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromLyrics = () => {
    if (!lyrics || lyrics.length === 0) {
      setErrorMsg('No lyrics found. Please add lyrics in the Lyrics tab first.');
      return;
    }
    
    const randomLine = lyrics[Math.floor(Math.random() * lyrics.length)].text;
    const visualPrompt = `cinematic, ${randomLine}, glowing neon lights, dreamy atmosphere, youthful, music-video aesthetic`;
    setPrompt(visualPrompt);
  };

  const handleCopyPrompt = () => {
    if (prompt.trim()) {
      navigator.clipboard.writeText(prompt);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider</label>
        <div className="flex gap-2">
          {PROVIDERS.map(provider => (
            <button
              key={provider.name}
              onClick={() => {
                setActiveProviderName(provider.name);
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 text-[10px] rounded border font-mono font-bold uppercase tracking-wider transition-colors ${
                activeProviderName === provider.name
                  ? 'bg-white/10 text-white border-white/30'
                  : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'
              }`}
            >
              {provider.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic cyberpunk city at night, neon lights, 4k..."
          className="w-full h-20 bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
        />
        <div className="flex justify-between items-center mt-1">
          <button
            onClick={handleCopyPrompt}
            disabled={!prompt.trim()}
            className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <Copy size={10} /> Copy Prompt
          </button>
          <button
            onClick={handleGenerateFromLyrics}
            className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider transition-colors"
          >
            <Wand2 size={10} /> Random from Lyrics
          </button>
        </div>
      </div>

      {!capabilities.externalGenerator && (
        <>
          <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Negative Prompt</label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="ugly, blurry, bad anatomy..."
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['16:9', '9:16', '1:1', '4:5'].map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar as any)}
                    className={`py-1 text-[10px] rounded border font-mono ${
                      aspectRatio === ar ? 'bg-white/10 text-white border-white/20' : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Number of Images</label>
              <div className="flex gap-1.5">
                {[1, 2, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setAmount(n)}
                    className={`flex-1 py-1 text-[10px] rounded border font-mono ${
                      amount === n ? 'bg-white/10 text-white border-white/20' : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {capabilities.externalGenerator ? (
        <div className="flex flex-col gap-3 mt-1">
          <div className="bg-purple-950/40 border border-purple-500/30 text-purple-200 text-[11px] p-3.5 rounded-xl flex flex-col gap-2.5 leading-relaxed shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-white flex items-center gap-1.5 text-xs">
                <Sparkles size={14} className="text-purple-400" />
                Perchance AI Generator Suite
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 font-mono border border-purple-500/30 font-bold">
                External Hub
              </span>
            </div>

            <p className="text-slate-300 text-[11px]">
              Perchance enforces browser cross-origin security headers (<code className="text-purple-300 font-mono text-[10px]">X-Frame-Options: SAMEORIGIN</code>) that prevent embedded inline rendering. Use the quick launch workflow below to generate on Perchance and import back into Joelizer!
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-purple-500/20">
              <button
                onClick={() => {
                  handleCopyPrompt();
                  window.open('https://perchance.org/image-generator-professional', '_blank', 'width=1000,height=800,scrollbars=yes');
                }}
                className="w-full sm:w-auto flex-1 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Copy size={12} />
                <ExternalLink size={12} />
                <span>Copy Prompt & Launch Perchance</span>
              </button>

              <button
                onClick={() => setActiveProviderName('Pollinations (Headless)')}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Wand2 size={12} className="text-emerald-400" />
                <span>Use Inline AI Instead</span>
              </button>
            </div>
          </div>

          {/* Quick Import Form for Perchance Output */}
          <div className="bg-black/60 border border-white/15 rounded-xl p-3.5 flex flex-col gap-3 shadow-xl">
            <label className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon size={13} />
                Import Generated Image
              </span>
              <span className="text-[9px] text-slate-400 font-normal">Copy Image Address & Paste Here</span>
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://... or data:image/..."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setErrorMsg(null);
                }}
                className="flex-1 bg-black/80 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono placeholder-slate-600"
              />
              <button
                onClick={() => {
                  const val = prompt.trim();
                  if (val.startsWith('http') || val.startsWith('data:image')) {
                    addVideoAsset({
                      id: `perchance-${Date.now()}`,
                      url: val,
                      name: `Perchance AI - ${Date.now().toString().slice(-4)}`,
                      type: 'image',
                      duration: 8,
                      thumbnail: val,
                      isStock: true,
                      sourceType: 'generated',
                      status: 'ready'
                    });
                    setPrompt('');
                    setErrorMsg(null);
                  } else {
                    setErrorMsg('Please paste a valid image URL starting with http:// or https://');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
              >
                Import
              </button>
            </div>

            {/* Live Preview of pasted URL */}
            {prompt.trim() && (prompt.trim().startsWith('http') || prompt.trim().startsWith('data:image')) && (
              <div className="relative w-full h-36 bg-black/80 rounded-lg overflow-hidden border border-white/20 flex items-center justify-center">
                <img 
                  src={prompt.trim()} 
                  alt="Import Preview" 
                  className="w-full h-full object-contain"
                  onError={() => setErrorMsg('Image failed to load. Check that the link points directly to an image file.')}
                />
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-mono bg-red-500/10 p-2 rounded border border-red-500/20">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] p-2.5 rounded-lg flex items-start gap-2 leading-relaxed font-mono">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-2.5 mt-auto rounded-lg font-black tracking-wider uppercase text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            style={{ 
              backgroundColor: activeColor, 
              color: '#000',
              boxShadow: isGenerating ? 'none' : `0 0 15px ${activeColor}40`
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Images
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
