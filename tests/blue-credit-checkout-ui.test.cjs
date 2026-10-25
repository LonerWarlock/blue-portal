'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function evaluate(file,imports,globals={}) { const c=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual(c.diagnostics,[]);const m={exports:{}};vm.runInNewContext(c.outputText,{module:m,exports:m.exports,URLSearchParams,Number,Math,Error,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected import '+name);return imports[name];},...globals});return m.exports; }
const display=evaluate('lib/creditCheckoutDisplay.ts',{});
const pack=(id,credits)=>({id,name:id,description:'Fixture credits',credits,basePriceUSD:credits,basePriceINR:credits*100,platformFeePercent:30,platformFeeUSD:credits*.3,platformFeeINR:credits*30,priceUSD:credits*1.3,priceINR:credits*130});
const catalog=[pack('starter',1),pack('standard',15)];
test('display prices preserve one-for-one credits, checkout fees and total without extra credits',()=>{
 const p=display.customCreditPackDisplay(catalog[0],25);assert.equal(p.credits,25);assert.equal(p.basePriceUSD,25);assert.equal(p.platformFeeUSD,7.5);assert.equal(p.priceUSD,32.5);assert.equal(p.basePriceINR,2500);assert.equal(p.platformFeeINR,750);assert.equal(p.priceINR,3250);assert.equal(display.validCreditPackDisplay(p),true);
});
test('display never invents a price when configuration is missing, malformed or not the30percentcontract',()=>{
 for(const value of [undefined,{},catalog[0]&&{...catalog[0],priceUSD:1},{...catalog[0],platformFeePercent:0},{...catalog[0],credits:Infinity},{...catalog[0],basePriceUSD:2}])assert.equal(display.validCreditPackDisplay(value),false);
 assert.equal(display.customCreditPackDisplay(undefined,25),null);for(const credits of [0,9,101,25.5,Infinity])assert.equal(display.customCreditPackDisplay(catalog[0],credits),null);
});
test('Teams deep links select25 custom credits while untrusted invalid amounts use the safe default',()=>{
 assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=25').packId,'custom');assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=25').customCredits,25);
 assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=1e100').customCredits,25);assert.equal(display.initialCreditCheckoutSelection('?pack=unknown').packId,'starter');
});
const CurrencySelector=()=>null;
function harness({search='?pack=custom&credits=25',config=catalog,authenticated=true}={}) {
 const hooks=[],effects=[],requests=[],navigation=[],stored=[],scripts=[];let cursor=0,dirty=false,tree;
 const react={useState(initial){const i=cursor++;hooks[i]||={value:typeof initial==='function'?initial():initial};return[hooks[i].value,v=>{hooks[i].value=typeof v==='function'?v(hooks[i].value):v;dirty=true;}];},useRef(initial){const i=cursor++;hooks[i]||={value:{current:initial}};return hooks[i].value;},useEffect(fn,deps){const i=cursor++;if(!hooks[i]||deps.some((d,j)=>!Object.is(d,hooks[i].deps[j])))effects.push({i,fn,deps});}};
 const jsx=(type,props)=>({type,props}),browser={location:{search,origin:'https://example.invalid',href:''}};
 const document={body:{appendChild(node){scripts.push(node);}},createElement(tag){return{tag,appendChild(){},submit(){}};},getElementById(){return null;}};
 const Form=evaluate('app/blue-pro/checkout/checkout-form.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({push:x=>navigation.push(x)})},'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:authenticated?{access_token:'synthetic',user:{id:'buyer',email:'buyer@example.invalid'}}:null}})}}},'@/app/components/CurrencySelector':{CurrencySelector},'@/lib/creditCheckoutDisplay':display},{window:browser,document,process:{env:{}},sessionStorage:{setItem:(...a)=>stored.push(a)},fetch:async(...args)=>{requests.push(args);return{ok:true,json:async()=>({packs:config})};}}).CheckoutForm;
 function render(){cursor=0;dirty=false;effects.length=0;tree=Form();for(const {i,fn,deps} of effects.splice(0)){hooks[i]={deps,cleanup:fn()};}}
 function walk(node,fn){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,fn));return;}fn(node);walk(node.props?.children,fn);}
 function text(node){if(node==null||typeof node==='boolean')return'';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(node.props?.children);}
 function find(fn){let result;walk(tree,n=>{if(fn(n))result=n;});return result;}
 render();return{requests,navigation,stored,scripts,text:()=>text(tree),find,async flush(){for(let i=0;i<8;i++){await new Promise(r=>setImmediate(r));if(dirty)render();}},async currency(value){find(n=>n.type===CurrencySelector).props.onChange(value);await this.flush();}};
}
test('actual checkout preselects25credit purchase and shows INR subtotal,fee and gross total',async()=>{
 const h=harness();assert.match(h.text(),/Loading current credit prices/);await h.flush();assert.match(h.text(),/25 Blue Credits will be added/);assert.match(h.text(),/Credit subtotal₹2,500.00/);assert.match(h.text(),/Platform fee \(30%\)₹750.00/);assert.match(h.text(),/Total payable₹3,250.00/);assert.match(h.text(),/qualifies to activate or reactivate Blue Teams/);
 assert.equal(h.requests.length,1);assert.equal(h.requests[0][0],'/api/blue-pro/pack-config');
});
test('actual checkout displays USD fee,total and no extra usage markup',async()=>{
 const h=harness();await h.flush();await h.currency('USD');assert.match(h.text(),/Credit subtotal\$25.00/);assert.match(h.text(),/Platform fee \(30%\)\$7.50/);assert.match(h.text(),/Total payable\$32.50/);assert.match(h.text(),/platform fee does not add credits/);
});
test('actual checkout refuses malformed prices and keeps payment controls unavailable',async()=>{
 const h=harness({config:[{...catalog[0],priceUSD:1}]});await h.flush();assert.match(h.text(),/Credit prices could not be verified/);assert.ok(h.find(n=>n.type==='button'&&n.props.children==='Retry prices'));assert.equal(h.find(n=>n.type===CurrencySelector),undefined);assert.equal(h.scripts.length,0);
});
test('sign-in redirect preserves the25credit selection and no payment request is made',async()=>{
 const h=harness({authenticated:false});await h.flush();assert.equal(h.navigation[0],'/console');assert.equal(h.stored[0][0],'redirectAfterLogin');assert.equal(h.stored[0][1],'/blue-pro/checkout?pack=custom&credits=25');assert.equal(h.requests.length,1);
});
test('small top-ups accurately explain they cannot independently reactivate Teams',async()=>{
 const h=harness({search:'?pack=starter'});await h.flush();assert.match(h.text(),/1 Blue Credits will be added/);assert.match(h.text(),/Smaller packs can extend access that is already active/);assert.match(h.text(),/Total payable₹130.00/);
});

test('missing or duplicate catalogue choices never silently show one price while ordering another pack',async()=>{
 for(const config of [[catalog[0]],[catalog[1]],[...catalog,catalog[0]]]){
   const h=harness({search:'?pack=standard',config});await h.flush();assert.match(h.text(),/Credit pack choices could not be verified/);assert.equal(h.find(n=>n.type===CurrencySelector),undefined);assert.equal(h.scripts.length,0);
 }
});
