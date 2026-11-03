import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {registerProductionReports} from '../server/routes/reports/production-report-api.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {capacitySourceQuery,capacitySourceRows} from '../server/services/masters/oracle-capacity-source.mjs';
const columns={location:'SITE',make:'MAKE',model:'MODEL',capacity:'CAPACITY',averageDalaFactor:'AVG_FACTOR',jobType:'JOB',effectiveFrom:'FROM_DATE'};
test('Oracle capacity sync requires an explicit read-only mapping and rejects SQL fragments',()=>{
 assert.throws(()=>capacitySourceQuery({}),/not configured/);
 const env={ORACLE_CAPACITY_VIEW:'MIS.OB_TRIP_AVERAGE',ORACLE_CAPACITY_COLUMNS_JSON:JSON.stringify(columns)};
 const sql=capacitySourceQuery(env);assert.match(sql,/^SELECT SITE AS LOCATION/);assert.match(sql,/ FROM MIS.OB_TRIP_AVERAGE$/);
 for(const view of ['X; DELETE FROM EMPLOYEE','X WHERE 1=1','X--'])assert.throws(()=>capacitySourceQuery({...env,ORACLE_CAPACITY_VIEW:view}),/valid Oracle/);
 assert.throws(()=>capacitySourceQuery({...env,ORACLE_CAPACITY_COLUMNS_JSON:JSON.stringify({...columns,make:'MAKE FROM PASSWORDS'})}),/valid Oracle/);
});
test('Oracle capacity rows use the existing positive effective-dated capacity rules',()=>{
 const row={LOCATION:'Jayant OC',MAKE:'Volvo',MODEL:'FMX',CAPACITY:20,AVERAGE_DALA_FACTOR:18,JOB_TYPE:'OB',EFFECTIVE_FROM:'2026-11-03'};
 const [mapped]=capacitySourceRows([row]);assert.equal(mapped.capacity,20);assert.equal(mapped.averageDalaFactor,18);assert.equal(mapped.locationKey,'jayant ob');
 assert.throws(()=>capacitySourceRows([{...row,CAPACITY:-1}]));assert.throws(()=>capacitySourceRows([{...row,EFFECTIVE_FROM:'2026-02-30'}]));
});

test('Oracle capacity import is atomic, idempotent and never replaces an approved conflict',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE TABLE master_records(id BIGSERIAL PRIMARY KEY,master_name TEXT,record_data JSONB)');
 await db.query('INSERT INTO master_records(master_name,record_data) VALUES($1,$2)',['Equipment master',JSON.stringify({category:'Vehicle',door:'V519',make:'Volvo',model:'FMX',currentLocation:'Jayant OC'})]);
 const query=(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):!args&&sql.includes(';')?db.exec(sql):db.query(sql,args);
 const pool={query,connect:async()=>({query,release(){}})};
 const row={LOCATION:'Jayant OC',MAKE:'Volvo',MODEL:'FMX',CAPACITY:20,AVERAGE_DALA_FACTOR:18,JOB_TYPE:'OB',EFFECTIVE_FROM:'2026-11-03'};
 let incoming=capacitySourceRows([row]);
 const app=express();app.use(express.json());const auth=(q,r,n)=>{q.session={login:'test',role:'super',permissions:{adminLevel:'Admin'}};n()};
 registerProductionReports(app,{pool,protect:[auth],ensureBooks:async()=>{},readCapacitySource:async()=>incoming});app.use((e,q,r,n)=>r.status(e.status||400).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close()});
 const call=async()=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/capacity-master/sync-oracle',{method:'POST'});return {status:r.status,data:await r.json()}};
 const first=await call();assert.equal(first.status,200,JSON.stringify(first));assert.deepEqual(first.data,{added:1,unchanged:0});assert.deepEqual((await call()).data,{added:0,unchanged:1});
 incoming=capacitySourceRows([{...row,EFFECTIVE_FROM:'2026-11-04'},{...row,CAPACITY:21}]);const conflict=await call();assert.equal(conflict.status,409);assert.equal(Number((await db.query('SELECT count(*) n FROM mis_capacity_versions')).rows[0].n),1,'the preceding new version was rolled back');
 incoming=[];assert.equal((await call()).status,409);assert.equal(Number((await db.query('SELECT count(*) n FROM mis_capacity_versions')).rows[0].n),1);
});
