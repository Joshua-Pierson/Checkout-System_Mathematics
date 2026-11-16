import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibilityChanged, saveEligibilityChanges } from '../src/utils/eligibility.js';
import { updateDiscountEligibility } from '../src/api.js';
const original = [
 {category:'art supplies',student_eligible:false,employee_eligible:true},
 {category:'drinks',student_eligible:false,employee_eligible:true},
];
test('eligibility saves only changed categories and preserves both checkbox states',async()=>{
 const drafts=[{...original[0],student_eligible:true,employee_eligible:false}, {...original[1]}];
 const calls=[];
 const result=await saveEligibilityChanges(original,drafts,async(...args)=>{calls.push(args);});
 assert.equal(eligibilityChanged(drafts[0],original[0]),true);
 assert.deepEqual(calls,[['art supplies',{student_eligible:true,employee_eligible:false}]]);
 assert.equal(result.saved.length,1);assert.deepEqual(result.failed,[]);
 assert.equal(original[0].student_eligible,false);
});
test('partial failure preserves successful saves and retry only resends failed changes',async()=>{
 const drafts=original.map(row=>({...row,student_eligible:true}));
 const result=await saveEligibilityChanges(original,drafts,async(category)=>{if(category==='drinks')throw new Error('Database unavailable');});
 assert.equal(result.saved[0].category,'art supplies');
 assert.deepEqual(result.failed,[{category:'drinks',message:'Database unavailable'}]);
 const updated=original.map(row=>result.saved.find(saved=>saved.category===row.category)||row);
 const calls=[];
 await saveEligibilityChanges(updated,drafts,async(category)=>{calls.push(category);});
 assert.deepEqual(calls,['drinks']);
});
test('category API encodes names and sends boolean flags including false',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'http://localhost:5001/api/discounts/categories/art%20supplies');
  assert.equal(options.method,'PUT');
  assert.deepEqual(JSON.parse(options.body),{student_eligible:false,employee_eligible:false});
  return {ok:true,json:async()=>({status:'success'})};
 };
 try{await updateDiscountEligibility('art supplies',{student_eligible:false,employee_eligible:false});}
 finally{globalThis.fetch=originalFetch;}
});
