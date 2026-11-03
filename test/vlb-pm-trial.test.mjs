import test from 'node:test';import assert from 'node:assert/strict';
import {activateVlbPmTrial,vlbPmTrial} from '../server/domain/logbooks/vlb-pm-trial.mjs';
test('historical trials cannot bypass mandatory site PM approval',async()=>{
 const client={query:async()=>({rows:[{active:true,ends_at:'2099-01-01'}]})};
 assert.equal((await vlbPmTrial(client)).active,false);
 await assert.rejects(activateVlbPmTrial(),/PM approval is required/);
});
