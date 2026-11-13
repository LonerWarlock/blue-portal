import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteBlueCredits, quoteBlueCreditsFromInr } from './blueCreditPricing.ts';
test('flat INR quantities and rupee amounts use the same fixed rate',()=>{
 for(const credits of [1,5,15,25,100])assert.deepEqual(quoteBlueCredits(credits),{credits,priceINR:credits*115,priceUSD:credits*1.3});
 assert.equal(quoteBlueCreditsFromInr(575).credits,5);
 assert.equal(quoteBlueCreditsFromInr(500).credits,4.347826087);
 assert.equal(quoteBlueCreditsFromInr(1).credits,0.0086956522);
 assert.equal(quoteBlueCreditsFromInr(2874.99).credits<25,true);
 assert.equal(quoteBlueCreditsFromInr(2875).credits,25);
});
test('invalid quantities and unsupported money precision never create a quote',()=>{
 for(const v of [0,-1,101,1.5,'5',null,NaN,Infinity])assert.throws(()=>quoteBlueCredits(v),RangeError);
 for(const v of [0,-1,11500.01,1.001,'575',null,NaN,Infinity])assert.throws(()=>quoteBlueCreditsFromInr(v),RangeError);
});
