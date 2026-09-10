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
    <div className="flex flex-col h-full bg-[#0e1115] text-[#f0f3f6] p-3.5 gap-3.5 overflow-y-auto">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === cat 
                ? 'bg-[#161b22] text-accent border border-accent/50 shadow-sm' 
                : 'bg-[#12161c] text-[#7e8999] hover:text-[#f0f3f6] border border-[#232933] hover:bg-[#161b22]'
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
                  ? 'bg-[#161b22] border-accent/60 shadow-[0_0_12px_rgba(0,230,118,0.12)] ring-1 ring-accent/30' 
                  : 'bg-[#12161c] border-[#232933] hover:border-[#384252] hover:bg-[#161b22]'
              }`}
            >
              {/* Top Row: Name & Badge */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: tmpl.previewColor }}
                  />
                  <span className="text-xs font-mono font-bold text-[#f0f3f6] uppercase tracking-wider">
                    {tmpl.name}
                  </span>
                </div>

                {tmpl.badge && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#161b22] text-accent border border-accent/30 flex items-center gap-1">
                    <Flame size={10} />
                    {tmpl.badge}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-[#7e8999] leading-snug my-1.5 z-10 font-sans">
                {tmpl.description}
              </p>

              {/* Bottom Tag & Selected Indicator */}
              <div className="flex items-center justify-between z-10 pt-1 border-t border-[#232933]/50">
                <span className="text-[9px] font-mono text-[#7e8999] uppercase tracking-wider">
                  {tmpl.category}
                </span>

                {isSelected ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 bg-accent text-black shadow-sm">
                    <Check size={12} strokeWidth={3} />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#7e8999] group-hover:text-[#f0f3f6] transition-colors">
                    Apply
                  </span>
                )}
              </div>

              {/* Background Accent Glow */}
              <div 
                className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none transition-opacity group-hover:opacity-20"
                style={{ backgroundColor: tmpl.previewColor }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
