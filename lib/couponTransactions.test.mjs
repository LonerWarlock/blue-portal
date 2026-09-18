import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
let db;
const users = [1, 2, 3].map(i => `00000000-0000-4000-8000-00000000000${i}`);
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create table public.wallets(user_id uuid primary key references auth.users(id), balance numeric(18,10) not null default 0,
      blue_credits numeric(18,10) not null default 0, account_type text not null default 'standard');`);
  for (let i = 0; i < users.length; i++) await db.query('insert into auth.users values ($1, $2)', [users[i], `u${i}@test.invalid`]);
  await db.exec(await readFile(new URL('../supabase/migrations/023_atomic_imr_coupons.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });
async function coupon(code, options = {}) {
  await db.query('insert into coupons(code,reward_amount,max_uses,per_user_limit,is_active,expires_at) values($1,$2,$3,$4,$5,$6)',
    [code, options.reward ?? 25, options.max ?? 0, options.perUser ?? 1, options.active ?? true, options.expiry ?? null]);
}
async function claim(code, user = users[0]) {
  return (await db.query('select claim_imr_coupon($1::uuid,$2) as receipt', [user, code])).rows[0].receipt;
}
test('atomic claim adds IMR once while preserving Blue credits', async () => {
  await db.query('insert into wallets values($1,10,2,\'pro_payg\')', [users[0]]);
  await coupon('ONCE');
  const receipts = await Promise.all([claim(' once '), claim('ONCE')]);
  assert.equal(receipts.filter(r => r.success).length, 1);
  assert.equal(receipts.find(r => !r.success).status, 409);
  const wallet = (await db.query('select * from wallets where user_id=$1', [users[0]])).rows[0];
  assert.equal(Number(wallet.balance), 35); assert.equal(Number(wallet.blue_credits), 2);
  assert.equal(wallet.account_type, 'pro_payg');
  assert.equal(Number((await db.query("select times_used from coupons where code='ONCE'")).rows[0].times_used), 1);
});
test('global limits are enforced for competing users', async () => {
  await coupon('GLOBAL', { max: 2 });
  const receipts = await Promise.all(users.map(user => claim('GLOBAL', user)));
  assert.equal(receipts.filter(r => r.success).length, 2);
});
test('invalid, inactive and expired codes never credit a wallet', async () => {
  await coupon('INACTIVE', { active: false }); await coupon('EXPIRED', { expiry: 1 });
  const beforeBalance = (await db.query('select balance from wallets where user_id=$1', [users[0]])).rows[0].balance;
  for (const code of ['MISSING', 'INACTIVE', 'EXPIRED', '!bad']) assert.equal((await claim(code)).success, false);
  assert.equal((await db.query('select balance from wallets where user_id=$1', [users[0]])).rows[0].balance, beforeBalance);
});
test('a redemption-write failure rolls back wallet and usage counter', async () => {
  await coupon('ROLLBACK');
  await db.exec(`create function reject_test_redemption() returns trigger language plpgsql as $$ begin
    if new.coupon_code = 'ROLLBACK' then raise exception 'test ledger failure'; end if; return new; end $$;
    create trigger reject_test before insert on coupon_redemptions for each row execute function reject_test_redemption();`);
  const previous = (await db.query('select balance from wallets where user_id=$1', [users[0]])).rows[0].balance;
  await assert.rejects(claim('ROLLBACK'), /test ledger failure/);
  assert.equal((await db.query('select balance from wallets where user_id=$1', [users[0]])).rows[0].balance, previous);
  assert.equal((await db.query("select times_used from coupons where code='ROLLBACK'")).rows[0].times_used, 0);
});
test('legacy import preserves claims, skips repeat imports and disables incomplete history', async () => {
  const payload = {
    coupons: [
      { code: 'OLD', reward_amount: 20, reward_type: 'imr', times_used: 1, is_active: 1 },
      { code: 'INCOMPLETE', reward_amount: 20, reward_type: 'imr', times_used: 2, is_active: 1 },
    ], redemptions: [{ coupon_code: 'OLD', user_id: 'old-admin-id', user_email: 'u0@test.invalid', reward_amount: 20 }],
  };
  const run = async () => (await db.query('select import_legacy_imr_coupons($1::jsonb) as result', [JSON.stringify(payload)])).rows[0].result;
  assert.deepEqual(await run(), { imported: 2, disabled: 1, skipped: 0 });
  assert.deepEqual(await run(), { imported: 0, disabled: 0, skipped: 2 });
  assert.equal((await claim('OLD')).status, 409);
  assert.equal((await claim('INCOMPLETE', users[2])).success, false);
});
test('browser roles cannot credit wallets or invoke admin import', async () => {
  await db.exec('set role authenticated');
  try {
    await assert.rejects(claim('ONCE'), /permission denied/);
    await assert.rejects(db.query('select import_legacy_imr_coupons($1)', [JSON.stringify({ coupons: [], redemptions: [] })]), /permission denied/);
  } finally { await db.exec('reset role'); }
});
