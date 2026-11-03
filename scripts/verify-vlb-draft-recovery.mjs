import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const source=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{useBatchManualDraft}from'./src/hooks/use-batch-manual-draft.jsx';function App(){const[form,setForm]=useState({location:'Jayant OC',bookDate:'2026-11-03',cardShift:'I',shiftHours:8,assetId:'1',employeeId:'2',shiftId:'3',openingHmr:'100',closingHmr:'101',trips:[]});const api=async(path,config={})=>{const r=await fetch(path,config);const d=await r.json();if(!r.ok)throw Error(d.error);return d};const draft=useBatchManualDraft({batch:{id:'batch'},session:{login:'alice',token:'synthetic'},form,setForm,enabled:true,api});return <main><label>Closing HMR<input aria-label="Closing HMR" value={form.closingHmr} onChange={e=>setForm({...form,closingHmr:e.target.value})}/></label><p role="status">{draft.status}</p></main>}createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'esm'});
const drafts=new Map();
const server=createServer(async(req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<div id="root"></div><script type="module" src="/app.js"></script>')}
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].text)}
 if(req.url==='/outbox.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(readFileSync('src/services/scanning/scan-upload-outbox.mjs'))}
 res.setHeader('Content-Type','application/json');
 if(req.method==='PUT'){
  let body='';for await(const chunk of req)body+=chunk;
  const data=JSON.parse(body),id=req.url.split('/').at(-1),old=drafts.get(id);
  if(old&&data.revision!==old.revision){res.statusCode=409;return res.end(JSON.stringify({error:'Draft changed'}))}
  const row={id,revision:(old?.revision||0)+1,draft:data.draft};drafts.set(id,row);return res.end(JSON.stringify(row));
 }
 res.end(JSON.stringify({drafts:[...drafts.values()]}));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('status').filter({hasText:'Saved as draft'}).waitFor();
 await context.setOffline(true);await page.getByLabel('Closing HMR').fill('103');await page.waitForTimeout(1400);
 assert.match(await page.getByRole('status').textContent(),/Pending sync/);
 const local=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('caliber:manual:')&&!k.endsWith(':active')).map(k=>JSON.parse(localStorage.getItem(k))));assert.ok(local.some(row=>row.draft.closingHmr==='103'));
 await context.setOffline(false);await page.reload();await page.getByLabel('Closing HMR').waitFor();await page.waitForFunction(()=>document.querySelector('input').value==='103');await page.getByRole('status').filter({hasText:'Saved as draft'}).waitFor();assert.ok([...drafts.values()].some(row=>row.draft.closingHmr==='103'));
 await page.evaluate(async()=>{const m=await import('/outbox.mjs');await m.retainScanUpload({id:'a',scope:'alice:vehicle:batch1',createdAt:1,files:[new File(['original image bytes'],'scan.png',{type:'image/png'})]});await m.retainScanUpload({id:'b',scope:'bob:vehicle:batch2',createdAt:2,files:[new File(['other image'],'other.png')]})});
 await page.reload();const recovered=await page.evaluate(async()=>{const m=await import('/outbox.mjs');const a=await m.pendingScanUploads('alice:vehicle:batch1');return {count:a.length,name:a[0].files[0].name,bytes:await a[0].files[0].text()}});assert.deepEqual(recovered,{count:1,name:'scan.png',bytes:'original image bytes'});
 const remaining=await page.evaluate(async()=>{const m=await import('/outbox.mjs');try{await m.assertBatchDraftsSynced('batch1',{login:'alice'});throw Error('pending upload did not block logging')}catch(e){if(!e.message.includes('pending sync'))throw e}await m.removeScanUpload('a');await m.assertBatchDraftsSynced('batch1',{login:'alice'});return [(await m.pendingScanUploads('alice:vehicle:batch1')).length,(await m.pendingScanUploads('bob:vehicle:batch2')).length]});assert.deepEqual(remaining,[0,1]);
 console.log('Verified browser draft recovery through offline edits and reload; original upload bytes survive reload and remain isolated by user/batch.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
