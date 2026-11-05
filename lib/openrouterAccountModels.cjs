'use strict';

/** OpenRouter's default account catalogue is chat-centric. Query image output
 * separately with the SAME credential; union both before exact-key checks.
 * This preserves account preferences/guardrails and detects hidden extra models.
 * @param {string} key @param {typeof fetch} fetcher
 * @param {(counts: number[]) => void} [observe]
 */
async function accountModelRows(key, fetcher = fetch, observe) {
  const pages = await Promise.all(['', '?output_modalities=image'].map(async query => {
    const response = await fetcher('https://openrouter.ai/api/v1/models/user' + query, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Object.assign(new Error(`OpenRouter credential catalogue failed (${response.status})`), { status: response.status });
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error('OpenRouter returned an invalid credential catalogue');
    return payload.data;
  }));
  observe?.(pages.map(rows => rows.length));
  return [...new Map(pages.flat().filter(row => row && typeof row.id === 'string').map(row => [row.id, row])).values()];
}

module.exports = { accountModelRows };
