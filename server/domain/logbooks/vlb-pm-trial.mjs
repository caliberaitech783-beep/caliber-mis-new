import {auditVlbBatch,batchFail} from './vlb-batch-policy.mjs';
export const VLB_PM_TRIAL_ID='vlb-pm-trial-20261031';
// Explicit production opt-in; a durable row prevents redeploys extending the trial.
export async function activateVlbPmTrial(){
 throw Object.assign(new Error('Site PM approval is required. Trial reopening without approval is discontinued.'),{status:409});
}
export async function vlbPmTrial(client){
 const row=(await client.query('SELECT ends_at,started_at<=clock_timestamp() AND clock_timestamp()<ends_at AS active FROM mis_vlb_pm_trials WHERE id=$1',[VLB_PM_TRIAL_ID])).rows[0];
 return {active:false,endsAt:row?.ends_at||null};
}
