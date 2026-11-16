import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveStaffPriceChange } from '../src/utils/priceChange.js';
import { authorizePriceChange } from '../src/api.js';
const input = { itemId: '1006', expectedPrice: 45, newPrice: '40.00', reason: ' Sale ', staffId: ' STAFF01 ', pin: '0012' };
function fixture() {
 const calls=[];
 const api={fetchInventory:async()=>[{item_id:1006,name:'Hoodie',unit_price:45}],
  authorizePriceChange:async data=>{calls.push(['authorize',data]);return {authorized_by:'Manager'};},
  updateItem:async(...args)=>{calls.push(['update',...args]);return {};}};
 return {api,calls};
}
test('price change approves and audits original/new/reason before updating catalog', async()=>{
 const {api,calls}=fixture();
 const result=await saveStaffPriceChange(input,api);
 assert.deepEqual(calls,[['authorize',{item_id:1006,staff_id:'STAFF01',pin:'0012',original_price:45,new_price:40,reason:'Sale'}],['update',1006,{unit_price:40}]]);
 assert.equal(result.original_price,45);assert.equal(result.new_price,40);assert.equal(result.reason,'Sale');
});
test('invalid credentials and invalid input do not update the price',async()=>{
 const {api,calls}=fixture();
 api.authorizePriceChange=async()=>{throw new Error('Invalid staff credentials');};
 await assert.rejects(saveStaffPriceChange(input,api),/Invalid staff/);
 assert.deepEqual(calls,[]);
 for(const values of [{newPrice:'NaN'},{newPrice:'Infinity'},{newPrice:'-1'},{newPrice:'1.001'},{newPrice:''},{reason:' '},{pin:''}])
  await assert.rejects(saveStaffPriceChange({...input,...values},api));
});
test('stale and unchanged prices stop before authorization; partial failure is explicit',async()=>{
 const {api,calls}=fixture();
 await assert.rejects(saveStaffPriceChange({...input,expectedPrice:50},api),/price has changed/);
 await assert.rejects(saveStaffPriceChange({...input,newPrice:'45'},api),/matches the current/);
 assert.deepEqual(calls,[]);
 api.updateItem=async()=>{throw new Error('Connection lost');};
 await assert.rejects(saveStaffPriceChange(input,api),/approval was recorded, but the catalog price update did not complete/);
});
test('price approval request matches existing Flask endpoint',async()=>{
 const original=globalThis.fetch;
 const payload={staff_id:'STAFF01',pin:'0012',item_id:1006,original_price:45,new_price:40,reason:'Sale'};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'http://localhost:5001/api/cart/override/price');assert.equal(options.method,'PUT');
  assert.deepEqual(JSON.parse(options.body),payload);
  return {ok:true,json:async()=>({status:'success',new_price:40})};
 };
 try{await authorizePriceChange(payload);}finally{globalThis.fetch=original;}
});
