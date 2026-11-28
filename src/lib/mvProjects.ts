import {useStore} from '../store/useStore';
import {useMVStore,invalidateMVAssetHydration} from '../store/useMVStore';
import {useLyricsVideoStore} from '../store/useLyricsVideoStore';
import {useOverlayEffectsStore} from '../store/useOverlayEffectsStore';
import {globalHistory} from './globalHistory';
import {replaceMVWorkspaceStorage,saveLyricsToStorage} from './storage';

const mainKeys=['name','aspectRatio','layers','visualizerSettings','backgroundSettings','lyricsSettings','logoSettings','albumArt','audioUrl','audioDuration','audioFile','exportResolutionOverride','exportRangeStart','exportRangeEnd'] as const;
const mvKeys=['videoAssets','timelineClips','style','pacing','beatSync','captionLineCount','editSeed','songAnalysis','wordTimings','autoTransitions','defaultTransition','transitionDuration','soundtrackSpeed','soundtrackMuted','soundtrackVolume','showSoundtrackWaveform','visTrackVisible','lyrTrackVisible','mediaSourceFilter','stockFolder'] as const;
const designKeys=['selectedTemplateId','selectedBackgroundPresetId','visibleLineCount','showArtwork','showVisualizer','showVinylRing','showLyrics','showMeta','bilingualEnabled','fadeInDuration','fadeOutDuration','fadeEasing','elementPositions','animationStyle','kineticPalette','kineticColor','kineticGlow','kineticIntensity','customBackground','typographyOverride','artworkOverride','animationOverride','showSafeArea'] as const;
function pick<T extends object,K extends keyof T>(state:T,keys:readonly K[]):Pick<T,K>{
  return Object.fromEntries(keys.map(k=>[k,state[k]])) as Pick<T,K>;
}
function capture(defaults=false){
  const main=defaults?useStore.getInitialState():useStore.getState();
  const mv=defaults?useMVStore.getInitialState():useMVStore.getState();
  const design=defaults?useLyricsVideoStore.getInitialState():useLyricsVideoStore.getState();
  return structuredClone({
    main:pick(main,mainKeys),mv:pick(mv,mvKeys),design:pick(design,designKeys),
    overlay:defaults?useOverlayEffectsStore.getInitialState().mv:useOverlayEffectsStore.getState().mv,
    track:defaults?null:main.tracks[main.currentTrackIndex]||null
  });
}
type Workspace=ReturnType<typeof capture>;
export interface MVProjectSummary {
  id:string; name:string; updatedAt:number; createdAt:number; clips:number; duration:number; media:number; song:string;
}
interface SavedMVProject {version:1; summary:MVProjectSummary; workspace:Workspace; blobs:Record<string,Blob>}
const DB='JoelizerMVProjects', PREFIX='mv-project-blob:';
let currentProjectId:string|null=null;
let busy=false;
let restoredUrls:string[]=[];
export const activeMVProjectId=()=>currentProjectId;
if(typeof window!=='undefined')window.addEventListener('mv-workspace-cleared',()=>{currentProjectId=null;});
async function dbOpen():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('projects',{keyPath:'summary.id'});db.createObjectStore('summaries',{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Cannot open project storage.'));
    request.onblocked=()=>reject(new Error('Project storage is blocked by another tab.'));
  });
}
async function transaction<T>(stores:string[],mode:IDBTransactionMode,run:(tx:IDBTransaction)=>IDBRequest<T>|void):Promise<T>{
  const db=await dbOpen();
  try{return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(stores,mode);let result:T;
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('Project storage failed.'));
    tx.onabort=()=>reject(tx.error||new Error('Project storage transaction aborted.'));
    try{const req=run(tx);if(req)req.onsuccess=()=>{result=req.result;};}catch(error){tx.abort();reject(error);}
  });}finally{db.close();}
}
export async function listMVProjects():Promise<MVProjectSummary[]>{
  const items=await transaction<MVProjectSummary[]>(['summaries'],'readonly',tx=>tx.objectStore('summaries').getAll());
  return items.sort((a,b)=>b.updatedAt-a.updatedAt);
}
async function readProject(id:string){
  const project=await transaction<SavedMVProject|undefined>(['projects'],'readonly',tx=>tx.objectStore('projects').get(id));
  if(!project||project.version!==1)throw new Error('Saved project was not found or is unsupported.');
  return project;
}
async function putProject(project:SavedMVProject){
  await transaction(['projects','summaries'],'readwrite',tx=>{
    tx.objectStore('projects').put(project);tx.objectStore('summaries').put(project.summary);
  });
}
export function suggestedMVProjectName(){
  const s=useStore.getState();return s.tracks[s.currentTrackIndex]?.name||s.name||'Untitled project';
}
export function hasMVWorkspace(){
  const s=useStore.getState(),mv=useMVStore.getState();
  return !!(mv.timelineClips.length||mv.videoAssets.length||s.audioUrl||s.lyricsSettings.lines.length);
}
/** Replace ephemeral URLs by durable references. Every local file is copied
 * into the snapshot, while existing remote URLs remain remote references. */
async function encodeWorkspace(workspace:Workspace){
  const blobs:Record<string,Blob>={};const ids=new Map<string,string>();
  const hints=new Map<string,Blob>();
  for(const asset of workspace.mv.videoAssets)if(asset.file&&asset.url.startsWith('blob:'))hints.set(asset.url,asset.file);
  // Read the actual soundtrack URL, not a potentially stale shared audioFile
  // left behind by switching to another uploaded track.
  async function encode(value:unknown):Promise<unknown>{
    if(typeof value==='string'&&value.startsWith('blob:')){
      let id=ids.get(value);
      if(!id){
        id=String(ids.size);ids.set(value,id);
        const hint=hints.get(value);
        if(hint)blobs[id]=hint;
        else{const res=await fetch(value);if(!res.ok)throw new Error('A local media file is unavailable. Re-import it before saving.');blobs[id]=await res.blob();}
      }
      return PREFIX+id;
    }
    if(value instanceof Blob||value===null||typeof value!=='object')return value;
    if(Array.isArray(value)){const out=[];for(const x of value)out.push(await encode(x));return out;}
    const out:Record<string,unknown>={};for(const [key,x] of Object.entries(value))out[key]=await encode(x);return out;
  }
  const encoded=await encode(workspace) as Workspace;
  if(encoded.main.audioUrl?.startsWith(PREFIX))encoded.main.audioFile=blobs[encoded.main.audioUrl.slice(PREFIX.length)];
  else encoded.main.audioFile=null;
  for(const asset of encoded.mv.videoAssets){
    if(asset.url.startsWith(PREFIX)){
      const blob=blobs[asset.url.slice(PREFIX.length)];
      asset.file=blob instanceof File?blob:new File([blob],asset.name,{type:blob.type});
    }else asset.file=undefined;
  }
  return {workspace:encoded,blobs};
}
function decodeWorkspace(project:SavedMVProject){
  const urls=new Map<string,string>();
  function decode(value:unknown):unknown{
    if(typeof value==='string'&&value.startsWith(PREFIX)){
      const id=value.slice(PREFIX.length),blob=project.blobs[id];if(!blob)throw new Error('Saved media is missing.');
      if(!urls.has(id))urls.set(id,URL.createObjectURL(blob));
      return urls.get(id);
    }
    if(value instanceof Blob||value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(decode);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
  }
  try{return {workspace:decode(project.workspace) as Workspace,urls:[...urls.values()]};}
  catch(e){urls.forEach(url=>URL.revokeObjectURL(url));throw e;}
}
async function save(name:string,id:string|null=currentProjectId){
  name=name.trim().slice(0,100);if(!name)throw new Error('Enter a project name.');
  const raw=capture();
  if(raw.mv.videoAssets.some(a=>a.status==='pending'||a.status==='analyzing'))throw new Error('Wait for media imports to finish before saving.');
  const prev=id?await readProject(id):null;
  const encoded=await encodeWorkspace(raw);
  const summary:MVProjectSummary={id:id||crypto.randomUUID(),name,createdAt:prev?.summary.createdAt??Date.now(),updatedAt:Date.now(),
    clips:raw.mv.timelineClips.length,media:raw.mv.videoAssets.length,song:raw.track?.name||'No soundtrack',
    duration:Math.max(raw.main.audioDuration/(raw.mv.soundtrackSpeed||1),...raw.mv.timelineClips.map(c=>c.endTime),0)};
  await putProject({version:1,summary,...encoded});currentProjectId=summary.id;return summary;
}
async function checkpoint(){
  if(currentProjectId){const p=await readProject(currentProjectId);await save(p.summary.name);}
  else if(hasMVWorkspace())await save(suggestedMVProjectName(),null);
}
async function apply(workspace:Workspace,urls:string[]){
  const main=workspace.main,mv=workspace.mv;
  const localAudio=main.audioFile&&main.audioUrl?.startsWith('blob:')?main.audioFile:null;
  const track=main.audioUrl?{...(workspace.track||{id:crypto.randomUUID(),name:'Saved track',artist:'Uploaded Audio'}),url:main.audioUrl,duration:main.audioDuration,isUserUploaded:!!localAudio,albumArt:main.albumArt||undefined}:null;
  // Commit working media first, then replace live stores. Failure preserves
  // the current workspace and all named snapshots.
  invalidateMVAssetHydration();
  await replaceMVWorkspaceStorage(mv.videoAssets.map(a=>({id:a.id,blob:a.file,url:a.file?'':a.url,name:a.name,type:a.type,duration:a.duration,
    thumbnail:a.thumbnail.startsWith('blob:')?'':a.thumbnail,isStock:a.isStock,sourceType:a.sourceType})),
    localAudio&&track?{blob:localAudio,name:track.name,artist:track.artist,duration:main.audioDuration}:null);
  useStore.getState().setIsPlaying(false);
  useMVStore.setState({...mv,selectedClipId:null,copiedTimelineClip:null,timelineHistory:[mv.timelineClips],historyIndex:0});
  useLyricsVideoStore.setState({...workspace.design,videoMode:'music-video',selectedElement:null,isAutoGenerating:false});
  useOverlayEffectsStore.setState({mv:workspace.overlay});
  useStore.setState({...main,audioFile:localAudio,tracks:track?[track]:[],currentTrackIndex:0,currentTime:0,isPlaying:false,
    waveformPeaks:[],selectedStudioLineId:null});
  saveLyricsToStorage(main.lyricsSettings.lines);
  globalHistory.resetAfterProjectDeletion();
  window.dispatchEvent(new Event('mv-workspace-switched'));
  // Keep old object URLs alive until the renderer has switched its sources.
  const old=restoredUrls;restoredUrls=urls;setTimeout(()=>old.forEach(url=>URL.revokeObjectURL(url)),1000);
}
async function exclusive<T>(fn:()=>Promise<T>):Promise<T>{
  if(busy)throw new Error('Another project operation is in progress.');
  busy=true;try{return await fn();}finally{busy=false;}
}
export const saveMVProject=(name:string,asNew=false)=>exclusive(()=>save(name,asNew?null:currentProjectId));
export const openMVProject=(id:string,saveCurrent=true)=>exclusive(async()=>{
  if(id===currentProjectId)return;
  const project=await readProject(id),decoded=decodeWorkspace(project);
  try{if(saveCurrent)await checkpoint();await apply(decoded.workspace,decoded.urls);currentProjectId=id;}
  catch(e){decoded.urls.forEach(url=>URL.revokeObjectURL(url));throw e;}
});
export const newMVProject=(name:string)=>exclusive(async()=>{
  const title=name.trim().slice(0,100);if(!title)throw new Error('Enter a project name.');
  await checkpoint();
  const blank=capture(true);
  blank.main.name=title;blank.main.lyricsSettings.lines=[];blank.main.audioFile=null;blank.main.audioUrl=null;blank.main.audioDuration=0;blank.main.albumArt=null;blank.main.exportRangeStart=0;blank.main.exportRangeEnd=null;
  blank.mv.videoAssets=[];blank.mv.timelineClips=[];blank.mv.wordTimings=[];blank.mv.songAnalysis=null;
  // Save the empty project before switching, so a quota failure cannot erase the working draft.
  const summary:MVProjectSummary={id:crypto.randomUUID(),name:title.slice(0,100),createdAt:Date.now(),updatedAt:Date.now(),clips:0,media:0,duration:0,song:'No soundtrack'};
  const encoded=await encodeWorkspace(blank);
  await putProject({version:1,summary,...encoded});
  await apply(blank,[]);currentProjectId=summary.id;return summary;
});
export const deleteMVProject=(id:string)=>exclusive(async()=>{
  await transaction(['projects','summaries'],'readwrite',tx=>{tx.objectStore('projects').delete(id);tx.objectStore('summaries').delete(id);});
  if(currentProjectId===id)currentProjectId=null;
});
export const renameMVProject=(id:string,name:string)=>exclusive(async()=>{
  const title=name.trim().slice(0,100);if(!title)throw new Error('Enter a project name.');
  const p=await readProject(id);p.summary={...p.summary,name:title,updatedAt:Date.now()};await putProject(p);
});
