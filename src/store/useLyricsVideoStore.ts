import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LyricTemplateId, LYRIC_VIDEO_TEMPLATES, ArtworkStyle, ArtworkAnimation, LineAnimation, WordAnimation } from '../lib/lyricsTemplates';
import { BACKGROUND_PRESETS } from '../lib/lyricsBackgrounds';
import { getDefaultLyricsElementPositions, clampNormalizedPosition, LyricsElementPositions } from '../lib/lyricsLayout';
import { useMVStore } from './useMVStore';

export interface ElementPos { x: number; y: number; }
export type CanvasElementPositions = LyricsElementPositions;
export type VideoCreationMode = 'music-video' | 'lyrics-video';
export interface LyricsVideoState {
  videoMode: VideoCreationMode; selectedTemplateId: LyricTemplateId; selectedBackgroundPresetId: string;
  selectedElement: 'artwork' | 'meta' | 'lyrics' | 'visualizer' | 'watermark' | null; visibleLineCount: number;
  elementPositions: CanvasElementPositions;
  customBackground: { type: 'color'|'gradient'|'image'|'video'|'particles'|'blurred-artwork'|'waveform'; value: string; videoUrl?: string };
  typographyOverride: { fontFamily:string; fontWeight:string; fontSizeScale:number; textColor:string; activeWordColor:string; inactiveWordColor:string; glowColor:string; showContainerPill:boolean; pillBgColor:string };
  artworkOverride: { style:ArtworkStyle; animation:ArtworkAnimation; sizeScale:number };
  animationOverride: { lineAnimation:LineAnimation; wordAnimation:WordAnimation; intensity:number };
  showSafeArea:boolean; isAutoGenerating:boolean;
  setVideoMode:(mode:VideoCreationMode)=>void; setSelectedTemplateId:(id:LyricTemplateId)=>void; setSelectedBackgroundPresetId:(id:string)=>void;
  setCustomBackground:(bg:Partial<LyricsVideoState['customBackground']>)=>void; updateTypographyOverride:(u:Partial<LyricsVideoState['typographyOverride']>)=>void;
  updateArtworkOverride:(u:Partial<LyricsVideoState['artworkOverride']>)=>void; updateAnimationOverride:(u:Partial<LyricsVideoState['animationOverride']>)=>void;
  setShowSafeArea:(show:boolean)=>void; setSelectedElement:(el:LyricsVideoState['selectedElement'])=>void; setVisibleLineCount:(n:number)=>void;
  setElementPosition:(key:keyof CanvasElementPositions,pos:ElementPos)=>void; resetElementPositions:(aspectRatio?:string)=>void; generateLyricsVideo:()=>void;
}

export const useLyricsVideoStore = create<LyricsVideoState>()(persist((set,get)=>({
  videoMode:'lyrics-video', selectedTemplateId:'vinyl', selectedBackgroundPresetId:'sunset', selectedElement:null, visibleLineCount:2,
  elementPositions:getDefaultLyricsElementPositions('16:9'),
  customBackground:{type:'blurred-artwork',value:'#18181b'},
  typographyOverride:{fontFamily:'Outfit',fontWeight:'700',fontSizeScale:1.05,textColor:'#fff',activeWordColor:'#fef08a',inactiveWordColor:'rgba(255,255,255,.7)',glowColor:'#eab308',showContainerPill:true,pillBgColor:'rgba(10,10,12,.85)'},
  artworkOverride:{style:'vinyl',animation:'rotate',sizeScale:1}, animationOverride:{lineAnimation:'slide-up',wordAnimation:'karaoke',intensity:1}, showSafeArea:false,isAutoGenerating:false,
  setVideoMode:(videoMode)=>set({videoMode}),
  setSelectedTemplateId:(id)=>{const t=LYRIC_VIDEO_TEMPLATES[id];if(!t)return;set({selectedTemplateId:id,customBackground:{type:t.defaultBackground.type,value:t.defaultBackground.value},typographyOverride:{...t.typography},artworkOverride:{style:t.layout.artworkType,animation:t.layout.artworkAnim,sizeScale:1},animationOverride:{lineAnimation:t.animations.lineAnimation,wordAnimation:t.animations.wordAnimation,intensity:t.animations.intensity}})},
  setSelectedBackgroundPresetId:(id)=>{const p=BACKGROUND_PRESETS.find(x=>x.id===id);if(p)set({selectedBackgroundPresetId:id,customBackground:{type:p.type,value:p.value}})},
  setCustomBackground:(bg)=>set(s=>({customBackground:{...s.customBackground,...bg}})),
  updateTypographyOverride:(u)=>set(s=>({typographyOverride:{...s.typographyOverride,...u}})), updateArtworkOverride:(u)=>set(s=>({artworkOverride:{...s.artworkOverride,...u}})), updateAnimationOverride:(u)=>set(s=>({animationOverride:{...s.animationOverride,...u}})),
  setShowSafeArea:(showSafeArea)=>set({showSafeArea}), setSelectedElement:(selectedElement)=>set({selectedElement}), setVisibleLineCount:(visibleLineCount)=>set({visibleLineCount}),
  setElementPosition:(key,pos)=>set(s=>({elementPositions:{...s.elementPositions,[key]:clampNormalizedPosition(pos)}})),
  resetElementPositions:(aspectRatio='16:9')=>set({elementPositions:getDefaultLyricsElementPositions(aspectRatio)}),
  generateLyricsVideo:()=>{set({isAutoGenerating:true});const a=useMVStore.getState().songAnalysis;const bpm=a?.bpm||120;const language=a?.language||'en';let id:LyricTemplateId='vinyl';if(bpm>130)id='vinyl-needle';else if(bpm<90)id='circle';else if(language==='ko'||language==='ja')id='cd-needle';else id=['vinyl','cd','square','circle','full','vinyl-needle','cd-needle'][Math.floor(Math.random()*7)] as LyricTemplateId;get().setSelectedTemplateId(id);setTimeout(()=>set({isAutoGenerating:false}),600)}
}),{name:'lyrics-video-storage',storage:createJSONStorage(()=>sessionStorage)}));
