import type { CanonicalProjectJson } from '../types/projectJson';
import {clipSourceTime,getClipSpeed} from './clipSpeed';
export const clampMVVolume=(v=1)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):1;
export const clipAudioGain=(c:{audioMuted?:boolean;audioVolume?:number})=>c.audioMuted!==false?0:clampMVVolume(c.audioVolume);
export const soundtrackAudioGain=(a:{muted?:boolean;volume?:number})=>a.muted?0:clampMVVolume(a.volume);
export function requiresMVAudioMix(p:CanonicalProjectJson){
  return p.exportMode==='music-video'&&(soundtrackAudioGain(p.audio)!==1||p.videoClips.some(c=>c.type==='video'&&clipAudioGain(c)>0));
}
export function mvClipAudioSegments(p:CanonicalProjectJson){
  if(p.exportMode!=='music-video')return [];
  const sorted=[...p.videoClips].sort((a,b)=>a.startTime-b.startTime);
  return sorted.flatMap((c,i)=>{
    const gain=clipAudioGain(c),start=Math.max(c.startTime,p.exportRange.start),end=Math.min(c.endTime,p.exportRange.end,sorted[i+1]?.startTime??Infinity);
    if(c.type!=='video'||gain<=0||end<=start)return [];
    const prev=sorted[i-1];
    const lead=prev&&c.transition!=='cut'&&Math.abs(prev.endTime-c.startTime)<.05?Math.min(c.transitionDuration??.5,(prev.endTime-prev.startTime)/2,(c.endTime-c.startTime)/2):0;
    return [{id:c.id,url:c.url,gain,offset:Math.max(0,clipSourceTime(c,start,lead)),rate:getClipSpeed(c),start:start-p.exportRange.start,duration:end-start,trimEnd:c.trimEnd}];
  });
}
