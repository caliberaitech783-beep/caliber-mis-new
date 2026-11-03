import test from 'node:test';import assert from 'node:assert/strict';
import {CARD_GROUPS,cardReviewGroup,reviewGroupSummary,cardIssueGroups,matchesCardGroup,withAutoSaveFailures} from '../shared/scanning/scan-card-groups.mjs';
const draft={doorText:'V519',bookDate:'2026-11-03',location:'Jayant OC',assetId:'1',employeeId:'2',shiftId:'3',cardShift:'I',shiftHours:8,openingHmr:100,closingHmr:108,openingKmr:1000,closingKmr:1250,timeMode:'with',trips:[{equipmentName:'V101',loadingTime:'09:00',unloadingTime:'09:30',tripCount:1}],scanMachineSummary:[{equipmentName:'V101',tripCount:1}]};
const card=(id,extra={})=>({id,status:'review',draft:structuredClone(draft),checks:{errors:[],warnings:[]},raw_fields:{},...extra});
test('filled cards are not blank, while inherited batch headers alone do not create data',()=>{
 assert.equal(cardReviewGroup(card('header',{draft:{...draft,trips:[],scanMachineSummary:[]}}),'vehicle'),'orange');
 assert.equal(cardReviewGroup(card('blank',{draft:{bookDate:'2026-11-03',bookDateSource:'batch',location:'Jayant OC',cardShift:'I',shiftHours:8}}),'vehicle'),'red');
 assert.equal(cardReviewGroup(card('rejected',{status:'rejected'}),'vehicle'),'rejected');
 assert.ok(CARD_GROUPS.some(g=>g.id==='rejected'));
});
test('issue counters overlap without double-counting primary card statuses',()=>{
 const bad=card('bad',{draft:{...draft,assetId:'',employeeId:'',closingHmr:109,closingKmr:1251,scanMachineSummary:[{equipmentName:'V101',tripCount:2}]}});
 const groups=cardIssueGroups(bad,'vehicle');for(const g of ['wrong-door','wrong-caliber','wrong-hmr','wrong-kmr','mws-ted']){assert.ok(groups.includes(g));assert.equal(matchesCardGroup(bad,g,'vehicle'),true)}
 const counts=reviewGroupSummary([bad,card('good'),card('rejected',{status:'rejected'}),card('pending',{status:'queued'})],'vehicle');
 assert.equal(counts.total,4);assert.equal(counts.brown,1);assert.equal(counts.orange,1);assert.equal(counts.rejected,1);assert.equal(counts.pending,1);
 for(const g of groups)assert.equal(counts[g],1);
});
test('meter violations need attention and zero-difference readings remain valid',()=>{
 assert.equal(cardReviewGroup(card('over',{draft:{...draft,closingKmr:1251}}),'vehicle'),'brown');
 assert.equal(cardReviewGroup(card('idle',{draft:{...draft,closingHmr:100,closingKmr:1000}}),'vehicle'),'orange');
 const equipment=card('elb',{draft:{...draft,openingKmr:'',closingKmr:'',trips:[],scanMachineSummary:[]}});assert.equal(cardReviewGroup(equipment,'equipment'),'orange');
});
test('saved cards and extraction failures are distinct from draft readiness',()=>{
 assert.equal(cardReviewGroup(card('saved',{status:'posted'}),'vehicle'),'orange');
 assert.equal(cardReviewGroup(card('error',{status:'error'}),'vehicle'),'error');
 const draftCard=card('refused');draftCard.revision=1;
 const failed=withAutoSaveFailures([draftCard],new Map([['refused:1','Draft conflict']]))[0];assert.equal(cardReviewGroup(failed,'vehicle'),'brown');
 assert.equal(reviewGroupSummary([],'vehicle').canSaveAll,false);
});
