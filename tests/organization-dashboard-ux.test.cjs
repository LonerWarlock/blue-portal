const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const React=require('react'),{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom');
function load(file,imports){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};new Function('require','exports',code)(name=>name in imports?imports[name]:require(name),exports);return exports;}
const org={id:'22222222-2222-4222-8222-222222222222',name:'Imergene',owner:true,available:50,held:0,purchased:50,spent:0,seat_limit:5,member_spent:0,member_held:0,spend_cap:null};
async function ui({id=org.id,remembered=false,enabled=false,list=[org]}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://blue.test/organizations'+(id?'/'+id+'/admin':'')});const old={};for(const k of ['window','document','localStorage','HTMLElement','fetch','IS_REACT_ACT_ENVIRONMENT']){old[k]=global[k];global[k]=k==='IS_REACT_ACT_ENVIRONMENT'?true:k==='fetch'?undefined:dom.window[k];}
 const auth={user:{id:'owner'},session:{user:{id:'owner'},access_token:'first'},loading:false},calls=[],navigations=[];
 const router={push:p=>navigations.push(p),replace:p=>navigations.push(p)};
 if(remembered)dom.window.localStorage.setItem('blue.organization.last.owner',remembered);
 global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/ledger')?{events:[],payments:[]}:options.method==='POST'?{ok:true}:url==='/api/organizations'?{organizations:list}:{organization:org,members:[{user_id:'owner',email:'owner@example.test',active:true,spent:0,held:0,spend_cap:null}],invitations:[],checkout:{payu_test_enabled:enabled}});};
 const icons=Object.fromEntries(['ArrowUpRight','Building2','ChevronDown','MoreHorizontal','Plus','RefreshCw','X'].map(k=>[k,()=>null]));
 const workspace=load('app/components/WorkspaceSwitcher.tsx',{'react':React,'lucide-react':{...icons,UserRound:()=>null,Check:()=>null},'./workspace-switcher.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}}).default;
 const component=load('app/organizations/OrganizationClient.tsx',{'react':React,'next/navigation':{useRouter:()=>router},'next/link':{default:({children,prefetch,...props})=>React.createElement('a',props,children)},'lucide-react':icons,'@/app/components/PageLayout':{default:({children})=>React.createElement('main',null,children)},'@/app/contexts/AuthContext':{useAuth:()=>auth},'@/app/components/WorkspaceSwitcher':{default:workspace},'@/app/components/dashboard.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}}).default;
 const root=createRoot(document.getElementById('root'));
 const render=async()=>React.act(async()=>{root.render(React.createElement(component,{id}));await new Promise(r=>setTimeout(r,0));});
 await render();
 return {auth,calls,navigations,dom,render,async click(label){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label);assert.ok(button,label);await React.act(async()=>{button.click();await new Promise(r=>setTimeout(r,0));});},async close(){await React.act(()=>root.unmount());dom.window.close();for(const[k,v]of Object.entries(old))global[k]=v;}};
}
test('tab focus and refreshed auth tokens keep dashboard data and user inputs intact with zero re-fetches',async()=>{
 const f=await ui();try{assert.match(document.body.textContent,/Imergene/);const before=f.calls.length;
 await React.act(async()=>{window.dispatchEvent(new window.Event('focus'));document.dispatchEvent(new window.Event('visibilitychange'));});
 f.auth.session={user:{id:'owner'},access_token:'renewed'};await f.render();assert.equal(f.calls.length,before);assert.match(document.body.textContent,/Imergene/);
 await f.click('Refresh dashboard');assert.equal(f.calls.length,before+2);assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer renewed');
 }finally{await f.close();}
});
test('organizations entry routes straight to the remembered membership and rejects stale remembered IDs',async()=>{
 const second={...org,id:'33333333-3333-4333-8333-333333333333',name:'Second'};
 for(const remembered of [second.id,'removed-organization']){const f=await ui({id:null,remembered,list:[org,second]});try{assert.deepEqual(f.navigations,['/organizations/'+(remembered===second.id?second.id:org.id)+'/admin']);assert.doesNotMatch(document.body.textContent,/Your organizations/);}finally{await f.close();}}
});
test('billing loads lazily once and the INR1 display still requires eligible quantity and currency',async()=>{
 const f=await ui({enabled:true});try{assert.equal(f.calls.some(c=>c.url.endsWith('/ledger')),false);await f.click('Billing & Ledger');assert.equal(f.calls.filter(c=>c.url.endsWith('/ledger')).length,1);assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Buy ₹1'));await React.act(()=>{require('react-dom/test-utils').Simulate.change(document.querySelector('input[aria-label="Organization credits"]'),{target:{value:'51'}});});assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Buy ₹5,865'));await f.click('Members');await f.click('Billing & Ledger');assert.equal(f.calls.filter(c=>c.url.endsWith('/ledger')).length,1);}finally{await f.close();}
});
test('sign-out removes private dashboard content immediately',async()=>{const f=await ui();try{f.auth.user=null;f.auth.session=null;await f.render();assert.doesNotMatch(document.body.textContent,/owner@example.test/);assert.match(document.body.textContent,/Sign in to continue/);}finally{await f.close();}});
test('owner-only ledger is scoped to the selected organization and never queries personal records',async()=>{
 for(const owner of [true,false]){const queries=[];const db={from:table=>{const q={table};queries.push(q);return{select:()=>({eq:(key,value)=>{q.key=key;q.value=value;return{order:()=>({limit:async limit=>{q.limit=limit;return{data:[]};}})}}})}}};
 const route=load('app/api/organizations/[id]/ledger/route.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/lib/accountEntitlements':{verifiedSessionUser:async()=> 'owner',ACCOUNT_NO_STORE_HEADERS:{'Cache-Control':'private, no-store'}},'@/lib/organizations':{organizationId:v=>v,organizationContext:async()=>({owner})},'@/lib/supabaseAdmin':{supabaseAdmin:db}});
 const response=await route.GET(new Request('https://blue.test/ledger'),{params:{id:org.id}});assert.equal(response.status,owner?200:403);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(queries.length,owner?2:0);for(const q of queries){assert.equal(q.key,'organization_id');assert.equal(q.value,org.id);assert.ok(q.limit<=100);}
 }
});


test('shared AuthProvider keeps Organization and personal dashboards quiet on focus and auth events',async()=>{
 for(const pathname of ['/organizations/'+org.id+'/admin','/console']){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://blue.test'+pathname});const keys=['window','document','IS_REACT_ACT_ENVIRONMENT'],previous={};for(const key of keys){previous[key]=global[key];global[key]=key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key];}
  let callback,reads=0;const session={user:{id:'owner'},access_token:'first'};
  class Cache {generation=0;setAccount(){}peek(){return this.data;}invalidate(){this.generation++;}async get(){reads++;this.data={user_id:'owner',wallet:{balance:0},subscription:{plan:'lite'}};return this.data;}}
  const provider=load('app/contexts/AuthContext.tsx',{'react':React,'next/navigation':{usePathname:()=>pathname},'@/lib/accountCache':{AccountCache:Cache,WALLET_CACHE_TTL_MS:45000},'@/lib/supabase':{supabase:{auth:{onAuthStateChange:fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}}},getSession:async()=>({data:{session}})}}}}).AuthProvider;
  const root=createRoot(document.getElementById('root'));
  try{await React.act(async()=>{root.render(React.createElement(provider,null,React.createElement('div',null,'Dashboard')));await new Promise(r=>setTimeout(r,0));});const before=reads;assert.equal(before,pathname==='/console'?1:0);await React.act(async()=>{window.dispatchEvent(new window.Event('focus'));document.dispatchEvent(new window.Event('visibilitychange'));callback('SIGNED_IN',{...session});callback('TOKEN_REFRESHED',{...session,access_token:'renewed'});await new Promise(r=>setTimeout(r,0));});assert.equal(reads,before);}
  finally{await React.act(()=>root.unmount());dom.window.close();for(const key of keys)global[key]=previous[key];}
 }
});


test('workspace menu supports keyboard selection, Escape and outside dismissal',async()=>{
 const f=await ui();try{
  await f.click('Switch workspace: Imergene');assert.ok(document.querySelector('[role="menu"]'));assert.equal(document.activeElement.getAttribute('aria-checked'),'true');
  await React.act(()=>document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Home',bubbles:true})));assert.match(document.activeElement.textContent,/Personal workspace/);
  await React.act(()=>document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelector('[role="menu"]'),null);assert.match(document.activeElement.getAttribute('aria-label'),/Switch workspace/);
  await f.click('Switch workspace: Imergene');await React.act(()=>document.body.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true})));assert.equal(document.querySelector('[role="menu"]'),null);
  await f.click('Switch workspace: Imergene');await React.act(()=>document.querySelector('[role="menuitemradio"]').click());assert.deepEqual(f.navigations,['/console']);
 }finally{await f.close();}
});
