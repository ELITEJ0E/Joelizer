/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TopBar } from './components/Editor/TopBar';
import { LeftPanel } from './components/Editor/LeftPanel';
import { RightPanel } from './components/Editor/RightPanel';
import { Preview } from './components/Editor/Preview';
import { BottomBar } from './components/Editor/BottomBar';
import { ExportModal } from './components/Editor/ExportModal';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'preview' | 'layers' | 'settings'>('preview');

  return (
    <div className="flex flex-col h-screen w-screen bg-[#030303] text-slate-300 font-sans overflow-hidden select-none">
      <TopBar onExport={() => setShowExportModal(true)} />
      
      {/* Mobile Tabs */}
      <div className="md:hidden flex bg-[#070707] border-b border-white/10 relative">
        <button onClick={() => setMobileTab('layers')} className={`flex-1 py-3 text-[9px] uppercase tracking-widest font-black transition-colors ${mobileTab === 'layers' ? 'text-[#00e676] border-b-2 border-[#00e676]' : 'text-slate-500'}`}>Layers</button>
        <button onClick={() => setMobileTab('preview')} className={`flex-1 py-3 text-[9px] uppercase tracking-widest font-black transition-colors ${mobileTab === 'preview' ? 'text-[#00e676] border-b-2 border-[#00e676]' : 'text-slate-500'}`}>Preview</button>
        <button onClick={() => setMobileTab('settings')} className={`flex-1 py-3 text-[9px] uppercase tracking-widest font-black transition-colors ${mobileTab === 'settings' ? 'text-[#00e676] border-b-2 border-[#00e676]' : 'text-slate-500'}`}>Settings</button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 md:relative md:w-64 z-10 md:z-auto transition-transform duration-300 ${mobileTab === 'layers' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <LeftPanel />
        </div>
        
        <div className={`flex-1 w-full h-full absolute inset-0 md:relative z-0 md:z-auto ${mobileTab === 'preview' ? 'block' : 'hidden md:block'}`}>
          <Preview />
        </div>
        
        <div className={`absolute inset-0 md:relative md:w-80 z-10 md:z-auto transition-transform duration-300 ${mobileTab === 'settings' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
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

