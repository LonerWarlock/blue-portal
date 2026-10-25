import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as policy from './blueCreditPolicy.ts';
const nativeRequire=createRequire(import.meta.url);
async function module(file,modules={}){
 const code=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>name in modules?modules[name]:nativeRequire(name),exports);return exports;
}
const prices=await module('./exchangeRate.ts',{'@/lib/blueCreditPolicy':policy});
const security=await module('./paymentSecurity.ts');
const u={id:'11111111-1111-4111-8111-111111111111',email:'buyer@test.invalid'};
function database(payment=null){
 const writes=[],rpcs=[];
 const db={auth:{getUser:async()=>({data:{user:u}}),admin:{getUserById:async()=>({data:{user:u}})}},
  from(table){const chain={select(){return this},eq(){return this},maybeSingle:async()=>({data:payment}),single:async()=>({data:{id:'credit-payment'}}),
   insert(value){writes.push({table,value});return this},update(value){writes.push({table,value});return this},then(resolve){return Promise.resolve({data:null}).then(resolve)}};return chain;},
  rpc:async(name,args)=>{rpcs.push({name,args});return {data:{credits:payment?.credits_purchased||25}}}};
 return{db,writes,rpcs};
}
const next={NextResponse:{json:(body,init={})=>Response.json(body,init),redirect:(url,status=303)=>new Response(null,{status,headers:{Location:String(url)}})}};
async function route(path,fixture,extras={}){
 return module('../app/api/blue-pro/'+path+'/route.ts',{'next/server':next,'@/lib/supabaseAdmin':{supabaseAdmin:fixture.db},
  '@/lib/exchangeRate':prices,'@/lib/paymentSecurity':security,'@/lib/paymentOrigin':{paymentSiteOrigin:()=> 'https://blue.test'},
  '@/lib/paypal':extras.paypal||{},...extras});
}
const request=(body,auth=true)=>new Request('https://blue.test/checkout',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer user-session'}:{})},body:JSON.stringify(body)});
test('PayPal charges25credits plus30% and stores the immutable quote, not client-supplied amounts',async()=>{
 const f=database(),orders=[],r=await route('paypal/create-order',f,{paypal:{createPaypalOrder:async order=>{orders.push(order);return{orderId:'ORDER',approveUrl:'https://paypal.test/approve'}}}});
 const response=await r.POST(request({packId:'custom',customCredits:25,amount:1,platformFeePercent:0}));assert.equal(response.status,200);
 assert.equal(orders[0].amount,'32.50');assert.equal(orders[0].currency,'USD');
 const p=f.writes[0].value;assert.equal(p.credits_purchased,25);assert.equal(p.amount_paid,32.5);assert.equal(p.currency,'USD');
 assert.equal(p.metadata.expected_amount,'32.50');assert.equal(p.metadata.base_price_usd,25);assert.equal(p.metadata.platform_fee_usd,7.5);assert.equal(p.metadata.blue_credit_multiplier,1);
});
test('PayU signs the30%grosscharge and records only25credits',async()=>{
 const before={key:process.env.PAYU_MERCHANT_KEY,salt:process.env.PAYU_MERCHANT_SALT};
 process.env.PAYU_MERCHANT_KEY='unit-key';process.env.PAYU_MERCHANT_SALT='unit-salt';
 try{const f=database(),r=await route('payu/create-hash',f),response=await r.POST(request({packId:'custom',customCredits:25,amount:1}));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.amount,'3250.00');
  assert.equal(body.hash,security.payuRequestHash(body,'unit-salt'));
  const p=f.writes[0].value;assert.equal(p.credits_purchased,25);assert.equal(p.amount_paid,3250);
  assert.equal(p.metadata.base_price_inr,2500);assert.equal(p.metadata.platform_fee_inr,750);assert.equal(p.metadata.platform_fee_percent,30);
 }finally{for(const[name,value]of[['PAYU_MERCHANT_KEY',before.key],['PAYU_MERCHANT_SALT',before.salt]])if(value===undefined)delete process.env[name];else process.env[name]=value;}
});
test('payments require sign-in and reject fractional or non-finite packquantities without ordercreation',async()=>{
 for(const path of ['payu/create-hash','paypal/create-order']){
  const f=database(),r=await route(path,f,{paypal:{createPaypalOrder:()=>assert.fail('invalid input must not create order')}});
  assert.equal((await r.POST(request({packId:'custom',customCredits:25},false))).status,401);
  for(const credits of [0,25.2,'25',101])assert.equal((await r.POST(request({packId:'custom',customCredits:credits}))).status,400);
  assert.equal(f.writes.length,0);
 }
});
test('a saved pre-change PayPalorder settles its storedprice without adding a second fee',async()=>{
 const payment={id:'old',provider_txnid:'old-tx',payment_provider:'paypal',currency:'USD',status:'pending',credits_purchased:25,
  metadata:{paypal_order_id:'OLD-ORDER',expected_amount:'25.00',usd_amount:25,expected_custom_id:'old-tx',expected_invoice_id:'old-tx',return_url:'https://blue.test/console'}};
 const f=database(payment),r=await route('paypal/capture',f,{paypal:{capturePaypalOrder:async()=>({status:'COMPLETED',captureStatus:'COMPLETED',purchaseUnitCount:1,captureCount:1,captureId:'CAPTURE',orderId:'OLD-ORDER',currency:'USD',grossAmount:'25.00',customId:'old-tx',invoiceId:'old-tx'})}});
 const response=await r.GET(new Request('https://blue.test/callback?txnid=old-tx&token=OLD-ORDER'));
 assert.match(response.headers.get('Location'),/payment=success/);assert.deepEqual(f.rpcs,[{name:'complete_blue_credit_payment',args:{payment_id_param:'old',provider_txnid_param:'old-tx'}}]);
});
test('mismatched captured totals never credit the wallet',async()=>{
 const payment={id:'new',provider_txnid:'new-tx',payment_provider:'paypal',currency:'USD',status:'pending',credits_purchased:25,
  metadata:{paypal_order_id:'NEW-ORDER',expected_amount:'32.50',usd_amount:32.5}};
 const f=database(payment),r=await route('paypal/capture',f,{paypal:{capturePaypalOrder:async()=>({status:'COMPLETED',captureStatus:'COMPLETED',purchaseUnitCount:1,captureCount:1,captureId:'CAPTURE',orderId:'NEW-ORDER',currency:'USD',grossAmount:'25.00',customId:'new-tx',invoiceId:'new-tx'})}});
 const response=await r.GET(new Request('https://blue.test/callback?txnid=new-tx&token=NEW-ORDER'));
 assert.match(response.headers.get('Location'),/payment=invalid/);assert.equal(f.rpcs.length,0);
});
