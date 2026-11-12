// Redis is a fast admission/hold gate; Postgres independently enforces the same
// task ceiling. Losing Redis cannot mint credits or release a durable hold.
// Upstash counts EVAL *and* redis.call commands. Admission is EVAL + ZRANGE
// + ZADD (three counted commands), settlement is one ZREM: four in total.
// One sorted set per account holds a fixed _rate marker and active call holds.
// Do not expire ambiguous holds: only confirmed Postgres settlement removes one.
// Idle accounts retain just one small rate marker, not a key per minute/poll.
export const ADMIT_PROXY_SCRIPT = `
local rows = redis.call('ZRANGE', KEYS[1], 0, -1, 'WITHSCORES')
local count, held, rate = 0, 0, 0
for i = 1, #rows, 2 do
  local member, score = rows[i], tonumber(rows[i+1])
  if member == '_rate' then
    if math.floor(score / 1024) == tonumber(ARGV[5]) then rate = score % 1024 end
  else
    if member == ARGV[2] then return 0 end
    local call = cjson.decode(member)
    if call[1] == ARGV[1] then count = count + 1; held = held + score end
  end
end
if rate >= 120 then return -3 end
if count >= 8 then return -1 end
if held + tonumber(ARGV[3]) > tonumber(ARGV[4]) then return -2 end
redis.call('ZADD', KEYS[1], tonumber(ARGV[5]) * 1024 + rate + 1, '_rate', ARGV[3], ARGV[2])
return 1`;
const gateKey = userId => `blue:proxy:v2:{${userId}}:gate`;
const callMember = (taskId, callId) => JSON.stringify([taskId, callId]);
const fail = () => Object.assign(new Error('Blue credit admission is temporarily unavailable.'), { status: 503 });
export async function redisCommand(env, command, fetcher = fetch) {
  const url = String(env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url.startsWith('https://') || !token) throw fail();
  try {
    const response = await fetcher(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(3000), redirect: 'manual', cache: 'no-store' });
    if (!response.ok) throw fail();
    const result = await response.json();
    if (result.error || result.result === undefined) throw fail();
    return result.result;
  } catch { throw fail(); }
}
export async function holdProxyCredits(env, { taskId, userId, callId, amount, ceiling }, fetcher = fetch) {
  const units = Math.ceil(amount * 1e10), available = Math.floor(ceiling * 1e10);
  if (!Number.isSafeInteger(units) || units < 0 || !Number.isSafeInteger(available) || available < 0) throw fail();
  const result = await redisCommand(env, ['EVAL', ADMIT_PROXY_SCRIPT, '1', gateKey(userId),
    taskId, callMember(taskId, callId), String(units), String(available), String(Math.floor(Date.now()/60000))], fetcher);
  if (Number(result) === -3) throw Object.assign(new Error('Too many Blue model requests. Retry shortly.'), { status: 429 });
  if (Number(result) !== 1) throw Object.assign(new Error(Number(result) === -2 ? 'This task reached its model allowance.' : 'This model request is already active or the task is busy.'), { status: Number(result) === -2 ? 402 : 409 });
}
export async function releaseProxyHold(env, taskId, callId, userId, fetcher = fetch) {
  return redisCommand(env, ['ZREM', gateKey(userId), callMember(taskId, callId)], fetcher);
}
