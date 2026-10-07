import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../wechat/miniprogram/lib/community.js', import.meta.url), 'utf8');
const copiesModule = { exports: {} };
vm.runInNewContext(readFileSync(new URL('../wechat/miniprogram/lib/copy.js', import.meta.url), 'utf8'), { module: copiesModule });
const event = dataset => ({ currentTarget: { dataset } });
const row = (id = 'message-1', mine = false) => ({ id, text: 'Salve amice', authorName: 'Fixture learner', mine, createdAt: '2026-10-07T00:00:00Z', detectedLanguage: 'la' });
const response = messages => ({ messages, warnings: 0, mutedUntil: null, aiAvailable: true });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness(owner = null) {
  const calls = [], timers = new Map();
  let timerId = 0, session = owner ? { user: { id: owner } } : null;
  let handler = async path => path.includes('?') ? response([]) : { message: row() };
  const api = { getSession: () => session, request: async (path, method = 'GET', data) => { calls.push({ path, method, data }); return handler(path, method, data); } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: () => api, wx: { showModal: options => options.success({ confirm: true }), showToast() {} },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id) });
  const page = { ...module.exports.communityActions, alive: true, visible: true, owner, generation: 0,
    data: { language: 'la', locale: 'en', t: copiesModule.exports.copies.en, view: 'community', communityChannel: 'language', communityDraft: '', communityItems: [] },
    setData(update) { Object.assign(this.data, update); } };
  return { page, calls, timers, handle(fn) { handler = fn; }, owner(value) { page.owner = value; session = value ? { user: { id: value } } : null; } };
}

test('anonymous room reads poll only while visible and hidden late responses cannot replace messages', async () => {
  const h = harness();
  h.handle(async () => response([row()]));
  h.page.updateCommunityPolling(); await settle();
  assert.equal(h.page.data.communityItems.length, 1);
  assert.equal([...h.timers.values()][0].delay, 10000);
  let resolve;
  h.handle(() => new Promise(done => { resolve = done; }));
  const pending = h.page.loadCommunity();
  h.page.visible = false; h.page.stopCommunity();
  resolve(response([row('late')])); await pending;
  assert.equal(h.page.data.communityItems[0].id, 'message-1');
  assert.equal(h.timers.size, 0);
  h.page.data.communityDraft = 'Guest text'; await h.page.sendCommunity();
  assert.equal(h.calls.some(call => call.method === 'POST'), false);
});

test('changing room, language or owner discards stale messages and private translations', async () => {
  const h = harness('alice');
  let resolve;
  h.handle(() => new Promise(done => { resolve = done; }));
  const old = h.page.loadCommunity();
  h.handle(async () => response([row('study-message')]));
  h.page.changeCommunityChannel(event({ channel: 'study' })); await settle();
  resolve(response([row('old-language-message')])); await old;
  assert.equal(h.page.data.communityItems[0].id, 'study-message');
  h.page.communityTranslations = { 'study-message': { en: 'Private translation' } };
  h.owner('bob'); h.page.updateCommunityPolling(); await settle();
  assert.equal(h.page.data.communityItems[0].translation, '');
  h.page.data.language = 'fr'; h.page.updateCommunityPolling();
  assert.equal(h.page.data.communityEnabled, false);
  assert.equal(h.timers.size, 0);
});

test('uncertain send retries keep the same client ID; a warning is displayed without automatic retry', async () => {
  const h = harness('alice');
  h.page.data.communityDraft = 'Message in an unexpected language with several words';
  h.handle(async () => { throw new Error('Reply lost'); });
  await h.page.sendCommunity();
  const id = h.calls[0].data.clientId;
  h.handle(async () => { throw Object.assign(new Error('warning'), { details: { error: 'language_warning', warnings: 1, mutedUntil: null } }); });
  await h.page.sendCommunity();
  assert.equal(h.calls[1].data.clientId, id);
  assert.equal(h.page.data.communityWarnings, 1);
  assert.equal(h.page.data.communityError, h.page.data.t.communityWarning);
  assert.equal(h.calls.length, 2);
  assert.equal(h.page.communityPending, null);
  h.page.data.communityDraft = 'Corrected text';
  h.handle(async path => path.includes('?') ? response([row('sent')]) : { message: row('sent'), warnings: 1, mutedUntil: null });
  await h.page.sendCommunity();
  assert.notEqual(h.calls[2].data.clientId, id);
  assert.equal(h.page.data.communityDraft, '');
});

test('language mute blocks only target-language sends, and translation is on demand for other messages', async () => {
  const h = harness('alice');
  h.page.data.communityMutedUntil = new Date(Date.now() + 3600000).toISOString();
  h.page.data.communityDraft = 'Salve';
  await h.page.sendCommunity(); assert.equal(h.calls.length, 0);
  h.page.data.communityChannel = 'study';
  h.handle(async path => path.includes('?') ? { ...response([row(), row('mine', true)]), warnings: 4, mutedUntil: h.page.data.communityMutedUntil } : path.endsWith('/translate') ? { translation: 'Hello, friend', detectedLanguage: 'la' } : { message: row(), warnings: 4, mutedUntil: h.page.data.communityMutedUntil });
  await h.page.sendCommunity();
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(h.page.data.communityMuted, false);
  await h.page.translateCommunity(event({ id: 'mine' }));
  assert.equal(h.calls.filter(call => call.path.endsWith('/translate')).length, 0);
  await h.page.translateCommunity(event({ id: 'message-1' }));
  assert.equal(h.calls.at(-1).data.locale, 'en');
  assert.equal(h.page.data.communityItems[0].translation, 'Hello, friend');
  h.page.data.locale = 'zh-CN'; h.page.renderCommunity();
  assert.equal(h.page.data.communityItems[0].translation, '');
});

test('a late mutation from an old owner cannot clear a new account draft; reporting and deletion are explicit', async () => {
  const h = harness('alice');
  h.page.data.communityDraft = 'Salve';
  let resolve;
  h.handle(() => new Promise(done => { resolve = done; }));
  const sending = h.page.sendCommunity();
  h.owner('bob'); h.page.data.communityDraft = 'New account draft';
  resolve({ message: row() }); await sending;
  assert.equal(h.page.data.communityDraft, 'New account draft');
  h.page.communityMessages = [row(), row('mine', true)];
  h.handle(async path => path.includes('?') ? response([]) : { ok: true });
  await h.page.moderateCommunity(event({ id: 'message-1', action: 'delete' }));
  assert.equal(h.calls.filter(call => call.method === 'DELETE').length, 0);
  await h.page.moderateCommunity(event({ id: 'message-1', action: 'report' }));
  assert.equal(h.calls.at(-1).path, '/api/community/messages/message-1/report');
  await h.page.moderateCommunity(event({ id: 'mine', action: 'delete' }));
  assert.equal(h.calls.filter(call => call.method === 'DELETE').length, 1);
});


test('hiding preserves the same-room draft; terminal mute clears retry ID and errors re-localize immediately', async () => {
  const h = harness('alice');
  h.page.updateCommunityPolling(); await settle();
  h.page.data.communityDraft = 'Draft';
  h.page.visible = false; h.page.stopCommunity(); h.page.visible = true;
  h.page.updateCommunityPolling(); await settle();
  assert.equal(h.page.data.communityDraft, 'Draft');
  h.handle(async () => { throw Object.assign(new Error('muted'), { details: { error: 'muted', warnings: 4, mutedUntil: new Date(Date.now() + 3600000).toISOString() } }); });
  await h.page.sendCommunity();
  assert.equal(h.page.communityPending, null);
  assert.equal(h.page.data.communityMuted, true);
  h.page.data.locale = 'zh-CN'; h.page.data.t = copiesModule.exports.copies['zh-CN']; h.page.renderCommunity();
  assert.equal(h.page.data.communityError, h.page.data.t.communityMute);
  h.page.visible = false; h.page.stopCommunity();
});
