import React, { useEffect, useState } from 'react';
import { useStore, VisualizerSettings, BackgroundSettings } from '../../store/useStore';
import { X, Sparkles, Disc, Flame, Sunset, Zap, CircleDot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

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
  effects?: {
    glitchIntensity: number;
    shakeIntensity: number;
    showGrain: boolean;
    showScanlines: boolean;
  };
}

const PRESETS: Preset[] = [
  {
    id: 'phonk-energy',
    name: 'NCS Phonk',
    description: 'Aggressive bass shake, VHS glitches, and blood red aura',
    icon: Flame,
    visualizer: {
      style: 'bars',
      color: '#ff0033',
    },
    background: {
      type: 'gradient',
      value: '#140005, #000000',
    },
    accentGradient: 'from-[#ff0033] to-[#80001a]',
    effects: {
      glitchIntensity: 0.6,
      shakeIntensity: 0.7,
      showGrain: true,
      showScanlines: true,
    }
  },
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
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

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
      glitchIntensity: preset.effects?.glitchIntensity ?? 0,
      shakeIntensity: preset.effects?.shakeIntensity ?? 0,
      showGrain: preset.effects?.showGrain ?? false,
      showScanlines: preset.effects?.showScanlines ?? false,
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
            className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Dialog Container */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-black/90 border border-white/10 rounded-xl p-8 w-full max-w-3xl shadow-2xl relative overflow-hidden backdrop-blur-3xl z-10"
          >
            {/* Dynamic background glow based on hover */}
            <div 
              className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none transition-colors duration-500 opacity-20"
              style={{ background: hoveredPreset ? PRESETS.find(p => p.id === hoveredPreset)?.visualizer.color : activeColor }}
            />

            {/* Inner highlights */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10"
                  style={{ backgroundColor: `${activeColor}15` }}
                >
                  <Sparkles size={16} className="animate-pulse" style={{ color: activeColor }} />
                </div>
                <h2 className="text-lg font-black uppercase tracking-[3px] text-white font-display">Preset Gallery</h2>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-[10px] uppercase font-bold tracking-[2px] text-slate-400 mb-6 bg-white/[0.02] p-3 rounded-lg border border-white/5 inline-block">
              Select a template to instantly transform the visualizer and theme
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {PRESETS.map((preset) => {
                const IconComponent = preset.icon;
                const isHovered = hoveredPreset === preset.id;
                
                return (
                  <div
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    onMouseEnter={() => setHoveredPreset(preset.id)}
                    onMouseLeave={() => setHoveredPreset(null)}
                    className={cn(
                      "group relative flex flex-col justify-between p-5 rounded-xl border cursor-pointer transition-all duration-300",
                      isHovered ? "bg-white/[0.06] border-white/20 shadow-xl" : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    )}
                    style={isHovered ? {
                      boxShadow: `0 0 30px ${preset.visualizer.color}20`,
                      borderColor: `${preset.visualizer.color}50`
                    } : {}}
                  >
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${preset.accentGradient} flex items-center justify-center text-white shadow-lg`}>
                        <IconComponent size={20} strokeWidth={2.5} />
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 
                          className="text-sm font-black uppercase tracking-wider text-white transition-colors duration-300 font-display"
                          style={{ color: isHovered ? preset.visualizer.color : 'white' }}
                        >
                          {preset.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2 font-bold tracking-wide">
                          {preset.description}
                        </p>
                      </div>
                    </div>

                    {/* Swatch indicators */}
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">STYLE:</span>
                        <span 
                          className="text-[9px] font-mono uppercase font-black tracking-widest"
                          style={{ color: preset.visualizer.color }}
                        >
                          {preset.visualizer.style}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                        <div 
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner" 
                          style={{ backgroundColor: preset.visualizer.color }}
                          title="Visualizer Accent"
                        />
                        <div 
                          className="w-6 h-3.5 rounded-sm border border-white/15" 
                          style={{ 
                            background: preset.background.type === 'gradient' 
                              ? `linear-gradient(135deg, ${preset.background.value.split(',')[0]}, ${preset.background.value.split(',')[1] || preset.background.value.split(',')[0]})`
                              : preset.background.value 
                          }}
                          title="Background"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
