import React, { useRef, useState, useEffect } from 'react';
import { useMVStore, MediaAsset } from '../../store/useMVStore';
import { Film, Image as ImageIcon, Plus, Trash2, Link as LinkIcon, FolderPlus, Sparkles, ExternalLink, Globe, Search, Wand2 } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { ImageGeneratorPanel } from './Generator/ImageGeneratorPanel';

import { validateDirectMediaUrl } from '../../lib/providers/stockProviders';

export function MVAssetLibrary() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const videoAssets = useMVStore(s => s.videoAssets);
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const removeVideoAsset = useMVStore(s => s.removeVideoAsset);
  const addTimelineClip = useMVStore(s => s.addTimelineClip);
  const currentTime = useStore(s => s.currentTime);
  const mediaSourceFilter = useMVStore(s => s.mediaSourceFilter);
  const setMediaSourceFilter = useMVStore(s => s.setMediaSourceFilter);
  
  const [activeTab, setActiveTab] = useState<'media' | 'generate'>('media');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showLocalUploadModal, setShowLocalUploadModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowStockModal(false);
        setShowUrlModal(false);
        setShowLocalUploadModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const processFile = (file: File, isStock = false) => {
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|m4v)$/i);
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);

    if (!isVideo && !isImage) return;

    const url = URL.createObjectURL(file);

    if (isVideo) {
      const videoEl = document.createElement('video');
      videoEl.src = url;
      videoEl.muted = true;
      videoEl.onloadedmetadata = () => {
        videoEl.currentTime = Math.min(1, (videoEl.duration || 2) / 2);
      };
      videoEl.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = (videoEl.videoHeight / (videoEl.videoWidth || 1)) * 160 || 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          let thumb = '';
          try { thumb = canvas.toDataURL('image/jpeg', 0.7); } catch(e) { thumb = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60'; }
          addVideoAsset({
            id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            file,
            url,
            name: file.name,
            type: 'video',
            duration: videoEl.duration || 5,
            thumbnail: thumb,
            isStock,
            sourceType: isStock ? 'stock' : 'local',
            status: 'ready'
          });
        }
      };
    } else if (isImage) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = (img.height / (img.width || 1)) * 160 || 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.8);
          addVideoAsset({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            file,
            url,
            name: file.name,
            type: 'image',
            duration: 8,
            thumbnail: thumb,
            isStock,
            sourceType: isStock ? 'stock' : 'local',
            status: 'ready'
          });
        }
      };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      processFile(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

function generateFallbackSvgThumbnail(title: string, type: 'video' | 'image'): string {
  const cleanTitle = (title || 'Stock Media').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const badge = type === 'video' ? 'VIDEO' : 'IMAGE';
  const color = type === 'video' ? '#a855f7' : '#3b82f6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <rect width="320" height="180" fill="#0f0f18"/>
    <rect x="10" y="10" width="300" height="160" rx="12" fill="#181824" stroke="${color}" stroke-width="1.5" stroke-opacity="0.4"/>
    <circle cx="160" cy="75" r="26" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
    ${type === 'video' ? `<polygon points="154,65 174,75 154,85" fill="${color}"/>` : `<rect x="148" y="65" width="24" height="20" rx="3" fill="none" stroke="${color}" stroke-width="2"/>`}
    <text x="160" y="125" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${cleanTitle.slice(0, 24)}</text>
    <rect x="120" y="138" width="80" height="18" rx="9" fill="${color}" fill-opacity="0.3"/>
    <text x="160" y="151" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">${badge}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

  const handleAddUrl = () => {
    setUrlError('');
    if (!urlInput.trim()) {
      setUrlError('Please enter a valid media URL');
      return;
    }

    const cleanUrl = urlInput.trim();
    const validation = validateDirectMediaUrl(cleanUrl);

    if (!validation.valid) {
      setUrlError(validation.reason || 'Invalid media URL');
      return;
    }

    const type = validation.type || 'image';
    const filename = cleanUrl.split('/').pop()?.split('?')[0] || `stock-${type}`;

    const tryLoadVideo = (targetUrl: string, isProxyRetry = false) => {
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = targetUrl;
      videoEl.muted = true;
      videoEl.playsInline = true;

      const finishAddVideo = (thumbUrl: string) => {
        addVideoAsset({
          id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          url: cleanUrl, // Preserve original or proxied URL
          name: filename,
          type: 'video',
          duration: videoEl.duration && !isNaN(videoEl.duration) ? videoEl.duration : 10,
          thumbnail: thumbUrl,
          isStock: true,
          sourceType: 'stock',
          status: 'ready'
        });
        setUrlInput('');
        setShowUrlModal(false);
      };

      videoEl.onloadedmetadata = () => {
        videoEl.currentTime = Math.min(1, (videoEl.duration || 2) / 2);
      };

      videoEl.onseeked = () => {
        let thumb = '';
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = (videoEl.videoHeight / (videoEl.videoWidth || 1)) * 160 || 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            thumb = canvas.toDataURL('image/jpeg', 0.7);
          }
        } catch (e) {
          thumb = generateFallbackSvgThumbnail(filename, 'video');
        }
        finishAddVideo(thumb || generateFallbackSvgThumbnail(filename, 'video'));
      };

      videoEl.onerror = () => {
        if (!isProxyRetry) {
          const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(cleanUrl)}`;
          tryLoadVideo(proxyUrl, true);
        } else {
          setUrlError('Failed to load video from this URL. The host server may block cross-origin or hotlinking.');
        }
      };
    };

    if (type === 'video') {
      tryLoadVideo(cleanUrl, false);
    } else {
      const tryLoadImage = (targetUrl: string, isProxyRetry = false) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = targetUrl;
        img.onload = () => {
          let thumb = targetUrl;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = (img.height / (img.width || 1)) * 160 || 90;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              thumb = canvas.toDataURL('image/jpeg', 0.8);
            }
          } catch (e) {
            thumb = targetUrl;
          }
          addVideoAsset({
            id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            url: cleanUrl,
            name: filename,
            type: 'image',
            duration: 8,
            thumbnail: thumb,
            isStock: true,
            sourceType: 'stock',
            status: 'ready'
          });
          setUrlInput('');
          setShowUrlModal(false);
        };

        img.onerror = () => {
          if (!isProxyRetry) {
            const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(cleanUrl)}`;
            tryLoadImage(proxyUrl, true);
          } else {
            setUrlError('Failed to load image from this URL. Check connection or CORS rules.');
          }
        };
      };

      tryLoadImage(cleanUrl, false);
    }
  };

  const handleImportSampleStock = () => {
    const sampleStock: MediaAsset[] = [
      {
        id: 'stock-1',
        url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
        name: 'Concert Stage Lights.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-2',
        url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
        name: 'DJ Club Visuals.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-3',
        url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
        name: 'Retro Studio Mic.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-4',
        url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
        name: 'Neon Laser Crowd.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-5',
        url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&auto=format&fit=crop&q=80',
        name: 'Cyberpunk Neon City.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-6',
        url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80',
        name: 'Synthwave Soundboard.jpg',
        type: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      }
    ];

    sampleStock.forEach(s => addVideoAsset(s));
  };

  const filteredAssets = videoAssets.filter(a => {
    if (mediaSourceFilter === 'my-clips') return !a.isStock;
    if (mediaSourceFilter === 'stock') return a.isStock;
    return true;
  });

  const stockProviders = [
    { name: 'Pexels Video & Photos', url: 'https://www.pexels.com/videos', category: 'Free 4K Footage & HD Photos', badge: '100% Free', bg: 'from-emerald-600/30 to-teal-600/30', border: 'border-emerald-500/40' },
    { name: 'Pixabay Footage', url: 'https://pixabay.com/videos', category: 'Free Stock Videos & Visuals', badge: '100% Free', bg: 'from-blue-600/30 to-cyan-600/30', border: 'border-blue-500/40' },
    { name: 'Unsplash Photos', url: 'https://unsplash.com', category: 'High-Res Music & Stage Photos', badge: '100% Free', bg: 'from-purple-600/30 to-pink-600/30', border: 'border-purple-500/40' },
    { name: 'Coverr Footage', url: 'https://coverr.co', category: 'Free HD Video Backgrounds', badge: '100% Free', bg: 'from-amber-600/30 to-orange-600/30', border: 'border-amber-500/40' },
    { name: 'Mixkit Stock Video', url: 'https://mixkit.co/free-stock-video', category: 'Free Music Video Clips & FX', badge: '100% Free', bg: 'from-indigo-600/30 to-purple-600/30', border: 'border-indigo-500/40' },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Try to get text/uri-list for URL drops
    const urlStr = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (urlStr && urlStr.startsWith('http')) {
      setUrlInput(urlStr);
      setShowUrlModal(true);
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        processFile(files[i]);
      }
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#0e1115] text-[#c9d1d9] select-none overflow-hidden font-mono"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Top Tabs */}
      <div className="flex bg-[#0a0c0f] border-b border-[#232933] shrink-0 text-[11px] font-semibold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2.5 transition-colors flex items-center justify-center gap-2 border-b-2 ${
            activeTab === 'media'
              ? 'border-accent text-accent bg-[#12161c]/50'
              : 'border-transparent text-[#7e8999] hover:text-[#f0f3f6]'
          }`}
        >
          <Film size={13} />
          Media
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 py-2.5 transition-colors flex items-center justify-center gap-2 border-b-2 ${
            activeTab === 'generate'
              ? 'border-accent text-accent bg-[#12161c]/50'
              : 'border-transparent text-[#7e8999] hover:text-[#f0f3f6]'
          }`}
        >
          <Wand2 size={13} />
          AI Generate
        </button>
      </div>

      {activeTab === 'generate' ? (
        <ImageGeneratorPanel />
      ) : (
        <>
          {/* Header */}
          <div className="p-3 border-b border-[#232933] flex flex-col gap-2.5 shrink-0 bg-[#0e1115]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#f0f3f6] text-xs font-semibold tracking-wider uppercase">
                <Film size={13} className="text-accent" />
                Media Library
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setShowLocalUploadModal(true)}
                  title="Import Local Files or Folder"
                  className="bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] px-2.5 py-1.5 rounded text-[#f0f3f6] transition-colors flex items-center gap-1.5 text-[10px] font-semibold cursor-pointer"
                >
                  <FolderPlus size={12} className="text-accent" />
                  <span>Import Media</span>
                </button>
                <button 
                  onClick={() => setShowUrlModal(true)}
                  title="Add Direct Media URL"
                  className="bg-[#161b22] hover:bg-[#1c222b] text-[#c9d1d9] hover:text-accent p-1.5 rounded border border-[#232933] hover:border-[#303846] transition-colors text-[10px] cursor-pointer"
                >
                  <LinkIcon size={12} />
                </button>
              </div>
            </div>

            {/* Hidden Inputs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              accept="video/*,image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <input 
              type="file" 
              ref={folderInputRef} 
              multiple 
              // @ts-ignore
              webkitdirectory=""
              className="hidden" 
              onChange={handleFileChange}
            />

            {/* Timeline Scene Presets */}
            <div className="p-2.5 bg-[#12161c] border border-[#232933] rounded flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
                <Sparkles size={11} className="text-accent" />
                Add Timeline Scenes
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    addTimelineClip({
                      id: `clip-vinyl-${Date.now()}`,
                      assetId: 'vinyl-lyrics',
                      startTime: currentTime || 0,
                      endTime: (currentTime || 0) + 15,
                      trimStart: 0,
                      trimEnd: 15,
                      type: 'vinyl-lyrics'
                    });
                  }}
                  className="px-2 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#f0f3f6] text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Add Vinyl & Karaoke Lyric Scene to timeline"
                >
                  <span>💿</span>
                  <span>Vinyl Lyrics</span>
                </button>

                <button
                  onClick={() => {
                    addTimelineClip({
                      id: `clip-vis-${Date.now()}`,
                      assetId: 'visualizer',
                      startTime: currentTime || 0,
                      endTime: (currentTime || 0) + 15,
                      trimStart: 0,
                      trimEnd: 15,
                      type: 'visualizer'
                    });
                  }}
                  className="px-2 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#f0f3f6] text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Add Audio Visualizer Scene to timeline"
                >
                  <span>📊</span>
                  <span>Audio Visualizer</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-[#0a0c0f] p-0.5 rounded border border-[#232933] text-[10px]">
              <button
                onClick={() => setMediaSourceFilter('all')}
                className={`flex-1 py-1 rounded transition-colors font-semibold ${
                  mediaSourceFilter === 'all'
                    ? 'bg-[#161b22] text-accent border border-[#232933]'
                    : 'text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                All ({videoAssets.length})
              </button>
              <button
                onClick={() => setMediaSourceFilter('my-clips')}
                className={`flex-1 py-1 rounded transition-colors font-semibold ${
                  mediaSourceFilter === 'my-clips'
                    ? 'bg-[#161b22] text-accent border border-[#232933]'
                    : 'text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                My Clips
              </button>
              <button
                onClick={() => setMediaSourceFilter('stock')}
                className={`flex-1 py-1 rounded transition-colors font-semibold ${
                  mediaSourceFilter === 'stock'
                    ? 'bg-[#161b22] text-accent border border-[#232933]'
                    : 'text-[#7e8999] hover:text-[#f0f3f6]'
                }`}
              >
                Stock
              </button>
            </div>
          </div>
          
          {/* Media List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
            {filteredAssets.length === 0 ? (
              <div className="text-center text-xs text-[#7e8999] py-8 px-3 flex flex-col items-center gap-2.5">
                <Film size={26} className="opacity-30" />
                <p className="font-semibold text-[#c9d1d9]">No media in this section.</p>
                <div className="flex flex-col gap-2 w-full mt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] text-[#f0f3f6] text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Upload Video or Images
                  </button>
                  <button
                    onClick={handleImportSampleStock}
                    className="w-full py-2 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-accent text-accent text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    Import Pro Stock Footage Pack
                  </button>
                </div>
              </div>
            ) : (
              filteredAssets.map(asset => {
                const handleQuickAdd = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const dur = Math.min(4, asset.duration || 4);
                  addTimelineClip({
                    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    assetId: asset.id,
                    startTime: currentTime || 0,
                    endTime: (currentTime || 0) + dur,
                    trimStart: 0,
                    trimEnd: dur,
                    locked: false,
                    type: asset.type
                  });
                };

                return (
                  <div 
                    key={asset.id} 
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/joelizer-asset-id', asset.id);
                      e.dataTransfer.setData('text/plain', asset.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="relative group rounded overflow-hidden bg-[#12161c] border border-[#232933] hover:border-[#303846] transition-colors shadow-sm cursor-grab active:cursor-grabbing"
                  >
                    <img src={asset.thumbnail} alt={asset.name} className="w-full h-20 object-cover opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c0f] via-transparent to-transparent pointer-events-none" />
                    
                    {/* Type Badge */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider ${
                        asset.type === 'image' 
                          ? 'bg-[#161b22] text-[#f0f3f6] border border-[#232933]' 
                          : 'bg-[#161b22] text-accent border border-[#232933]'
                      }`}>
                        {asset.type === 'image' ? <ImageIcon size={9} className="inline mr-0.5" /> : <Film size={9} className="inline mr-0.5" />}
                        {asset.type}
                      </span>
                      {asset.isStock && (
                        <span className="bg-[#161b22] text-[#c9d1d9] border border-[#232933] px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase">
                          Stock
                        </span>
                      )}
                    </div>

                    {/* Quick Add & Delete Action Buttons */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={handleQuickAdd}
                        className="bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-accent p-1 rounded cursor-pointer shadow transition-colors"
                        title="Add clip to timeline at playhead"
                      >
                        <Plus size={11} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeVideoAsset(asset.id); }}
                        className="bg-[#161b22] hover:bg-red-950/60 border border-[#232933] hover:border-red-900/50 text-[#7e8999] hover:text-red-400 p-1 rounded cursor-pointer shadow transition-colors"
                        title="Remove Media"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {/* Title & Duration */}
                    <div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between items-end text-[9px] font-mono pointer-events-none">
                      <span className="truncate max-w-[120px] text-[#c9d1d9] font-medium" title={asset.name}>{asset.name}</span>
                      <span className="font-semibold text-[#f0f3f6] bg-[#0a0c0f]/90 px-1 rounded border border-[#232933]">{formatTime(asset.duration)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer / Stock Libraries Hub Button */}
          <div className="p-2.5 border-t border-[#232933] shrink-0 flex flex-col gap-1.5 bg-[#0a0c0f]">
            <button
              onClick={handleImportSampleStock}
              className="w-full py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] text-[#f0f3f6] border border-[#232933] hover:border-[#303846] text-[10px] font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={11} className="text-accent" />
              <span>Load Royalty-Free Stock Pack</span>
            </button>

            <button 
              onClick={() => setShowStockModal(true)}
              className="w-full py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] text-[#c9d1d9] hover:text-accent border border-[#232933] hover:border-[#303846] text-[10px] font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Globe size={11} />
              <span>Stock Provider Hub</span>
            </button>
          </div>

          {/* Local Files / Folder Upload Modal */}
          {showLocalUploadModal && (
            <div 
              onClick={() => setShowLocalUploadModal(false)}
              className="fixed inset-0 bg-[#0a0c0f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0e1115] border border-[#232933] rounded-lg p-5 max-w-md w-full flex flex-col gap-4 text-[#c9d1d9] shadow-[0_16px_48px_rgba(0,0,0,0.9)] relative"
              >
                <div className="flex items-center justify-between border-b border-[#232933] pb-3">
                  <h3 className="text-xs font-semibold text-[#f0f3f6] uppercase tracking-wider flex items-center gap-2">
                    <FolderPlus size={15} className="text-accent" />
                    Import Local Media
                  </h3>
                  <button onClick={() => setShowLocalUploadModal(false)} className="text-[#7e8999] hover:text-[#f0f3f6] text-xs p-1 cursor-pointer">✕</button>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files) {
                      for (let i = 0; i < files.length; i++) {
                        processFile(files[i]);
                      }
                    }
                    setShowLocalUploadModal(false);
                  }}
                  className="border-2 border-dashed border-[#232933] hover:border-accent/60 rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-[#0a0c0f] text-center transition-colors"
                >
                  <FolderPlus size={30} className="text-accent opacity-70" />
                  <div>
                    <p className="text-xs font-semibold text-[#f0f3f6]">Drag & drop files or entire folder here</p>
                    <p className="text-[10px] text-[#7e8999] mt-1 font-sans">Supports MP4, WebM, MOV, JPG, PNG, WEBP</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button 
                      onClick={() => { fileInputRef.current?.click(); setShowLocalUploadModal(false); }}
                      className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Choose Files
                    </button>
                    <button 
                      onClick={() => { folderInputRef.current?.click(); setShowLocalUploadModal(false); }}
                      className="px-3.5 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-[#f0f3f6] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Choose Folder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Direct URL Import Modal */}
          {showUrlModal && (
            <div 
              onClick={() => setShowUrlModal(false)}
              className="fixed inset-0 bg-[#0a0c0f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0e1115] border border-[#232933] rounded-lg p-5 max-w-md w-full flex flex-col gap-4 text-[#c9d1d9] shadow-[0_16px_48px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center justify-between border-b border-[#232933] pb-3">
                  <h3 className="text-xs font-semibold text-[#f0f3f6] uppercase tracking-wider flex items-center gap-2">
                    <LinkIcon size={14} className="text-accent" />
                    Import Media from Direct URL
                  </h3>
                  <button onClick={() => setShowUrlModal(false)} className="text-[#7e8999] hover:text-[#f0f3f6] text-xs cursor-pointer">✕</button>
                </div>

                <p className="text-xs text-[#7e8999] font-sans leading-relaxed">
                  Paste a direct video or image URL (MP4, WebM, MOV, JPG, PNG) from your server, CDN, or stock service.
                </p>

                <input 
                  type="text" 
                  placeholder="https://cdn.example.com/stock-clip.mp4"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-[#0a0c0f] border border-[#232933] focus:border-accent rounded p-2.5 text-xs text-[#f0f3f6] placeholder-[#4d5566] focus:outline-none font-mono transition-colors"
                />

                {urlError && (
                  <p className="text-[11px] text-red-400 font-medium font-sans">{urlError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232933]">
                  <button 
                    onClick={() => setShowUrlModal(false)}
                    className="px-3 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-xs text-[#c9d1d9] hover:text-[#f0f3f6] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddUrl}
                    className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs text-[#0a0c0f] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    Import Media
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stock Providers Hub Modal */}
          {showStockModal && (
            <div 
              onClick={() => setShowStockModal(false)}
              className="fixed inset-0 bg-[#0a0c0f]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0e1115] border border-[#232933] rounded-lg p-5 max-w-lg w-full flex flex-col gap-4 text-[#c9d1d9] shadow-[0_16px_48px_rgba(0,0,0,0.9)] relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-[#232933] pb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[#f0f3f6] uppercase tracking-wider flex items-center gap-2">
                      <Globe size={15} className="text-accent" />
                      Stock Provider Hub
                    </h3>
                    <p className="text-[11px] text-[#7e8999] font-sans mt-0.5">
                      Browse stock sites directly or copy video/image links to import into Joelizer.
                    </p>
                  </div>
                  <button onClick={() => setShowStockModal(false)} className="text-[#7e8999] hover:text-[#f0f3f6] p-1 cursor-pointer">✕</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  {stockProviders.map(provider => (
                    <a
                      key={provider.name}
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] hover:border-[#303846] transition-colors flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#f0f3f6] text-xs tracking-wide">
                          {provider.name}
                        </span>
                        <ExternalLink size={12} className="text-[#7e8999] group-hover:text-accent transition-colors" />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[#7e8999] font-mono">{provider.category}</span>
                      </div>
                    </a>
                  ))}
                </div>

                <div className="bg-[#0a0c0f] border border-[#232933] rounded p-3 flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7e8999] flex items-center gap-1.5">
                    <LinkIcon size={12} className="text-accent" />
                    Quick Import Stock Video Link
                  </span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Paste direct .mp4 or .jpg URL from stock provider"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 bg-[#12161c] border border-[#232933] focus:border-accent rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] placeholder-[#4d5566] focus:outline-none font-mono transition-colors"
                    />
                    <button
                      onClick={() => {
                        handleAddUrl();
                        setShowStockModal(false);
                      }}
                      className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-[#0a0c0f] font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                    >
                      Import
                    </button>
                  </div>
                </div>

                <div className="flex justify-end items-center pt-2 border-t border-[#232933]">
                  <button 
                    onClick={() => setShowStockModal(false)}
                    className="px-3.5 py-1.5 rounded bg-[#161b22] hover:bg-[#1c222b] border border-[#232933] text-xs text-[#c9d1d9] hover:text-[#f0f3f6] cursor-pointer font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
