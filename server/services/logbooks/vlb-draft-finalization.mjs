import {checkScanCard} from '../../routes/scanning/bulk-card-scanning.mjs';
import {decodeScanRow} from '../../domain/scanning/scan-text-storage.mjs';
import {canonicalSiteName} from '../../../shared/masters/site-location.mjs';
import {bookShiftCode} from '../../../shared/scanning/trip-card-rules.mjs';
import {scanFleetBlockingMessage} from '../../../shared/scanning/scan-fleet-assignment.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:409})};
// Caller holds the batch write lock and owns the transaction. Any invalid card
// rolls back every insertion; request keys make retries idempotent.
export async function finalizeVlbDrafts(client,batch,actor,ops){
 const saved=[];
 if((await client.query("SELECT to_regclass('mis_scan_batches') AS name")).rows[0]?.name){
  const entries=(await client.query("SELECT * FROM mis_scan_batches WHERE kind='vehicle' AND expected_context->>'bookDate'=$1 ORDER BY id FOR UPDATE",[batch.report_date])).rows.filter(row=>!row.expected_context?.deletedVlbBatch&&canonicalSiteName(row.expected_context?.location)===canonicalSiteName(batch.site)&&bookShiftCode(row.expected_context?.cardShift)===batch.shift);
  for(const entry of entries){
   if(entry.expected_context?.cancelled)continue;
   const cards=(await client.query('SELECT * FROM mis_scan_cards WHERE batch_id=$1 ORDER BY ordinal FOR UPDATE',[entry.id])).rows.map(decodeScanRow);
   for(const card of cards){
    if(['rejected','posted'].includes(card.status)||card.duplicate_of)continue;
    if(!['review','approved'].includes(card.status))fail(`Card ${card.ordinal} is still reading or failed extraction. Correct or reject it before logging the batch.`);
    const fleet=card.raw_fields?.fleetReview||card.raw_fields?.fleetBlock||card.raw_fields?.fleetCheckRequired?scanFleetBlockingMessage(card):'';if(fleet)fail(fleet);
    const check=await checkScanCard(client,'vehicle',card);
    if(check.errors.length||!check.data)fail(`Card ${card.ordinal}: ${check.errors.join(' ')}`);
    if(!(check.data.trips||[]).length&&card.draft.noTripsConfirmed!==true)fail(`Card ${card.ordinal}: confirm that this card has no trips.`);
    const data={...check.data,scanCardId:card.id,scanBatchId:entry.id,scanCardNumber:check.number||null,reviewedBy:actor,meterCorrectionHistory:card.raw_fields?.meterCorrectionHistory||[]};
    await ops.applyHours(data,actor);
    const record=await ops.insert(client,'vehicle',data,card.id,actor,{relock:false});
    await client.query("UPDATE mis_scan_cards SET status='posted',logbook_id=$1,checked_by=$2,checked_at=NOW(),revision=revision+1 WHERE id=$3",[record.id,actor,card.id]);saved.push(record);
   }
  }
 }
 const manual=(await client.query('SELECT * FROM mis_vlb_manual_drafts WHERE batch_id=$1 AND logbook_id IS NULL AND rejected_at IS NULL ORDER BY created_at,id FOR UPDATE',[batch.id])).rows;
 for(const draft of manual){
  const input={...draft.draft,trips:(draft.draft.trips||[]).filter(row=>row.equipmentName||row.loadingTime||row.unloadingTime||row.jobType||row.remark)};
  const data=await ops.resolve(client,'vehicle',input,{enforceEmployeeSite:true});
  data.duplicateReason=String(input.duplicateReason||'').trim();
  await ops.applyHours(data,actor);
  const record=await ops.insert(client,'vehicle',data,draft.id,actor,{relock:false});
  await client.query('UPDATE mis_vlb_manual_drafts SET logbook_id=$1,revision=revision+1 WHERE id=$2',[record.id,draft.id]);saved.push(record);
 }
 return saved;
}
