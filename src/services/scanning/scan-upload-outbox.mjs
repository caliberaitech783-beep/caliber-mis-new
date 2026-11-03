const DB='caliber-scan-outbox',STORE='uploads';
function database(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(DB,1);
 request.onupgradeneeded=()=>{request.result.createObjectStore(STORE,{keyPath:'id'})};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
})}
async function transaction(mode,run){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),request=run(tx.objectStore(STORE));let result;
  request.onsuccess=()=>{result=request.result};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Draft storage was interrupted.'));
 })}finally{db.close()}
}
export const retainScanUpload=entry=>transaction('readwrite',store=>store.put(entry));
export const removeScanUpload=id=>transaction('readwrite',store=>store.delete(id));
export async function pendingScanUploads(scope){const rows=await transaction('readonly',store=>store.getAll());return rows.filter(row=>row.scope===scope).sort((a,b)=>a.createdAt-b.createdAt)}

export async function assertBatchDraftsSynced(batchId,session,storage=localStorage){
 const actor=String(session.login||session.name||'user'),prefix='caliber:manual:'+actor+':'+batchId+':';
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix)||key.endsWith(':active'))continue;let cached;try{cached=JSON.parse(storage.getItem(key)||'null')}catch{continue}if(cached?.draft&&cached.synchronized!==true)throw Error('A manual draft is pending sync on this device. Resume it and wait for Saved as draft before logging this batch.');}
 const uploads=await pendingScanUploads(actor+':vehicle:'+batchId);
 if(uploads.length)throw Error('An upload is pending sync on this device. Resume it before logging the batch.');
 const scanPrefix='caliberScanDraft:'+actor+':vehicle:';
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(scanPrefix)){let cached;try{cached=JSON.parse(storage.getItem(key)||'null')}catch{continue}if(cached?.draft&&cached.batchId===batchId)throw Error('Scan corrections are pending sync on this device. Resume the card before logging the batch.');}}
}
