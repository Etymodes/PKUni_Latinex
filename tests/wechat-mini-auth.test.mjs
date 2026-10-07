import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = readFileSync(new URL('../wechat/miniprogram/lib/api.js', import.meta.url), 'utf8');
const configModule = { exports: {} };
vm.runInNewContext(readFileSync(new URL('../wechat/miniprogram/lib/config.js', import.meta.url), 'utf8'), { module: configModule });
const config = configModule.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const identity = (id) => ({ id, email: `${id}@example.test`, name: id });
const tokenResponse = (id, expiresIn = 3600, revision = 'initial') => ({
  access_token: `fixture-access-${id}-${revision}`,
  refresh_token: `fixture-refresh-${id}-${revision}`,
  expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  user: { ...identity(id), user_metadata: { name: id, private_field: 'not-for-ui' } },
});

function harness(saved) {
  const storage = new Map(saved ? [[config.sessionStorageKey, plain(saved)]] : []);
  const calls = [];
  const wx = {
    getStorageSync: (key) => storage.has(key) ? plain(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    removeStorageSync: (key) => storage.delete(key),
    request: (options) => calls.push(options),
  };
  const module = { exports: {} };
  vm.runInNewContext(apiSource, {
    module, wx, Date, Error, require: (name) => {
      assert.equal(name, './config');
      return config;
    },
  }, { filename: 'wechat/miniprogram/lib/api.js' });
  return {
    api: module.exports, calls, storage, wx,
    respond(index, statusCode, data) { calls[index].success({ statusCode, data }); },
  };
}

async function sent() {
  // Flush promise continuations without clocks, real HTTP, or credentials.
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

test('email login preserves the website UUID and exposes no tokens or private metadata', async () => {
  const h = harness();
  const pending = h.api.signIn(' alice@example.test ', 'fixture-password');
  assert.equal(h.calls[0].url, `${config.supabaseUrl}/auth/v1/token?grant_type=password`);
  assert.equal(h.calls[0].method, 'POST');
  assert.ok(h.calls[0].header.apikey === config.supabasePublishableKey, 'uses the public project key');
  assert.ok(h.calls[0].data.email === 'alice@example.test', 'trims only the email');
  h.respond(0, 200, tokenResponse('alice'));
  assert.deepEqual(plain(await pending), { user: identity('alice') });
  const publicSession = h.api.getSession();
  publicSession.user.id = 'tampered';
  assert.deepEqual(plain(h.api.getSession()), { user: identity('alice') });
  assert.equal(Object.hasOwn(h.storage.get(config.sessionStorageKey), 'password'), false);
  assert.deepEqual(Object.keys(h.storage.get(config.sessionStorageKey).user).sort(), ['email', 'id', 'name']);

  const result = h.api.request('/api/preferences', 'PUT', { language: 'ru', level: 'C' });
  await sent();
  assert.ok(h.calls[1].header.Authorization === `Bearer ${tokenResponse('alice').access_token}`, 'attaches the active account token');
  assert.equal(h.calls[1].url, `${config.apiOrigin}/api/preferences`);
  assert.deepEqual(plain(h.calls[1].data), { language: 'ru', level: 'C' });
  h.respond(1, 200, '{"ok":true}');
  assert.deepEqual(plain(await result), { ok: true });
});

test('expired concurrent requests share one refresh and use the rotated bearer', async () => {
  const h = harness(tokenResponse('alice', -10));
  const stats = h.api.getStats();
  const prefs = h.api.request('/api/preferences', 'PUT', { language: 'la', level: 'G' });
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].url.endsWith('grant_type=refresh_token'));
  assert.ok(h.calls[0].data.refresh_token === tokenResponse('alice').refresh_token, 'refreshes the saved token');
  h.respond(0, 200, tokenResponse('alice', 3600, 'rotated'));
  await sent();
  assert.equal(h.calls.length, 3);
  for (const call of h.calls.slice(1)) {
    assert.ok(call.header.Authorization === `Bearer ${tokenResponse('alice', 3600, 'rotated').access_token}`, 'uses the rotated token');
  }
  h.respond(1, 200, { progress: {} });
  h.respond(2, 200, { ok: true });
  await Promise.all([stats, prefs]);
  assert.ok(h.storage.get(config.sessionStorageKey).refresh_token === tokenResponse('alice', 3600, 'rotated').refresh_token, 'persists the rotated token');
});

test('logout blocks a late refresh from restoring the session or sending a write', async () => {
  const h = harness(tokenResponse('alice', -10));
  const result = h.api.request('/api/vocab', 'POST', { language: 'la', answers: [{ lemma: 'amo', correct: true }] });
  const rejected = assert.rejects(result, { status: 409, code: 'SESSION_CHANGED' });
  h.api.signOut();
  h.respond(0, 200, tokenResponse('alice', 3600, 'rotated'));
  await rejected;
  assert.equal(h.api.getSession(), null);
  assert.equal(h.storage.has(config.sessionStorageKey), false);
  assert.equal(h.calls.length, 1);
});

test('account switch rejects late reads and isolates persisted credentials', async () => {
  const h = harness(tokenResponse('alice'));
  const oldStats = h.api.getStats();
  const oldRejected = assert.rejects(oldStats, { code: 'SESSION_CHANGED' });
  await sent();
  const login = h.api.signIn('bob@example.test', 'fixture-password');
  assert.equal(h.api.getSession(), null);
  assert.equal(h.storage.has(config.sessionStorageKey), false);
  h.respond(1, 200, tokenResponse('bob'));
  await login;
  h.respond(0, 200, { progress: { 'alice-only': 'correct' } });
  await oldRejected;
  assert.deepEqual(plain(h.api.getSession()), { user: identity('bob') });
  const newStats = h.api.getStats();
  await sent();
  assert.ok(h.calls[2].header.Authorization === `Bearer ${tokenResponse('bob').access_token}`, 'never reuses the old account token');
  h.respond(2, 200, { progress: {} });
  await newStats;
  assert.equal(h.storage.get(config.sessionStorageKey).user.id, 'bob');
});

test('late login responses cannot undo a newer login or logout', async () => {
  const h = harness();
  const alice = h.api.signIn('alice@example.test', 'fixture-password');
  const aliceRejected = assert.rejects(alice, { code: 'SESSION_CHANGED' });
  const bob = h.api.signIn('bob@example.test', 'fixture-password');
  h.respond(1, 200, tokenResponse('bob'));
  await bob;
  h.respond(0, 200, tokenResponse('alice'));
  await aliceRejected;
  assert.equal(h.api.getSession().user.id, 'bob');
  const another = h.api.signIn('alice@example.test', 'fixture-password');
  const anotherRejected = assert.rejects(another, { code: 'SESSION_CHANGED' });
  h.api.signOut();
  h.respond(2, 200, tokenResponse('alice'));
  await anotherRejected;
  assert.equal(h.api.getSession(), null);
});

test('anonymous identity responses started during login cannot overwrite the signed-in account', async () => {
  const h = harness();
  const login = h.api.signIn('alice@example.test', 'fixture-password');
  const me = h.api.request('/api/me');
  const rejected = assert.rejects(me, { code: 'SESSION_CHANGED' });
  assert.equal(Object.hasOwn(h.calls[1].header, 'Authorization'), false);
  h.respond(0, 200, tokenResponse('alice'));
  await login;
  h.respond(1, 200, { authenticated: false, user: null });
  await rejected;
  assert.equal(h.api.getSession().user.id, 'alice');
});

test('transient refresh failures preserve a recoverable session; a later call may refresh', async () => {
  for (const status of [0, 429, 503]) {
    const h = harness(tokenResponse('alice', -10));
    const result = h.api.getStats();
    const rejected = assert.rejects(result, { status, code: status ? 'HTTP_ERROR' : 'NETWORK_ERROR' });
    if (status) h.respond(0, status, { error: 'Temporarily unavailable' });
    else h.calls[0].fail({ errMsg: 'raw transport details must not leak' });
    await rejected;
    assert.equal(h.api.getSession().user.id, 'alice');
    assert.equal(h.storage.get(config.sessionStorageKey).user.id, 'alice');
    assert.equal(h.calls.length, 1, 'does not automatically retry failures');
    const retry = h.api.getStats();
    h.respond(1, 200, tokenResponse('alice', 3600, 'rotated'));
    await sent();
    h.respond(2, 200, { progress: {} });
    await retry;
  }
});

test('invalid refresh clears credentials and never sends the protected request', async () => {
  const h = harness(tokenResponse('alice', -10));
  const result = h.api.getStats();
  const rejected = assert.rejects(result, { code: 'SESSION_CHANGED' });
  h.respond(0, 400, { error: 'invalid_grant' });
  await rejected;
  assert.equal(h.api.getSession(), null);
  assert.equal(h.storage.has(config.sessionStorageKey), false);
  assert.equal(h.calls.length, 1);
  await assert.rejects(h.api.getStats(), { status: 401, code: 'AUTH_REQUIRED' });
});

test('public overrides remain anonymous even with an expired session; private calls require login', async () => {
  const h = harness(tokenResponse('alice', -10));
  const result = h.api.getOverrides();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, `${config.apiOrigin}/api/questions`);
  assert.equal(Object.hasOwn(h.calls[0].header, 'Authorization'), false);
  h.respond(0, 200, { overrides: [] });
  assert.deepEqual(plain(await result), { overrides: [] });
  h.api.signOut();
  await assert.rejects(h.api.request('/api/progress', 'POST', {}), { status: 401, code: 'AUTH_REQUIRED' });
  assert.equal(h.calls.length, 1);
  const me = h.api.request('/api/me');
  assert.equal(Object.hasOwn(h.calls[1].header, 'Authorization'), false);
  h.respond(1, 200, { authenticated: false, user: null });
  assert.equal((await me).authenticated, false);
});

test('HTTP failures and raw wx failures become Error objects without replaying vocabulary increments', async () => {
  for (const status of [0, 401, 503]) {
    const h = harness(tokenResponse('alice'));
    const result = h.api.request('/api/vocab', 'POST', { language: 'la', answers: [{ lemma: 'amo', correct: true }] });
    const rejected = assert.rejects(result, (failure) => {
      assert.ok(failure instanceof Error);
      assert.equal(failure.status, status);
      assert.equal(failure.code, status ? 'HTTP_ERROR' : 'NETWORK_ERROR');
      assert.equal(Object.hasOwn(failure, 'errMsg'), false);
      assert.equal(failure.message.includes('raw transport details'), false);
      return true;
    });
    await sent();
    if (status) h.respond(0, status, '{"error":"Request rejected"}');
    else h.calls[0].fail({ errMsg: 'raw transport details' });
    await rejected;
    assert.equal(h.calls.length, 1);
  }
});

test('failed login removes prior credentials, and external URLs cannot receive tokens', async () => {
  const h = harness(tokenResponse('alice'));
  const login = h.api.signIn('bob@example.test', 'fixture-password');
  const rejected = assert.rejects(login, { status: 400, code: 'HTTP_ERROR' });
  h.respond(0, 400, { error_description: 'Invalid login credentials' });
  await rejected;
  assert.equal(h.api.getSession(), null);
  assert.equal(h.storage.has(config.sessionStorageKey), false);
  await assert.rejects(h.api.request('https://example.test/api/stats'), { code: 'INVALID_REQUEST' });
  assert.equal(h.calls.length, 1);
});

test('synchronous wx failures and malformed successful JSON are normalized', async () => {
  const h = harness();
  h.wx.request = () => { throw new Error('raw transport details'); };
  await assert.rejects(h.api.getOverrides(), { status: 0, code: 'NETWORK_ERROR' });
  h.wx.request = (options) => h.calls.push(options);
  const result = h.api.getOverrides();
  const rejected = assert.rejects(result, { code: 'INVALID_RESPONSE' });
  h.respond(0, 200, '<html>not JSON</html>');
  await rejected;
});
