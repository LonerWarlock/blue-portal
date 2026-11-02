'use strict';

const API = 'https://openrouter.ai/api/v1';
const raster = new Set(['png', 'jpeg', 'jpg', 'webp']);
const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;

// Keep provider units. A token price is never a fixed quote for one image.
function priceLines(endpoints, model) {
  const lines = [];
  for (const endpoint of endpoints || []) for (const line of endpoint.pricing || []) {
    const cost = number(line.cost_usd);
    if (cost === undefined || !['image', 'megapixel', 'token', 'request'].includes(line.unit) || typeof line.billable !== 'string') continue;
    lines.push({ billable: line.billable, unit: line.unit, costUsd: cost, ...(line.variant ? { variant: String(line.variant).slice(0, 100) } : {}) });
  }
  if (!lines.some(line => line.billable === 'output_image')) {
    const output = number(model.pricing?.image_output ?? model.pricing?.image_token);
    if (output !== undefined) lines.push({ billable: 'output_image', unit: 'token', costUsd: output });
    const input = number(model.pricing?.prompt);
    if (input !== undefined && input > 0) lines.push({ billable: 'input_text', unit: 'token', costUsd: input });
  }
  return [...new Map(lines.map(line => [JSON.stringify(line), line])).values()];
}

/** @param {any[]} models @param {any[]} accountModels @param {Map<string, any[]>} endpoints @param {Set<string>} blocked */
function buildImageCatalogue(models, accountModels, endpoints = new Map(), blocked = new Set()) {
  const allowed = new Set(accountModels.flatMap(model => [model.id, model.provider_route_id, ...(model.aliases || [])]).filter(Boolean));
  const result = new Map();
  for (const model of models) {
    if (!model || typeof model.id !== 'string' || !/^[^\s/]+\/[^\s]+$/.test(model.id) || model.id.startsWith('openrouter/') || !model.architecture?.output_modalities?.includes('image')) continue;
    const pricing = priceLines(endpoints.get(model.id), model);
    const records = endpoints.get(model.id) || [];
    const textToRaster = records.some(endpoint => {
      const formats = endpoint.supported_parameters?.output_format?.values;
      const references = endpoint.supported_parameters?.input_references;
      return (!Array.isArray(formats) || formats.some(format => raster.has(format))) && !(Number(references?.min) > 0);
    });
    let unavailableReason = !allowed.has(model.id) && !allowed.has(model.canonical_slug) ? 'Not enabled in Blue’s provider account' : '';
    if (blocked.has(model.id) || blocked.has(model.canonical_slug)) unavailableReason = 'Temporarily unavailable in Blue';
    if (records.length && !textToRaster) unavailableReason = 'Requires reference images or vector output; not supported in this image flow yet';
    if (!pricing.some(line => line.billable === 'output_image' && line.costUsd > 0)) unavailableReason ||= 'Verified paid output pricing is unavailable';
    result.set(model.id, { id: model.id, displayName: String(model.name || model.id), imageGeneration: true, isFree: false,
      available: !unavailableReason, ...(unavailableReason ? { unavailableReason } : {}), pricing });
  }
  return [...result.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Public metadata only; never submits a generation, uses an API key, or accepts a server-supplied fetch URL.
 * Pricing lookup concurrency and total wait are bounded, then cached by the route.
 * @param {typeof fetch} fetcher
 */
async function loadPublicImageCatalogue(fetcher = fetch) {
  const response = await fetcher(API + '/models?output_modalities=image', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
  if (!response.ok) throw new Error('The public image catalogue is unavailable');
  const payload = await response.json();
  const models = (Array.isArray(payload.data) ? payload.data : []).filter(model => typeof model.id === 'string' && /^[^\s/]+\/[^\s]+$/.test(model.id) && !model.id.startsWith('openrouter/') && model.architecture?.output_modalities?.includes('image')).slice(0, 200);
  if (!models.length) throw new Error('The public image catalogue is empty');
  const endpoints = new Map();
  const deadline = AbortSignal.timeout(5000);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(12, models.length) }, async () => {
    while (cursor < models.length && !deadline.aborted) {
      const model = models[cursor++];
      try {
        const response = await fetcher(API + '/images/models/' + model.id.split('/').map(encodeURIComponent).join('/') + '/endpoints', {
          signal: AbortSignal.any([deadline, AbortSignal.timeout(2500)]), cache: 'no-store'
        });
        if (response.ok) { const value = await response.json(); if (Array.isArray(value.endpoints)) endpoints.set(model.id, value.endpoints); }
      } catch { /* General catalogue token pricing stays visible during endpoint metadata outages. */ }
    }
  }));
  return { models, endpoints: [...endpoints] };
}

module.exports = { buildImageCatalogue, loadPublicImageCatalogue, priceLines };
