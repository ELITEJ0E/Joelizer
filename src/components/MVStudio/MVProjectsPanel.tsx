import React,{useEffect,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {FolderOpen,Plus,Save,Copy,Trash2,Pencil,Film,Check,Loader2} from 'lucide-react';
import {activeMVProjectId,listMVProjects,saveMVProject,newMVProject,openMVProject,deleteMVProject,renameMVProject,suggestedMVProjectName,hasMVWorkspace,type MVProjectSummary} from '../../lib/mvProjects';
const btn='inline-flex items-center justify-center gap-1.5 rounded-md border border-[#34404c] bg-[#161d25] px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:bg-[#222d38] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-accent';
const format=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
export function MVProjectsPanel(){
  const [projects,setProjects]=useState<MVProjectSummary[]>([]);
  const [active,setActive]=useState(activeMVProjectId);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [dialog,setDialog]=useState<{kind:'new'|'save'|'copy'|'rename'|'delete'|'open';id?:string;name:string}|null>(null);
  const [name,setName]=useState('');
  const refresh=async()=>{setProjects(await listMVProjects());setActive(activeMVProjectId());};
  useEffect(()=>{const reload=()=>{refresh().catch(e=>setError(String(e?.message||e)));};reload();window.addEventListener('mv-workspace-cleared',reload);return ()=>window.removeEventListener('mv-workspace-cleared',reload);},[]);
  const run=async(action:()=>Promise<unknown>,success:string)=>{
    setBusy(true);setError('');setMessage('');
    try{await action();await refresh();setMessage(success);setDialog(null);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  const ask=(kind:NonNullable<typeof dialog>['kind'],value='',id?:string)=>{setName(value);setError('');setDialog({kind,id,name:value});};
  const activeProject=projects.find(p=>p.id===active);
  const save=()=>activeProject?void run(()=>saveMVProject(activeProject.name),'Project saved.'):ask('save',suggestedMVProjectName());
  const open=(p:MVProjectSummary)=>{if(hasMVWorkspace()||active)ask('open',p.name,p.id);else void run(()=>openMVProject(p.id),'Project opened.');};
  const submit=()=>{if(!dialog)return;const title=name.trim();
    if(dialog.kind==='open'){void run(()=>openMVProject(dialog.id!),'Project opened.');return;}
    if(dialog.kind==='delete'){void run(()=>deleteMVProject(dialog.id!),'Saved project deleted.');return;}
    if(!title)return;
    if(dialog.kind==='new')void run(()=>newMVProject(title),'New project created.');
    else if(dialog.kind==='rename')void run(()=>renameMVProject(dialog.id!,title),'Project renamed.');
    else void run(()=>saveMVProject(title,dialog.kind==='copy'),'Project saved.');
  };
  return <div className="space-y-3 p-3 text-slate-200" aria-label="MV project library">
    <div className="rounded-lg border border-[#303846] bg-[#0e141b] p-3 space-y-2">
      <div className="flex items-center gap-2"><FolderOpen size={16} className="text-accent"/><span className="min-w-0 truncate text-xs font-semibold">{activeProject?.name||'Current working draft'}</span></div>
      <p className="text-[10px] leading-relaxed text-slate-400">Save your complete edit, including uploaded footage and soundtrack. Your current draft is saved before opening or creating another project.</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button className={btn+' border-emerald-600/50 text-emerald-300'} disabled={busy} onClick={save}><Save size={13}/> Save project</button>
        <button className={btn} disabled={busy} onClick={()=>ask('new','Untitled project')}><Plus size={13}/> New project</button>
      </div>
      <button className={btn+' w-full'} disabled={busy} onClick={()=>ask('copy',(activeProject?.name||suggestedMVProjectName())+' copy')}><Copy size={12}/> Save as copy</button>
    </div>
    {message&&<p role="status" className="text-[11px] text-emerald-300">{message}</p>}
    {error&&!dialog&&<p role="alert" className="text-[11px] text-red-300 break-words">{error}</p>}
    <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saved projects</h3><span className="text-[10px] text-slate-500">{projects.length}</span></div>
    {!projects.length&&<p className="rounded border border-dashed border-[#34404c] p-3 text-center text-xs text-slate-400">No saved projects yet.</p>}
    {projects.map(p=><article key={p.id} className={`rounded-lg border p-2.5 ${p.id===active?'border-emerald-500/50 bg-emerald-950/15':'border-[#303846] bg-[#111820]'}`}>
      <div className="flex items-center gap-2"><Film size={16} className="shrink-0 text-slate-400"/><button className="min-w-0 flex-1 truncate text-left text-xs font-semibold hover:text-accent" disabled={busy||p.id===active} onClick={()=>open(p)}>{p.name}</button>{p.id===active&&<Check size={14} className="text-accent"/>}</div>
      <p className="mt-1 truncate text-[10px] text-slate-400">{p.song} · {p.clips} clips · {format(p.duration)}</p>
      <p className="mt-1 text-[10px] text-slate-500">{new Date(p.updatedAt).toLocaleString()}</p>
      <div className="mt-2 flex gap-1.5">
        <button className={btn+' flex-1 py-1'} disabled={busy||p.id===active} onClick={()=>open(p)}><FolderOpen size={12}/> {p.id===active?'Open now':'Open'}</button>
        <button className={btn+' py-1'} disabled={busy} aria-label={'Rename '+p.name} onClick={()=>ask('rename',p.name,p.id)}><Pencil size={12}/></button>
        <button className={btn+' py-1 text-red-300'} disabled={busy} aria-label={'Delete '+p.name} onClick={()=>ask('delete',p.name,p.id)}><Trash2 size={12}/></button>
      </div>
    </article>)}
    <p className="text-[10px] leading-relaxed text-slate-500">Stored locally in this browser. Save before closing the page; clearing browser data removes saved projects. Remote media still needs its source URL.</p>
    <Dialog.Root open={!!dialog||busy} onOpenChange={open=>{if(!open&&!busy)setDialog(null);}}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[22000] bg-black/60"/>
        <Dialog.Content data-mv-dialog className="fixed left-1/2 top-1/2 z-[22001] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#394554] bg-[#111820] p-4 text-slate-100 shadow-xl outline-none" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}>
          <Dialog.Title className="text-sm font-semibold">{busy?'Saving project…':dialog?.kind==='delete'?'Delete saved project?':dialog?.kind==='open'?'Open saved project?':dialog?.kind==='new'?'New project':dialog?.kind==='rename'?'Rename project':dialog?.kind==='copy'?'Save as copy':'Save project'}</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-slate-400">{busy?'Keeping project media and edits together.':dialog?.kind==='delete'?'Delete this saved snapshot? Your current editing session is not deleted.':dialog?.kind==='open'?'Open '+dialog.name+'? Save your current workspace first, or explicitly discard changes since its last save.':dialog?.kind==='new'?'Your current edit will be saved before the new blank project opens.':'Choose a name for this saved edit.'}</Dialog.Description>
          {busy?<div className="flex items-center gap-2 py-4 text-xs text-emerald-300"><Loader2 className="animate-spin" size={16}/> Updating local project storage</div>:<>
            {dialog?.kind!=='delete'&&dialog?.kind!=='open'&&<input aria-label="Project name" value={name} maxLength={100} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit();}} className="mt-3 w-full rounded-md border border-[#34404c] bg-[#0a0f15] px-3 py-2 text-sm outline-none focus:border-accent"/>}
            {error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2"><button className={btn} onClick={()=>setDialog(null)}>Cancel</button>{dialog?.kind==='open'&&<button className={btn+' text-amber-300'} onClick={()=>void run(()=>openMVProject(dialog.id!,false),'Project opened without saving the previous draft.')}>Discard &amp; open</button>}<button className={btn+(dialog?.kind==='delete'?' text-red-300':' text-emerald-300')} disabled={dialog?.kind!=='delete'&&!name.trim()} onClick={submit}>{dialog?.kind==='delete'?'Delete':dialog?.kind==='open'?'Save & open':dialog?.kind==='new'?'Create project':'Save'}</button></div>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
