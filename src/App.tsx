/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/Editor/TopBar';
import { KeyboardShortcutsModal } from './components/Shell/KeyboardShortcutsModal';
import { ExportModal } from './components/Editor/ExportModal';
import { AudioSourceModal } from './components/Audio/AudioSourceModal';
import { AudioMasteringLabModal } from './components/Audio/AudioMasteringLabModal';
import { DAWLayout } from './components/DAW/DAWLayout';
import { StudioLayout } from './components/Studio/StudioLayout';
import { GlobalAudioPlayer } from './components/Audio/GlobalAudioPlayer';
import { MVStudioLayout } from './components/MVStudio/MVStudioLayout';
import { LyricsVideoLayout } from './components/LyricsStudio/LyricsVideoLayout';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const initFromStorage = useStore(s => s.initFromStorage);
  const activeColor = useStore(s => s.visualizerSettings?.color) || '#00e676';
  const audioFile = useStore(s => s.audioFile);
  const currentTrackName = useStore(s => s.tracks[s.currentTrackIndex]?.name);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  // Sync global CSS variables with selected accent color theme
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', activeColor);
    root.style.setProperty('--signal-emerald', activeColor);
    
    // Create clean hex variants for borders, dims, and glow
    const hex = activeColor.startsWith('#') ? activeColor : '#00e676';
    root.style.setProperty('--accent-dim', `${hex}26`); // ~15% opacity
    root.style.setProperty('--accent-border', `${hex}59`); // ~35% opacity
    root.style.setProperty('--signal-emerald-dim', `${hex}26`);
    root.style.setProperty('--signal-emerald-border', `${hex}59`);
    root.style.setProperty('--accent-glow', `0 0 16px ${hex}40`);
  }, [activeColor]);

  useEffect(() => {
    const handleOpenExport = () => setShowExportModal(true);
    const handleOpenAudio = () => setShowAudioModal(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
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
      } else if (e.key === '1') {
        setActiveTab('lrc');
      } else if (e.key === '2') {
        setActiveTab('lyrics');
      } else if (e.key === '3') {
        setActiveTab('mv-studio');
      } else if (e.key === '4') {
        setActiveTab('audio-lab');
      } else if (e.key === '5') {
        setActiveTab('daw');
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
  }, [setActiveTab]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0c0f] text-[#c4cad4] font-sans overflow-hidden select-none">
      <GlobalAudioPlayer />

      {/* Top Application Bar with Integrated Studio Navigation */}
      <TopBar
        onExport={() => setShowExportModal(true)}
        onOpenAudioModal={() => setShowAudioModal(true)}
        onOpenShortcutsModal={() => setShowShortcutsModal(true)}
      />

      {/* Full-width Workspace Viewport */}
      <main
        id="workspace-viewport"
        className="flex-1 bg-[#0e1115] overflow-hidden relative flex flex-col"
      >
        {activeTab === 'lrc' && (
          <div className="flex-1 h-full w-full min-h-0 overflow-hidden relative animate-in fade-in duration-150 flex flex-col">
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

        {activeTab === 'daw' && (
          <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden relative">
            <DAWLayout />
          </div>
        )}

        {activeTab === 'audio-lab' && (
          <div className="flex-1 min-h-0 w-full overflow-hidden relative animate-in fade-in duration-150">
            <AudioMasteringLabModal
              embedded
              onClose={() => setActiveTab('mv-studio')}
              currentAudio={audioFile}
              currentName={currentTrackName}
            />
          </div>
        )}
      </main>

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
