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
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3.5 bg-[#0e1115] text-[#c9d1d9] font-mono select-none">
      <div className="flex flex-col gap-1.5 border-b border-[#232933] pb-3">
        <label className="text-[10px] font-semibold text-[#7e8999] uppercase tracking-wider">Provider</label>
        <div className="flex gap-2">
          {PROVIDERS.map(provider => (
            <button
              key={provider.name}
              onClick={() => {
                setActiveProviderName(provider.name);
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 text-[10px] rounded border font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                activeProviderName === provider.name
                  ? 'bg-[#161b22] text-[#00e676] border-[#232933]'
                  : 'bg-[#0a0c0f] text-[#7e8999] border-[#232933] hover:text-[#f0f3f6]'
              }`}
            >
              {provider.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-b border-[#232933] pb-3">
        <label className="text-[10px] font-semibold text-[#7e8999] uppercase tracking-wider">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic city at night, stage lights, 4k..."
          className="w-full h-20 bg-[#0a0c0f] border border-[#232933] focus:border-[#00e676] rounded p-2 text-xs text-[#f0f3f6] placeholder-[#4d5566] focus:outline-none resize-none font-mono transition-colors"
        />
        <div className="flex justify-between items-center mt-1">
          <button
            onClick={handleCopyPrompt}
            disabled={!prompt.trim()}
            className="flex items-center gap-1 text-[9px] text-[#7e8999] hover:text-[#f0f3f6] font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Copy size={10} /> Copy Prompt
          </button>
          <button
            onClick={handleGenerateFromLyrics}
            className="flex items-center gap-1 text-[9px] text-[#00e676] hover:text-[#00c853] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Wand2 size={10} /> Random from Lyrics
          </button>
        </div>
      </div>

      {!capabilities.externalGenerator && (
        <>
          <div className="flex flex-col gap-1.5 border-b border-[#232933] pb-3">
            <label className="text-[10px] font-semibold text-[#7e8999] uppercase tracking-wider">Negative Prompt</label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="ugly, blurry, bad anatomy..."
              className="w-full bg-[#0a0c0f] border border-[#232933] focus:border-[#00e676] rounded p-2 text-xs text-[#f0f3f6] placeholder-[#4d5566] focus:outline-none font-mono transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-[#232933] pb-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-[#7e8999] uppercase tracking-wider">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['16:9', '9:16', '1:1', '4:5'].map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar as any)}
                    className={`py-1 text-[10px] rounded border font-mono transition-colors cursor-pointer ${
                      aspectRatio === ar 
                        ? 'bg-[#161b22] text-[#00e676] border-[#232933]' 
                        : 'bg-[#0a0c0f] text-[#7e8999] border-[#232933] hover:text-[#f0f3f6]'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-[#7e8999] uppercase tracking-wider">Number of Images</label>
              <div className="flex gap-1.5">
                {[1, 2, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setAmount(n)}
                    className={`flex-1 py-1 text-[10px] rounded border font-mono transition-colors cursor-pointer ${
                      amount === n 
                        ? 'bg-[#161b22] text-[#00e676] border-[#232933]' 
                        : 'bg-[#0a0c0f] text-[#7e8999] border-[#232933] hover:text-[#f0f3f6]'
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
          <div className="bg-[#161b22] border border-[#232933] text-[#c9d1d9] text-[11px] p-3 rounded flex flex-col gap-2 leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#f0f3f6] flex items-center gap-1.5 text-xs">
                <Sparkles size={13} className="text-[#00e676]" />
                Perchance AI Generator Hub
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0a0c0f] text-[#7e8999] font-mono border border-[#232933]">
                External Hub
              </span>
            </div>

            <p className="text-[#7e8999] text-[11px] font-sans">
              Perchance enforces browser cross-origin security headers that prevent embedded iframe rendering. Generate on Perchance and paste the image link below.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-[#232933]">
              <button
                onClick={() => {
                  handleCopyPrompt();
                  window.open('https://perchance.org/image-generator-professional', '_blank', 'width=1000,height=800,scrollbars=yes');
                }}
                className="w-full sm:w-auto flex-1 py-1.5 px-3 rounded bg-[#00e676] hover:bg-[#00c853] text-[#0a0c0f] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy size={12} />
                <ExternalLink size={12} />
                <span>Copy & Launch Perchance</span>
              </button>

              <button
                onClick={() => setActiveProviderName('Pollinations (Headless)')}
                className="w-full sm:w-auto py-1.5 px-3 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-[#f0f3f6] font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Wand2 size={12} className="text-[#00e676]" />
                <span>Use Inline AI Instead</span>
              </button>
            </div>
          </div>

          {/* Quick Import Form for Perchance Output */}
          <div className="bg-[#12161c] border border-[#232933] rounded p-3 flex flex-col gap-2.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#7e8999] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon size={12} className="text-[#00e676]" />
                Import Generated Image
              </span>
              <span className="text-[9px] text-[#7e8999] font-normal">Copy Image URL & Paste Here</span>
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
                className="flex-1 bg-[#0a0c0f] border border-[#232933] focus:border-[#00e676] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] focus:outline-none font-mono placeholder-[#4d5566] transition-colors"
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
                className="px-3 py-1.5 rounded bg-[#00e676] hover:bg-[#00c853] text-[#0a0c0f] font-semibold text-xs shrink-0 cursor-pointer transition-colors"
              >
                Import
              </button>
            </div>

            {/* Live Preview of pasted URL */}
            {prompt.trim() && (prompt.trim().startsWith('http') || prompt.trim().startsWith('data:image')) && (
              <div className="relative w-full h-36 bg-[#0a0c0f] rounded overflow-hidden border border-[#232933] flex items-center justify-center">
                <img 
                  src={prompt.trim()} 
                  alt="Import Preview" 
                  className="w-full h-full object-contain"
                  onError={() => setErrorMsg('Image failed to load. Check that the link points directly to an image file.')}
                />
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-mono bg-red-950/20 p-2 rounded border border-red-900/30">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className="bg-red-950/20 border border-red-900/30 text-red-400 text-[10px] p-2.5 rounded flex items-start gap-2 leading-relaxed font-mono">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-2.5 mt-auto rounded font-semibold tracking-wider uppercase text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-[#00e676] hover:bg-[#00c853] text-[#0a0c0f]"
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
