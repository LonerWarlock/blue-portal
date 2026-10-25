import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as activity from './desktopActivity.ts';

const require = createRequire(import.meta.url);
const {createDesktopActivityReporter} = require('../../BlueV2/desktop/electron/lib/desktop-activity.cjs');
test('actual Desktop reporter, authenticated route and SQL persist metadata once without billing or private content', async () => {
  const db = new PGlite(), owner = randomUUID(), other = randomUUID(), requests = [];
  let unavailable = false, now = Date.parse('2026-10-24T00:00:00Z');
  const token = `header.${Buffer.from(JSON.stringify({sub:owner})).toString('base64url')}.signature`;
  const store = {state:{account:{userId:owner},settings:{}},update(fn){fn(this.state)}};
  let reporter;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key);create table wallets(user_id uuid primary key,balance numeric);
      insert into auth.users values('${owner}'),('${other}');insert into wallets values('${owner}',50);`);
    await db.exec(await readFile(new URL('../supabase/migrations/035_desktop_activity_reporting.sql',import.meta.url),'utf8'));
    const source = await readFile(new URL('../app/api/desktop/activity/route.ts',import.meta.url),'utf8');
    const modules = {'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
      '@/lib/desktopActivity':activity,'@/lib/trafficControl':{checkRateLimit:async()=>({configured:true,allowed:true}),rateLimitHeaders:()=>({})},
      '@/lib/supabaseAdmin':{supabaseAdmin:{auth:{getUser:async received=>({data:{user:received===token?{id:owner}:null},error:null})},
        rpc:async(name,args)=>{
          assert.equal(name,'record_desktop_activity'); assert.equal(args.user_id_param,owner);
          if(unavailable) return {data:null,error:{message:'private backend error'}};
          const result = await db.query('select public.record_desktop_activity($1,$2,$3,$4,$5) result',
            [args.user_id_param,args.session_id_param,args.app_version_param,args.presence_param,JSON.stringify(args.runs_param)]);
          return {data:result.rows[0].result,error:null};
        }}}};
    const route = {};
    new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
      (name=>{assert.ok(name in modules,name);return modules[name]},route);
    reporter = createDesktopActivityReporter({store,portal:{connectionSessionGeneration:0,sessionToken:async()=>token},appVersion:'0.1.32',now:()=>now,
      timers:{setTimeout:()=>1,clearTimeout:()=>{}},fetch:async(url,init)=>{
        const body = JSON.parse(init.body); requests.push(body);
        assert.ok(activity.validateDesktopActivity(body));
        assert.doesNotMatch(init.body,/PRIVATE|private\.invalid|client-folder|raw stack|gsk-secret/);
        return route.POST(new Request(url,init));
      }});
    reporter.start();
    reporter.beginRun({key:'PRIVATE client-folder',kind:'team',provider:'opencode',model:'anthropic/claude-sonnet-4.5',engine:'opencode',prompt:'PRIVATE',url:'https://private.invalid'});
    assert.equal(await reporter.flush(),true);
    now+=1500;
    reporter.updateUsage('PRIVATE client-folder',{inputTokens:123,outputTokens:8,cacheReadTokens:0});
    reporter.finishRun('PRIVATE client-folder',{status:'failed',error:Error('Timed out: PRIVATE raw stack')});
    unavailable = true; assert.equal(await reporter.flush(),false);
    unavailable = false; assert.equal(await reporter.flush(),true);
    assert.equal(await reporter.flush(),true);
    const rows = (await db.query('select * from desktop_task_runs')).rows;
    assert.equal(rows.length,1); assert.equal(rows[0].user_id,owner); assert.equal(rows[0].revision,2);
    assert.equal(rows[0].status,'failed'); assert.equal(rows[0].error_code,'timeout');
    assert.equal(rows[0].model,'anthropic/claude-sonnet-4.5'); assert.equal(rows[0].input_tokens,123); assert.equal(rows[0].cache_read_tokens,0);
    assert.ok((await db.query('select last_seen_at from desktop_app_sessions')).rows[0].last_seen_at);
    for(const model of ['gsk-secret','provider/github_pat_secret','https:/private','C:/Users']) {
      const key=randomUUID();reporter.beginRun({key,kind:'chat',provider:'openrouter',model});reporter.finishRun(key,{});
    }
    assert.equal(await reporter.flush(),true);
    const sanitized = requests.at(-1).runs; assert.equal(sanitized.length,4); assert.ok(sanitized.every(run=>run.model===null));
    assert.equal((await db.query('select count(*) as n from desktop_task_runs where user_id=$1',[other])).rows[0].n,0);
    assert.equal((await db.query('select balance from wallets')).rows[0].balance,'50');
    store.state.settings.activityReportingEnabled=false;reporter.syncAccount();const sent=requests.length;
    assert.equal(await reporter.flush(),false);assert.equal(requests.length,sent);assert.deepEqual(store.state.desktopActivity.owners,{});
  } finally {reporter?.dispose();await db.close();}
});
