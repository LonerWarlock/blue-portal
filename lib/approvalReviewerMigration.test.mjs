import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const user = '11111111-1111-4111-8111-111111111111';
const reviewer = 'qwen/qwen3.8-27b:free';
const legacyReviewer = 'openai/gpt-5.4-mini';
const freeReviewerMigration = '028_blue_runtime_free_approval_reviewer.sql';
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

async function fixture({ balance = 1, upgraded = true } = {}) {
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
  if (upgraded) {
    await db.exec(await migration(freeReviewerMigration));
    // Retry the additive migration against its already-updated schema.
    await db.exec(await migration(freeReviewerMigration));
  }
  await db.query('insert into auth.users values ($1)', [user]);
  await db.query("insert into wallets (user_id,account_type,blue_credits) values ($1,'pro_payg',$2)", [user, balance]);
  await db.query("insert into blue_profiles (user_id,status,total_credits_purchased,access_tier) values ($1,'active',1,'trial')", [user]);
  return db;
}

async function admit(db, requestId, options = {}) {
  const { reviewed = true, hash = 'b'.repeat(64), deviceHash = 'a'.repeat(64),
    model = 'vendor/coding:free', reviewerModel = reviewer, free = true, mode = 'normal', userId = user,
    amount = !free || (reviewed && reviewerModel === legacyReviewer) ? 0.2 : 0 } = options;
  const args = [userId, requestId, deviceHash, hash, model, mode, free, 'trial', amount,
    10, 500, new Date(Date.now()+120_000).toISOString(), new Date(Date.now()+3_600_000).toISOString()];
  if (reviewed) args.push(reviewerModel);
  const functionName = reviewed ? 'admit_blue_runtime_task_v3' : 'admit_blue_runtime_task_v2';
  const result = await db.query(`select ${functionName}(${args.map((_, i) => `$${i+1}`).join(',')}) as admission`, args);
  return result.rows[0].admission;
}

async function extend(db, requestId, extensionId = 'review-extension-001') {
  const result = await db.query('select extend_blue_runtime_task($1,$2,$3,$4,$5) as extension',
    [user, requestId, extensionId, 0.2, new Date(Date.now()+3_600_000).toISOString()]);
  return result.rows[0].extension;
}

async function settle(db, requestId, cost) {
  const result = await db.query('select settle_blue_credit_reservation($1,$2,$3,$4,$5,$6) as settlement',
    [user, requestId, cost, 1.5, 1000, 100]);
  return result.rows[0].settlement;
}

test('free coding and free reviewer admit and replay at zero balance in one trial slot', async () => {
  const db = await fixture({ balance: 0 });
  try {
    const initial = await admit(db, 'reviewed-task-001');
    assert.equal(initial.state, 'provisioning');
    assert.equal(Number(initial.reserved), 0);
    assert.equal(Number(initial.remaining), 0);
    const duplicate = await admit(db, 'reviewed-task-001');
    assert.equal(duplicate.conflict, false);
    assert.equal(Number(duplicate.reserved), 0);
    assert.equal(Number(duplicate.remaining), 0);
    const row = (await db.query('select * from blue_runtime_tasks where request_id=$1', ['reviewed-task-001'])).rows[0];
    assert.equal(row.reviewer_model, reviewer);
    assert.equal(row.is_free, true, 'coding route still resolves the free variant');
    assert.equal(Number(row.requested_blue_credits), 0);
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_tasks')).rows[0].n, 1);
    const reservation = (await db.query('select model, reserved_blue_credits from billing_reservations')).rows[0];
    assert.equal(reservation.model, 'vendor/coding:free', 'review uses the coding task reservation');
    assert.equal(Number(reservation.reserved_blue_credits), 0);
    const second = await admit(db, 'legacy-free-002', { reviewed: false, hash: 'c'.repeat(64) });
    assert.equal(second.state, 'queued', 'trial cap is one real task, not a hidden reviewer task');
    assert.equal(Number(second.remaining), 0);
    const third = await admit(db, 'queued-review-003', { hash: 'd'.repeat(64) });
    assert.equal(third.state, 'queued');
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks where request_id=$1', ['queued-review-003'])).rows[0].reviewer_model, reviewer);
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 1,
      'queued reviewed work has no extra reservation before promotion');
    assert.equal(Number((await settle(db, 'reviewed-task-001', 0)).charged), 0);
    assert.equal(Number((await settle(db, 'reviewed-task-001', 0)).remaining), 0);
    assert.equal((await db.query('select count(*)::int as n from billing_transactions')).rows[0].n, 1);
    await db.query("update blue_runtime_tasks set state='completed', execution_released_at=now() where request_id='reviewed-task-001'");
    const promoted = await admit(db, 'legacy-free-002', { reviewed: false, hash: 'c'.repeat(64) });
    assert.equal(promoted.state, 'provisioning');
    assert.equal(Number(promoted.reserved), 0);
    assert.equal(Number(promoted.remaining), 0);
    assert.equal((await db.query("select reviewer_model from blue_runtime_tasks where request_id='legacy-free-002'")).rows[0].reviewer_model, null);
    await db.query("update blue_runtime_tasks set state='completed', execution_released_at=now() where request_id='legacy-free-002'");
    const reviewedPromotion = await admit(db, 'queued-review-003', { hash: 'd'.repeat(64) });
    assert.equal(reviewedPromotion.state, 'provisioning');
    assert.equal(Number(reviewedPromotion.reserved), 0);
    assert.equal(Number(reviewedPromotion.remaining), 0);
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks where request_id=$1', ['queued-review-003'])).rows[0].reviewer_model, reviewer);
  } finally { await db.close(); }
});

test('only exact reviewers and the correct free or paid allowance are admitted', async () => {
  const db = await fixture();
  try {
    for (const reviewerModel of [null, '', 'openrouter/auto', 'qwen/qwen3.8-27b', 'vendor/other:free', `${reviewer} `]) {
      await assert.rejects(admit(db, 'invalid-model-001', { reviewerModel }), /Invalid approval reviewer model/);
    }
    for (const amount of [null, -0.1, 0.2]) {
      await assert.rejects(admit(db, 'invalid-free-001', { amount }), /Invalid runtime allowance for approval reviewer/);
    }
    for (const options of [
      { reviewerModel: legacyReviewer, amount: 0 },
      { reviewerModel: legacyReviewer, amount: null },
      { free: false, model: 'vendor/coding', amount: 0 },
      { free: false, model: 'vendor/coding', amount: -0.1 }
    ]) {
      await assert.rejects(admit(db, 'invalid-paid-001', options), /Invalid runtime allowance for approval reviewer/);
    }
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_tasks')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 0);
    assert.equal(Number((await db.query('select blue_credits from wallets where user_id=$1', [user])).rows[0].blue_credits), 1);
    await admit(db, 'valid-model-001');
    await assert.rejects(db.query('update blue_runtime_tasks set reviewer_model=$1 where request_id=$2',
      ['vendor/other:free', 'valid-model-001']), /blue_runtime_tasks_reviewer_model_check/);
  } finally { await db.close(); }
});

test('reviewer and runtime identity mismatches cannot widen or reuse a task', async () => {
  const db = await fixture();
  try {
    await admit(db, 'bound-task-001');
    for (const options of [
      { hash: 'd'.repeat(64) },
      { deviceHash: 'd'.repeat(64) },
      { model: 'vendor/different:free' },
      { mode: 'ui_max' },
      { free: false, amount: 0.2 },
      { reviewerModel: legacyReviewer, amount: 0.2 }
    ]) {
      assert.equal((await admit(db, 'bound-task-001', options)).conflict, true);
    }
    await assert.rejects(admit(db, 'bound-task-001', { userId: '22222222-2222-4222-8222-222222222222' }),
      /Request ID already belongs to another user/);
    await admit(db, 'old-free-001', { reviewed: false, hash: 'e'.repeat(64) });
    assert.equal((await admit(db, 'old-free-001', { hash: 'e'.repeat(64) })).conflict, true,
      'v3 cannot widen even a legacy task given the same incorrect payload hash');
    assert.equal(Number((await db.query('select blue_credits from wallets where user_id=$1', [user])).rows[0].blue_credits), 1);
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks where request_id=$1', ['bound-task-001'])).rows[0].reviewer_model, reviewer);
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks where request_id=$1', ['old-free-001'])).rows[0].reviewer_model, null);
  } finally { await db.close(); }
});

test('repeated migration retains service-only admission execution', async () => {
  const db = await fixture();
  try {
    const rights = (await db.query(`select has_function_privilege('anon',
      'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as authenticated,
      has_function_privilege('service_role', 'public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)', 'execute') as service`)).rows[0];
    assert.equal(rights.anon, false); assert.equal(rights.authenticated, false); assert.equal(rights.service, true);
  } finally { await db.close(); }
});

test('paid coding with free review retains one paid hold and idempotent extension and settlement', async () => {
  const db = await fixture();
  try {
    const options = { free: false, model: 'vendor/coding' };
    const initial = await admit(db, 'billing-task-001', options);
    assert.equal(Number(initial.reserved), 0.2);
    assert.equal(Number(initial.remaining), 0.8);
    assert.equal(Number((await admit(db, 'billing-task-001', options)).remaining), 0.8);
    let extension = await extend(db, 'billing-task-001');
    assert.equal(extension.extended, true);
    assert.equal(Number(extension.reserved), 0.4);
    extension = await extend(db, 'billing-task-001');
    assert.equal(extension.duplicate, true);
    assert.equal(Number(extension.remaining), 0.6);
    const first = await settle(db, 'billing-task-001', 0.1);
    assert.equal(Number(first.charged), 0.15);
    assert.equal(Number(first.remaining), 0.85);
    assert.equal(Number((await settle(db, 'billing-task-001', 0.1)).remaining), 0.85);
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks')).rows[0].reviewer_model, reviewer);
    assert.equal((await db.query('select count(*)::int as n from billing_transactions')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_tasks')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from blue_runtime_extensions')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('pre-upgrade paid reviewer bindings survive migration retries, replay, extension and queued promotion', async () => {
  const db = await fixture({ upgraded: false });
  try {
    const options = { reviewerModel: legacyReviewer };
    const initial = await admit(db, 'legacy-paid-001', options);
    assert.equal(Number(initial.reserved), 0.2);
    const queued = await admit(db, 'legacy-paid-002', { ...options, hash: 'c'.repeat(64) });
    assert.equal(queued.state, 'queued');
    const before = (await db.query('select request_id, reviewer_model, requested_blue_credits, reserved_blue_credits from blue_runtime_tasks order by request_id')).rows;
    await db.exec(await migration(freeReviewerMigration));
    await db.exec(await migration(freeReviewerMigration));
    const after = (await db.query('select request_id, reviewer_model, requested_blue_credits, reserved_blue_credits from blue_runtime_tasks order by request_id')).rows;
    assert.deepEqual(after, before, 'the additive migration must preserve existing task bindings and allowances');
    await db.query('update wallets set blue_credits=0 where user_id=$1', [user]);
    const replay = await admit(db, 'legacy-paid-001', options);
    assert.equal(replay.conflict, false);
    assert.equal(Number(replay.reserved), 0.2);
    assert.equal(Number(replay.remaining), 0, 'the original hold is reused even when the wallet is empty');
    assert.equal((await admit(db, 'legacy-paid-001')).conflict, true, 'free review cannot replace a persisted paid reviewer');
    await db.query('update wallets set blue_credits=0.8 where user_id=$1', [user]);
    assert.equal(Number((await extend(db, 'legacy-paid-001')).reserved), 0.4);
    assert.equal((await extend(db, 'legacy-paid-001')).duplicate, true);
    assert.equal(Number((await settle(db, 'legacy-paid-001', 0.1)).remaining), 0.85);
    assert.equal(Number((await settle(db, 'legacy-paid-001', 0.1)).remaining), 0.85);
    await db.query("update blue_runtime_tasks set state='completed', execution_released_at=now() where request_id='legacy-paid-001'");
    const promoted = await admit(db, 'legacy-paid-002', { ...options, hash: 'c'.repeat(64) });
    assert.equal(promoted.state, 'provisioning');
    assert.equal(Number(promoted.reserved), 0.2, 'legacy review still reserves its original paid allowance');
    assert.equal(Number(promoted.remaining), 0.65);
    assert.equal((await db.query('select reviewer_model from blue_runtime_tasks where request_id=$1', ['legacy-paid-002'])).rows[0].reviewer_model, legacyReviewer);
    assert.equal((await db.query('select count(*)::int as n from billing_reservations')).rows[0].n, 2);
    assert.equal((await db.query('select count(*)::int as n from billing_transactions')).rows[0].n, 1);
  } finally { await db.close(); }
});
