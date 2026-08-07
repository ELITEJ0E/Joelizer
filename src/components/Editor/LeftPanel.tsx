import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Layers as LayersIcon, Eye, EyeOff, GripVertical, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TemplatesModal } from './TemplatesModal';

export function LeftPanel({ onLayerSelect }: { onLayerSelect?: () => void }) {
  const layers = useStore(s => s.layers);
  const selectedLayerId = useStore(s => s.selectedLayerId);
  const setSelectedLayerId = useStore(s => s.setSelectedLayerId);
  const updateLayerVisibility = useStore(s => s.updateLayerVisibility);
  const reorderLayers = useStore(s => s.reorderLayers);

  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDrop = (e: React.DragEvent) => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      reorderLayers(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="w-full h-full bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
      
      <div className="h-14 sm:h-16 px-4 sm:px-5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[3px] font-black" style={{ color: activeColor, textShadow: `0 0 10px ${activeColor}40` }}>[ LAYERS ]</span>
          <div className="w-5 h-5 rounded bg-black/40 border flex items-center justify-center" style={{ borderColor: `${activeColor}20`, color: activeColor }}>
            <LayersIcon size={11} />
          </div>
        </div>

        <button 
          onClick={() => setIsTemplatesOpen(true)}
          title="Templates & Presets"
          className="group bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
        >
          <Sparkles size={11} style={{ color: activeColor }} className="opacity-90 group-hover:animate-pulse transition-opacity" />
          <span>Templates</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {layers.map((layer, index) => {
          const isSelected = selectedLayerId === layer.id;
          return (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => {
                setSelectedLayerId(layer.id);
                onLayerSelect?.();
              }}
              className={cn(
                "layer-item-anim flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-glass group border relative overflow-hidden",
                isSelected 
                  ? "bg-white/[0.06] border-white/10 text-white shadow-lg" 
                  : "bg-white/[0.01] border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-white",
                !layer.visible && "opacity-40"
              )}
            >
              {isSelected && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg transition-all duration-300"
                  style={{ 
                    backgroundColor: activeColor,
                    boxShadow: `0 0 10px ${activeColor}80` 
                  }}
                />
              )}
              
              <div className="cursor-grab opacity-30 group-hover:opacity-100 transition-opacity hidden sm:block">
                <GripVertical size={13} />
              </div>
              
              <div 
                className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300")} 
                style={{ 
                  backgroundColor: isSelected ? activeColor : 'rgba(255,255,255,0.2)',
                  boxShadow: isSelected ? `0 0 8px ${activeColor}` : 'none'
                }}
              />
              
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider truncate">{layer.name}</p>
                <p 
                  className="text-[9px] font-mono uppercase tracking-widest mt-0.5 truncate font-semibold"
                  style={{ color: isSelected ? activeColor : 'rgba(255,255,255,0.4)' }}
                >
                  {layer.type}
                </p>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayerVisibility(layer.id, !layer.visible);
                }}
                className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
              >
                {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          );
        })}
      </div>

      <TemplatesModal isOpen={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} />
    </div>
  );
}
