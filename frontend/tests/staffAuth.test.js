import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffLogin, authorizeItemRemoval } from '../src/api.js';
import { saveCatalogItem } from '../src/utils/catalog.js';
test('login and removal use backend authentication and audit routes',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push([new URL(url).pathname,options.method,JSON.parse(options.body)]);
  return {ok:true,json:async()=>({status:'success',staff:{staff_id:'STAFF01',name:'Cashier'}})};
 };
 try{
  await staffLogin(' STAFF01 ','0012');
  await authorizeItemRemoval('1006','STAFF01','0012');
  assert.deepEqual(calls,[
   ['/api/auth/login','POST',{staff_id:'STAFF01',pin:'0012'}],
   ['/api/cart/override/item','DELETE',{item_id:1006,staff_id:'STAFF01',pin:'0012'}],
  ]);
 }finally{globalThis.fetch=original;}
});
test('invalid credentials preserve backend error and 401 for session logout',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({status:'error',message:'Authentication failed: Invalid Staff ID or PIN.'})});
 try{
  await assert.rejects(staffLogin('STAFF01','bad'),e=>e.status===401&&/Invalid Staff ID or PIN/.test(e.message));
  await assert.rejects(authorizeItemRemoval(1006,'STAFF01','bad'),e=>e.status===401);
 }finally{globalThis.fetch=original;}
});
test('Edit Catalog cannot bypass authorized price-change workflow',async()=>{
 let writes=0;
 const api={fetchBundles:async()=>({}),fetchInventory:async()=>[{item_id:1006,name:'Hoodie',unit_price:45}],updateItem:async()=>{writes++;}};
 await assert.rejects(saveCatalogItem('edit',1006,{name:'Hoodie',unit_price:40},null,api),/Use Manager → Change Price/);
 assert.equal(writes,0);
});
