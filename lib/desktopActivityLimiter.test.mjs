import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('database limiter is atomic, bounded, per-account, resets and denies browser-role access',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');`);
    const sql=await readFile(new URL('../supabase/migrations/038_desktop_activity_database_limiter.sql',import.meta.url),'utf8');
    await db.exec(sql);await db.exec(sql);
    const consume=async id=>(await db.query('select public.limit_desktop_activity($1) result',[id])).rows[0].result;
    // Prevent a wall-clock minute boundary from making a rate test flaky.
    await consume(owner);await db.exec(`update desktop_activity_rate_windows set window_start=date_trunc('minute',clock_timestamp()),requests=119 where user_id='${owner}'`);
    const results=await Promise.all(Array.from({length:12},()=>consume(owner)));
    assert.equal(results.filter(r=>r.allowed).length,1);assert.ok(results.filter(r=>!r.allowed).every(r=>r.remaining===0&&r.retry_after_seconds>=1&&r.retry_after_seconds<=60));
    assert.equal((await consume(other)).allowed,true);
    assert.equal((await db.query('select requests from desktop_activity_rate_windows where user_id=$1',[owner])).rows[0].requests,121);
    await db.query("update desktop_activity_rate_windows set window_start=window_start-interval '1 minute' where user_id=$1",[owner]);
    assert.deepEqual(await consume(owner),{allowed:true,remaining:119,retry_after_seconds:0});
    assert.equal((await db.query('select count(*) n from desktop_activity_rate_windows')).rows[0].n,2);
    for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(consume(owner),/permission denied/);}finally{await db.exec('reset role');}}
    await db.exec('set role service_role');try{assert.equal((await consume(other)).allowed,true);await assert.rejects(db.query('select * from desktop_activity_rate_windows'),/permission denied/);}finally{await db.exec('reset role');}
  }finally{await db.close();}
});
