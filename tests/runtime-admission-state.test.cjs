'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('typescript');
const filename=require('node:path').join(__dirname,'../lib/blueRuntime.ts');
const source=fs.readFileSync(filename,'utf8'),ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true);
const target=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getBlueRuntimeTask');
const code=ts.transpileModule(target.getText(ast)+'\nglobalThis.readTask=getBlueRuntimeTask;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture({afterModels='failed',credentialState}={}){
  const start={request_id:'request',user_id:'owner',device_hash:'bound-device',model:'model',state:'provisioning',is_free:false};
  let current={...start},provisions=0;
  const context={exports:{},Error,Date,assertConfigured(){},sha256:()=> 'bound-device',
    isTerminal:state=>['failed','completed','cancelled','expired'].includes(state),
    getTaskForUser:async()=>({...current}),requireTask:async()=>({...current}),
    recoverUnprovisionedTask:async t=>({...t,state:'failed'}),walletBalance:async()=>25,
    existingSettlement:async t=>({state:t.state,terminal_reason:t.terminal_reason}),
    getOpenRouterModels:async()=>{current={...current,state:afterModels,terminal_reason:'management connection failed: operation aborted due to timeout'};return [{id:'model'}];},
    resolveModel:models=>models[0],runtimeQueuePosition:async()=>2,promoteBlueRuntimeQueue:async()=>{},
    statusError:(status,message)=>Object.assign(new Error(message),{status}),
    BLUE_RUNTIME_ROTATION_WINDOW_MS:300000,getActiveCredential:async()=>credentialState?{state:credentialState}:undefined,
    disableAndObserveCredential:async()=>{},extendRuntimeExpiry:async()=>{},decryptCredential:()=>({token:'test-only'}),
    provisionCredential:async task=>{provisions++;if(!['active','provisioning'].includes(task.state))throw new Error('This Blue runtime has not received an execution slot');return {token:'test-only'};},
    activeOrProvision:async task=>credentialState==='provisioning'?undefined:context.provisionCredential(task),
    admissionPayload:async(t,credential)=>({state:t.state,credential,position:t.queue_position})};
  vm.runInNewContext(code,context);return {run:()=>context.readTask({userId:'owner'},'request','device'),provisions:()=>provisions};
}
test('runtime failure during a slow catalogue read returns its original terminal state without reprovisioning',async()=>{
  const f=fixture();const result=await f.run();assert.equal(result.state,'failed');assert.match(result.terminal_reason,/management connection failed/);assert.equal(f.provisions(),0);
});
test('a task that becomes queued during status lookup stays queued without receiving a credential',async()=>{
  const f=fixture({afterModels:'queued'}),result=await f.run();assert.equal(result.state,'queued');assert.equal(result.position,2);assert.equal(result.credential,undefined);assert.equal(f.provisions(),0);
});
test('an in-flight credential setup is not provisioned twice by status polling',async()=>{
  const f=fixture({afterModels:'provisioning',credentialState:'provisioning'}),result=await f.run();assert.equal(result.state,'provisioning');assert.equal(result.credential,undefined);assert.equal(f.provisions(),0);
});
test('a stopping runtime cannot be revived by a status lookup',async()=>{
  const f=fixture({afterModels:'stopping'});await assert.rejects(f.run(),e=>e.status===409&&/being settled/.test(e.message));assert.equal(f.provisions(),0);
});
