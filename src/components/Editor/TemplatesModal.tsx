import React, { useEffect } from 'react';
import { useStore, VisualizerSettings, BackgroundSettings } from '../../store/useStore';
import { X, Sparkles, Disc, Flame, Sunset, Zap, CircleDot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  visualizer: {
    style: VisualizerSettings['style'];
    color: string;
  };
  background: {
    type: BackgroundSettings['type'];
    value: string;
  };
  accentGradient: string;
}

const PRESETS: Preset[] = [
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    description: 'Electric cyber-orb pulsing to raw synthetic bass',
    icon: CircleDot,
    visualizer: {
      style: 'orb',
      color: '#00e676',
    },
    background: {
      type: 'gradient',
      value: '#020d08, #000000',
    },
    accentGradient: 'from-[#00e676] to-[#00b4d8]',
  },
  {
    id: 'retro-wave',
    name: 'Retro Wave',
    description: 'Vibrant neon pink bars over an immersive dusk gradient',
    icon: Flame,
    visualizer: {
      style: 'bars',
      color: '#ff007f',
    },
    background: {
      type: 'gradient',
      value: '#15021c, #030008',
    },
    accentGradient: 'from-[#ff007f] to-[#7b2cbf]',
  },
  {
    id: 'cosmic-flow',
    name: 'Cosmic Flow',
    description: 'Symphony of cyan solar particles drifting in deep space',
    icon: Sparkles,
    visualizer: {
      style: 'particles',
      color: '#00e5ff',
    },
    background: {
      type: 'gradient',
      value: '#010d1f, #000108',
    },
    accentGradient: 'from-[#00e5ff] to-[#3a86ff]',
  },
  {
    id: 'hypnotic-mirror',
    name: 'Zen Kaleidoscope',
    description: 'Hypnotic geometric mirror-mesh radiating golden warmth',
    icon: Zap,
    visualizer: {
      style: 'kaleidoscope',
      color: '#ff9e00',
    },
    background: {
      type: 'gradient',
      value: '#140c00, #000000',
    },
    accentGradient: 'from-[#ff9e00] to-[#ff0055]',
  },
  {
    id: 'vapor-dream',
    name: 'Vapor Dream',
    description: 'Amethyst radial waveform emerging from dream mist',
    icon: Sunset,
    visualizer: {
      style: 'radial',
      color: '#bd5eff',
    },
    background: {
      type: 'gradient',
      value: '#0f041d, #03010a',
    },
    accentGradient: 'from-[#bd5eff] to-[#ff007f]',
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Crisp absolute white waveform on an elegant black canvas',
    icon: Disc,
    visualizer: {
      style: 'waveform',
      color: '#ffffff',
    },
    background: {
      type: 'color',
      value: '#080808',
    },
    accentGradient: 'from-[#ffffff] to-[#555555]',
  },
];

export function TemplatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const updateVisualizerSettings = useStore(s => s.updateVisualizerSettings);
  const updateBackgroundSettings = useStore(s => s.updateBackgroundSettings);

  // Close Dialog on 'Escape' key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const applyPreset = (preset: Preset) => {
    updateVisualizerSettings({
      style: preset.visualizer.style,
      color: preset.visualizer.color,
    });
    updateBackgroundSettings({
      type: preset.background.type,
      value: preset.background.value,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Animated Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          />

          {/* Background radial glow */}
          <div className="absolute w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

          {/* Dialog Container */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-[#0b0b0b]/95 border border-white/10 rounded-lg p-6 w-full max-w-2xl shadow-2xl relative overflow-hidden backdrop-blur-2xl z-10"
          >
            {/* Inner highlights */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="text-[#00e676] animate-pulse" size={18} />
                <h2 className="text-sm font-black uppercase tracking-[2px] text-white">Preset Gallery</h2>
              </div>
              <button 
                onClick={onClose} 
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-6">
              SELECT A TEMPLATE TO INSTANTLY TRANSFORM THE VISUALIZER AND THEME:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1">
              {PRESETS.map((preset) => {
                const IconComponent = preset.icon;
                return (
                  <div
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="group relative flex flex-col justify-between p-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/15 cursor-pointer hover:bg-white/[0.05] transition-all duration-200 shadow-lg"
                  >
                    {/* Glow ring on hover */}
                    <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-white/10 transition-colors pointer-events-none" />

                    <div className="flex gap-3.5">
                      <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${preset.accentGradient} flex items-center justify-center text-black shadow-lg shadow-black/40`}>
                        <IconComponent size={18} strokeWidth={2.5} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-wider text-white group-hover:text-[#00e676] transition-colors">
                          {preset.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    {/* Swatch indicators */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase text-slate-500">STYLE:</span>
                        <span className="text-[9px] font-mono uppercase text-[#00e676] font-bold">
                          {preset.visualizer.style}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Visualizer color circle */}
                        <div 
                          className="w-3 h-3 rounded-full border border-white/20 shadow-inner" 
                          style={{ backgroundColor: preset.visualizer.color }}
                        />
                        {/* Background color block */}
                        <div 
                          className="w-5 h-3 rounded border border-white/15" 
                          style={{ 
                            background: preset.background.type === 'gradient' 
                              ? `linear-gradient(135deg, ${preset.background.value.split(',')[0]}, ${preset.background.value.split(',')[1] || preset.background.value.split(',')[0]})`
                              : preset.background.value 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/5 text-center">
              <p className="text-[9px] font-mono text-slate-500 uppercase">
                * SELECTING A PRESET OVERWRITES CURRENT BACKGROUND & VISUALIZER STYLES
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
