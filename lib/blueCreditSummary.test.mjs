import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { before, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { getBlueCreditSummary, publicBlueCreditSummary } from './blueCreditSummary.ts';

const summary = {
  available_blue_credits: 1.4, temporarily_held_blue_credits: 0.6,
  total_blue_credits: 2, hold_count: 2,
  pending_settlement_blue_credits: 0.2, pending_settlement_count: 1,
  as_of: '2026-09-30T00:00:00.000Z'
};

test('public summary has an explicit credential-free whitelist', () => {
  assert.deepEqual(publicBlueCreditSummary({ ...summary, key: 'secret', device_hash: 'private', reservations: [] }), summary);
  assert.deepEqual(publicBlueCreditSummary({ ...summary, available_blue_credits: '1.4' }), summary);
});

test('missing, malformed and inconsistent snapshots remain unavailable', () => {
  for (const input of [undefined, {}, [], { ...summary, hold_count: null },
    { ...summary, temporarily_held_blue_credits: undefined }, { ...summary, available_blue_credits: NaN },
    { ...summary, available_blue_credits: -1 }, { ...summary, total_blue_credits: 3 },
    { ...summary, pending_settlement_blue_credits: 1 }, { ...summary, pending_settlement_count: 3 },
    { ...summary, as_of: 'invalid' }]) assert.equal(publicBlueCreditSummary(input), undefined);
});

test('RPC failure never fabricates a zero hold and uses only the verified user', async () => {
  const calls = [];
  const database = { rpc: async (name, args) => { calls.push({ name, args }); return { data: summary }; } };
  assert.deepEqual(await getBlueCreditSummary(database, 'verified-user'), summary);
  assert.deepEqual(calls, [{ name: 'blue_credit_snapshot', args: { user_id_param: 'verified-user' } }]);
  assert.equal(await getBlueCreditSummary({ rpc: async () => ({ data: summary, error: new Error('unavailable') }) }, 'user'), undefined);
  assert.equal(await getBlueCreditSummary({ rpc: async () => { throw new Error('offline'); } }, 'user'), undefined);
});

let db;
const users = [1, 2].map(index => `00000000-0000-4000-8000-00000000000${index}`);
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
  for (const name of ['002_blue_pro.sql', '004_payg_production.sql', '007_zero_cost_reservations.sql',
    '010_blue_direct_runtime.sql', '012_blue_runtime_delayed_usage_settlement.sql',
    '013_expired_reservation_reconciliation.sql', '015_blue_runtime_heartbeat.sql', '020_blue_runtime_global_queue.sql']) {
    const source = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
    await db.exec(source.replace('create extension if not exists pgcrypto;', ''));
  }
  for (const user of users) {
    await db.query('insert into auth.users values($1)', [user]);
    await db.query("insert into wallets(user_id,balance,account_type,blue_credits) values($1,100,'pro_payg',2)", [user]);
    await db.query("insert into blue_profiles(user_id,status,total_credits_purchased,access_tier) values($1,'active',2,'full')", [user]);
  }
  await reserve('old-initial-failure', 0.2, users[1]);
  await insertTask('old-initial-failure', 'failed', 0.2, users[1]);
  await db.exec(await readFile(new URL('../supabase/migrations/024_blue_credit_clarity.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });
async function reserve(id, amount, user = users[0]) {
  return (await db.query('select reserve_blue_credits($1,$2,$3,$4) as receipt', [user, id, 'vendor/model', amount])).rows[0].receipt;
}
async function insertTask(id, state, amount, user = users[0], device = 'a') {
  await db.query(`insert into blue_runtime_tasks(request_id,user_id,device_hash,payload_hash,model,mode,is_free,access_tier,state,
    reserved_blue_credits,requested_blue_credits,expires_at) values($1,$2,$3,$4,'vendor/model','normal',false,'full',$5,$6,$6,now()+interval '1 hour')`,
  [id, user, device.repeat(64), 'b'.repeat(64), state, amount]);
}
async function snapshot(user = users[0]) {
  return (await db.query('select blue_credit_snapshot($1) as receipt', [user])).rows[0].receipt;
}
async function releaseInitial(id, user = users[0]) {
  return (await db.query('select release_unprovisioned_blue_runtime_task($1,$2) as receipt', [user, id])).rows[0].receipt;
}
async function wallet(user = users[0]) {
  return Number((await db.query('select blue_credits from wallets where user_id=$1', [user])).rows[0].blue_credits);
}

test('SQL snapshot aggregates all devices and legacy holds without double subtraction', async () => {
  await reserve('snapshot-other-device', 0.2);
  await insertTask('snapshot-other-device', 'active', 0.2, users[0], 'c');
  await reserve('snapshot-stopping-task', 0.2);
  await insertTask('snapshot-stopping-task', 'stopping', 0.2);
  await reserve('snapshot-legacy-hold', 0.2);
  await reserve('snapshot-free-hold', 0);
  await insertTask('snapshot-terminal-history', 'completed', 9);
  const value = publicBlueCreditSummary(await snapshot());
  assert.ok(value);
  assert.equal(value.available_blue_credits, 1.4);
  assert.equal(value.temporarily_held_blue_credits, 0.6);
  assert.equal(value.total_blue_credits, 2);
  assert.equal(value.hold_count, 3);
  assert.equal(value.pending_settlement_blue_credits, 0.2);
  assert.equal(value.pending_settlement_count, 1);
  assert.equal(Number((await snapshot(users[1])).temporarily_held_blue_credits), 0.2);
});

test('old uncharged initial failures are reopened for atomic release recovery', async () => {
  const task = (await db.query("select * from blue_runtime_tasks where request_id='old-initial-failure'")).rows[0];
  assert.equal(task.state, 'provisioning');
  assert.equal(task.unprovisioned_release_pending, true);
  assert.equal((await releaseInitial('old-initial-failure', users[1])).released, true);
  assert.equal(await wallet(users[1]), 2);
});

test('a failed release retains the hold and recoverable task; retry releases once', async () => {
  await reserve('retry-initial-failure', 0.2);
  await insertTask('retry-initial-failure', 'provisioning', 0.2);
  await db.query("update blue_runtime_tasks set unprovisioned_release_pending=true where request_id='retry-initial-failure'");
  const previous = await wallet();
  await db.exec(`create function reject_test_initial_refund() returns trigger language plpgsql as $$ begin
    if new.blue_credits > old.blue_credits then raise exception 'test refund failure'; end if; return new; end $$;
    create trigger reject_initial_refund before update on wallets for each row execute function reject_test_initial_refund();`);
  await assert.rejects(releaseInitial('retry-initial-failure'), /test refund failure/);
  const pending = (await db.query("select state,unprovisioned_release_pending from blue_runtime_tasks where request_id='retry-initial-failure'")).rows[0];
  assert.equal(pending.state, 'provisioning');
  assert.equal(pending.unprovisioned_release_pending, true);
  assert.equal(await wallet(), previous);
  await db.exec('drop trigger reject_initial_refund on wallets');
  assert.equal((await releaseInitial('retry-initial-failure')).released, true);
  assert.equal(await wallet(), previous + 0.2);
  assert.equal((await releaseInitial('retry-initial-failure')).released, false);
  assert.equal(await wallet(), previous + 0.2);
  const terminal = (await db.query("select state,unprovisioned_release_pending,balance_after from blue_runtime_tasks where request_id='retry-initial-failure'")).rows[0];
  assert.equal(terminal.state, 'failed');
  assert.equal(terminal.unprovisioned_release_pending, false);
  assert.equal(Number(terminal.balance_after), previous + 0.2);
});

test('release RPC refuses active admitted tasks and live credentials', async () => {
  await reserve('admitted-no-refund', 0.2);
  await insertTask('admitted-no-refund', 'active', 0.2);
  await db.query("update blue_runtime_tasks set unprovisioned_release_pending=true where request_id='admitted-no-refund'");
  const previous = await wallet();
  assert.equal((await releaseInitial('admitted-no-refund')).released, false);
  assert.equal(await wallet(), previous);
  await reserve('live-key-no-refund', 0.2);
  await insertTask('live-key-no-refund', 'provisioning', 0.2);
  await db.query("update blue_runtime_tasks set unprovisioned_release_pending=true where request_id='live-key-no-refund'");
  await db.query("insert into blue_runtime_credentials(request_id,key_hash,state,expires_at) values('live-key-no-refund','hash','active',now()+interval '1 hour')");
  const liveBalance = await wallet();
  await assert.rejects(releaseInitial('live-key-no-refund'), /live credential/);
  assert.equal(await wallet(), liveBalance);
});

test('browser database roles cannot invoke either service-only RPC', async () => {
  await db.exec('set role authenticated');
  try {
    await assert.rejects(snapshot(), /permission denied/);
    await assert.rejects(releaseInitial('retry-initial-failure'), /permission denied/);
  } finally { await db.exec('reset role'); }
});
