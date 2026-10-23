import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as plans from './blueTeamsPlans.ts';

const quote = (patch = {}) => ({version:1,mode:'upgrade',from_plan:'solo',
  quoted_at:'2026-10-15T00:00:00Z',effective_start:'2026-10-15T00:00:00Z',effective_end:'2026-10-30T00:00:00Z',
  base_amount_inr:'500.00',base_amount_usd:'7.92',currency_locked:'INR',...patch});

test('saved upgrade quotes use the immutable remaining-period amount, not a client or catalogue total',()=>{
  const metadata={teams_quote:quote(),price:1,base_price_inr:1,private_receipt:'not-public'};
  assert.equal(plans.blueTeamsCheckoutAmount('pro','INR',metadata),'500.00');
  assert.equal(plans.getBlueTeamsCheckoutQuote(metadata).private_receipt,undefined);
  assert.equal(plans.getBlueTeamsCheckoutQuote(metadata).effective_end,'2026-10-30T00:00:00Z');
  assert.throws(()=>plans.blueTeamsCheckoutAmount('pro','USD',metadata),/original payment currency/);
  assert.throws(()=>plans.blueTeamsCheckoutAmount('pro','INR',metadata,1),/upgrade adjustment/);
});

test('new/renewal quotes allow either currency and the existing IMR rule',()=>{
  const metadata={teams_quote:quote({mode:'new',from_plan:null,currency_locked:null,base_amount_inr:'1499.00',base_amount_usd:'15.83'})};
  assert.equal(plans.blueTeamsCheckoutAmount('pro','INR',metadata,100),'1449.00');
  assert.equal(plans.blueTeamsCheckoutAmount('pro','USD',metadata,100),'15.33');
  assert.equal(plans.blueTeamsCheckoutAmount('business','INR',{teams_quote:quote({mode:'renewal',currency_locked:null,base_amount_inr:'1.00'})}),'1.00');
});

test('malformed present quotes fail closed instead of reverting to full-price checkout',()=>{
  for (const value of [false,[],{},quote({version:2}),quote({mode:'free'}),quote({from_plan:null}),
    quote({currency_locked:'EUR'}),quote({base_amount_inr:'1e3'}),quote({base_amount_usd:1}),
    quote({base_amount_inr:'0.00'}),quote({effective_end:'invalid'}),quote({effective_end:'2026-10-14T00:00:00Z'}),
    quote({effective_start:'2026-10-14T00:00:00Z'})]) {
    assert.throws(()=>plans.blueTeamsCheckoutAmount('pro','INR',{teams_quote:value}),/Invalid Teams payment quote/);
  }
  assert.equal(plans.getBlueTeamsCheckoutQuote({}),null);
  assert.equal(plans.blueTeamsCheckoutAmount('solo','INR',{blue_teams_test_mode:true}),'1.00','old receipts retain their old price');
});

const entitlement = {};
const code=ts.transpileModule(await readFile(new URL('./blueTeamsEntitlement.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',code)(()=>plans,entitlement);
test('a saved next plan survives expiry only as a payment-required preference, never active access',()=>{
  const row={plan:'pro',status:'active',current_period_end:'2026-10-30T00:00:00Z',metadata:{
    secret:'not-public',scheduled_change:{plan:'solo',change_at:'2026-10-30T00:00:00Z',payment_required:true}}};
  const active=entitlement.activeBlueTeamsEntitlement(row,Date.parse('2026-10-29T00:00:00Z'));
  assert.equal(active.plan,'pro');assert.equal(active.scheduled_change.plan,'solo');assert.equal(active.secret,undefined);
  const expired=entitlement.activeBlueTeamsEntitlement(row,Date.parse('2026-10-31T00:00:00Z'));
  assert.equal(expired.plan,null);assert.equal(expired.status,'inactive');assert.equal(expired.agents_per_team,0);
  assert.equal(expired.scheduled_change.payment_required,true);
  for (const invalid of [{plan:'__proto__',change_at:row.current_period_end,payment_required:true},
    {plan:'solo',change_at:row.current_period_end,payment_required:false},
    {plan:'solo',change_at:'2026-10-01T00:00:00Z',payment_required:true}]) {
    assert.equal(entitlement.activeBlueTeamsEntitlement({...row,metadata:{scheduled_change:invalid}},Date.now()).scheduled_change,undefined);
  }
});
