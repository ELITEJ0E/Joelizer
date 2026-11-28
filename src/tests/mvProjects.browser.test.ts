import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';
const port=4188;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port)],{env:process.env,stdio:'pipe'});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await sleep(300);}
  assert.ok(ready,'Vite did not start');
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  const ids=await page.evaluate(async()=>{
    const paths=['/src/store/useStore.ts','/src/store/useMVStore.ts','/src/store/useLyricsVideoStore.ts','/src/store/useOverlayEffectsStore.ts','/src/lib/mvProjects.ts'];
    const [main,mv,design,overlay,p]=await Promise.all(paths.map(path=>import(/* @vite-ignore */ path)));
    main.useStore.getState().setActiveTab('mv-studio');
    // Valid local SVG, stored as bytes, not just a temporary object URL.
    const file=new File(['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>'],'cover.svg',{type:'image/svg+xml'});
    const url=URL.createObjectURL(file);
    mv.useMVStore.getState().addVideoAsset({id:'media-a',file,url,name:file.name,type:'image',duration:5,thumbnail:url,status:'ready'});
    mv.useMVStore.getState().setTimelineClips([{id:'clip-a',assetId:'media-a',type:'image',startTime:0,endTime:5,trimStart:0,trimEnd:5,offsetX:0.2,zoom:1.2,audioMuted:true,transition:'fade'}]);
    main.useStore.getState().updateLyricsSettings({lines:[{id:'line-a',text:'Song A',startTime:0,endTime:2}],font:'Outfit'});
    main.useStore.getState().setAspectRatio('9:16');
    const wav=new ArrayBuffer(44+16000);const bytes=new DataView(wav);const ascii=(at:number,text:string)=>{for(let i=0;i<text.length;i++)bytes.setUint8(at+i,text.charCodeAt(i));};
    ascii(0,'RIFF');bytes.setUint32(4,wav.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');bytes.setUint32(16,16,true);bytes.setUint16(20,1,true);bytes.setUint16(22,1,true);bytes.setUint32(24,8000,true);bytes.setUint32(28,16000,true);bytes.setUint16(32,2,true);bytes.setUint16(34,16,true);ascii(36,'data');bytes.setUint32(40,16000,true);
    const soundtrack=new File([wav],'song-a.wav',{type:'audio/wav'});
    main.useStore.getState().setAudio(soundtrack,URL.createObjectURL(soundtrack),1,null,{name:'Song A'});
    design.useLyricsVideoStore.getState().updateTypographyOverride({fontSizeScale:1.3});
    mv.useMVStore.getState().setSoundtrackVolume(.6);
    mv.useMVStore.getState().setLyrTrackVisible(false);
    const a=await p.saveMVProject('Song A');
    const b=await p.newMVProject('Song B');
    if(mv.useMVStore.getState().timelineClips.length||main.useStore.getState().lyricsSettings.lines.length)throw new Error('New workspace is not blank');
    main.useStore.getState().updateLyricsSettings({lines:[{id:'line-b',text:'Song B',startTime:0,endTime:1}]});
    await p.openMVProject(a.id);
    const state=mv.useMVStore.getState();
    if(state.timelineClips[0]?.id!=='clip-a'||state.timelineClips[0].zoom!==1.2||state.soundtrackVolume!==.6||state.lyrTrackVisible!==false)throw new Error('MV edit was not restored');
    if(main.useStore.getState().aspectRatio!=='9:16'||main.useStore.getState().lyricsSettings.lines[0]?.text!=='Song A'||design.useLyricsVideoStore.getState().typographyOverride.fontSizeScale!==1.3)throw new Error('Shared design or lyrics were not restored');
    if(!(await(await fetch(state.videoAssets[0].url)).text()).includes('fill="red"'))throw new Error('Restored asset bytes are incorrect');
    const audio=main.useStore.getState();if(!audio.audioUrl||audio.audioFile?.size!==wav.byteLength||(await(await fetch(audio.audioUrl)).arrayBuffer()).byteLength!==wav.byteLength)throw new Error('Soundtrack bytes not restored');
    await p.openMVProject(b.id);
    if(main.useStore.getState().lyricsSettings.lines[0]?.text!=='Song B'||mv.useMVStore.getState().videoAssets.length)throw new Error('Project B was overwritten');
    return {a:a.id,b:b.id};
  });
  const projectsButton=page.getByRole('button',{name:'Projects',exact:true});
  await projectsButton.click();
  await page.getByRole('button',{name:'Save project',exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Rename Song A',exact:true}).waitFor({state:'visible'});
  await page.reload({waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async({a,b})=>{
    const path='/src/lib/mvProjects.ts';const p=await import(/* @vite-ignore */ path);
    const list=await p.listMVProjects();return list.some((x:{id:string})=>x.id===a)&&list.some((x:{id:string})=>x.id===b);
  },ids);
  assert.equal(result,true,'Named snapshots must survive page reload');
  console.log('PASS: MV projects, independent edits, durable imported media, and reload persistence');
}finally{await browser?.close();server.kill();}
