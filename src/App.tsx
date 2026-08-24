/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/Editor/TopBar';
import { ExportModal } from './components/Editor/ExportModal';
import { StudioLayout } from './components/Studio/StudioLayout';
import { GlobalAudioPlayer } from './components/Audio/GlobalAudioPlayer';

import { MVStudioLayout } from './components/MVStudio/MVStudioLayout';
import { SunoStudioLayout } from './components/SunoStudio/SunoStudioLayout';
import { LyricsVideoLayout } from './components/LyricsStudio/LyricsVideoLayout';
import { DAWLayout } from './components/DAW/DAWLayout';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<'layers' | 'settings'>('layers');
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const activeTab = useStore(s => s.activeTab);
  const initFromStorage = useStore(s => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    const handleOpenExport = () => setShowExportModal(true);
    window.addEventListener('open-export-modal', handleOpenExport);
    return () => window.removeEventListener('open-export-modal', handleOpenExport);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#030304] spotify-grid text-slate-300 font-sans overflow-hidden select-none">
      <GlobalAudioPlayer />
      <TopBar onExport={() => setShowExportModal(true)} />
      
      {activeTab === 'create' ? (
        <div className="flex-1 overflow-hidden relative">
          <SunoStudioLayout />
        </div>
      ) : activeTab === 'studio' ? (
        <div className="flex-1 overflow-hidden relative">
          <DAWLayout />
        </div>
      ) : activeTab === 'lrc' ? (
        <div className="flex-1 overflow-hidden relative">
          <StudioLayout />
        </div>
      ) : activeTab === 'lyrics' ? (
        <div className="flex-1 overflow-hidden relative">
          <LyricsVideoLayout />
        </div>
      ) : activeTab === 'mv-studio' ? (
        <div className="flex-1 overflow-hidden relative">
          <MVStudioLayout />
        </div>
      ) : null}
      
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}

