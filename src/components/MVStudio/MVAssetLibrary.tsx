import React, { useRef, useState } from 'react';
import { useMVStore, MediaAsset } from '../../store/useMVStore';
import { Film, Image as ImageIcon, Plus, Trash2, Wand2, Link as LinkIcon, FolderPlus, Sparkles, Filter } from 'lucide-react';
import { formatTime } from '../../lib/utils';

export function MVAssetLibrary() {
  const videoAssets = useMVStore(s => s.videoAssets);
  const addVideoAsset = useMVStore(s => s.addVideoAsset);
  const removeVideoAsset = useMVStore(s => s.removeVideoAsset);
  const mediaSourceFilter = useMVStore(s => s.mediaSourceFilter);
  const setMediaSourceFilter = useMVStore(s => s.setMediaSourceFilter);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'video' | 'image'>('video');
  const [urlError, setUrlError] = useState('');

  const [comfyUIConnected, setComfyUIConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => {
    const checkComfyUI = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8188/system_stats');
        setComfyUIConnected(res.ok);
      } catch {
        setComfyUIConnected(false);
      }
    };
    checkComfyUI();
    const interval = setInterval(checkComfyUI, 10000);
    return () => clearInterval(interval);
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
            duration: 8, // Default image shot duration 8s
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
      setUrlError('Please provide a direct media URL (e.g. .mp4, .webm, .jpg, .png)');
      return;
    }

    const mediaType = isDirectImage ? 'image' : 'video';
    const filename = cleanUrl.split('/').pop()?.split('?')[0] || `url-${mediaType}`;

    const newAsset: MediaAsset = {
      id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url: cleanUrl,
      name: filename,
      mediaType,
      duration: mediaType === 'video' ? 10 : 8,
      thumbnail: isDirectImage ? cleanUrl : 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&auto=format&fit=crop&q=60',
      sourceType: 'url',
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
        url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
        name: 'Concert Lights Stage.jpg',
        mediaType: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-2',
        url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
        name: 'DJ Club Atmosphere.jpg',
        mediaType: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-3',
        url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
        name: 'Vintage Microphone Studio.jpg',
        mediaType: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60',
        isStock: true,
        sourceType: 'stock',
        status: 'ready'
      },
      {
        id: 'stock-4',
        url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
        name: 'Neon Party Crowd.jpg',
        mediaType: 'image',
        duration: 8,
        thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&auto=format&fit=crop&q=60',
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

  return (
    <div className="flex flex-col h-full bg-[#08080c] text-slate-300">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-white text-xs font-bold tracking-widest uppercase">
            <Film size={14} className="text-purple-400" />
            Media Library
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Add Files (Videos/Images)"
              className="bg-white/10 hover:bg-white/20 p-1.5 rounded text-white transition-colors flex items-center gap-1 text-[10px]"
            >
              <Plus size={13} />
              <span>Files</span>
            </button>
            <button 
              onClick={() => folderInputRef.current?.click()}
              title="Add Folder"
              className="bg-white/10 hover:bg-white/20 p-1.5 rounded text-white transition-colors text-[10px]"
            >
              <FolderPlus size={13} />
            </button>
            <button 
              onClick={() => setShowUrlModal(true)}
              title="Add from URL"
              className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 p-1.5 rounded border border-purple-500/30 transition-colors text-[10px]"
            >
              <LinkIcon size={13} />
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
            className={`flex-1 py-1 rounded transition-colors ${mediaSourceFilter === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            All ({videoAssets.length})
          </button>
          <button
            onClick={() => setMediaSourceFilter('my-clips')}
            className={`flex-1 py-1 rounded transition-colors ${mediaSourceFilter === 'my-clips' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            My Clips
          </button>
          <button
            onClick={() => setMediaSourceFilter('stock')}
            className={`flex-1 py-1 rounded transition-colors ${mediaSourceFilter === 'stock' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Stock
          </button>
        </div>
      </div>
      
      {/* Media List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredAssets.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-6 px-3 flex flex-col items-center gap-2">
            <Film size={28} className="opacity-30" />
            <p>No media in this section.</p>
            <div className="flex flex-col gap-1.5 w-full mt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors"
              >
                Upload Video or Images
              </button>
              <button
                onClick={handleImportSampleStock}
                className="w-full py-1.5 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Sparkles size={12} />
                Load Sample Stock Footage
              </button>
            </div>
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div key={asset.id} className="relative group rounded overflow-hidden bg-white/5 border border-white/10 hover:border-purple-500/50 transition-colors">
              <img src={asset.thumbnail} alt={asset.name} className="w-full h-20 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
              
              {/* Type Badge */}
              <div className="absolute top-1 left-1.5 flex items-center gap-1">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${asset.mediaType === 'image' ? 'bg-amber-500/80 text-black' : 'bg-blue-500/80 text-white'}`}>
                  {asset.mediaType === 'image' ? <ImageIcon size={9} className="inline mr-0.5" /> : <Film size={9} className="inline mr-0.5" />}
                  {asset.mediaType}
                </span>
                {asset.isStock && (
                  <span className="bg-purple-500/80 text-white px-1 py-0.5 rounded text-[8px] font-bold uppercase">
                    Stock
                  </span>
                )}
              </div>

              {/* Delete Button */}
              <button 
                onClick={() => removeVideoAsset(asset.id)}
                className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <Trash2 size={10} />
              </button>

              {/* Title & Duration */}
              <div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between items-end text-[9px] font-mono">
                <span className="truncate max-w-[130px] text-slate-200" title={asset.name}>{asset.name}</span>
                <span className="font-bold text-white bg-black/70 px-1 rounded">{formatTime(asset.duration)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Stock Button */}
      <div className="p-2 border-t border-white/10 shrink-0 flex flex-col gap-1.5">
        {videoAssets.filter(a => a.isStock).length === 0 && (
          <button
            onClick={handleImportSampleStock}
            className="w-full py-1.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-purple-900/50"
          >
            <Sparkles size={12} />
            Add Stock Library
          </button>
        )}

        <button 
          onClick={() => {
            if (comfyUIConnected) {
              setIsGenerating(true);
              setTimeout(() => {
                setIsGenerating(false);
                alert("ComfyUI generation simulated. Generated media imported.");
              }, 2000);
            }
          }}
          disabled={!comfyUIConnected || isGenerating}
          className="w-full py-1.5 rounded bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600/20"
        >
          <Wand2 size={12} />
          {isGenerating ? 'Generating Visual...' : (comfyUIConnected ? 'ComfyUI Generate Visual' : 'ComfyUI Offline (Optional)')}
        </button>
      </div>

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121218] border border-white/20 rounded-lg p-5 max-w-md w-full flex flex-col gap-4 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon size={16} className="text-purple-400" />
                Add Media from Direct URL
              </h3>
              <button onClick={() => setShowUrlModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Paste a direct URL to an MP4, WebM, MOV video or JPG, PNG, WebP image.
            </p>

            <input 
              type="text" 
              placeholder="https://example.com/footage/clip1.mp4"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />

            {urlError && (
              <p className="text-[11px] text-red-400">{urlError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button 
                onClick={() => setShowUrlModal(false)}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs text-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddUrl}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-xs text-white font-bold flex items-center gap-1.5"
              >
                <Plus size={14} />
                Import Media
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
