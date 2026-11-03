import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {registerGeminiScanSettings} from '../server/routes/scanning/gemini-scan-settings.mjs';
import {createIntegrationSecretStore} from '../server/services/core/integration-secret-store.mjs';
import {requireMisAdministrator} from '../shared/auth/mis-admin-access.mjs';
import {requestedMisPage,misPageUrl} from '../src/utils/ui/mis-navigation.mjs';
import {MODEL} from '../server/services/scanning/gemini-card-reader.mjs';

test('Gemini keys are encrypted, administrator-only, never returned, and failed replacement retains the working key',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'gemini-settings-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const secrets=new Map();
 const pool={async query(sql,args=[]){if(sql.startsWith('SELECT ciphertext'))return {rows:secrets.has(args[0])?[{ciphertext:secrets.get(args[0])}]:[]};if(sql.startsWith('INSERT INTO mis_integration_secrets'))secrets.set(args[0],args[1]);return {rows:[]}}};
 const store=await createIntegrationSecretStore(pool,path.join(dir,'integration.key'));
 const app=express();app.use(express.json());let upstreamCalls=0,fail=false,lastUrl,lastHeaders;
 const service=registerGeminiScanSettings(app,{store,env:{},requireSession(req,res,next){if(!req.headers.authorization)return res.sendStatus(401);req.session={role:'super',permissions:{adminLevel:req.headers.authorization==='admin'?'Super Admin':'Manager'}};next()},requireAdministrator:requireMisAdministrator,
  async fetchImpl(url,options){upstreamCalls++;lastUrl=url;lastHeaders=options.headers;return {ok:!fail,status:fail?403:200,json:async()=>fail?{error:'unsafe upstream secret'}:{name:`models/${MODEL}`,supportedGenerationMethods:['generateContent']}}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close()});
 const url=`http://127.0.0.1:${server.address().port}/api/gemini-settings`;
 const request=(auth,body)=>fetch(url,{method:body?'POST':'GET',headers:{...(auth?{Authorization:auth}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await request()).status,401);assert.equal((await request('manager')).status,403);
 assert.equal((await request('manager',{enabled:true,apiKey:'secret-key-should-not-be-saved'})).status,403);assert.equal(upstreamCalls,0);
 const key='synthetic-gemini-secret-123456';
 assert.equal((await request('admin',{enabled:true,apiKey:'bad key'})).status,400);
 const response=await request('admin',{enabled:true,apiKey:'  '+key+'\n'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();assert.equal(data.enabled,true);assert.equal(data.configured,true);assert.ok(data.verifiedAt);assert.equal(JSON.stringify(data).includes(key),false);
 assert.equal(lastUrl.includes(key),false);assert.equal(lastHeaders['x-goog-api-key'],key);assert.equal([...secrets.values()].join('').includes(key),false);
 assert.equal((await store.read('gemini-scanning')).apiKey,key);
 fail=true;const rejected=await request('admin',{enabled:true,apiKey:'replacement-secret-123456789'});assert.equal(rejected.status,400);assert.equal(JSON.stringify(await rejected.json()).includes('unsafe upstream secret'),false);assert.equal((await service.getConfig()).apiKey,key);
 fail=false;assert.equal((await request('admin',{enabled:true})).status,200);
 assert.equal((await request('admin',{enabled:false})).status,200);assert.equal((await service.getConfig()).enabled,false);assert.equal((await service.getConfig()).apiKey,key);
 assert.equal((await request('admin')).status,200);assert.equal((await readFile(path.join(dir,'integration.key'))).length,32);
});

test('Gemini settings has a bookmarkable local route',()=>{
 assert.equal(requestedMisPage('?page=ocr-settings'),'Gemini OCR settings');
 assert.equal(misPageUrl('http://127.0.0.1:4174/','Gemini OCR settings'),'/?page=ocr-settings');
});
