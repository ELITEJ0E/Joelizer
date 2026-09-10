/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/Editor/TopBar';
import { WorkspaceRail } from './components/Shell/WorkspaceRail';
import { KeyboardShortcutsModal } from './components/Shell/KeyboardShortcutsModal';
import { ExportModal } from './components/Editor/ExportModal';
import { AudioSourceModal } from './components/Audio/AudioSourceModal';
import { StudioLayout } from './components/Studio/StudioLayout';
import { GlobalAudioPlayer } from './components/Audio/GlobalAudioPlayer';
import { MVStudioLayout } from './components/MVStudio/MVStudioLayout';
import { LyricsVideoLayout } from './components/LyricsStudio/LyricsVideoLayout';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const activeTab = useStore(s => s.activeTab);
  const initFromStorage = useStore(s => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    const handleOpenExport = () => setShowExportModal(true);
    const handleOpenAudio = () => setShowAudioModal(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setShowExportModal(true);
      }
    };

    window.addEventListener('open-export-modal', handleOpenExport);
    window.addEventListener('open-audio-modal', handleOpenAudio);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-export-modal', handleOpenExport);
      window.removeEventListener('open-audio-modal', handleOpenAudio);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0c0f] text-[#c4cad4] font-sans overflow-hidden select-none">
      <GlobalAudioPlayer />

      {/* Top Application Bar */}
      <TopBar
        onExport={() => setShowExportModal(true)}
        onOpenAudioModal={() => setShowAudioModal(true)}
      />

      {/* Main Workspace Frame with Left Navigation Rail */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        <WorkspaceRail
          onOpenAudioModal={() => setShowAudioModal(true)}
          onOpenShortcutsModal={() => setShowShortcutsModal(true)}
        />

        {/* Workspace Canvas Container */}
        <main
          id="workspace-viewport"
          className="flex-1 bg-[#0e1115] overflow-hidden relative flex flex-col"
        >
          {activeTab === 'lrc' && (
            <div className="flex-1 overflow-hidden relative animate-in fade-in duration-150">
              <StudioLayout />
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="flex-1 overflow-hidden relative animate-in fade-in duration-150">
              <LyricsVideoLayout />
            </div>
          )}

          {activeTab === 'mv-studio' && (
            <div className="flex-1 overflow-hidden relative animate-in fade-in duration-150">
              <MVStudioLayout />
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      <AudioSourceModal
        isOpen={showAudioModal}
        onClose={() => setShowAudioModal(false)}
      />

      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
