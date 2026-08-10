import React, { useEffect, useState } from 'react';
import { useMVStore } from '../../store/useMVStore';
import { MVTimeline } from './MVTimeline';
import { MVPreview } from './MVPreview';
import { MVWorkflow } from './MVWorkflow';
import { MVAssetLibrary } from './MVAssetLibrary';
import { Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';

export function MVStudioLayout() {
  const [engineStatus, setEngineStatus] = useState<'offline' | 'checking' | 'online'>('checking');
  const setLocalEngineConnected = useMVStore(s => s.setLocalEngineConnected);

  useEffect(() => {
    let mounted = true;
    const checkEngine = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/mv/health');
        if (res.ok) {
          if (mounted) {
            setEngineStatus('online');
            setLocalEngineConnected(true);
          }
        } else {
          throw new Error('Not OK');
        }
      } catch {
        if (mounted) {
          setEngineStatus('offline');
          setLocalEngineConnected(false);
        }
      }
    };
    
    checkEngine();
    const interval = setInterval(checkEngine, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setLocalEngineConnected]);

  return (
    <div className="flex flex-col h-full bg-[#050505] text-slate-300">
      {/* Informational Status Banner */}
      <div className={`border-b text-xs px-4 py-1.5 flex items-center justify-between z-50 transition-colors ${
        engineStatus === 'online' 
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-950/30 border-amber-500/20 text-amber-300/90'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${engineStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-bold tracking-wider uppercase flex items-center gap-1.5">
            <Cpu size={12} />
            {engineStatus === 'online' ? 'LOCAL ENGINE ONLINE' : 'LOCAL ENGINE OFFLINE'}
          </span>
          <span className="opacity-90">
            {engineStatus === 'online' 
              ? 'Enhanced WhisperX alignment & local FFmpeg export active.' 
              : 'Basic Auto Edit is available. Connect Local Engine on port 4000 for WhisperX & local FFmpeg export.'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="opacity-75">Basic Auto Edit: <strong className="text-emerald-400">READY</strong></span>
          <span className="opacity-75">ComfyUI: <strong className="text-slate-400">OPTIONAL</strong></span>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Asset Library */}
        <div className="w-72 border-r border-white/10 flex flex-col bg-[#080808]">
          <MVAssetLibrary />
        </div>

        {/* Center: Preview & Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 bg-black relative flex items-center justify-center border-b border-white/10 p-4">
            <MVPreview />
          </div>
          <div className="h-64 bg-[#0a0a0c] border-t border-white/10 flex-shrink-0">
            <MVTimeline />
          </div>
        </div>

        {/* Right: Workflow & Settings */}
        <div className="w-80 border-l border-white/10 flex flex-col bg-[#080808] overflow-y-auto">
          <MVWorkflow />
        </div>
      </div>
    </div>
  );
}
