import {useEffect,useRef,useState} from 'react';
export function useBatchManualDraft({batch,session,form,setForm,enabled,api}){
 const prefix='caliber:manual:'+String(session.login||session.name||'user')+':'+String(batch?.id||'')+':';
 const current=useRef(null),inFlight=useRef(null),latest=useRef(form);
 const [ready,setReady]=useState(false),[status,setStatus]=useState(''),[tick,setTick]=useState(0),[drafts,setDrafts]=useState([]),[rejectedDrafts,setRejectedDrafts]=useState([]);
 latest.current=form;
 const remember=(value,synchronized=false)=>{current.current.synchronized=synchronized;try{localStorage.setItem(prefix+current.current.id,JSON.stringify({...current.current,draft:value}));localStorage.setItem(prefix+'active',current.current.id);return true}catch{return false}};
 const refresh=async()=>{if(!batch?.id)return;const data=await api('/api/vlb-batches/'+batch.id);const rows=data.drafts||[];
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix)||key===prefix+'active')continue;const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached?.draft&&!cached.synchronized&&!rows.some(row=>row.id===cached.id))rows.push(cached)}}catch{}
  setDrafts(rows);setRejectedDrafts(data.rejectedDrafts||[]);
 };
 useEffect(()=>{
  if(!batch?.id)return;let cache;
  try{const id=localStorage.getItem(prefix+'active');cache=id&&JSON.parse(localStorage.getItem(prefix+id)||'null')}catch{}
  current.current=cache||{id:crypto.randomUUID(),revision:null};
  if(cache?.draft)setForm(cache.draft);
  setReady(true);void refresh().catch(()=>{});
 },[batch?.id,session.token]);
 const save=async(value=latest.current)=>{
  if(!batch?.id||!current.current)return null;
  if(inFlight.current)await inFlight.current;
  const identity=current.current;identity.synchronized=false;
  if(!remember(value)){setStatus('Local recovery storage unavailable. Keep this page open until the draft synchronizes.');}
  setStatus(navigator.onLine?'Pending sync: saving draft…':'Pending sync: draft retained on this device.');
  const task=(async()=>{
   try{const result=await api('/api/vlb-batches/'+batch.id+'/drafts/'+identity.id,{method:'PUT',body:JSON.stringify({draft:value,revision:identity.revision})});
    identity.revision=result.revision;identity.synchronized=JSON.stringify(value)===JSON.stringify(latest.current);if(current.current===identity)remember(latest.current,identity.synchronized);
    setStatus(result.status==='rejected'?'This card is already rejected. Restore it from Rejected manual cards to edit it.':'Saved as draft. Not logged.');await refresh().catch(()=>{});return result;
   }catch(e){setStatus('Pending sync: '+e.message+' Draft retained on this device if local storage is available.');throw e;}
  })();inFlight.current=task;try{return await task}finally{if(inFlight.current===task)inFlight.current=null}
 };
 useEffect(()=>{
  if(!ready||!enabled||!batch?.id||!form.location||!form.shiftId||!form.assetId&&!form.employeeId&&!String(form.openingHmr||'')&&!form.trips?.some(r=>r.equipmentName))return;
  remember(form);
  const timer=setTimeout(()=>{void save(form).catch(()=>{})},1000);return()=>clearTimeout(timer);
 },[form,ready,enabled,tick]);
 useEffect(()=>{const retry=()=>setTick(t=>t+1);window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[]);
 const start=()=>{void refresh().catch(()=>{});current.current={id:crypto.randomUUID(),revision:null};try{localStorage.setItem(prefix+'active',current.current.id)}catch{}setStatus('');};
 const choose=row=>{current.current={id:row.id,revision:row.revision};setForm(row.draft);remember(row.draft);setStatus('Draft restored.');};
 const reject=async row=>{if(inFlight.current)await inFlight.current;const revision=current.current?.id===row.id?current.current.revision:row.revision;const result=revision==null?{rejected:true,localOnly:true}:await api('/api/vlb-batches/'+batch.id+'/drafts/'+row.id,{method:'DELETE',body:JSON.stringify({revision})});try{localStorage.removeItem(prefix+row.id)}catch{}await refresh();return result;};
 return {save,start,choose,reject,status,drafts,rejectedDrafts};
}
