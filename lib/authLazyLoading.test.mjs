import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/contexts/AuthContext.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'AuthContext.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, []);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const userSession = id => ({ user: { id }, access_token: `token-${id}` });
const sameDeps = (left, right) => left && right && left.length === right.length
  && left.every((value, index) => Object.is(value, right[index]));

// Run the actual provider and its effects with deterministic hook, SDK and
// cache adapters. No browser, Supabase accounts, requests or timers are used.
function providerHarness({ pathname = '/console', loadSdk, getSession, signOut } = {}) {
  let path = pathname;
  let cursor = 0;
  let dirty = false;
  let mounted = true;
  let tree;
  let authCallback;
  let sdkLoads = 0;
  let unsubscribes = 0;
  const slots = [];
  const effects = [];
  const log = [];
  const pendingEffects = new Set();
  const stateWrites = [];

  class FakeAccountCache {
    accountId = null;
    generation = 0;
    data = null;
    setAccount(id) {
      log.push(['cache.setAccount', id]);
      if (id !== this.accountId) { this.accountId = id; this.data = null; this.generation += 1; }
    }
    invalidate() { this.generation += 1; log.push(['cache.invalidate']); }
    peek() { return this.data; }
    async get(token, force) {
      log.push(['cache.get', token, force]);
      this.data = { user_id: this.accountId, wallet: { balance: 20 } };
      return this.data;
    }
  }

  const supabase = {
    auth: {
      onAuthStateChange(callback) {
        log.push(['sdk.subscribe']);
        authCallback = callback;
        return { data: { subscription: { unsubscribe() { unsubscribes += 1; log.push(['sdk.unsubscribe']); } } } };
      },
      getSession() {
        log.push(['sdk.getSession']);
        return getSession ? getSession() : Promise.resolve({ data: { session: null } });
      },
      signOut() {
        log.push(['sdk.signOut']);
        return signOut ? signOut() : Promise.resolve({ error: null });
      },
    },
  };

  const react = {
    createContext(defaultValue) { return { Provider: Symbol('AuthContext.Provider'), defaultValue }; },
    useContext(context) { return context.defaultValue; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        stateWrites.push({ mounted, index, value: next });
        if (!Object.is(slots[index], next)) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!effects[index] || !sameDeps(effects[index].deps, deps)) {
        const cleanup = effects[index]?.cleanup;
        effects[index] = { effect, deps, cleanup };
        pendingEffects.add(index);
      }
    },
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'next/navigation': { usePathname: () => path },
    '@/lib/accountCache': { AccountCache: FakeAccountCache, WALLET_CACHE_TTL_MS: 45_000 },
  };
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === '@/lib/supabase') {
        sdkLoads += 1;
        log.push(['sdk.load']);
        return loadSdk ? loadSdk({ supabase }) : { supabase };
      }
      assert.ok(Object.hasOwn(modules, name), `Unexpected provider import: ${name}`);
      return modules[name];
    },
    window: { setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  }, { filename: 'AuthContext.tsx', timeout: 1000 });

  function render() {
    cursor = 0;
    dirty = false;
    tree = exports.AuthProvider({ children: 'server-rendered public content' });
    const queued = [...pendingEffects];
    pendingEffects.clear();
    for (const index of queued) {
      effects[index].cleanup?.();
      effects[index].cleanup = effects[index].effect();
    }
    return tree.props.value;
  }

  async function flush() {
    // Drain the dynamic import, getSession and account-cache promise chains.
    for (let i = 0; i < 12; i += 1) {
      await Promise.resolve();
      if (mounted && dirty) render();
    }
    return tree.props.value;
  }

  function unmount() {
    mounted = false;
    for (const effect of effects) effect?.cleanup?.();
  }

  render();
  return {
    flush, unmount, log, stateWrites, supabase,
    navigate(nextPath) { path = nextPath; return render(); },
    emit(event, session) { assert.ok(authCallback, 'SDK must subscribe before emitting'); authCallback(event, session); },
    get value() { if (mounted && dirty) render(); return tree.props.value; },
    get loads() { return sdkLoads; },
    get unsubscribes() { return unsubscribes; },
    get children() { return tree.props.children; },
  };
}

test('public guides render without loading the auth SDK', async () => {
  for (const pathname of ['/', '/docs', '/guides/ai-agent-teams']) {
    const h = providerHarness({ pathname });
    await h.flush();
    assert.equal(h.loads, 0, pathname);
    assert.equal(h.value.loading, false);
    assert.equal(h.children, 'server-rendered public content');
    h.unmount();
  }
});

test('a direct Teams visit initializes the signed-in account without hiding public content', async () => {
  const h = providerHarness({ pathname:'/teams',getSession:()=>Promise.resolve({data:{session:userSession('teams-user')}}) });
  await h.flush();
  assert.equal(h.loads,1);
  assert.equal(h.value.user.id,'teams-user');
  assert.equal(h.value.account.user_id,'teams-user');
  assert.equal(h.children,'server-rendered public content');
  h.unmount();
});

test('existing auth-aware route prefixes load, subscribe and retrieve the session', async () => {
  for (const pathname of ['/console', '/console/settings', '/subscribe', '/pricing', '/teams', '/blue-pro', '/checkout/teams']) {
    const h = providerHarness({ pathname });
    await h.flush();
    assert.equal(h.loads, 1, pathname);
    assert.deepEqual(h.log.filter(entry => entry[0].startsWith('sdk.')).map(entry => entry[0]),
      ['sdk.load', 'sdk.subscribe', 'sdk.getSession']);
    assert.equal(h.value.loading, false);
    h.unmount();
    assert.equal(h.unsubscribes, 1);
  }
});

test('navigating from public content to an authenticated area loads the SDK only then', async () => {
  const h = providerHarness({ pathname: '/guides/ai-agent-teams' });
  await h.flush();
  assert.equal(h.loads, 0);
  h.navigate('/console');
  await h.flush();
  assert.equal(h.loads, 1);
  h.navigate('/pricing');
  await h.flush();
  assert.equal(h.loads, 1, 'same auth-enabled area must retain its subscription');
  h.unmount();
});

test('unmounting while the auth chunk is pending prevents late subscription or state changes', async () => {
  const load = deferred();
  let sdk;
  const h = providerHarness({ loadSdk(module) { sdk = module; return load.promise; } });
  await h.flush();
  assert.equal(h.loads, 1);
  h.unmount();
  const writesBeforeResolution = h.stateWrites.length;
  load.resolve(sdk);
  await h.flush();
  assert.equal(h.log.some(entry => entry[0] === 'sdk.subscribe'), false);
  assert.equal(h.log.some(entry => entry[0] === 'sdk.getSession'), false);
  assert.equal(h.stateWrites.length, writesBeforeResolution);
});

test('leaving an authenticated area before its SDK resolves also prevents late subscription', async () => {
  const load = deferred();
  let sdk;
  const h = providerHarness({ loadSdk(module) { sdk = module; return load.promise; } });
  await h.flush();
  h.navigate('/guides/ai-agent-teams');
  load.resolve(sdk);
  await h.flush();
  assert.equal(h.log.some(entry => entry[0] === 'sdk.subscribe'), false);
  assert.equal(h.value.user, null);
});

test('getSession cannot overwrite a newer auth event', async () => {
  const sessionRequest = deferred();
  const h = providerHarness({ getSession: () => sessionRequest.promise });
  await h.flush();
  h.emit('SIGNED_IN', userSession('new-user'));
  await h.flush();
  sessionRequest.resolve({ data: { session: userSession('stale-user') } });
  await h.flush();
  assert.equal(h.value.user.id, 'new-user');
  assert.equal(h.value.session.access_token, 'token-new-user');
  assert.equal(h.value.account.user_id, 'new-user');
  h.unmount();
});

test('late session retrieval after cleanup does not update unmounted provider state', async () => {
  const sessionRequest = deferred();
  const h = providerHarness({ getSession: () => sessionRequest.promise });
  await h.flush();
  h.unmount();
  assert.equal(h.unsubscribes, 1);
  const writesBeforeResolution = h.stateWrites.length;
  sessionRequest.resolve({ data: { session: userSession('late-user') } });
  await h.flush();
  assert.equal(h.stateWrites.length, writesBeforeResolution);
});

test('auth chunk failure is contained and ends loading without replacing public children', async () => {
  const h = providerHarness({ loadSdk() { throw new Error('ChunkLoadError: auth SDK unavailable'); } });
  await h.flush();
  assert.equal(h.value.loading, false);
  assert.equal(h.value.user, null);
  assert.match(h.value.accountError, /could not be loaded/i);
  assert.equal(h.children, 'server-rendered public content');
  assert.equal(h.log.some(entry => entry[0] === 'sdk.subscribe'), false);
  h.unmount();
});

test('getSession rejection retains the original signed-out fallback behavior', async () => {
  const h = providerHarness({ getSession: async () => { throw new Error('Offline'); } });
  await h.flush();
  assert.equal(h.value.loading, false);
  assert.equal(h.value.user, null);
  assert.equal(h.value.accountError, '');
  h.unmount();
});

test('signOut clears private cached state before lazily invoking the SDK', async () => {
  const h = providerHarness({ getSession: async () => ({ data: { session: userSession('user-a') } }) });
  await h.flush();
  assert.equal(h.value.account.user_id, 'user-a');
  h.log.length = 0;
  const result = h.value.signOut();
  assert.equal(h.log[0][0], 'cache.setAccount');
  assert.equal(h.log[0][1], null);
  assert.equal(h.value.user, null);
  assert.equal(h.value.account, null);
  await result;
  assert.deepEqual(h.log.filter(entry => entry[0].startsWith('sdk.')).map(entry => entry[0]),
    ['sdk.load', 'sdk.signOut']);
  h.unmount();
});

test('signOut SDK errors remain rejected rather than falsely reporting success', async () => {
  const h = providerHarness({ pathname: '/teams', signOut: async () => { throw new Error('Sign-out failed'); } });
  await h.flush();
  assert.equal(h.loads, 1);
  await assert.rejects(h.value.signOut(), /Sign-out failed/);
  assert.equal(h.value.user, null);
  assert.equal(h.value.account, null);
  h.unmount();
});

test('signOut import failure remains rejected while local private state is cleared', async () => {
  const h = providerHarness({ pathname: '/teams', loadSdk() { throw new Error('SDK chunk unavailable'); } });
  await h.flush();
  await assert.rejects(h.value.signOut(), /SDK chunk unavailable/);
  assert.equal(h.value.user, null);
  assert.equal(h.value.account, null);
  h.unmount();
});

test('provider has only dynamic auth SDK imports and preserves its auth route scope', () => {
  assert.doesNotMatch(source, /import\s+(?!type\b)[^;\n]+\s+from\s+["']@\/lib\/supabase["']/);
  assert.equal((source.match(/import\(["']@\/lib\/supabase["']\)/g) || []).length, 2);
  assert.match(source, /const AUTH_AWARE_ROUTES = \["\/console", "\/subscribe", "\/pricing", "\/teams", "\/blue-pro", "\/checkout"\]/);
  assert.match(source, /\{children\}<\/AuthContext.Provider>/);
});
