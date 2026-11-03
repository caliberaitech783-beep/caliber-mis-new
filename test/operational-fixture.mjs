import {VLB_BATCH_SCHEMA} from '../server/domain/logbooks/vlb-batch-policy.mjs';
import {randomUUID} from 'node:crypto';
import {canonicalSiteName} from '../shared/masters/site-location.mjs';
import {vlbRecordShift} from '../shared/logbooks/vlb-batch-format.mjs';
// Arrange a permitted batch for tests of logbook/scanner behavior. Batch
// ownership, locking and approval behavior have their own integration tests.
export async function prepareVlbFixture(db,input={},login='test-admin'){
 const date=input.bookDate||input.date,site=canonicalSiteName(input.location||input.site),shift=vlbRecordShift(input)||'S1';
 if(!date||date<'2026-11-01'||!site)return;
 await db.query('UPDATE mis_vlb_batches SET closed_at=COALESCE(closed_at,NOW()) WHERE site=$1 AND (book_date<>$2 OR shift<>$3)',[site,date,shift]);
 const existing=(await db.query('SELECT id FROM mis_vlb_batches WHERE site=$1 AND book_date=$2 AND shift=$3',[site,date,shift])).rows[0];
 if(existing){await db.query('UPDATE mis_vlb_batches SET closed_at=NULL,amendment_by=NULL,trial_reopened_until=NULL WHERE id=$1',[existing.id]);return;}
 await db.query('INSERT INTO mis_vlb_batches(id,name,site,book_date,shift,sequence,created_by,creator_login,request_key,continuous_entry,saved_lock_policy) VALUES($1,$2,$3,$4,$5,1,NULL,$6,$7,TRUE,TRUE)',[randomUUID(),'FIXTURE/'+site+'/'+date+'/'+shift,site,date,shift,login,randomUUID()]);
}
export async function extendOperationalScanFixture(db){
 await db.exec(`CREATE TABLE IF NOT EXISTS mis_log_books(id BIGINT PRIMARY KEY,book_date DATE);
 ALTER TABLE mis_scan_batches ADD COLUMN IF NOT EXISTS expected_context JSONB DEFAULT '{"bookDate":"2026-12-01"}';
 ALTER TABLE mis_scan_cards ADD COLUMN IF NOT EXISTS draft JSONB DEFAULT '{}';
 ALTER TABLE mis_scan_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT '2026-12-01T00:00:00Z';
 ALTER TABLE mis_scan_cards ADD COLUMN IF NOT EXISTS logbook_id BIGINT;`);
}

// Upload/reader protocol tests predate mandatory site batches. Arrange their
// selected parent explicitly; authorization and lock behavior are tested by
// vlb-draft-workflow and batch lifecycle tests without this middleware.
export function arrangeScanParent(db){return async(req,res,next)=>{try{
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 let context=req.body?.expectedContext,kind=req.body?.kind;
 const match=req.path.match(/^\/api\/scan-(batches|cards)\/([a-f0-9-]{36})/i);
 if(!context&&match){const id=match[1]==='cards'?(await db.query('SELECT batch_id FROM mis_scan_cards WHERE id=$1',[match[2]])).rows[0]?.batch_id:match[2];if(id){const batch=(await db.query('SELECT kind,expected_context FROM mis_scan_batches WHERE id=$1',[id])).rows[0];context=batch?.expected_context;kind=batch?.kind;}}
 if(kind==='vehicle'&&context?.bookDate&&context.location&&context.cardShift){if(!(await db.query("SELECT to_regclass('mis_vlb_batches') AS name")).rows[0]?.name)await db.exec(VLB_BATCH_SCHEMA);await prepareVlbFixture(db,context);}
 next();
 }catch(e){next(e)}}}
