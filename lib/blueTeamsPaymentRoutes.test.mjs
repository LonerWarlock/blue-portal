import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as plans from './blueTeamsPlans.ts';

const nativeRequire = createRequire(import.meta.url);
const modeCode = ts.transpileModule(await readFile(new URL('./blueTeamsCheckoutMode.ts', import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mode = {};
new Function('require','exports',modeCode)((name)=>name === './blueTeamsPlans' ? plans : nativeRequire(name),mode);
const user = { id:'00000000-0000-4000-8000-000000000011', email:'teams@example.invalid' };
const sandboxEnv = {
  BLUE_TEAMS_TEST_MODE:'true', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'false',
  NEXT_PUBLIC_PAYU_URL:'https://test.payu.in/_payment', PAYU_MERCHANT_KEY:'test-key', PAYU_MERCHANT_SALT:'test-salt',
  PAYPAL_ENV:'sandbox', PAYPAL_CLIENT_ID:'sandbox-client', PAYPAL_CLIENT_SECRET:'sandbox-secret', NEXT_PUBLIC_PAYPAL_CLIENT_ID:'sandbox-client',
};
const envKeys = [...Object.keys(sandboxEnv),'NODE_ENV','VERCEL_ENV','BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED','DISABLE_CHECKOUT'];

async function withSandbox(run) {
  const before = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, sandboxEnv);
  try { return await run(); } finally { for (const key of envKeys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
}
function adapter(session = null, previousOrder = null) {
  const writes = [], rpcs = [];
  const admin = {
    auth:{ getUser:async()=>({data:{user},error:null}), admin:{getUserById:async()=>({data:{user}})} },
    from(table) {
      let inserted = null, updated = null;
      const result = { data: table === 'checkout_sessions' ? session : table === 'payment_orders' ? previousOrder : table === 'wallets' ? { balance: 250 } : null, error:null };
      const chain = {
        select(){return this}, eq(){return this}, limit(){if(table==='checkout_sessions')result.data=session?[session]:[];return this},
        insert(value){inserted=value;writes.push({table,value});result.data=table==='checkout_sessions'?{id:'new-session'}:null;return this},
        update(value){updated=value;writes.push({table,value});return this},
        upsert(value){inserted=value;writes.push({table,value});return this},
        single:async()=>result, maybeSingle:async()=>result,
        then(resolve,reject){return Promise.resolve(result).then(resolve,reject)},
      };
      return chain;
    },
    async rpc(name,args){rpcs.push({name,args});return {data:name==='create_blue_teams_checkout'?{session_id:'new-session',quote_mode:'new'}:{status:'completed'},error:null};},
  };
  return {admin,writes,rpcs};
}
async function loadRoute(path, db, extra = {}) {
  const source = await readFile(new URL(`../app/api/${path}/route.ts`, import.meta.url),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const modules = {
    'next/server':{NextResponse:{json:(body,options={})=>Response.json(body,options),redirect:(url,status=303)=>new Response(null,{status,headers:{Location:String(url)}})}},
    '@/lib/supabaseAdmin':{supabaseAdmin:db.admin}, '@/lib/bluePayg':{getBearerToken:()=> 'test-token'},
    '@/lib/blueTeamsPlans':plans, '@/lib/blueTeamsCheckoutMode':mode,
    '@/lib/trafficControl':{checkRateLimit:async()=>({allowed:true,configured:true}),requestIp:()=> 'test-ip',rateLimitHeaders:()=>({})},
    '@/lib/paymentOrigin':{paymentSiteOrigin:input=>new URL(input).origin},
    '@/lib/paymentSecurity':{payuRequestHash:()=> 'test-signature',safeInternalUrl:(_value,site,fallback='/teams')=>new URL(fallback,site),
      moneyEquals:(a,b)=>Number(a).toFixed(2)===Number(b).toFixed(2), parsePayuForm:()=>extra.payuForm || {},
      validPayuCallbackSignature:()=>true,matchesExpectedPayuPayment:()=>true},
    '@/lib/paypal':{createPaypalOrder:async()=>({orderId:'PAYPAL-TEST-ORDER',approveUrl:'https://sandbox.paypal.test/approve'}),
      capturePaypalOrder:async()=>extra.capture || {},getPaypalOrder:async()=>extra.capture || {}},
    ...extra,
  };
  new Function('require','exports',code)((name)=>name in modules?modules[name]:nativeRequire(name),exports);
  return exports;
}
function post(body) { return new Request('https://blue.test/api/teams/checkout',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify(body)}); }
function checkoutSession() { return { id:'team-session',user_id:user.id,plan:'blue_teams_solo',billing_cycle:'monthly',status:'pending',
  expires_at:new Date(Date.now()+600000).toISOString(),metadata:{email:user.email,product_kind:'blue_teams',product_sku:'blue_teams_solo_monthly',blue_teams_test_mode:true} }; }

test('team checkout session uses the server plan and Solo sandbox price', async()=>withSandbox(async()=>{
  const db=adapter(null),route=await loadRoute('teams/checkout/create-session',db);
  const response=await route.POST(post({tier:'solo',price:9999,duration_days:1}));
  assert.equal(response.status,200);assert.equal((await response.json()).session_id,'new-session');
  assert.equal(db.writes.length,0,'the database owns atomic quote creation');
  assert.equal(db.rpcs[0].name,'create_blue_teams_checkout');
  assert.deepEqual(db.rpcs[0].args,{user_id_param:user.id,tier_param:'solo',is_test_param:true,live_test_param:false});
}));

test('PayU creates a signed server-priced sandbox order for the authenticated Solo session', async()=>withSandbox(async()=>{
  const db=adapter(checkoutSession()),route=await loadRoute('teams/checkout/payu/create-hash',db);
  const response=await route.POST(post({sessionId:'team-session',amount:9999,redeemedImr:0}));
  const payload=await response.json();
  assert.equal(response.status,200);assert.equal(payload.amount,'1.00');assert.equal(payload.hash,'test-signature');
  const order=db.writes.find(write=>write.table==='payment_orders').value;
  assert.equal(order.product_sku,'blue_teams_solo_monthly');assert.equal(order.currency,'INR');
  assert.equal(order.redeemed_imr,0);assert.equal(order.amount,'1.00');
}));

test('PayPal creates and persists a USD sandbox order without trusting client amounts', async()=>withSandbox(async()=>{
  const db=adapter(checkoutSession()),route=await loadRoute('teams/checkout/paypal/create-order',db);
  const response=await route.POST(post({sessionId:'team-session',amount:'499'}));
  const payload=await response.json();
  assert.equal(response.status,200);assert.equal(payload.orderId,'PAYPAL-TEST-ORDER');
  const order=db.writes.find(write=>write.table==='payment_orders').value;
  assert.equal(order.product_sku,'blue_teams_solo_monthly');assert.equal(order.currency,'USD');
  assert.equal(order.amount,'0.01');assert.equal(order.redeemed_imr,0);
  assert.equal(order.metadata.blue_teams_test_mode,true);
}));

test('PayU test checkout refuses a production endpoint before persisting an order', async()=>withSandbox(async()=>{
  process.env.NEXT_PUBLIC_PAYU_URL='https://secure.payu.in/_payment';
  const db=adapter(checkoutSession()),route=await loadRoute('teams/checkout/payu/create-hash',db);
  const response=await route.POST(post({sessionId:'team-session'}));
  assert.equal(response.status,503);assert.equal(db.writes.length,0);
}));

test('verified PayU callback settles a bound team order exactly once through the database RPC', async()=>withSandbox(async()=>{
  const metadata = { email:user.email, product_kind:'blue_teams', product_sku:'blue_teams_solo_monthly', blue_teams_test_mode:true,
    payment_provider:'payu', txnid:'bt_0123456789abcdef01234567', expected_key:'test-key', expected_amount:'1.00',
    expected_productinfo:'Blue Teams Solo - 30 days', expected_firstname:'teams', expected_email:user.email,
    redeemed_imr:0, return_url:'https://blue.test/teams' };
  const session = { ...checkoutSession(), metadata };
  const order = { id:'payment-order',user_id:user.id,checkout_session_id:session.id,product_sku:'blue_teams_solo_monthly',
    amount:'1.00',currency:'INR',redeemed_imr:0,gateway:'payu',provider_order_id:metadata.txnid,custom_id:metadata.txnid,
    status:'pending',metadata:{productinfo:metadata.expected_productinfo,blue_teams_test_mode:true} };
  const db=adapter(session,order),route=await loadRoute('teams/checkout/payu/callback',db,{
    payuForm:{key:'test-key',txnid:metadata.txnid,amount:'1.00',productinfo:metadata.expected_productinfo,
      firstname:metadata.expected_firstname,email:user.email,status:'success',mihpayid:'PAYU-TRANSACTION-1'},
  });
  const handler=route.POST;
  const response=await handler(new Request('https://blue.test/api/teams/checkout/payu/callback',{method:'POST',body:new FormData()}));
  assert.equal(response.status,303);assert.ok(response.headers.get('Location').includes('payment=success'),response.headers.get('Location'));
  assert.equal(db.rpcs.length,1);assert.equal(db.rpcs[0].name,'complete_blue_teams_checkout');
  assert.equal(db.rpcs[0].args.provider_param,'payu');
}));

test('PayPal capture verifies completed provider evidence before settling the saved team order', async()=>withSandbox(async()=>{
  const txnid='btt_0123456789abcdef01234567';
  const metadata={ email:user.email,product_kind:'blue_teams',product_sku:'blue_teams_solo_monthly',blue_teams_test_mode:true,
    payment_provider:'paypal',expected_order_id:'PAYPAL-TEST-ORDER',expected_amount:'0.01',expected_currency:'USD',
    expected_custom_id:txnid,expected_invoice_id:txnid,txnid,redeemed_imr:0,return_url:'https://blue.test/teams?test_mode=1' };
  const session={...checkoutSession(),metadata};
  const order={id:'payment-order',user_id:user.id,checkout_session_id:session.id,expires_at:session.expires_at,product_sku:'blue_teams_solo_monthly',
    amount:'0.01',currency:'USD',redeemed_imr:0,gateway:'paypal',provider_order_id:'PAYPAL-TEST-ORDER',custom_id:txnid,status:'pending',
    metadata:{expected_custom_id:txnid,expected_invoice_id:txnid,expected_order_id:'PAYPAL-TEST-ORDER',expected_amount:'0.01',
      expected_currency:'USD',blue_teams_test_mode:true}};
  const capture={status:'COMPLETED',captureStatus:'COMPLETED',purchaseUnitCount:1,captureCount:1,captureId:'CAPTURE-1',
    orderId:'PAYPAL-TEST-ORDER',customId:txnid,invoiceId:txnid,currency:'USD',grossAmount:'0.01',payerEmail:user.email};
  const db=adapter(session,order),route=await loadRoute('teams/checkout/paypal/capture',db,{capture});
  const url=`https://blue.test/api/teams/checkout/paypal/capture?session_id=${session.id}&token=PAYPAL-TEST-ORDER&txnid=${txnid}`;
  const response=await route.GET(new Request(url));
  assert.equal(response.status,303);assert.ok(response.headers.get('Location').includes('payment=success'),response.headers.get('Location'));
  assert.equal(db.rpcs.length,1);assert.equal(db.rpcs[0].name,'complete_blue_teams_checkout');
  assert.equal(db.rpcs[0].args.provider_param,'paypal');
}));

const savedQuote=(currency='INR')=>({version:1,mode:'upgrade',from_plan:'solo',quoted_at:new Date().toISOString(),
  effective_start:new Date(Date.now()+100).toISOString(),effective_end:new Date(Date.now()+15*86400000).toISOString(),
  base_amount_inr:'500.00',base_amount_usd:'5.28',currency_locked:currency});
function upgradeSession(currency='INR') {
  const session=checkoutSession();
  return {...session,plan:'blue_teams_pro',metadata:{...session.metadata,product_sku:'blue_teams_pro_monthly',
    blue_teams_test_mode:false,teams_quote:savedQuote(currency)}};
}
function enableLive() {
  Object.assign(process.env,{NODE_ENV:'production',VERCEL_ENV:'production',BLUE_TEAMS_TEST_MODE:'false',
    BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'true',NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment',PAYPAL_ENV:'live'});
}

for (const [gateway,currency] of [['payu','INR'],['paypal','USD']]) {
  test(`${gateway} uses the saved prorated quote, rejects IMR and stale access before any payment is created`,async()=>withSandbox(async()=>{
    enableLive();
    const session=upgradeSession(currency), db=adapter(session), route=await loadRoute(`teams/checkout/${gateway}/${gateway==='payu'?'create-hash':'create-order'}`,db);
    const response=await route.POST(post({sessionId:session.id,amount:'0.01',redeemedImr:0}));
    assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
    const order=db.writes.find(w=>w.table==='payment_orders').value;
    assert.equal(order.amount,currency==='INR'?'500.00':'5.28');
    assert.deepEqual(db.rpcs[0],{name:'validate_blue_teams_checkout',args:{session_id_param:session.id,currency_param:currency}});

    const imrDb=adapter(session), imrRoute=await loadRoute(`teams/checkout/${gateway}/${gateway==='payu'?'create-hash':'create-order'}`,imrDb);
    assert.equal((await imrRoute.POST(post({sessionId:session.id,redeemedImr:1}))).status,400);
    assert.equal(imrDb.writes.length,0);

    const staleDb=adapter(session);staleDb.admin.rpc=async()=>({error:{message:'current plan changed'},data:null});
    const staleRoute=await loadRoute(`teams/checkout/${gateway}/${gateway==='payu'?'create-hash':'create-order'}`,staleDb,{
      '@/lib/paypal':{createPaypalOrder:()=>assert.fail('stale checkout must not contact a payment provider')},
    });
    assert.equal((await staleRoute.POST(post({sessionId:session.id}))).status,409);
    assert.equal(staleDb.writes.length,0);
  }));
}

test('quote admission returns actionable safe guidance, never raw database errors',async()=>withSandbox(async()=>{
  for(const [message,status,expected] of [
    ['A previous Teams checkout is still pending. Finish or resolve it before choosing another plan',409,/previous Teams checkout/],
    ['This period already has a prorated upgrade. Another upgrade needs a manual billing review; no payment has started',409,/billing review/],
    ['A collected Teams payment is awaiting review. Do not pay again; contact support to reconcile that receipt',409,/Do not pay again/],
    ['A lower Teams plan starts only after the current plan ends. Schedule the change instead',409,/Change at expiry/],
    ['relation internal_private_table does not exist',503,/No payment was started/],
  ]) {
    const db=adapter();db.admin.rpc=async()=>({data:null,error:{message}});
    const route=await loadRoute('teams/checkout/create-session',db),response=await route.POST(post({tier:'solo'}));
    assert.equal(response.status,status);const body=await response.json();assert.match(body.error,expected);
    assert.doesNotMatch(body.error,/internal_private_table/);assert.equal(db.writes.length,0);
  }
}));

test('plan preferences use only the authenticated owner and never create a payment',async()=>{
  for(const tier of ['solo',null]) {
    const db=adapter(),route=await loadRoute('teams/plan-change',db), response=await route.POST(post({tier}));
    assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.deepEqual(db.rpcs,[{name:tier===null?'cancel_blue_teams_change':'schedule_blue_teams_change',
      args:{user_id_param:user.id,...(tier===null?{}:{tier_param:tier})}}]);
    assert.equal(db.writes.length,0);
  }
  for(const input of [{tier:'solo',user_id:'somebody-else'},{tier:'__proto__'},{}]) {
    const db=adapter(),route=await loadRoute('teams/plan-change',db);
    assert.equal((await route.POST(post(input))).status,400);assert.equal(db.rpcs.length,0);
  }
});

test('plan management is blocked without authentication, when throttled or when the backend is unavailable',async()=>{
  for(const [extra,status] of [
    [{'@/lib/bluePayg':{getBearerToken:()=>null}},401],
    [{'@/lib/trafficControl':{checkRateLimit:async()=>({allowed:false,configured:true}),rateLimitHeaders:()=>({})}},429],
    [{'@/lib/supabaseAdmin':{supabaseAdmin:null}},503],
  ]) {
    const db=adapter(),route=await loadRoute('teams/plan-change',db,extra);
    assert.equal((await route.POST(post({tier:'solo'}))).status,status);assert.equal(db.rpcs.length,0);
  }
  const db=adapter();db.admin.rpc=async()=>{throw new Error('synthetic network failure')};
  const route=await loadRoute('teams/plan-change',db);
  assert.equal((await route.POST(post({tier:null}))).status,503);
});

test('verified collected payments needing reconciliation return pending, never success or an invitation to pay again',async()=>withSandbox(async()=>{
  const session=checkoutSession(), tx='bt_review_receipt';
  Object.assign(session.metadata,{payment_provider:'payu',txnid:tx,expected_key:'test-key',expected_amount:'1.00',
    expected_productinfo:'Blue Teams Solo - 30 days',expected_firstname:'teams',expected_email:user.email,redeemed_imr:0});
  const order={id:'order',user_id:user.id,product_sku:'blue_teams_solo_monthly',amount:'1.00',currency:'INR',redeemed_imr:0,
    gateway:'payu',provider_order_id:tx,custom_id:tx,status:'pending',metadata:{blue_teams_test_mode:true}};
  const db=adapter(session,order);db.admin.rpc=async(name,args)=>{db.rpcs.push({name,args});return {data:{outcome:'requires_review'},error:null};};
  const route=await loadRoute('teams/checkout/payu/callback',db,{payuForm:{key:'test-key',txnid:tx,status:'success',mihpayid:'receipt-review'}});
  let response=await route.POST(new Request('https://blue.test/callback',{method:'POST',body:new FormData()}));
  assert.match(response.headers.get('Location'),/payment=pending/);assert.equal(db.rpcs.length,1);
  session.status='completed';session.metadata.payment_outcome='requires_review';order.status='completed';order.provider_transaction_id='receipt-review';
  response=await route.POST(new Request('https://blue.test/callback',{method:'POST',body:new FormData()}));
  assert.match(response.headers.get('Location'),/payment=pending/);assert.equal(db.rpcs.length,1,'replay never settles or charges twice');
}));
