import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
async function load(file,imports={}) {
 const source=await readFile(new URL(file,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('require','exports',compiled)(name=>name in imports?imports[name]:nativeRequire(name),exports);return exports;
}
const org='22222222-2222-4222-8222-222222222222',target='omnileshkarande@gmail.com';
const next={NextResponse:{json:(value,init={})=>Response.json(value,init),redirect:(url,status=303)=>new Response(null,{status,headers:{Location:String(url)}})}};
async function enabled(value,fn) {
 const before={org:process.env.BLUE_ORGANIZATIONS_ENABLED,test:process.env.BLUE_ORGANIZATION_PAYU_TEST_ENABLED,key:process.env.PAYU_MERCHANT_KEY,salt:process.env.PAYU_MERCHANT_SALT};
 process.env.BLUE_ORGANIZATIONS_ENABLED='true';process.env.BLUE_ORGANIZATION_PAYU_TEST_ENABLED=value;
 process.env.PAYU_MERCHANT_KEY='unit-key';process.env.PAYU_MERCHANT_SALT='unit-salt';
 try{return await fn();}finally{for(const[key,v]of[['BLUE_ORGANIZATIONS_ENABLED',before.org],['BLUE_ORGANIZATION_PAYU_TEST_ENABLED',before.test],['PAYU_MERCHANT_KEY',before.key],['PAYU_MERCHANT_SALT',before.salt]])if(v===undefined)delete process.env[key];else process.env[key]=v;}
}
async function fixture({email=target,verified=true,owner=true,authError=false,payment=null}={}) {
 const user={id:'11111111-1111-4111-8111-111111111111',email,email_confirmed_at:verified?'2026-11-15T00:00:00Z':null};
 const writes=[],calls=[];let lookups=0;
 const db={auth:{getUser:async()=>({data:{user}}),admin:{getUserById:async id=>{assert.equal(id,user.id);lookups++;return {data:{user},error:authError?{message:'unavailable'}:null};}}},
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='blue_organization_context'?{owner}:name==='blue_organization_admin_snapshot'?{organization:{owner}}:{credits:50}};},
  from(table){return {select(){return this;},eq(){return this;},insert(value){writes.push({table,value});return this;},update(){return this;},single:async()=>({data:{id:'test-payment'}}),maybeSingle:async()=>({data:payment})};}};
 const organizations=await load('./organizations.ts',{'@/lib/supabaseAdmin':{supabaseAdmin:db},'@/lib/bluePayg':{statusError:(status,message)=>Object.assign(new Error(message),{status})}});
 return {db,organizations,writes,calls,user,get lookups(){return lookups;}};
}
const security=await load('./paymentSecurity.ts');
const pricing=await load('./blueCreditPricing.ts');
async function payuRoute(name,f) {
 return load('../app/api/blue-pro/payu/'+name+'/route.ts',{'next/server':next,'@/lib/organizations':f.organizations,'@/lib/supabaseAdmin':{supabaseAdmin:f.db},
  '@/lib/blueCreditPricing':pricing,'@/lib/paymentSecurity':security,'@/lib/paymentOrigin':{paymentSiteOrigin:()=> 'https://blue.test'},
  '@/lib/exchangeRate':{APPROX_USD_TO_INR:100,getCreditPurchasePack:()=>({id:'custom',name:'Blue Credits',credits:5,priceINR:575,priceUSD:6.5,basePriceINR:575,basePriceUSD:6.5,platformFeeUSD:0,platformFeeINR:0,platformFeePercent:0,multiplier:1})}});
}
const request=body=>new Request('https://blue.test/checkout',{method:'POST',headers:{Authorization:'Bearer session','Content-Type':'application/json'},body:JSON.stringify(body)});

test('INR1 test requires its server flag and preserves standard public quotes',async()=>enabled('false',async()=>{
 const f=await fixture();assert.equal(await f.organizations.organizationPayuTestAccount(f.user.id),false);assert.equal(f.lookups,0);
 assert.equal((await f.organizations.organizationPurchasePack(f.user.id,org,50,'INR')).priceINR,5750);
 assert.deepEqual(f.organizations.quoteOrganizationCredits(50),{credits:50,priceINR:5750,priceUSD:57.5});
}));
test('only the verified owner test account buying exactly50credits inINR receives the flatINR1 price',async()=>enabled('true',async()=>{
 const f=await fixture(),pack=await f.organizations.organizationPurchasePack(f.user.id,org,50,'INR');
 assert.equal(pack.priceINR,1);assert.equal(pack.basePriceINR,1);assert.equal(pack.credits,50);assert.equal(pack.testPayuCheckout,true);
 for(const [quantity,currency]of[[51,'INR'],[1000,'INR'],[50,'USD'],[50,undefined]]){
  const p=await f.organizations.organizationPurchasePack(f.user.id,org,quantity,currency);assert.equal(p.priceINR,quantity*115);assert.equal(p.testPayuCheckout,false);assert.equal(p.priceUSD,quantity*115/100);
 }
 for(const options of [{email:'other@example.test'},{verified:false},{authError:true}]){
  const other=await fixture(options);assert.equal((await other.organizations.organizationPurchasePack(other.user.id,org,50,'INR')).priceINR,5750);
 }
 const member=await fixture({owner:false});await assert.rejects(member.organizations.organizationPurchasePack(member.user.id,org,50,'INR'),/owner required/);
 for(const invalid of [49,1001,50.1,'50',null])await assert.rejects(f.organizations.organizationPurchasePack(f.user.id,org,invalid,'INR'),/50 to 1,000/);
}));
test('PayU stores and signs exactlyINR1 and cannot be discounted by client-supplied identity or price',async()=>enabled('true',async()=>{
 for(const [email,expected]of[[target,1],['other@example.test',5750]]){
  const f=await fixture({email}),r=await payuRoute('create-hash',f);
  const response=await r.POST(request({organization_id:org,customCredits:50,amount:1,email:target,testPayuCheckout:true}));
  assert.equal(response.status,200);const body=await response.json(),p=f.writes[0].value;
  assert.equal(body.amount,expected.toFixed(2));assert.equal(body.hash,security.payuRequestHash(body,'unit-salt'));
  assert.equal(p.amount_paid,expected);assert.equal(p.credits_purchased,50);assert.equal(p.organization_id,org);
  assert.equal(p.metadata.expected_amount,expected.toFixed(2));
  assert.equal(p.metadata.live_payment_test,expected===1?true:undefined);
  assert.equal(p.metadata.pricing_version,expected===1?'organization-payu-live-inr1-test-v1':'organization-inr115-usd115-v1');
 }
 const f=await fixture(),r=await payuRoute('create-hash',f);
 assert.equal((await r.POST(request({customCredits:5,amount:1,email:target}))).status,200);assert.equal(f.writes[0].value.amount_paid,575);assert.equal(f.writes[0].value.metadata.live_payment_test,undefined);
}));
test('turning the flag off restoresINR5750 without breaking an already signedINR1 callback',async()=>enabled('false',async()=>{
 const f=await fixture(),r=await payuRoute('create-hash',f);
 assert.equal((await r.POST(request({organization_id:org,customCredits:50}))).status,200);assert.equal(f.writes[0].value.amount_paid,5750);
 const fields={key:'unit-key',txnid:'test-tx',amount:'1.00',productinfo:'Blue Organization - 50 Blue Credits',firstname:'Om',email:target,status:'success'};
 const payment={id:'saved-test',organization_id:org,provider_txnid:fields.txnid,payment_provider:'payu',currency:'INR',credits_purchased:50,metadata:{expected_key:fields.key,expected_amount:fields.amount,expected_productinfo:fields.productinfo,expected_firstname:fields.firstname,expected_email:fields.email,return_url:'https://blue.test/organizations/'+org+'/admin'}};
 for(const changed of [false,true]){
  const fixtureWithPayment=await fixture({payment}),callback=await payuRoute('callback',fixtureWithPayment);
  const input={...fields,amount:changed?'2.00':'1.00'},form=new FormData();for(const[k,v]of Object.entries({...input,hash:security.payuCallbackHash(input,'unit-salt')}))form.set(k,v);
  const response=await callback.POST(new Request('https://blue.test/callback',{method:'POST',body:form}));
  assert.match(response.headers.get('Location'),changed?/payment=invalid/:/payment=success/);
  assert.equal(fixtureWithPayment.calls.length,changed?0:1);
 }
}));
test('Organization admin test status is owner-only and remains no-store',async()=>enabled('true',async()=>{
 for(const owner of [true,false]){
  const f=await fixture({owner});const r=await load('../app/api/organizations/[id]/route.ts',{'next/server':next,'@/lib/organizations':f.organizations,'@/lib/supabaseAdmin':{supabaseAdmin:f.db},'@/lib/accountEntitlements':{verifiedSessionUser:async()=>f.user.id,ACCOUNT_NO_STORE_HEADERS:{'Cache-Control':'private, no-store'}},'@/lib/trafficControl':{},'@/lib/jobOutbox':{}});
  const response=await r.GET(new Request('https://blue.test/api/organizations/'+org),{params:{id:org}}),body=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
  assert.equal(body.checkout?.payu_test_enabled,owner?true:undefined);assert.equal(f.lookups,owner?1:0);
 }
}));


test('Organization checkout shows INR1 only for the eligible INR50-credit selection',async()=>{
 const jsx=(type,props)=>({type,props});
 function text(node){if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(text).join('');if(typeof node!=='object')return String(node);return text(node.props?.children);}
 function buttons(node,result=[]){if(Array.isArray(node)){for(const child of node)buttons(child,result);}else if(node&&typeof node==='object'){if(node.type==='button')result.push(text(node));buttons(node.props?.children,result);}return result;}
 for(const [eligible,quantity,currency,expected]of[[true,'50','INR','Buy ₹1'],[false,'50','INR','Buy ₹5,750'],[true,'51','INR','Buy ₹5,865'],[true,'50','USD','Buy US$57.50']]){
  const snapshot={organization:{id:org,name:'Test',owner:true,purchased:50,available:50,spent:0,held:0,seat_limit:5},members:[],invitations:[],checkout:{payu_test_enabled:eligible}};
  const component=await load('../app/organizations/OrganizationClient.tsx',{'react':{useState:initial=>[initial===null?snapshot:initial==='50'?quantity:initial==='INR'?currency:initial,()=>{}],useCallback:fn=>fn,useEffect:()=>{}},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{default:'a'},'@/app/components/PageLayout':{default:'div'},'@/app/contexts/AuthContext':{useAuth:()=>({user:{id:'owner'},session:{access_token:'fixture'},loading:false})}});
  const tree=component.default({id:org});assert.ok(buttons(tree).includes(expected),buttons(tree).join('; '));
 }
});
