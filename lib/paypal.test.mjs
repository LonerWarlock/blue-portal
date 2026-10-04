import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const keys = ['PAYPAL_ENV','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET'];
const savedEnv = Object.fromEntries(keys.map(key => [key,process.env[key]]));
process.env.PAYPAL_ENV = 'sandbox';
process.env.PAYPAL_CLIENT_ID = 'test-client-not-a-real-credential';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret-not-a-real-credential';
const { capturePaypalOrder, getPaypalOrder } = await import('./paypal.ts');
test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key,value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function mockProvider(payload, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(String(url).startsWith('https://api-m.sandbox.paypal.com/'));
    calls.push({url:String(url),method:options.method,requestId:options.headers?.['PayPal-Request-Id'],prefer:options.headers?.Prefer});
    if (String(url).endsWith('/v1/oauth2/token')) return Response.json({access_token:'test-only-token',expires_in:300});
    return Response.json(payload,{status});
  };
  return calls;
}
const order = {
  id:'TEST_ORDER', status:'COMPLETED', payer:{email_address:'payer@example.invalid',payer_id:'TEST_PAYER'},
  purchase_units:[{custom_id:'nonce',invoice_id:'nonce',payments:{captures:[{
    id:'TEST_CAPTURE',status:'COMPLETED',amount:{currency_code:'USD',value:'5.33'},
  }]}}],
};

test('capture preserves completed provider evidence and an idempotent request ID',async()=>{
  const calls = mockProvider(order);
  const result = await capturePaypalOrder('TEST_ORDER');
  assert.equal(result.captureStatus,'COMPLETED'); assert.equal(result.captureId,'TEST_CAPTURE');
  assert.equal(result.purchaseUnitCount,1); assert.equal(result.captureCount,1);
  assert.equal(result.currency,'USD'); assert.equal(result.grossAmount,'5.33');
  assert.equal(calls.at(-1).method,'POST'); assert.equal(calls.at(-1).requestId,'capture-TEST_ORDER');
  assert.equal(calls.at(-1).prefer,'return=representation');
});
test('reconciliation retrieves evidence with GET and cannot charge again',async()=>{
  const calls = mockProvider(order);
  const result = await getPaypalOrder('TEST_ORDER');
  assert.equal(result.orderId,'TEST_ORDER'); assert.equal(result.customId,'nonce');
  assert.equal(result.invoiceId,'nonce'); assert.equal(result.captureStatus,'COMPLETED');
  assert.equal(calls.at(-1).method,'GET'); assert.equal(calls.at(-1).requestId,undefined);
});
test('pending and ambiguous captures remain distinguishable for fail-closed settlement',async()=>{
  const pending = structuredClone(order);
  pending.purchase_units[0].payments.captures[0].status = 'PENDING';
  mockProvider(pending);
  assert.equal((await getPaypalOrder('TEST_ORDER')).captureStatus,'PENDING');
  const multiple = structuredClone(order);
  multiple.purchase_units.push(structuredClone(multiple.purchase_units[0]));
  multiple.purchase_units[0].payments.captures.push(structuredClone(multiple.purchase_units[0].payments.captures[0]));
  mockProvider(multiple);
  const result = await getPaypalOrder('TEST_ORDER');
  assert.equal(result.purchaseUnitCount,2); assert.equal(result.captureCount,2);
});
test('provider retrieval failure never invents a completed payment',async()=>{
  mockProvider({message:'Not found'},404);
  await assert.rejects(getPaypalOrder('TEST_ORDER'),/Not found/);
});
