import React, { useState } from 'react';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { LYRIC_VIDEO_TEMPLATES, LyricTemplateId } from '../../lib/lyricsTemplates';
import { Sparkles, Check, Flame } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function TemplateCarousel() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const selectedTemplateId = useLyricsVideoStore(s => s.selectedTemplateId);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Modern', 'Retro', 'Minimal', 'Cinematic', 'Dynamic'];

  const templatesList = Object.values(LYRIC_VIDEO_TEMPLATES).filter(t => {
    if (activeCategory === 'All') return true;
    return t.category === activeCategory;
  });

  return (
    <div className="flex flex-col h-full bg-[#060608] text-slate-300 p-3 gap-3 overflow-y-auto">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === cat ? 'bg-white text-black font-extrabold shadow-md' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {templatesList.map(tmpl => {
          const isSelected = selectedTemplateId === tmpl.id;

          return (
            <div
              key={tmpl.id}
              onClick={() => setSelectedTemplateId(tmpl.id as LyricTemplateId)}
              className={`group relative rounded-xl p-3 border transition-all cursor-pointer flex flex-col justify-between min-h-[110px] overflow-hidden ${
                isSelected 
                  ? 'bg-white/10 border-white shadow-xl ring-2 ring-white/30' 
                  : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/8'
              }`}
            >
              {/* Top Row: Name & Badge */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: tmpl.previewColor }}
                  />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    {tmpl.name}
                  </span>
                </div>

                {tmpl.badge && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Flame size={10} />
                    {tmpl.badge}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-400 font-medium leading-snug my-1 z-10">
                {tmpl.description}
              </p>

              {/* Bottom Tag & Selected Indicator */}
              <div className="flex items-center justify-between z-10 pt-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {tmpl.category}
                </span>

                {isSelected ? (
                  <span 
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md"
                    style={{ backgroundColor: activeColor, color: '#000000' }}
                  >
                    <Check size={12} strokeWidth={3} />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
                    Apply
                  </span>
                )}
              </div>

              {/* Background Accent Glow */}
              <div 
                className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-30"
                style={{ backgroundColor: tmpl.previewColor }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
