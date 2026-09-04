import { drawBackgroundCanvas } from './lyricsBackgrounds';
import { LyricLine, useStore } from '../store/useStore';
import { LyricVideoTemplate, ArtworkStyle } from './lyricsTemplates';

export interface LyricsRenderConfig {
  template: LyricVideoTemplate;
  aspectRatio: '16:9'|'9:16'|'1:1'|'4:5'|'3:4'|'4:3';
  customBackground?: { type:'color'|'gradient'|'image'|'video'|'particles'|'blurred-artwork'|'waveform'; value:string; videoUrl?:string };
  typographyOverride?: { fontFamily?:string; fontWeight?:string; fontSizeScale?:number; textColor?:string; activeWordColor?:string; inactiveWordColor?:string; glowColor?:string; showContainerPill?:boolean; pillBgColor?:string };
  artworkOverride?: { style?:ArtworkStyle; animation?:string; sizeScale?:number };
  animationOverride?: { lineAnimation?:string; wordAnimation?:string };
  elementPositions?: { artwork:{x:number;y:number}; meta:{x:number;y:number}; lyrics:{x:number;y:number}; visualizer:{x:number;y:number}; watermark:{x:number;y:number} };
  watermarkText?:string; showSafeArea?:boolean;
}
export interface TrackMeta { title:string; artist:string; albumArtUrl?:string|null; }

const imageCache=new Map<string,HTMLImageElement>();
function getImage(url?:string|null){if(!url)return null;let img=imageCache.get(url);if(!img){img=new Image();img.crossOrigin='anonymous';img.src=url;imageCache.set(url,img)}return img}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function posOr(pos:{x:number;y:number}|undefined,x:number,y:number){return pos?{x:pos.x,y:pos.y}:{x,y}}
function easeInOut(t:number){t=clamp(t,0,1);return t*t*(3-2*t)}
function fitText(ctx:CanvasRenderingContext2D,text:string,max:number){if(ctx.measureText(text).width<=max)return text;let s=text;while(s&&ctx.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…'}

export function renderLyricsVideoFrame(ctx:CanvasRenderingContext2D,W:number,H:number,currentTime:number,lyricsLines:LyricLine[],trackMeta:TrackMeta,config:LyricsRenderConfig,audioFrequencyData?:Uint8Array|null){
  const playing=useStore.getState().isPlaying;
  const vertical=H>W;
  const bgType=config.customBackground?.type||config.template.defaultBackground.type;
  const bgVal=config.customBackground?.value||config.template.defaultBackground.value;
  const album=getImage(trackMeta.albumArtUrl);
  drawBackgroundCanvas(ctx,W,H,currentTime,{type:bgType,value:bgVal,videoUrl:config.customBackground?.videoUrl,imageElement:album,videoElement:null},album,audioFrequencyData);

  const artStyle=config.artworkOverride?.style||config.template.layout.artworkType;
  const artPos=posOr(config.elementPositions?.artwork,vertical?.5:.28,vertical?.39:.40);
  if(artStyle!=='none'&&artStyle!=='background-blur') drawArtwork(ctx,W,H,currentTime,playing,album,artStyle,config.artworkOverride?.sizeScale||1,artPos,audioFrequencyData);

  if(config.template.layout.showSongTitle||config.template.layout.showArtist){
    const metaPos=posOr(config.elementPositions?.meta,vertical?.5:.28,vertical?.11:.72);
    drawMeta(ctx,W,H,trackMeta,metaPos,vertical);
  }

  drawSynchronizedLyrics(ctx,W,H,currentTime,lyricsLines,config,config.elementPositions?.lyrics);
  drawVisualizer(ctx,W,H,config.elementPositions?.visualizer,audioFrequencyData);
  drawWatermark(ctx,W,H,config.watermarkText||'Made with Joelizer',config.elementPositions?.watermark);
  if(config.showSafeArea)drawSafeArea(ctx,W,H);
}

function drawArtwork(ctx:CanvasRenderingContext2D,W:number,H:number,time:number,playing:boolean,img:HTMLImageElement|null,style:ArtworkStyle,scale:number,pos:{x:number;y:number},freq?:Uint8Array|null){
  ctx.save();const vertical=H>W;const pulse=playing&&freq?.length?1+(freq.slice(0,8).reduce((a,b)=>a+b,0)/Math.min(8,freq.length)/255)*.035:1;const size=Math.min(W,H)*(vertical?.40:.34)*scale*pulse;const r=size/2;const cx=pos.x*W,cy=pos.y*H;ctx.translate(cx,cy);
  const disc=style==='vinyl'||style==='vinyl-needle'||style==='cd'||style==='cd-needle';
  if(!disc){const half=size/2;ctx.shadowBlur=30;ctx.shadowColor='rgba(0,0,0,.65)';ctx.fillStyle='#18181b';ctx.beginPath();ctx.roundRect(-half,-half,size,size,size*.2);ctx.fill();ctx.clip();if(img?.complete)ctx.drawImage(img,-half,-half,size,size);ctx.restore();return}
  const rot=playing?(time/1.8)*Math.PI*2:0;
  ctx.shadowBlur=32;ctx.shadowColor='rgba(0,0,0,.8)';const grad=ctx.createRadialGradient(0,0,r*.08,0,0,r);grad.addColorStop(0,'#151515');grad.addColorStop(.55,'#292929');grad.addColorStop(1,'#050505');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.save();ctx.rotate(rot);
  for(let i=1;i<38;i++){const rr=r*(.42+(i/38)*.56);ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.strokeStyle=i%2?'rgba(255,255,255,.07)':'rgba(0,0,0,.65)';ctx.lineWidth=.8;ctx.stroke()}
  const glare=ctx.createLinearGradient(-r,-r,r,r);glare.addColorStop(0,'rgba(255,255,255,.20)');glare.addColorStop(.25,'rgba(255,255,255,.02)');glare.addColorStop(.55,'rgba(0,0,0,.35)');glare.addColorStop(1,'rgba(255,255,255,.15)');ctx.fillStyle=glare;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  const lr=r*.40;ctx.beginPath();ctx.arc(0,0,lr,0,Math.PI*2);ctx.clip();if(img?.complete&&img.naturalWidth)ctx.drawImage(img,-lr,-lr,lr*2,lr*2);else{ctx.fillStyle='#18181b';ctx.fill()}ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.40,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.055,0,Math.PI*2);ctx.fillStyle='#222';ctx.fill();ctx.restore();
  if(style==='vinyl-needle'||style==='cd-needle')drawTonearm(ctx,r,playing);
  ctx.restore();
}
function drawTonearm(ctx:CanvasRenderingContext2D,r:number,playing:boolean){ctx.save();ctx.translate(r*.82,-r*.82);ctx.rotate(playing?.03:-.31);ctx.strokeStyle='#d4d4d8';ctx.lineWidth=Math.max(3,r*.025);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(0,r*.45,-r*.45,r*.65,-r*.60,r*1.08);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#1a1a1a';ctx.fillRect(-r*.65,r*1.08,12,18);ctx.fillStyle='#ef4444';ctx.fillRect(-r*.63,r*1.17,8,10);ctx.restore()}

function drawMeta(ctx:CanvasRenderingContext2D,W:number,H:number,meta:TrackMeta,pos:{x:number;y:number},vertical:boolean){ctx.save();const fs=Math.max(14,Math.round(H*(vertical?.024:.026)));ctx.textAlign='center';ctx.textBaseline='top';ctx.font=`700 ${fs}px sans-serif`;ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=8;ctx.fillText(fitText(ctx,meta.title||'Untitled Track',W*(vertical?.82:.40)),pos.x*W,pos.y*H);ctx.font=`500 ${Math.round(fs*.78)}px sans-serif`;ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillText(fitText(ctx,meta.artist||'Joelizer Studio',W*(vertical?.82:.40)),pos.x*W,pos.y*H+fs*1.35);ctx.restore()}

function drawSynchronizedLyrics(ctx:CanvasRenderingContext2D,W:number,H:number,time:number,lines:LyricLine[],config:LyricsRenderConfig,pos?:{x:number;y:number}){
  if(!lines.length)return;const vertical=H>W;let idx=lines.findIndex(l=>time>=l.startTime&&time<=l.endTime);if(idx<0){idx=lines.findIndex(l=>l.startTime>time);if(idx>0)idx--;else if(idx<0)return}
  const line=lines[idx];const elapsed=time-line.startTime;const remaining=line.endTime-time;const fadeIn=easeInOut(elapsed/.22);const fadeOut=easeInOut(remaining/.22);ctx.save();ctx.globalAlpha=Math.min(fadeIn,fadeOut);
  const family=config.typographyOverride?.fontFamily||config.template.typography.fontFamily||'Inter';const weight=config.typographyOverride?.fontWeight||'700';const size=Math.max(16,Math.round(H*(vertical?.038:.045)*(config.typographyOverride?.fontSizeScale||1)));ctx.font=`${weight} ${size}px ${family},sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=10;
  const p=posOr(pos,vertical?.5:.72,vertical?.70:.45);const x=p.x*W,y=p.y*H;const max=W*(vertical?.88:.48);const text=fitText(ctx,line.text,max);const karaoke=(config.animationOverride?.wordAnimation||'karaoke')==='karaoke'||useStore.getState().lyricsSettings?.animationStyle==='karaoke';
  const padX=Math.max(16,size*.55);const boxW=Math.min(max+padX*2,W*.94);const boxH=size*1.8;ctx.fillStyle=config.typographyOverride?.showContainerPill===false?'transparent':config.typographyOverride?.pillBgColor||'rgba(10,10,12,.85)';if(ctx.fillStyle!=='transparent'){ctx.beginPath();ctx.roundRect(x-boxW/2,y-boxH/2,boxW,boxH,Math.min(18,size*.5));ctx.fill()}
  if(karaoke&&line.words?.length){drawSmoothWordKaraoke(ctx,line,time,x,y,size,config)}else{ctx.fillStyle=config.typographyOverride?.textColor||'#fff';ctx.fillText(text,x,y)}ctx.restore();
}
function drawSmoothWordKaraoke(ctx:CanvasRenderingContext2D,line:LyricLine,time:number,x:number,y:number,size:number,config:LyricsRenderConfig){
  const words=line.words||[];const inactive=config.typographyOverride?.inactiveWordColor||'rgba(255,255,255,.65)';const active=config.typographyOverride?.activeWordColor||'#fef08a';const full=words.map(w=>w.word).join(' ');const totalW=ctx.measureText(full).width;let cursor=x-totalW/2;
  words.forEach((w,i)=>{const label=w.word+(i<words.length-1?' ':'');const ww=ctx.measureText(label).width;const start=w.startTime,end=w.endTime;const wordProgress=start===end?time>=end?1:0:clamp((time-start)/(end-start),0,1);const activeBlend=easeInOut(wordProgress);ctx.save();ctx.fillStyle=inactive;ctx.fillText(label,cursor+ww/2,y);if(wordProgress>0){ctx.beginPath();ctx.rect(cursor,y-size*.72,ww*activeBlend,size*1.45);ctx.clip();ctx.fillStyle=active;ctx.fillText(label,cursor+ww/2,y)}ctx.restore();cursor+=ww})
}

function drawVisualizer(ctx:CanvasRenderingContext2D,W:number,H:number,pos?:{x:number;y:number},freq?:Uint8Array|null){ctx.save();const vertical=H>W;const p=posOr(pos,vertical?.5:.72,vertical?.83:.68);const x=p.x*W,y=p.y*H;const color=useStore.getState().visualizerSettings?.color||'#00e676';const count=16;const bw=Math.max(3,Math.round(W*.008)),gap=Math.max(2,Math.round(W*.004));const total=count*(bw+gap)-gap;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=10;for(let i=0;i<count;i++){const v=freq?.length?(freq[i%freq.length]/255):.25;const h=Math.max(4,H*.07*Math.pow(v,1.25));const bx=x-total/2+i*(bw+gap);ctx.beginPath();ctx.roundRect(bx,y-h/2,bw,h,bw/2);ctx.fill()}ctx.restore()}
function drawWatermark(ctx:CanvasRenderingContext2D,W:number,H:number,text:string,pos?:{x:number;y:number}){ctx.save();const vertical=H>W;const p=posOr(pos,vertical?.5:.72,vertical?.93:.88);ctx.font=`500 ${Math.max(10,Math.round(H*.018))}px sans-serif`;ctx.fillStyle='rgba(255,255,255,.38)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x*W,p.y*H);ctx.restore()}
function drawSafeArea(ctx:CanvasRenderingContext2D,W:number,H:number){ctx.save();ctx.strokeStyle='rgba(239,68,68,.6)';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);const x=W*.05,y=H*.05;ctx.strokeRect(x,y,W-x*2,H-y*2);ctx.restore()}
