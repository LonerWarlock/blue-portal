'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {accountModelRows}=require('./openrouterAccountModels.cjs');
test('cheap dedicated image models survive the image-output account query without using a public catalogue',async()=>{
  const calls=[];const rows=await accountModelRows('test-key',async(url,init)=>{calls.push({url,init});return Response.json({data:url.includes('?')?[{id:'vendor/cheap-image'},{id:'vendor/multimodal'}]:[{id:'vendor/chat'},{id:'vendor/multimodal'}]});});
  assert.deepEqual(rows.map(row=>row.id),['vendor/chat','vendor/multimodal','vendor/cheap-image']);assert.equal(calls.length,2);
  assert.ok(calls.every(call=>call.url.startsWith('https://openrouter.ai/api/v1/models/user')&&call.init.headers.Authorization==='Bearer test-key'));
});
test('neither modality view can hide extra models from exact-key verification',async()=>{
  const rows=await accountModelRows('test-key',async url=>Response.json({data:[{id:url.includes('?')?'other/image':'selected/chat'}]}));
  assert.equal(new Set(rows.map(row=>row.id)).size,2);
});
test('account restrictions and catalogue failures remain fail-closed',async()=>{
  const restricted=await accountModelRows('test-key',async()=>Response.json({data:[]}));assert.deepEqual(restricted,[]);
  await assert.rejects(accountModelRows('test-key',async url=>url.includes('?')?Response.json({error:'blocked'},{status:403}):Response.json({data:[{id:'selected/chat'}]})),error=>error.status===403);
});
