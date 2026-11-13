'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function evaluate(file,imports,globals={}) { const c=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual(c.diagnostics,[]);const m={exports:{}};vm.runInNewContext(c.outputText,{module:m,exports:m.exports,URLSearchParams,Number,Math,Error,require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected import '+name);return imports[name];},...globals});return m.exports; }
const pricing=evaluate('lib/blueCreditPricing.ts',{});
const display=evaluate('lib/creditCheckoutDisplay.ts',{'@/lib/blueCreditPricing':pricing});
const pack=(id,credits)=>({id,name:id,description:'Fixture credits',credits,basePriceUSD:credits*1.3,basePriceINR:credits*115,platformFeePercent:0,platformFeeUSD:0,platformFeeINR:0,priceUSD:credits*1.3,priceINR:credits*115});
const catalog=[pack('starter',1),pack('standard',15)];
test('display prices use a flat INR115 rate without increasing usage credits',()=>{
 const p=display.customCreditPackDisplay(catalog[0],25);assert.equal(p.credits,25);assert.equal(p.basePriceUSD,32.5);assert.equal(p.platformFeeUSD,0);assert.equal(p.priceUSD,32.5);assert.equal(p.basePriceINR,2875);assert.equal(p.platformFeeINR,0);assert.equal(p.priceINR,2875);assert.equal(display.validCreditPackDisplay(p),true);
});
test('display never invents a price when configuration is missing, malformed or not the flat-rate contract',()=>{
 for(const value of [undefined,{},catalog[0]&&{...catalog[0],priceUSD:1},{...catalog[0],platformFeePercent:30},{...catalog[0],credits:Infinity},{...catalog[0],basePriceUSD:2}])assert.equal(display.validCreditPackDisplay(value),false);
 assert.equal(display.customCreditPackDisplay(undefined,25),null);for(const credits of [0,-1,101,25.5,Infinity])assert.equal(display.customCreditPackDisplay(catalog[0],credits),null);
});
test('Teams deep links select25 custom credits while untrusted invalid amounts use the safe default',()=>{
 assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=25').packId,'custom');assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=25').customCredits,25);
 assert.equal(display.initialCreditCheckoutSelection('?pack=custom&credits=1e100').customCredits,25);assert.equal(display.initialCreditCheckoutSelection('?pack=unknown').packId,'starter');
});
const CurrencySelector=()=>null;
function harness({search='?pack=custom&credits=25',config=catalog,authenticated=true,paypal=false}={}) {
 const hooks=[],effects=[],requests=[],navigation=[],stored=[],scripts=[],paypalButtons=[];let cursor=0,dirty=false,tree;
 const react={useState(initial){const i=cursor++;hooks[i]||={value:typeof initial==='function'?initial():initial};return[hooks[i].value,v=>{hooks[i].value=typeof v==='function'?v(hooks[i].value):v;dirty=true;}];},useRef(initial){const i=cursor++;hooks[i]||={value:{current:initial}};return hooks[i].value;},useEffect(fn,deps){const i=cursor++;if(!hooks[i]||deps.some((d,j)=>!Object.is(d,hooks[i].deps[j])))effects.push({i,fn,deps});}};
 const jsx=(type,props)=>({type,props}),browser={location:{search,origin:'https://example.invalid',href:''}};
 if(paypal)browser.paypal={Buttons:options=>{paypalButtons.push(options);return{render(){}};}};
 const paypalContainer={replaceChildren(node){this.child=node;}};
 const document={body:{appendChild(node){scripts.push(node);}},createElement(tag){return{tag,appendChild(){},submit(){},remove(){}};},getElementById(id){return paypal&&id==='paypal-button-container-bluepro'?paypalContainer:null;}};
 const Form=evaluate('app/blue-pro/checkout/checkout-form.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({push:x=>navigation.push(x)})},'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:authenticated?{access_token:'synthetic',user:{id:'buyer',email:'buyer@example.invalid'}}:null}})}}},'@/app/components/CurrencySelector':{CurrencySelector},'@/lib/creditCheckoutDisplay':display},{window:browser,document,process:{env:{}},sessionStorage:{setItem:(...a)=>stored.push(a)},fetch:async(...args)=>{requests.push(args);return{ok:true,json:async()=>args[0]==='/api/blue-pro/pack-config'?({packs:config}):({orderId:'ORDER',txnid:'synthetic-tx'})};}}).CheckoutForm;
 function render(){cursor=0;dirty=false;effects.length=0;tree=Form();walk(tree,n=>{if(n.props?.id==='paypal-button-container-bluepro'&&n.props.ref)n.props.ref.current=paypalContainer;});for(const {i,fn,deps} of effects.splice(0)){hooks[i]?.cleanup?.();hooks[i]={deps,cleanup:fn()};}}
 function walk(node,fn){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,fn));return;}fn(node);walk(node.props?.children,fn);}
 function text(node){if(node==null||typeof node==='boolean')return'';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(node.props?.children);}
 function find(fn){let result;walk(tree,n=>{if(fn(n))result=n;});return result;}
 render();return{requests,navigation,stored,scripts,paypalButtons,text:()=>text(tree),find,async flush(){for(let i=0;i<8;i++){await new Promise(r=>setImmediate(r));if(dirty)render();}},async currency(value){find(n=>n.type===CurrencySelector).props.onChange(value);await this.flush();}};
}
test('actual checkout preselects25credit purchase and shows the final flat INR total',async()=>{
 const h=harness();assert.match(h.text(),/Loading current credit prices/);await h.flush();assert.match(h.text(),/25 Blue Credits will be added/);assert.match(h.text(),/Rate per credit₹115/);assert.doesNotMatch(h.text(),/Platform fee|30%/);assert.match(h.text(),/Total payable₹2,875.00/);assert.match(h.text(),/qualifies to activate or reactivate Blue Teams/);
 assert.equal(h.requests.length,1);assert.equal(h.requests[0][0],'/api/blue-pro/pack-config');
});
test('actual checkout displays the existing USD total without a separate fee line',async()=>{
 const h=harness();await h.flush();await h.currency('USD');assert.match(h.text(),/Rate per credit\$1.30/);assert.doesNotMatch(h.text(),/Platform fee|30%/);assert.match(h.text(),/Total payable\$32.50/);assert.match(h.text(),/displayed price is the final total/);
});
test('actual checkout refuses malformed prices and keeps payment controls unavailable',async()=>{
 const h=harness({config:[{...catalog[0],priceUSD:1}]});await h.flush();assert.match(h.text(),/Credit prices could not be verified/);assert.ok(h.find(n=>n.type==='button'&&n.props.children==='Retry prices'));assert.equal(h.find(n=>n.type===CurrencySelector),undefined);assert.equal(h.scripts.length,0);
});
test('sign-in redirect preserves the25credit selection and no payment request is made',async()=>{
 const h=harness({authenticated:false});await h.flush();assert.equal(h.navigation[0],'/console');assert.equal(h.stored[0][0],'redirectAfterLogin');assert.equal(h.stored[0][1],'/blue-pro/checkout?pack=custom&credits=25');assert.equal(h.requests.length,1);
});
test('small top-ups accurately explain they cannot independently reactivate Teams',async()=>{
 const h=harness({search:'?pack=starter'});await h.flush();assert.match(h.text(),/1 Blue Credits will be added/);assert.match(h.text(),/Smaller packs can extend access that is already active/);assert.match(h.text(),/Total payable₹115.00/);
});

test('missing or duplicate catalogue choices never silently show one price while ordering another pack',async()=>{
 for(const config of [[catalog[0]],[catalog[1]],[...catalog,catalog[0]]]){
   const h=harness({search:'?pack=standard',config});await h.flush();assert.match(h.text(),/Credit pack choices could not be verified/);assert.equal(h.find(n=>n.type===CurrencySelector),undefined);assert.equal(h.scripts.length,0);
 }
});


test('five-credit deep link and custom INR entry send the same quantities shown in checkout',async()=>{
 const h=harness({search:'?pack=custom&credits=5'});await h.flush();
 assert.match(h.text(),/5 Blue Credits will be added/);assert.match(h.text(),/Total payable₹575.00/);
 await h.find(n=>n.type==='button'&&n.props.onClick&&[].concat(n.props.children).join('')==='By INR amount').props.onClick();await h.flush();
 h.find(n=>n.props?.id==='custom-blue-credit-amount').props.onChange({target:{value:'500'}});await h.flush();
 assert.match(h.text(),/4.347826087 Blue Credits will be added/);assert.match(h.text(),/Total payable₹500.00/);
 const pay=h.find(n=>n.type==='button'&&typeof n.props.onClick==='function'&&n.props.className?.includes('w-full px-6'));
 await pay.props.onClick();await h.flush();
 const posted=h.requests.find(([url])=>url==='/api/blue-pro/payu/create-hash');assert.ok(posted);
 const body=JSON.parse(posted[1].body);assert.equal(body.customInrAmount,500);assert.equal(body.customCredits,undefined);
});


function customAmountInput(h){return h.find(n=>n.props?.id==='custom-blue-credit-amount');}
function payButton(h){return h.find(n=>n.type==='button'&&typeof n.props.onClick==='function'&&n.props.className?.includes('w-full px-6'));}
async function editAmount(h,value){customAmountInput(h).props.onChange({target:{value}});await h.flush();}
async function amountMode(h,currency){h.find(n=>n.type==='button'&&[].concat(n.props.children).join('')===`By ${currency} amount`).props.onClick();await h.flush();}

test('INR field stays editable through deletion and typing2500 instead of forcing1 on every keystroke',async()=>{
 const h=harness();await h.flush();await amountMode(h,'INR');
 await editAmount(h,'1');await editAmount(h,'');
 assert.equal(customAmountInput(h).props.value,'');assert.equal(payButton(h).props.disabled,true);
 assert.doesNotMatch(h.text(),/Loading current credit prices/);
 await payButton(h).props.onClick();await h.flush();assert.equal(h.requests.length,1,'empty input cannot request a payment');
 for(const value of ['2','25','250','2500']){await editAmount(h,value);assert.equal(customAmountInput(h).props.value,value);}
 assert.match(h.text(),/21.7391304348 Blue Credits will be added/);assert.match(h.text(),/Total payable₹2,500.00/);
 await payButton(h).props.onClick();await h.flush();assert.equal(JSON.parse(h.requests[1][1].body).customInrAmount,2500);
});

test('minimum applies only after leaving an empty orzero input; invalid precision and range cannot be paid',async()=>{
 const h=harness();await h.flush();await amountMode(h,'INR');
 for(const value of ['','0']){
  await editAmount(h,value);assert.equal(customAmountInput(h).props.value,value);assert.equal(payButton(h).props.disabled,true);
  customAmountInput(h).props.onBlur();await h.flush();assert.equal(customAmountInput(h).props.value,'1');assert.equal(payButton(h).props.disabled,false);
 }
 for(const value of ['11501','2.001']){await editAmount(h,value);assert.equal(customAmountInput(h).props.value,value);assert.equal(payButton(h).props.disabled,true);}
 h.find(n=>n.type==='button'&&n.props.children==='By credits').props.onClick();await h.flush();
 await editAmount(h,'');assert.equal(customAmountInput(h).props.value,'');await editAmount(h,'50');assert.match(h.text(),/50 Blue Credits will be added/);
});

test('USD field accepts a new amount and sends it through the PayPal SDK order callback',async()=>{
 const h=harness({paypal:true});await h.flush();await h.currency('USD');await amountMode(h,'USD');
 await editAmount(h,'');assert.equal(customAmountInput(h).props.value,'');assert.equal(h.find(n=>n.props?.id==='custom-blue-credit-amount').props['aria-invalid'],true);
 for(const value of ['2','25','25.','25.5']){await editAmount(h,value);assert.equal(customAmountInput(h).props.value,value);}
 assert.match(h.text(),/19.6153846154 Blue Credits will be added/);assert.match(h.text(),/Total payable\$25.50/);
 const sdk=h.scripts.find(script=>script.src?.includes('paypal.com/sdk'));assert.ok(sdk);sdk.onload();await h.flush();
 assert.ok(h.paypalButtons.length);assert.equal(await h.paypalButtons.at(-1).createOrder(),'ORDER');
 const posted=h.requests.find(([url])=>url==='/api/blue-pro/paypal/create-order');assert.ok(posted);
 const body=JSON.parse(posted[1].body);assert.equal(body.customUsdAmount,25.5);assert.equal(body.customCredits,undefined);assert.equal(body.customInrAmount,undefined);
 const rendered=h.paypalButtons.length;await editAmount(h,'26');assert.equal(h.paypalButtons.length,rendered,'editing a valid amount reuses the rendered PayPal controls');
 await h.paypalButtons.at(-1).createOrder();assert.equal(JSON.parse(h.requests.at(-1)[1].body).customUsdAmount,26);
 const previous=h.paypalButtons.at(-1);await editAmount(h,'');const requestCount=h.requests.length;
 await assert.rejects(previous.createOrder(),/valid purchase amount|changed/);assert.equal(h.requests.length,requestCount);
 await editAmount(h,'0');assert.equal(customAmountInput(h).props.value,'0');customAmountInput(h).props.onBlur();await h.flush();assert.equal(customAmountInput(h).props.value,'1');
});
