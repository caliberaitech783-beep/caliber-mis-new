import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionExpiryGuard} from '../src/services/auth/session-expiry-guard.mjs';
const init=token=>({headers:{Authorization:'Bearer '+token}});
test('service-specific unauthorized responses do not sign out a valid session',async()=>{
 const check=createSessionExpiryGuard({getToken:()=>'current',fetchImpl:async()=>({status:204})});
 assert.equal(await check('/api/local-scanner/status',init('current'),{status:401}),false);
});
test('confirmed revoked sessions sign out, while restarts and network failures retain local sign-in',async()=>{
 for(const status of [401,403,502,503,504]){
  const check=createSessionExpiryGuard({getToken:()=>'current',fetchImpl:async()=>({status})});
  assert.equal(await check('/api/masters',init('current'),{status:401}),status===401);
 }
 const check=createSessionExpiryGuard({getToken:()=>'current',fetchImpl:async()=>{throw Error('offline')}});
 assert.equal(await check('/api/masters',init('current'),{status:401}),false);
});
test('late responses and requests without the current bearer token cannot clear the current login',async()=>{
 let token='current',calls=0,finish;
 const check=createSessionExpiryGuard({getToken:()=>token,fetchImpl:async()=>{calls++;return new Promise(r=>finish=r)}});
 for(const headers of [{},init('previous')])assert.equal(await check('/api/masters',headers,{status:401}),false);
 assert.equal(calls,0);
 const pending=check('/api/masters',init('current'),{status:401});token='new-login';finish({status:401});assert.equal(await pending,false);
});
test('simultaneous failures share a heartbeat check',async()=>{
 let finish,calls=0;const check=createSessionExpiryGuard({getToken:()=>'current',fetchImpl:()=>{calls++;return new Promise(r=>finish=r)}});
 const pending=[check('/api/a',init('current'),{status:401}),check('/api/b',init('current'),{status:401})];finish({status:401});assert.deepEqual(await Promise.all(pending),[true,true]);assert.equal(calls,1);
 assert.equal(await check('/api/session-heartbeat',init('current'),{status:401}),true);assert.equal(calls,1);
});
