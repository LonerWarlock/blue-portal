'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { buildImageCatalogue, loadPublicImageCatalogue, priceLines } = require('./imageModelCatalog.cjs');
const model = id => ({ id, name: id, architecture: { output_modalities: ['image'] }, pricing: { image_output: '0.000008' } });
test('the entire live image-output catalogue is listed without an original-model allowlist', () => {
  const models = ['sourceful/new-model', 'bytedance/seedream', 'openai/image', 'recraft/vector'].map(model);
  const rows = buildImageCatalogue([...models, { ...model('vision/only'), architecture: { input_modalities: ['image'], output_modalities: ['text'] } }, model('openrouter/auto')], [models[2]]);
  assert.equal(rows.length, 4); assert.equal(rows.filter(row => row.available).length, 1);
  assert.match(rows.find(row => row.id === 'sourceful/new-model').unavailableReason, /provider account/);
  assert.equal(rows.every(row => row.pricing[0].unit === 'token'), true);
});
test('endpoint prices preserve units, tiers and extra input costs; no fake per-image token quote', () => {
  const lines = priceLines([{ pricing: [
    { billable:'output_image',unit:'image',cost_usd:.04 }, { billable:'output_image',unit:'image',cost_usd:.08,variant:'4k' },
    { billable:'output_image',unit:'megapixel',cost_usd:.02 }, { billable:'input_text',unit:'token',cost_usd:.000002 },
    { billable:'output_image',unit:'image',cost_usd:-1 }, { billable:'output_image',unit:'invalid',cost_usd:1 }
  ] }], model('new/image'));
  assert.equal(lines.length, 4); assert.equal(lines[1].variant,'4k'); assert.equal(lines[3].costUsd,.000002);
  assert.equal(priceLines([],model('fallback/image'))[0].unit,'token');
});
test('account and safety restrictions cannot be bypassed by the public catalogue', () => {
  const models = ['new/raster', 'new/vector', 'new/edit', 'new/blocked'].map(model);
  const endpoints = new Map([
    ['new/vector',[{supported_parameters:{output_format:{values:['svg']}}}]],
    ['new/edit',[{supported_parameters:{input_references:{min:1}}}]]
  ]);
  const rows = buildImageCatalogue(models, models, endpoints, new Set(['new/blocked']));
  assert.equal(rows.find(row => row.id === 'new/raster').available,true);
  for(const id of ['new/vector','new/edit','new/blocked']) assert.equal(rows.find(row => row.id === id).available,false);
});
test('discovery uses fixed public metadata endpoints only, with bounded parallel pricing lookup', async () => {
  let active=0,peak=0; const urls=[];
  const data=Array.from({length:28},(_,index)=>model('vendor/model-'+index));
  const result=await loadPublicImageCatalogue(async(url,init)=>{
    urls.push(url);assert.equal(init.method,undefined);assert.equal(init.headers,undefined);
    if(url.endsWith('/models?output_modalities=image'))return Response.json({data});
    active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
    return Response.json({endpoints:[{pricing:[{billable:'output_image',unit:'image',cost_usd:.02}]}]});
  });
  assert.equal(result.models.length,28);assert.equal(result.endpoints.length,28);assert.ok(peak<=12);
  assert.equal(urls.length,29);assert.ok(urls.every(url=>url.startsWith('https://openrouter.ai/api/v1/')));
});
