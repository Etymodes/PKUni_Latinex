import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createSourceLoader } from '../scripts/build-wechat.mjs';
const shared = createSourceLoader()('lib/community-avatar.ts');
const source = readFileSync(new URL('../wechat/miniprogram/lib/profile.js', import.meta.url), 'utf8');
const copyModule = { exports: {} };
vm.runInNewContext(readFileSync(new URL('../wechat/miniprogram/lib/copy.js', import.meta.url), 'utf8'), { module: copyModule });
const plain = value => JSON.parse(JSON.stringify(value));
const event = dataset => ({ currentTarget: { dataset } });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness(owner = 'alice', initialHandler) {
  const calls = [];
  let session = owner ? { user: { id: owner } } : null;
  let handler = initialHandler || (async (_path, method, data) => ({ avatar: method === 'PUT' ? data.avatar : { kind: 'preset', value: 'cat' } }));
  const api = { getSession: () => session, request: async (path, method = 'GET', data) => { calls.push({ path, method, data: data && plain(data), owner: session?.user.id }); return handler(path, method, data); } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => name === './api' ? api : shared });
  const page = { ...module.exports.profileActions, alive: true, generation: 0, owner,
    data: { view: 'account', locale: 'en', t: copyModule.exports.copies.en }, setData(update) { Object.assign(this.data, update); } };
  page.renderProfile();
  return { page, calls, expireSession() { session = null; }, handle(fn) { handler = fn; }, owner(value) { page.owner = value; session = value ? { user: { id: value } } : null; page.generation++; page.renderProfile(); } };
}

test('guest avatar settings are read-only; signed previews validate formats and save only explicitly', async () => {
  const guest = harness(null);
  guest.page.changeAvatarKind(event({ kind: 'initials' })); await guest.page.saveAvatar();
  assert.equal(guest.page.data.avatarPreview, '🐱'); assert.equal(guest.calls.length, 0);
  const h = harness(); await settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, 'GET');
  h.page.changeAvatarKind(event({ kind: 'initials' }));
  for (const value of ['A', 'AB', 'Ab', 'Abc']) { h.page.inputAvatar({ detail: { value } }); assert.equal(h.page.data.avatarValid, true); }
  for (const value of ['ABC', 'abc', 'A1', 'Abcd', 'Ab\n', '']) { h.page.inputAvatar({ detail: { value } }); assert.equal(h.page.data.avatarValid, false); await h.page.saveAvatar(); }
  assert.equal(h.calls.length, 1, 'previews and invalid input never write');
  h.page.inputAvatar({ detail: { value: 'Abc' } }); await h.page.saveAvatar();
  assert.deepEqual(h.calls[1], { path: '/api/community/profile', method: 'PUT', data: { avatar: { kind: 'initials', value: 'Abc' } }, owner: 'alice' });
  assert.equal(h.page.data.profileSaved, true); assert.equal(h.page.data.avatarDirty, false);
  h.page.selectAvatarPreset(event({ id: 'owl' }));
  assert.equal(h.page.data.avatarPreview, '🦉'); assert.equal(h.calls.length, 2);
  h.page.selectAvatarPreset(event({ id: 'https://example.test/avatar.png' }));
  assert.equal(h.page.data.avatarPreview, '🦉');
});

test('a late initial read preserves an edited draft; switching locale never writes or resets the preview', async () => {
  let finish;
  const h = harness('alice', () => new Promise(resolve => { finish = resolve; }));
  h.page.changeAvatarKind(event({ kind: 'initials' })); h.page.inputAvatar({ detail: { value: 'AB' } });
  finish({ avatar: { kind: 'preset', value: 'dog' } }); await settle();
  assert.equal(h.page.data.avatarPreview, 'AB'); assert.equal(h.page.data.avatarDirty, true);
  h.page.data.locale = 'zh-CN'; h.page.data.t = copyModule.exports.copies['zh-CN']; h.page.renderProfile();
  assert.equal(h.page.data.avatarPreview, 'AB'); assert.equal(h.page.data.avatarPresets[0].label, '猫'); assert.equal(h.calls.length, 1);
});

test('late profile saves cannot overwrite another account, and failures keep the local draft unconfirmed', async () => {
  const h = harness(); await settle();
  h.page.selectAvatarPreset(event({ id: 'fox' }));
  let finish;
  h.handle(() => new Promise(resolve => { finish = resolve; }));
  const save = h.page.saveAvatar();
  h.handle(async () => ({ avatar: { kind: 'preset', value: 'panda' } }));
  h.owner('bob'); await settle();
  finish({ avatar: { kind: 'preset', value: 'fox' } }); await save;
  assert.equal(h.page.data.avatarPreview, '🐼'); assert.equal(h.page.data.profileSaved, false);
  h.page.selectAvatarPreset(event({ id: 'peach' }));
  h.handle(async () => { throw new Error('Network unavailable'); });
  await h.page.saveAvatar();
  assert.equal(h.page.data.avatarPreview, '🍑'); assert.equal(h.page.data.profileSaved, false); assert.equal(h.page.data.avatarDirty, true);
  assert.equal(h.page.data.profileError, h.page.data.t.avatarSaveError);
  h.page.data.locale = 'zh-CN'; h.page.data.t = copyModule.exports.copies['zh-CN']; h.page.renderProfile();
  assert.equal(h.page.data.profileError, h.page.data.t.avatarSaveError);
  h.owner(null); assert.equal(h.page.data.avatarPreview, '🐱'); assert.equal(h.page.data.profileError, '');
});


test('expired sessions clear avatar work and offer recovery without accepting another account receipt', async () => {
  let failLoad;
  const load = harness('alice', () => new Promise((_resolve, reject) => { failLoad = reject; }));
  assert.equal(load.page.data.profileLoading, true);
  load.expireSession(); failLoad(new Error('Refresh token expired')); await settle();
  assert.equal(load.page.data.profileLoading, false); assert.equal(load.page.data.profileSaving, false);
  assert.equal(load.page.data.profileExpired, true);
  assert.equal(load.page.data.profileError, load.page.data.t.avatarSessionExpired);
  load.page.selectAvatarPreset(event({ id: 'fox' })); await load.page.saveAvatar();
  assert.equal(load.calls.length, 1); assert.equal(load.page.data.avatarPreview, '🐱');
  const save = harness(); await settle();
  save.page.selectAvatarPreset(event({ id: 'fox' }));
  save.handle(async () => { save.expireSession(); throw new Error('Refresh token expired'); });
  await save.page.saveAvatar();
  assert.equal(save.page.data.profileSaving, false); assert.equal(save.page.data.profileExpired, true);
  assert.equal(save.page.data.profileSaved, false); assert.equal(save.page.data.avatarDirty, true);
  assert.equal(save.page.data.profileError, save.page.data.t.avatarSessionExpired);
  await save.page.saveAvatar(); assert.equal(save.calls.length, 2);
  save.owner(null); assert.equal(save.page.data.profileExpired, false); assert.equal(save.page.data.profileError, '');
});
