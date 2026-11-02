import test from 'node:test';
import assert from 'node:assert/strict';
import { imageGenerationModels, isPaidImageModel, modelsForAccess, normalizeOpenRouterModels, publicModel } from './openrouter.ts';

const base = { id: 'google/image', name: 'Image model', architecture: { input_modalities: ['text'], output_modalities: ['image'] }, pricing: { prompt: '0', completion: '0', image_output: '0.00004' } };
test('paid image-only models survive normalization without acquiring coding access', () => {
  const rows = normalizeOpenRouterModels([base]);
  assert.equal(rows.length, 1);
  assert.equal(imageGenerationModels(rows).length, 1);
  assert.equal(modelsForAccess(rows, 'full').length, 0);
  assert.equal(modelsForAccess(rows, 'trial').length, 0);
});
test('vision input cannot claim image generation and zero text prices cannot hide paid output images', () => {
  assert.equal(isPaidImageModel({ ...base, architecture: { input_modalities: ['image','text'], output_modalities: ['text'] } }), false);
  assert.equal(publicModel(base).isFree, false);
  assert.equal(publicModel({ ...base, pricing: { ...base.pricing, image_output: undefined, image_token: '0.01' } }).isFree, false);
});
test('free, unpriced, invalid and variable-priced models stay out of the paid image picker', () => {
  for (const pricing of [{ prompt:'0', completion:'0', image_output:'0' }, {}, { image_output:'-1' }, { image_output:'not-a-price' }]) {
    assert.equal(isPaidImageModel({ ...base, pricing }), false);
  }
  assert.equal(isPaidImageModel({ ...base, id:'openrouter/auto' }), false);
});
test('text-tool catalogue and its free access rules stay independent of image discovery', () => {
  const chat = { id:'vendor/chat', supported_parameters:['tools'], architecture:{output_modalities:['text']}, pricing:{prompt:'0',completion:'0'} };
  const rows = normalizeOpenRouterModels([base,chat]);
  assert.deepEqual(modelsForAccess(rows,'trial').map(row=>row.id),['vendor/chat']);
  assert.deepEqual(imageGenerationModels(rows).map(row=>row.id),['google/image']);
});
