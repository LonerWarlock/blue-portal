const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const esbuild = require(path.resolve(root, '..', 'BlueV2', 'desktop', 'node_modules', 'esbuild'));
const source = fs.readFileSync(path.join(root, 'demo', 'desktop', 'bridge.ts'), 'utf8');
const transformed = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
function bridge(reduced = true) {
  const module = { exports: {} };
  vm.runInNewContext(transformed, { module, exports: module.exports, setTimeout, clearTimeout, URLSearchParams });
  return module.exports.createDemoBridge({ location: { search: '?theme=dark' }, matchMedia: () => ({ matches: reduced }) }, () => {});
}
test('sample state is isolated, themed, and does not access real accounts', async () => {
  const demo = bridge();
  const state = await demo.bootstrap();
  assert.equal(state.settings.theme, 'dark');
  assert.equal(state.account.email, 'student@blue-demo.example');
  state.settings.selectedModel = 'modified';
  assert.notEqual((await demo.bootstrap()).settings.selectedModel, 'modified');
  await assert.rejects(demo.auth.signInWithPassword({ email: 'x', password: 'y' }), /preview/i);
  await assert.rejects(demo.setup.saveProvider({ provider: 'blue' }), /preview/i);
  assert.equal((await demo.connections.connectCanva()).connected, false);
  assert.equal((await demo.connections.connectVercel()).connected, false);
  assert.equal(await demo.openExternal('https://example.com'), false);
  assert.equal((await demo.rollback.list('demo-project'))[0].restorable, false);
});
test('actual renderer events include named agents, completion, and bounded messages', async () => {
  const demo = bridge(); const events = [];
  const dispose = demo.chats.onEvent(event => events.push(event));
  const result = await demo.chats.send({ chatId: 'demo-understand', text: 'Review the example', projectId: 'demo-project' });
  const agents = events.filter(event => event.type === 'agent_work');
  assert.deepEqual([...new Set(agents.map(event => event.agent.name))], ['Layout', 'Accessibility']);
  assert.equal(agents.filter(event => event.entry.status === 'completed').length, 2);
  assert.equal(events.filter(event => event.type === 'complete').length, 1);
  assert.match(result.messages.at(-1).text, /No AI calls/);
  await demo.modes.set({ mode: 'multiAgent', enabled: false });
  events.length = 0;
  await demo.chats.send({ chatId: 'demo-ui', text: 'x'.repeat(9000) });
  assert.equal(events.some(event => event.type === 'agent_work'), false);
  assert.equal(events.find(event => event.type === 'accepted').message.text.length, 6000);
  dispose();
});
test('question choice affects the answer and duplicate submission is rejected', async () => {
  const demo = bridge();
  const input = { chatId: 'demo-build', requestId: 'demo-planner-question', answers: [['Weekly board']] };
  assert.equal(await demo.questions.reply(input), true);
  assert.match((await demo.bootstrap()).messages['demo-build'].at(-1).text, /Weekly board/);
  assert.equal(await demo.questions.reply(input), false);
  assert.equal(await demo.questions.reply({ ...input, requestId: 'not-a-question' }), false);
});
test('Stop cancels the scripted task without producing a completed answer', async () => {
  const demo = bridge(false); const events = [];
  const dispose = demo.chats.onEvent(event => events.push(event));
  const running = demo.chats.send({ chatId: 'demo-ui', text: 'An example to stop' });
  assert.equal(await demo.chats.stop('demo-ui'), true);
  await running;
  assert.equal(events.some(event => event.type === 'complete'), false);
  assert.equal(events.some(event => event.type === 'state' && event.state === 'stopped'), true);
  dispose();
});
test('generated frame permits only its exact script and blocks all network/credential access', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'demos', 'blue-desktop', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const digest = crypto.createHash('sha256').update(script).digest('base64');
  assert.ok(html.includes(`script-src 'sha256-${digest}'`));
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.doesNotMatch(source, /\bfetch\s*\(|\bWebSocket\b|localStorage|sessionStorage|\brequire\s*\(/);
});
