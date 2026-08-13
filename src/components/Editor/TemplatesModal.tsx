import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLyricsVideoStore } from '../../store/useLyricsVideoStore';
import { LYRIC_VIDEO_TEMPLATES, LyricTemplateId } from '../../lib/lyricsTemplates';
import { useStore } from '../../store/useStore';
import { X, Check, Flame, Sparkles } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatesModal({ isOpen, onClose }: TemplatesModalProps) {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const selectedTemplateId = useLyricsVideoStore(s => s.selectedTemplateId);
  const setSelectedTemplateId = useLyricsVideoStore(s => s.setSelectedTemplateId);

  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Modern', 'Retro', 'Minimal', 'Cinematic', 'Dynamic'];

  const templatesList = Object.values(LYRIC_VIDEO_TEMPLATES).filter(t => {
    if (activeCategory === 'All') return true;
    return t.category === activeCategory;
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: activeColor }} />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Select Layout Template</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-6 py-3 bg-black/40 border-b border-white/10 overflow-x-auto no-scrollbar shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat 
                  ? 'bg-white text-black font-extrabold shadow-md' 
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templatesList.map(tmpl => {
            const isSelected = selectedTemplateId === tmpl.id;

            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  setSelectedTemplateId(tmpl.id as LyricTemplateId);
                  onClose();
                }}
                className={`group relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between min-h-[120px] overflow-hidden ${
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
                <p className="text-[11px] text-slate-400 font-medium leading-snug my-2 z-10">
                  {tmpl.description || `Beautiful ${tmpl.category.toLowerCase()} template layout for responsive lyrics videos.`}
                </p>

                {/* Bottom Row */}
                <div className="flex items-center justify-between z-10 pt-2 border-t border-white/5">
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
                      Apply Template
                    </span>
                  )}
                </div>

                {/* Background Accent Glow */}
                <div 
                  className="absolute -right-12 -bottom-12 w-24 h-24 rounded-full filter blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity"
                  style={{ backgroundColor: tmpl.previewColor }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
