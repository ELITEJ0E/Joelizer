import React, { useRef, useState } from 'react';
import { useMVStore, MediaAsset } from '../../store/useMVStore';
import { Film, Image as ImageIcon, Plus, Trash2, Link as LinkIcon, FolderPlus, Sparkles, ExternalLink, Globe, Search } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export function MVAssetLibrary() {
  const activeColor = useStore(s => s.visualizerSettings.color) || '#00e676';
  const videoAssets = useMVStore(s => s.videoAssets);
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const removeVideoAsset = useMVStore(s => s.removeVideoAsset);
  const mediaSourceFilter = useMVStore(s => s.mediaSourceFilter);
  const setMediaSourceFilter = useMVStore(s => s.setMediaSourceFilter);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

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
          const thumb = canvas.toDataURL('image/jpeg', 0.7);
          addVideoAsset({
            id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            file,
            url,
            name: file.name,
            mediaType: 'video',
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
            mediaType: 'image',
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

  const handleAddUrl = () => {
    setUrlError('');
    if (!urlInput.trim()) {
      setUrlError('Please enter a valid media URL');
      return;
    }

    const cleanUrl = urlInput.trim();
    const isDirectVideo = cleanUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i);
    const isDirectImage = cleanUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i);

    if (!isDirectVideo && !isDirectImage && !cleanUrl.startsWith('http')) {
      setUrlError('Please provide a valid direct media URL');
      return;
    }

    const mediaType = isDirectImage ? 'image' : 'video';
    const filename = cleanUrl.split('/').pop()?.split('?')[0] || `stock-${mediaType}`;

    const newAsset: MediaAsset = {
      id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url: cleanUrl,
      name: filename,
      mediaType,
      duration: mediaType === 'video' ? 10 : 8,
      thumbnail: isDirectImage ? cleanUrl : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60',
      isStock: true,
      sourceType: 'stock',
      status: 'ready'
    };

    addVideoAsset(newAsset);
    setUrlInput('');
    setShowUrlModal(false);
  };

  const handleImportSampleStock = () => {
    const sampleStock: MediaAsset[] = [
      {
        id: 'stock-1',
        url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
        name: 'Concert Stage Lights.jpg',
        mediaType: 'image',
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
        mediaType: 'image',
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
        mediaType: 'image',
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
        mediaType: 'image',
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
        mediaType: 'image',
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
        mediaType: 'image',
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
    { name: 'Motion Array', url: 'https://motionarray.com', category: '4K Footage & Templates', bg: 'from-amber-600/30 to-purple-600/30', border: 'border-amber-500/40' },
    { name: 'Artlist.io', url: 'https://artlist.io/stock-footage', category: 'Cinematic Stock Video', bg: 'from-purple-600/30 to-pink-600/30', border: 'border-purple-500/40' },
    { name: 'Envato Elements', url: 'https://elements.envato.com/stock-video', category: 'Unlimited Video Assets', bg: 'from-emerald-600/30 to-teal-600/30', border: 'border-emerald-500/40' },
    { name: 'Pexels Video', url: 'https://www.pexels.com/videos', category: 'Free HD/4K Videos', bg: 'from-blue-600/30 to-cyan-600/30', border: 'border-blue-500/40' },
    { name: 'Unsplash', url: 'https://unsplash.com', category: 'High-Res Music Photos', bg: 'from-slate-600/30 to-slate-800/30', border: 'border-slate-500/40' },
    { name: 'Pixabay Footage', url: 'https://pixabay.com/videos', category: 'Free Stock Clips', bg: 'from-green-600/30 to-lime-600/30', border: 'border-green-500/40' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#08080c] text-slate-300 select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 border-b border-white/10 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-white text-xs font-bold tracking-widest uppercase">
            <Film size={14} className="text-purple-400" />
            Media Library
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Add Local Files"
              className="bg-white/10 hover:bg-white/20 p-1.5 rounded text-white transition-colors flex items-center gap-1 text-[10px] font-bold"
            >
              <Plus size={12} />
              <span>Files</span>
            </button>
            <button 
              onClick={() => folderInputRef.current?.click()}
              title="Add Local Folder"
              className="bg-white/10 hover:bg-white/20 p-1.5 rounded text-white transition-colors text-[10px]"
            >
              <FolderPlus size={12} />
            </button>
            <button 
              onClick={() => setShowUrlModal(true)}
              title="Add Direct Media URL"
              className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 p-1.5 rounded border border-purple-500/30 transition-colors text-[10px]"
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

        {/* Filter Tabs */}
        <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 text-[10px]">
          <button
            onClick={() => setMediaSourceFilter('all')}
            className="flex-1 py-1 rounded transition-all font-bold"
            style={mediaSourceFilter === 'all' ? { backgroundColor: activeColor, color: '#000' } : { color: '#94a3b8' }}
          >
            All ({videoAssets.length})
          </button>
          <button
            onClick={() => setMediaSourceFilter('my-clips')}
            className="flex-1 py-1 rounded transition-all font-bold"
            style={mediaSourceFilter === 'my-clips' ? { backgroundColor: activeColor, color: '#000' } : { color: '#94a3b8' }}
          >
            My Clips
          </button>
          <button
            onClick={() => setMediaSourceFilter('stock')}
            className="flex-1 py-1 rounded transition-all font-bold"
            style={mediaSourceFilter === 'stock' ? { backgroundColor: activeColor, color: '#000' } : { color: '#94a3b8' }}
          >
            Stock
          </button>
        </div>
      </div>
      
      {/* Media List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {filteredAssets.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-6 px-3 flex flex-col items-center gap-2">
            <Film size={28} className="opacity-30" />
            <p className="font-bold text-slate-400">No media in this section.</p>
            <div className="flex flex-col gap-1.5 w-full mt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
              >
                Upload Video or Images
              </button>
              <button
                onClick={handleImportSampleStock}
                className="w-full py-1.5 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Sparkles size={12} />
                Import Pro Stock Footage Pack
              </button>
            </div>
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div key={asset.id} className="relative group rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors shadow">
              <img src={asset.thumbnail} alt={asset.name} className="w-full h-20 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
              
              {/* Type Badge */}
              <div className="absolute top-1 left-1.5 flex items-center gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${asset.mediaType === 'image' ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'}`}>
                  {asset.mediaType === 'image' ? <ImageIcon size={9} className="inline mr-0.5" /> : <Film size={9} className="inline mr-0.5" />}
                  {asset.mediaType}
                </span>
                {asset.isStock && (
                  <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                    Stock
                  </span>
                )}
              </div>

              {/* Delete Button */}
              <button 
                onClick={() => removeVideoAsset(asset.id)}
                className="absolute top-1 right-1 bg-red-600/80 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                title="Remove Media"
              >
                <Trash2 size={10} />
              </button>

              {/* Title & Duration */}
              <div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between items-end text-[9px] font-mono">
                <span className="truncate max-w-[130px] text-slate-200 font-medium" title={asset.name}>{asset.name}</span>
                <span className="font-bold text-white bg-black/80 px-1 rounded border border-white/10">{formatTime(asset.duration)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Stock Libraries Hub Button */}
      <div className="p-2 border-t border-white/10 shrink-0 flex flex-col gap-1.5 bg-black/40">
        <button
          onClick={handleImportSampleStock}
          className="w-full py-1.5 rounded bg-purple-900/40 text-purple-200 border border-purple-500/40 text-[10px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-purple-900/60 cursor-pointer shadow"
        >
          <Sparkles size={12} className="text-purple-400" />
          <span>Load Royalty-Free Stock Pack</span>
        </button>

        <button 
          onClick={() => setShowStockModal(true)}
          className="w-full py-1.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-amber-500/20 cursor-pointer"
        >
          <Globe size={12} className="text-amber-400" />
          <span>Stock Provider Hub (Artlist, MotionArray...)</span>
        </button>
      </div>

      {/* Direct URL Import Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121218] border border-white/20 rounded-xl p-5 max-w-md w-full flex flex-col gap-4 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon size={16} className="text-purple-400" />
                Import Media from Direct URL
              </h3>
              <button onClick={() => setShowUrlModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Paste a direct video or image URL (MP4, WebM, MOV, JPG, PNG) from your server, CDN, or stock service.
            </p>

            <input 
              type="text" 
              placeholder="https://cdn.example.com/stock-clip.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />

            {urlError && (
              <p className="text-[11px] text-red-400 font-medium">{urlError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button 
                onClick={() => setShowUrlModal(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddUrl}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs text-white font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Plus size={14} />
                Import Media
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Providers Hub Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f15] border border-white/20 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 text-slate-200 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Globe size={18} className="text-amber-400" />
                  Pro Stock Footage & Visual Hub
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Browse stock sites directly or copy video/image links to import into Joelizer MV Studio.
                </p>
              </div>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {stockProviders.map(provider => (
                <a
                  key={provider.name}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3 rounded-xl border bg-gradient-to-br ${provider.bg} ${provider.border} hover:scale-[1.02] transition-transform flex flex-col justify-between group cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs tracking-wide">{provider.name}</span>
                    <ExternalLink size={12} className="text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-[10px] text-slate-300 font-mono mt-1">{provider.category}</span>
                </a>
              ))}
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <LinkIcon size={12} />
                Quick Import Stock Video Link
              </span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste direct .mp4 or .jpg URL from stock provider"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-black/80 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  onClick={() => {
                    handleAddUrl();
                    setShowStockModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shrink-0 cursor-pointer"
                >
                  Import
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  handleImportSampleStock();
                  setShowStockModal(false);
                }}
                className="text-xs text-purple-300 hover:text-purple-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={13} />
                Or Load Pre-bundled Stock Pack (6 Clips)
              </button>
              <button 
                onClick={() => setShowStockModal(false)}
                className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
