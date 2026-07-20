import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Layers as LayersIcon, Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LeftPanel() {
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

  return (
    <div className="w-full h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[2px] font-bold text-slate-500">Layers</span>
        <button className="text-[#00e676] hover:text-white">
          <LayersIcon size={14} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragEnd={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => setSelectedLayerId(layer.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group border",
              selectedLayerId === layer.id 
                ? "bg-[#00e676]/10 border-[#00e676]/20 text-white" 
                : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white",
              !layer.visible && "opacity-40"
            )}
          >
            <div className="cursor-grab opacity-50 group-hover:opacity-100 hidden sm:block">
              <GripVertical size={14} />
            </div>
            <div className={cn("w-2 h-2 rounded-full", selectedLayerId === layer.id ? "bg-[#00e676]" : "bg-white/20")} />
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{layer.name}</p>
              <p className={cn("text-[10px] font-mono uppercase truncate", selectedLayerId === layer.id ? "text-[#00e676]" : "opacity-50")}>
                TYPE: {layer.type}
              </p>
            </div>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                updateLayerVisibility(layer.id, !layer.visible);
              }}
              className="text-slate-500 hover:text-white"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
