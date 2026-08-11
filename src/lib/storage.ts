const DB_NAME = 'JoelizerAudioDB';
const DB_VERSION = 2;
const STORE_NAME = 'audio_data';
const MV_ASSETS_STORE = 'mv_assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(MV_ASSETS_STORE)) {
        db.createObjectStore(MV_ASSETS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioToStorage(file: File | Blob, name: string, duration: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(file, 'audioBlob');
    store.put(name, 'audioName');
    store.put(duration, 'audioDuration');
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB:', err);
  }
}

export async function clearAudioFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.warn('Failed to clear audio from IndexedDB:', err);
  }
}

export async function loadAudioFromStorage(): Promise<{ blob: Blob; name: string; duration: number } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const getReq = (key: string) => new Promise<any>((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    const blob = await getReq('audioBlob');
    const name = await getReq('audioName');
    const duration = await getReq('audioDuration');

    if (blob && blob instanceof Blob) {
      return {
        blob,
        name: name || 'Saved Track',
        duration: duration || 0
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to load audio from IndexedDB:', err);
    return null;
  }
}

export function saveLyricsToStorage(lines: any[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('joelizer_lyrics_lines', JSON.stringify(lines));
    }
  } catch (err) {
    console.warn('Failed to save lyrics to localStorage:', err);
  }
}

export function loadLyricsFromStorage(): any[] | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('joelizer_lyrics_lines');
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (err) {
    console.warn('Failed to load lyrics from localStorage:', err);
  }
  return null;
}

export interface StoredMVAsset {
  id: string;
  blob?: Blob;
  url: string;
  name: string;
  mediaType: 'video' | 'image';
  duration: number;
  thumbnail: string;
  isStock?: boolean;
  sourceType?: 'local' | 'url' | 'stock' | 'generated';
}

export async function saveMVAssetToStorage(asset: StoredMVAsset): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(MV_ASSETS_STORE, 'readwrite');
    const store = tx.objectStore(MV_ASSETS_STORE);
    store.put(asset);
  } catch (err) {
    console.warn('Failed to save MV asset to IndexedDB:', err);
  }
}

export async function removeMVAssetFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(MV_ASSETS_STORE, 'readwrite');
    const store = tx.objectStore(MV_ASSETS_STORE);
    store.delete(id);
  } catch (err) {
    console.warn('Failed to remove MV asset from IndexedDB:', err);
  }
}

export async function loadMVAssetsFromStorage(): Promise<StoredMVAsset[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(MV_ASSETS_STORE, 'readonly');
    const store = tx.objectStore(MV_ASSETS_STORE);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Failed to load MV assets from IndexedDB:', err);
    return [];
  }
}
