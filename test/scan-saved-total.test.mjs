import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applySavedScanCard,scanBatchReport} from '../shared/scanning/scan-batch-report.mjs';
const batch={id:'batch',kind:'vehicle'};
test('confirmed saves update the combined total immediately for corrected and already-valid cards',()=>{
 const cards=['okay','corrected'].map((id,i)=>({id,batch_id:batch.id,ordinal:i+1,status:'review',draft:{totalTrips:999}}));
 const records=cards.map((card,i)=>({id:i+1,book_no:'BOOK-'+i,data:{scanCardId:card.id,scanBatchId:batch.id,totalTrips:i+1,totalWorkingHmr:2,totalRunningKmr:10}}));
 let rows=cards.map((card,i)=>i===0?applySavedScanCard(card,records[i]):card);
 assert.equal(scanBatchReport(batch,rows).counts.saved,1);
 rows=rows.map((card,i)=>applySavedScanCard(card,records[i]));
 const report=scanBatchReport(batch,rows);assert.equal(report.counts.saved,2);assert.equal(report.counts.pending,0);assert.equal(report.totals.trips,3);
 assert.equal(cards[0].status,'review');
 assert.equal(applySavedScanCard(cards[0],{...records[0],data:{...records[0].data,scanCardId:'wrong'}}),cards[0]);
 assert.equal(applySavedScanCard(cards[0],{...records[0],data:{...records[0].data,scanBatchId:'other'}}),cards[0]);
});

test('the scanning page never posts complete cards automatically',()=>{
 const source=readFileSync(new URL('../src/pages/scanning/bulk-card-scanning.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/api\('\/api\/scan-cards\/'\+next.id\+'\/auto-save'/);
 assert.match(source,/Save &amp; log batch/);
});
