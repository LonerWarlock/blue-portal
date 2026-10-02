import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const user = '11111111-1111-4111-8111-111111111111';
const reviewer = 'openai/gpt-5.4-mini';
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.blue_request_cancellations (request_id text primary key, user_id uuid,
      requested_at timestamptz default now(), expires_at timestamptz default now()+interval '1 day');
  `);
  // gen_random_uuid is built into this PostgreSQL runtime; its optional pgcrypto
  // extension is not bundled in PGlite. Apply the real baseline otherwise intact.
  await db.exec((await migration('002_blue_pro.sql')).replace('create extension if not exists pgcrypto;', ''));
  await db.exec(await migration('004_payg_production.sql'));
  await db.exec(await migration('007_zero_cost_reservations.sql'));
  const direct = await migration('010_blue_direct_runtime.sql');
  // Existing baseline tables and the real extension RPC are applied verbatim.
  // Legacy cleanup grants target obsolete signatures not present in this small
  // fixture, so load only the relevant production sections of migration 010.
  await db.exec(direct.slice(0, direct.indexOf('create or replace function public.admit_blue_runtime_task(')));
  await db.exec(direct.slice(direct.indexOf('create or replace function public.extend_blue_runtime_task('),
    direct.indexOf('create or replace function public.rollback_blue_runtime_extension(')));
  await db.exec(await migration('015_blue_runtime_heartbeat.sql'));
  await db.exec(await migration('020_blue_runtime_global_queue.sql'));
  // Existing Supabase projects may grant direct EXECUTE by default. The new
  // function must remove these grants, not only the implicit PUBLIC grant.
  await db.exec('alter default privileges in schema public grant execute on functions to anon, authenticated;');
  await db.exec(await migration('025_blue_runtime_approval_reviewer.sql'));
  // Additive migration can be safely retried.
  await db.exec(await migration('025_blue_runtime_approval_reviewer.sql'));
  await db.query('insert into auth.users values ($1)', [user]);
  await db.query("insert into wallets (user_id,account_type,blue_credits) values ($1,'pro_payg',1)", [user]);
  await db.query("insert into blue_profiles (user_id,status,total_credits_purchased,access_tier) values ($1,'active',1,'trial')", [user]);
  return db;
}

async function admit(db, requestId, options = {}) {
  const { reviewed = true, hash = 'b'.repeat(64), amount = reviewed ? 0.2 : 0,
    model = 'vendor/coding:free', reviewerModel = reviewer, free = true } = options;
  const args = [user, requestId, 'a'.repeat(64), hash, model, 'normal', free, 'trial', amount,
    10, 500, new Date(Date.now()+120_000).toISOString(), new Date(Date.now()+3_600_000).toISOString()];
  if (reviewed) args.push(reviewerModel);
  const functionName = reviewed ? 'admit_blue_runtime_task_v3' : 'admit_blue_runtime_task_v2';
  const result = await db.query(`select ${functionName}(${args.map((_, i) => `$${i+1}`).join(',')}) as admission`, args);
  return result.rows[0].admission;
}

test('reviewed trial task has one slot/hold; replay does not double debit; normal v2 remains free', async () => {
  const db = await fixture();
  try {
    const initial = await admit(db, 'reviewed-task-001');
    assert.equal(initial.state, 'provisioning');
    assert.equal(Number(initial.reserved), 0.2);
    assert.equal(Number(initial.remaining), 0.8);
    const duplicate = await admit(db, 'reviewed-task-001');
    assert.equal(duplicate.conflict, false);
    assert.equal(Number(duplicate.remaining), 0.8);
    // Simulate the rest of the wallet being held by unrelated settled usage.
    // Replaying this request must not reserve a second allowance at zero balance.
    await db.query('update wallets set blue_credits=0 where user_id=$1', [user]);
    assert.equal(Number((await admit(db, 'reviewed-task-001')).remaining), 0);
    await db.query('update wallets set blue_credits=0.8 where user_id=$1', [user]);
    const row = (await db.query('select * from blue_runtime_tasks where request_id=$1', ['reviewed-task-001'])).rows[0];
    assert.equal(row.reviewer_model, reviewer);
    assert.equal(row.is_free, true, 'coding route still resolves the free variant');
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_tasks')).rows[0].n, 1);
    const second = await admit(db, 'legacy-free-002', { reviewed: false, hash: 'c'.repeat(64) });
    assert.equal(second.state, 'queued', 'trial cap is one real task, not a hidden reviewer task');
    assert.equal(Number(second.remaining), 0.8);
    await db.query("update blue_runtime_tasks set state='completed', execution_released_at=now() where request_id='reviewed-task-001'");
    const promoted = await admit(db, 'legacy-free-002', { reviewed: false, hash: 'c'.repeat(64) });
    assert.equal(promoted.state, 'provisioning');
    assert.equal(Number(promoted.reserved), 0);
    assert.equal((await db.query("select reviewer_model from blue_runtime_tasks where request_id='legacy-free-002'")).rows[0].reviewer_model, null);
  } finally { await db.close(); }
});

test('reviewer binding is immutable and new payload identity cannot reuse an old hold', async () => {
  const db = await fixture();
  try {
    await admit(db, 'bound-task-001');
    assert.equal((await admit(db, 'bound-task-001', { hash: 'd'.repeat(64) })).conflict, true);
    await assert.rejects(admit(db, 'bound-task-001', { reviewerModel: 'openrouter/auto' }), /Invalid approval reviewer model/);
    await assert.rejects(admit(db, 'other-task-001', { amount: 0 }), /positive runtime allowance/);
    await admit(db, 'old-free-001', { reviewed: false, hash: 'e'.repeat(64) });
    assert.equal((await admit(db, 'old-free-001', { hash: 'e'.repeat(64) })).conflict, true,
      'v3 cannot widen even a legacy task given the same incorrect payload hash');
    assert.equal(Number((await db.query('select blue_credits from wallets where user_id=$1', [user])).rows[0].blue_credits), 0.8);
    const rights = (await db.query(`select has_function_privilege('anon',
      'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as authenticated,
      has_function_privilege('service_role', 'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as service`)).rows[0];
    assert.equal(rights.anon, false); assert.equal(rights.authenticated, false); assert.equal(rights.service, true);
  } finally { await db.close(); }
});

test('review costs on a free coding task extend and settle once at the existing multiplier', async () => {
  const db = await fixture();
  try {
    await admit(db, 'billing-task-001');
    const params = [user, 'billing-task-001', 'review-extension-001', 0.2, new Date(Date.now()+3_600_000).toISOString()];
    let result = await db.query('select extend_blue_runtime_task($1,$2,$3,$4,$5) as extension', params);
    assert.equal(result.rows[0].extension.extended, true);
    assert.equal(Number(result.rows[0].extension.reserved), 0.4);
    result = await db.query('select extend_blue_runtime_task($1,$2,$3,$4,$5) as extension', params);
    assert.equal(result.rows[0].extension.duplicate, true);
    assert.equal(Number(result.rows[0].extension.remaining), 0.6);
    const settle = () => db.query('select settle_blue_credit_reservation($1,$2,$3,$4,$5,$6) as settlement',
      [user, 'billing-task-001', 0.1, 1.5, 1000, 100]);
    const first = (await settle()).rows[0].settlement;
    assert.equal(Number(first.charged), 0.15);
    assert.equal(Number(first.remaining), 0.85);
    assert.equal(Number((await settle()).rows[0].settlement.remaining), 0.85);
    assert.equal((await db.query('select count(*)::int as n from billing_transactions')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_tasks')).rows[0].n, 1);
  } finally { await db.close(); }
});
