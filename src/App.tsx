/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/Editor/TopBar';
import { LeftPanel } from './components/Editor/LeftPanel';
import { RightPanel } from './components/Editor/RightPanel';
import { Preview } from './components/Editor/Preview';
import { BottomBar } from './components/Editor/BottomBar';
import { ExportModal } from './components/Editor/ExportModal';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'layers' | 'settings'>('layers');
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#030303] text-slate-300 font-sans overflow-hidden select-none">
      <TopBar onExport={() => setShowExportModal(true)} />
      
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* Desktop Sidebar Left (Layers) */}
        <div className="hidden md:block md:w-64 border-r border-white/10 h-full">
          <LeftPanel />
        </div>

        {/* Center area containing Preview (always visible at top on mobile) and Mobile Edit Controls below */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          {/* Preview Panel - taking 38vh on mobile, flexible on desktop */}
          <div className="w-full h-[38vh] md:h-auto md:flex-1 border-b md:border-b-0 border-white/10 relative z-0 bg-[#020202]">
            <Preview />
          </div>

          {/* Mobile Edit Controls (Underneath the preview on mobile only) */}
          <div className="md:hidden flex flex-col flex-1 bg-[#050505] overflow-hidden relative border-t border-white/10">
            <div className="flex bg-[#070707] border-b border-white/10 shrink-0">
              <button 
                onClick={() => setMobileTab('layers')} 
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-black transition-colors ${mobileTab === 'layers' ? 'text-white' : 'text-slate-500'}`}
                style={mobileTab === 'layers' ? { borderBottom: `2px solid ${activeColor}` } : {}}
              >
                Layers
              </button>
              <button 
                onClick={() => setMobileTab('settings')} 
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-black transition-colors ${mobileTab === 'settings' ? 'text-white' : 'text-slate-500'}`}
                style={mobileTab === 'settings' ? { borderBottom: `2px solid ${activeColor}` } : {}}
              >
                Settings
              </button>
            </div>

            <div className="flex-1 overflow-y-auto relative">
              {mobileTab === 'layers' ? (
                <LeftPanel onLayerSelect={() => setMobileTab('settings')} />
              ) : (
                <RightPanel />
              )}
            </div>
          </div>
        </div>

        {/* Desktop Sidebar Right (Settings) */}
        <div className="hidden md:block md:w-80 border-l border-white/10 h-full">
          <RightPanel />
        </div>
      </div>
      
      <BottomBar />
      
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}

