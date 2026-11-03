export function saveDraftRecovery(storage,key,revision,draft,batchId=null){try{storage.setItem(key,JSON.stringify({revision,draft,batchId,savedAt:Date.now()}));return true;}catch{return false;}}
export function loadDraftRecovery(storage,key,revision){try{const value=JSON.parse(storage.getItem(key)||'null');return value?.revision===revision&&value.draft&&typeof value.draft==='object'&&!Array.isArray(value.draft)?value.draft:null;}catch{return null;}}

export function conflictingDraftRecovery(storage,key,revision){
 try{const value=JSON.parse(storage.getItem(key)||'null');return value&&value.revision!==revision&&value.draft&&typeof value.draft==='object'&&!Array.isArray(value.draft)?value:null}catch{return null}
}
