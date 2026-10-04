// Execute the real route handlers with isolated auth/database/provider adapters.
// No network requests, real users, payment orders or charges are created.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as plans from './blueSubscriptionPlans.ts';

const nativeRequire = createRequire(import.meta.url);
const user = { id:'00000000-0000-4000-8000-000000000001', email:'test@example.invalid' };
const next = { NextResponse: { json: (body, options={}) => Response.json(body,options),
  redirect: (url,status=303) => new Response(null,{status,headers:{Location:String(url)}}) } };
function adapter(session) {
  const writes = [], rpcs = [];
  const admin = { auth:{getUser:async()=>({data:{user},error:null})},
    from(table) {
      const result = { data: table==='checkout_sessions' ? session : table==='wallets' ? {balance:200} : null, error:null };
      const chain = {
        select(){return this}, eq(){return this}, limit(){return this},
        insert(value){writes.push({table,value});result.data={id:'test-session'};return this},
        update(value){writes.push({table,value});return this},
        upsert(value){writes.push({table,value});return this},
        single:async()=>result, maybeSingle:async()=>result,
        then(resolve,reject){return Promise.resolve(result).then(resolve,reject)},
      }; return chain;
    },
    async rpc(name,args){ rpcs.push({name,args});return {data:{status:'completed'},error:null}; }
  };
  return {admin,writes,rpcs};
}
async function route(path, db, extras={}) {
  const source = await readFile(new URL(`../app/api/checkout/${path}/route.ts`,import.meta.url),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const modules = {
    'next/server':next, '@/lib/supabaseAdmin':{supabaseAdmin:db.admin},
    '@/lib/trafficControl':{checkRateLimit:async()=>({allowed:true}),requestIp:()=> 'test',rateLimitHeaders:()=>({})},
    '@/lib/blueSubscriptionPlans':plans, '@/lib/bluePayg':{getBearerToken:()=> 'test'},
    '@/lib/paymentSecurity':{payuRequestHash:()=> 'test-signature',safeInternalUrl:()=>new URL('https://test.invalid/console'),
      matchesExpectedPayuPayment:()=>true,validPayuCallbackSignature:()=>true,
      parsePayuForm:()=>({key:'test-key',txnid:'test-provider-order',status:'success',mihpayid:'test-transaction',email:user.email})},
    '@/lib/paypal':{capturePaypalOrder:()=>{throw Error('A rejected cycle must not contact PayPal')}},
    ...extras,
  };
  new Function('require','exports',code)((name)=> name in modules ? modules[name] : nativeRequire(name),exports);
  return exports;
}
function request(body) { return new Request('https://test.invalid/api/checkout',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)}); }
function session(cycle) { return {id:'test-session',user_id:user.id,plan:'blue',billing_cycle:cycle,status:'pending',expires_at:new Date(Date.now()+600000).toISOString(),metadata:{email:user.email}}; }

test('create-session persists selected cycle with server-owned prices, ignoring forged amounts',async()=>{
  for(const cycle of ['monthly','quarterly','yearly']) {
    const db=adapter(null), handler=await route('create-session',db);
    const response=await handler.POST(request({plan:'blue',billing_cycle:cycle,price:1,duration_days:9999}));
    assert.equal(response.status,200);
    const saved=db.writes.find(w=>w.table==='checkout_sessions').value;
    assert.equal(saved.billing_cycle,cycle);assert.equal(saved.metadata.base_price_inr,plans.bluePlanPriceInr(cycle));
    assert.equal(saved.metadata.duration_days,plans.BLUE_SUBSCRIPTION_PLANS[cycle].days);
    assert.equal(saved.metadata.base_price_usd,plans.bluePlanPriceUsd(cycle));
    assert.equal(saved.metadata.currency_usd,'USD');
  }
});
test('create-session rejects unsupported durations without inserting anything',async()=>{
  for(const cycle of ['weekly','__proto__',{},false]) {
    const db=adapter(null),handler=await route('create-session',db);
    assert.equal((await handler.POST(request({billing_cycle:cycle}))).status,400);assert.equal(db.writes.length,0);
  }
});
test('PayU signs the stored cycle price and writes a matching trusted order',async()=>{
  const oldKey=process.env.PAYU_MERCHANT_KEY,oldSalt=process.env.PAYU_MERCHANT_SALT;
  process.env.PAYU_MERCHANT_KEY='test-key';process.env.PAYU_MERCHANT_SALT='test-salt';
  try {
    for(const cycle of ['monthly','quarterly','yearly']) {
      const db=adapter(session(cycle)),handler=await route('payu/create-hash',db);
      const response=await handler.POST(request({sessionId:'test-session',redeemedImr:100,amount:1,billing_cycle:'monthly'}));
      assert.equal(response.status,200);assert.equal((await response.json()).amount,plans.bluePlanPriceInr(cycle,100));
      const order=db.writes.find(w=>w.table==='payment_orders').value;
      assert.equal(order.product_sku,plans.BLUE_SUBSCRIPTION_PLANS[cycle].sku);
      assert.equal(order.amount,plans.bluePlanPriceInr(cycle,100));assert.equal(order.currency,'INR');
    }
  } finally {
    if(oldKey===undefined) delete process.env.PAYU_MERCHANT_KEY; else process.env.PAYU_MERCHANT_KEY=oldKey;
    if(oldSalt===undefined) delete process.env.PAYU_MERCHANT_SALT; else process.env.PAYU_MERCHANT_SALT=oldSalt;
  }
});
test('PayU refuses another user’s session before any payment writes',async()=>{
  const db=adapter({...session('yearly'),user_id:'another-user'}),handler=await route('payu/create-hash',db);
  assert.equal((await handler.POST(request({sessionId:'test-session'}))).status,403);assert.equal(db.writes.length,0);
});
test('PayPal capture rejects unknown plans before contacting the provider',async()=>{
  for(const cycle of ['weekly','__proto__']) {
    const db=adapter(session(cycle)),handler=await route('paypal/capture',db);
    const response=await handler.GET(new Request('https://test.invalid/api/checkout/paypal/capture?session_id=test-session&token=test-order'));
    assert.equal(response.status,303);assert.ok(response.headers.get('Location').includes('payment=invalid'));
    assert.equal(db.rpcs.length,0);
  }
});
test('verified PayU callbacks reach atomic settlement for every supported duration',async()=>{
  const oldKey=process.env.PAYU_MERCHANT_KEY;
  process.env.PAYU_MERCHANT_KEY='test-key';
  try {
    for(const cycle of ['monthly','quarterly','yearly','weekly']) {
      const db=adapter([{...session(cycle),metadata:{payment_provider:'payu',txnid:'test-provider-order'}}]);
      const handler=await route('payu/callback',db);
      const response=await handler.POST(new Request('https://test.invalid/api/checkout/payu/callback',{method:'POST',body:new FormData()}));
      assert.equal(response.status,303);
      assert.equal(db.rpcs.length,cycle==='weekly'?0:1);
      assert.ok(response.headers.get('Location').includes(cycle==='weekly'?'payment=invalid':'payment=success'));
      if(cycle!=='weekly') assert.equal(db.rpcs[0].name,'complete_blue_subscription_checkout');
    }
  } finally { if(oldKey===undefined) delete process.env.PAYU_MERCHANT_KEY; else process.env.PAYU_MERCHANT_KEY=oldKey; }
});
