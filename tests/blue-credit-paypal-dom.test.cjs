const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {JSDOM}=require('jsdom');
const rootDir=path.resolve(__dirname,'..');
function load(file,imports,globals={}){
 const source=fs.readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,URLSearchParams,Number,Math,Promise,Error,process:{env:{NEXT_PUBLIC_PAYPAL_CLIENT_ID:'synthetic-client'}},require(name){assert.ok(Object.hasOwn(imports,name),'Unexpected import '+name);return imports[name]},...globals});
 return module.exports;
}
test('USD checkout keeps React messages separate from SDK nodes through loading, edits and currency switches',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/blue-pro/checkout?pack=custom&credits=25'});
 const {window}=dom,document=window.document;
 const previous={};
 for(const [key,value] of Object.entries({window,document,navigator:window.navigator,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
  previous[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React;
 const scripts=[],instances=[],orders=[],errors=[];
 let failNextRender=false;
 const oldConsoleError=console.error;console.error=(...args)=>{const message=args.map(String).join(' ');if(!message.includes('Warning:'))errors.push(message)};
 window.addEventListener('error',event=>{errors.push(String(event.error||event.message));event.preventDefault()});
 const nativeAppend=document.body.appendChild.bind(document.body);
 document.body.appendChild=node=>{if(node.tagName==='SCRIPT'&&node.src.includes('paypal.com/sdk')){scripts.push(node);return node}return nativeAppend(node)};
 window.paypal={Buttons(options){const instance={options,node:null,host:null,closed:false};instances.push(instance);return{
  render(target){if(failNextRender){failNextRender=false;return Promise.reject(new Error('Synthetic SDK render failure'))}
   const host=typeof target==='string'?document.querySelector(target):target;assert.ok(host,'SDK render requires a mounted host');
   instance.host=host;instance.node=document.createElement('button');instance.node.textContent='Synthetic PayPal';host.appendChild(instance.node);return Promise.resolve();},
  close(){return new Promise(resolve=>setTimeout(()=>{instance.node?.remove();instance.closed=true;resolve()},30))}
 }}};
 const pricing=load(path.join(rootDir,'lib/blueCreditPricing.ts'),{});
 const display=load(path.join(rootDir,'lib/creditCheckoutDisplay.ts'),{'@/lib/blueCreditPricing':pricing});
 const packs=[1,15].map((credits,index)=>({id:index?'standard':'starter',name:index?'Full':'Starter',description:'Synthetic credits',credits,
  priceINR:115*credits,priceUSD:1.3*credits,basePriceINR:115*credits,basePriceUSD:1.3*credits,platformFeeINR:0,platformFeeUSD:0,platformFeePercent:0}));
 const fetch=async(url,options)=>{if(url==='/api/blue-pro/pack-config')return{ok:true,json:async()=>({packs})};
  if(url==='/api/blue-pro/paypal/create-order'){orders.push(JSON.parse(options.body));return{ok:true,json:async()=>({orderId:'ORDER',txnid:'test-tx'})}}throw Error('Unexpected network request '+url)};
 const CurrencySelector=({value,onChange})=>React.createElement('div',{},['INR','USD'].map(currency=>React.createElement('button',{key:currency,'aria-pressed':value===currency,onClick:()=>onChange(currency)},currency)));
 const formFile=process.env.BLUE_CREDIT_CHECKOUT_SOURCE||path.join(rootDir,'app/blue-pro/checkout/checkout-form.tsx');
 const Form=load(formFile,{react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/navigation':{useRouter:()=>({push(){}})},
  '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic',user:{email:'fixture@example.invalid'}}}})}}},
  '@/app/components/CurrencySelector':{CurrencySelector},'@/lib/creditCheckoutDisplay':display},{window,document,fetch,sessionStorage:window.sessionStorage}).CheckoutForm;
 class Boundary extends React.Component{constructor(p){super(p);this.state={error:null}}static getDerivedStateFromError(error){return{error}}
  componentDidCatch(error){errors.push(error.message)}render(){return this.state.error?React.createElement('p',{role:'alert'},this.state.error.message):this.props.children}}
 const root=createRoot(document.getElementById('root'));
 const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5))})};
 const click=async label=>{const button=Array.from(document.querySelectorAll('button')).find(node=>node.textContent===label);assert.ok(button,'Button '+label+' exists');await act(async()=>button.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await flush()};
 const edit=async value=>{const input=document.getElementById('custom-blue-credit-amount');assert.ok(input);await act(async()=>{
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
  input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));
 });await flush()};
 try{
  await act(async()=>root.render(React.createElement(Boundary,null,React.createElement(Form))));await flush();
  await click('USD');assert.equal(scripts.length,1);await act(async()=>scripts[0].onload());await flush();
  assert.deepEqual(errors,[],'loading the SDK must not make React remove missing nodes');
  assert.ok(document.getElementById('paypal-button-container-bluepro')?.querySelector('button'),'SDK buttons rendered');
  await click('By USD amount');await edit('');assert.match(document.body.textContent,/Enter a valid amount/);assert.ok(document.getElementById('custom-blue-credit-amount'));
  const beforeOrders=orders.length;await assert.rejects(instances.at(-1).options.createOrder(),/valid purchase amount|changed/);assert.equal(orders.length,beforeOrders);
  await edit('25.50');assert.match(document.body.textContent,/19.6153846154 Blue Credits/);await instances.at(-1).options.createOrder();assert.equal(orders.at(-1).customUsdAmount,25.5);
  for(let count=0;count<3;count++){
   const oldInstance=instances.at(-1);await click('INR');await click('USD');
   await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40))});
   await assert.rejects(oldInstance.options.createOrder(),/changed/,'retired SDK callbacks must not create payment orders');
   assert.ok(document.getElementById('paypal-button-container-bluepro')?.querySelector('button'),'late cleanup must not remove current SDK buttons');
   assert.deepEqual(errors,[]);
  }
  assert.equal(scripts.length,1,'currency toggles reuse the SDK script');
  await click('INR');failNextRender=true;await click('USD');assert.match(document.body.textContent,/PayPal could not load/);
  await click('Try loading PayPal again');assert.ok(document.getElementById('paypal-button-container-bluepro')?.querySelector('button'));
  assert.deepEqual(errors,[]);
 }finally{
  await act(async()=>root.unmount());await flush();console.error=oldConsoleError;dom.window.close();
  for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
 }
});
