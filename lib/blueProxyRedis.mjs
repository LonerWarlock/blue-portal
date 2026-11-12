// Redis is a fast admission/hold gate; Postgres independently enforces the same
// task ceiling. Losing Redis cannot mint credits or release a durable hold.
const HOLD = `
local prior = redis.call('HGET', KEYS[1], ARGV[1])
if prior then return 0 end
local count = redis.call('ZCARD', KEYS[2])
if count >= tonumber(ARGV[4]) then return -1 end
local available = tonumber(ARGV[3])
local held = tonumber(redis.call('HGET', KEYS[1], '_held') or '0')
if held + tonumber(ARGV[2]) > available then return -2 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('HINCRBY', KEYS[1], '_held', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[5], ARGV[1])
redis.call('EXPIRE', KEYS[1], 86400)
redis.call('EXPIRE', KEYS[2], 86400)
return 1`;
const RELEASE = `
local held = redis.call('HGET', KEYS[1], ARGV[1])
if held then redis.call('HINCRBY', KEYS[1], '_held', -tonumber(held)); redis.call('HDEL', KEYS[1], ARGV[1]) end
redis.call('ZREM', KEYS[2], ARGV[1])
return 1`;
const RATE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`;
const fail = () => Object.assign(new Error('Blue credit admission is temporarily unavailable.'), { status: 503 });
export async function redisCommand(env, command, fetcher = fetch) {
  const url = String(env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url.startsWith('https://') || !token) throw fail();
  try {
    const response = await fetcher(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(3000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw fail();
    const result = await response.json();
    if (result.error || result.result === undefined) throw fail();
    return result.result;
  } catch { throw fail(); }
}
export async function holdProxyCredits(env, { taskId, userId, callId, amount, ceiling }, fetcher = fetch) {
  const n = await redisCommand(env, ['EVAL', RATE, '1', `blue:proxy:rate:${userId}:${Math.floor(Date.now()/60000)}`], fetcher);
  if (Number(n) > 120) throw Object.assign(new Error('Too many Blue model requests. Retry shortly.'), { status: 429 });
  const result = await redisCommand(env, ['EVAL', HOLD, '2', `blue:proxy:{${taskId}}:holds`, `blue:proxy:{${taskId}}:calls`,
    callId, String(Math.ceil(amount * 1e10)), String(Math.floor(ceiling * 1e10)), '8', String(Date.now())], fetcher);
  if (Number(result) !== 1) throw Object.assign(new Error(Number(result) === -2 ? 'This task reached its model allowance.' : 'This model request is already active or the task is busy.'), { status: Number(result) === -2 ? 402 : 409 });
}
export async function releaseProxyHold(env, taskId, callId, fetcher = fetch) {
  return redisCommand(env, ['EVAL', RELEASE, '2', `blue:proxy:{${taskId}}:holds`, `blue:proxy:{${taskId}}:calls`, callId], fetcher);
}
