import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Layers as LayersIcon, Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LeftPanel({ onLayerSelect }: { onLayerSelect?: () => void }) {
  const layers = useStore(s => s.layers);
  const selectedLayerId = useStore(s => s.selectedLayerId);
  const setSelectedLayerId = useStore(s => s.setSelectedLayerId);
  const updateLayerVisibility = useStore(s => s.updateLayerVisibility);
  const reorderLayers = useStore(s => s.reorderLayers);

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
    <div className="w-full h-full bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col relative overflow-hidden">
      
      <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[2px] font-bold text-white font-display">Project Layers</span>
        <div className="w-6 h-6 rounded bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400">
          <LayersIcon size={12} />
        </div>
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
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-glass group border relative overflow-hidden",
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
    </div>
  );
}
