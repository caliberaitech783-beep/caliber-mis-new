import {prepareVlbFixture} from './operational-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import express from 'express';import {PGlite} from '@electric-sql/pglite';import {randomUUID} from 'node:crypto';
import {registerBulkCardScanning} from '../server/routes/scanning/bulk-card-scanning.mjs';import {LOG_BOOK_SCHEMA} from '../server/routes/logbooks/log-book.mjs';
import {canAutoSaveScanCard} from '../shared/scanning/scan-auto-save.mjs';
process.env.VLB_TWO_STAGE_BATCHES='0'; // legacy single-step batch expectations
const valid={doorText:'V321',bookDate:'2026-12-19',location:'Sasti OC',cardShift:'I',assetId:'1',employeeId:'2',shiftId:'3',workOrderId:'5',shiftHours:8,openingHmr:0,closingHmr:6,openingKmr:0,closingKmr:20,aFormNo:'75',jobCardNo:'E75',timeMode:'with',trips:[{equipmentName:'D19',loadingTime:'09:02',unloadingTime:'09:09',tripCount:1}],scanMachineSummary:[{equipmentName:'D19',tripCount:1}]};
test('automatic saving requires complete valid values while Work Order remains optional',()=>{
 const card={status:'review',draft:valid,raw_fields:{},checks:{errors:[],warnings:[]}};
 assert.equal(canAutoSaveScanCard(card,'vehicle'),true);
 assert.equal(canAutoSaveScanCard({...card,raw_fields:{fleetBlock:{message:'Verify the machine first.'}}},'vehicle'),false);
 assert.equal(canAutoSaveScanCard({...card,raw_fields:{fleetRejection:{message:'Original needs recovery.'}}},'vehicle'),false);
 assert.equal(canAutoSaveScanCard({...card,context_mismatch:['Wrong date.']},'vehicle'),false);
 assert.equal(canAutoSaveScanCard({...card,draft:{...valid,workOrderId:''},checks:{errors:[],warnings:['No Work Order selected. Confirm whether this card requires a contract.']}},'vehicle'),true);
 for(const c of [{...card,status:'posted'},{...card,status:'rejected'},{...card,checks:null},{...card,draft:{...valid,employeeId:''}},{...card,checks:{warnings:['Working hours exceed shift.']}},{...card,checks:{errors:['Duplicate scan.']}}])assert.equal(canAutoSaveScanCard(c,'vehicle'),false);
});
test('automatic saving retains complete and incomplete drafts without posting or archiving',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE TABLE master_records(id BIGINT PRIMARY KEY,master_name TEXT,record_data JSONB);'+LOG_BOOK_SCHEMA);
 const masters=[[1,'Equipment master',{category:'Vehicle',door:'V321',currentLocation:'Sasti OC'}],[2,'C-Dir Employee master',{name:'TEST DRIVER',empId:'EMP100'}],[3,'Shift Master',{site:'Sasti OC',shiftName:'Shift I'}],[4,'Equipment master',{category:'Equipment',door:'E1',currentLocation:'Sasti OC'}],[5,'Work Order master',{site:'Sasti OC',workOrderNo:'WO1'}]];
 masters.push([6,'Equipment master',{category:'Equipment',door:'D19',currentLocation:'Sasti OC'}]);
 for(const [id,name,data]of masters)await db.query('INSERT INTO master_records VALUES($1,$2,$3)',[id,name,JSON.stringify(data)]);
 let tail=Promise.resolve();const query=(q,a)=>q.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):!a&&q.includes(';')?db.exec(q):db.query(q,a);
 const pool={query,connect:async()=>{const previous=tail;let done;tail=new Promise(r=>done=r);await previous;return {query,release(){done()}}}};
 const app=express();app.use(express.json());const session=(q,s,n)=>{if(!q.headers.authorization)return s.sendStatus(401);q.session={login:'test-admin'};n()},admin=(q,s,n)=>q.headers.authorization==='admin'?n():s.sendStatus(403);
 let pulseAvailable=true;let archives=0;const service=registerBulkCardScanning(app,{pool,requireSession:session,requireAdministrator:admin,readHours:async()=>{if(!pulseAvailable)throw Error('Pulse offline');return {breakdownHours:0}},ocr:{close(){}},archiveSavedBatch:async(b,rows)=>{assert.ok(rows.every(r=>r.status==='posted'));archives++;return {status:'saved'}}});await service.start();await prepareVlbFixture(db,valid);t.after(()=>service.stop());app.use((e,q,s,n)=>s.status(e.status||500).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close()});
 const call=async(id,revision=1,auth='admin')=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/scan-cards/'+id+'/auto-save',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({revision})});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():null}};
 const batch=randomUUID(),context={bookDate:valid.bookDate,location:valid.location,cardShift:valid.cardShift};await db.query('INSERT INTO mis_scan_batches(id,kind,name,created_by) VALUES($1,$2,$3,$4)',[batch,'vehicle','Auto save test','test-admin']);
 const add=async(ordinal,draft,hash=randomUUID())=>{const id=randomUUID();await db.query("INSERT INTO mis_scan_cards(id,batch_id,ordinal,filename,image,image_hash,draft,raw_fields,status) VALUES($1,$2,$3,'test.png',$4,$5,$6,$7::jsonb,'review')",[id,batch,ordinal,Buffer.from('retained image'),hash,JSON.stringify(draft),JSON.stringify({extractionDraft:draft})]);return id};
 const first=await add(1,valid),second=await add(2,{...valid,aFormNo:'76',employeeId:''});
 assert.equal((await call(first)).status,409,'legacy cards need a selected context');
 const setupRoot='http://127.0.0.1:'+server.address().port+'/api/scan-batches/'+batch;
 for(const [route,body] of [['/context',{expectedContext:context}],['/validate-context',{action:'proceed'}]]){const r=await fetch(setupRoot+route,{method:'POST',headers:{Authorization:'admin','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.text());}
 for(const id of [first,second]){const r=await call(id);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.status,'draft');assert.equal((await db.query('SELECT status FROM mis_scan_cards WHERE id=$1',[id])).rows[0].status,'review');}
 assert.equal((await call(first,999)).status,409);
 assert.equal((await call(first,1,'normal')).status,403);assert.equal((await call(first,1,'')).status,401);
 assert.equal(Number((await db.query('SELECT count(*) n FROM mis_log_books')).rows[0].n),0);
 assert.equal(archives,0);
 assert.deepEqual(Buffer.from((await db.query('SELECT image FROM mis_scan_cards WHERE id=$1',[first])).rows[0].image),Buffer.from('retained image'));
});
