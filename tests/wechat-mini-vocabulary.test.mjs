import { createSourceLoader as localeSourceLoader } from '../scripts/build-wechat.mjs';
const contentLocale = () => localeSourceLoader()('lib/content-locale.ts');
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { buildSharedSource, buildVocabularySource, loadProjectData } from '../scripts/build-wechat.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bank = loadProjectData(root);
const plain = value => JSON.parse(JSON.stringify(value));
const code = name => fs.readFileSync(path.join(root, 'wechat/miniprogram/lib', name + '.js'), 'utf8');
const now = '2026-10-07T00:00:00.000Z';
const storageKey = owner => `pikku-mini-vocabulary-v2:${owner || 'guest'}`;
function moduleFrom(source, dependencies, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name];
  }, ...extra });
  return module.exports;
}
const model = moduleFrom(buildVocabularySource('vocabulary-model'), {});
const shared = moduleFrom(buildSharedSource(), { './bank.js': bank });
const syncing = moduleFrom(buildVocabularySource('vocabulary-review-sync'), { './vocabulary-model.js': model });
const event = (id, outcome = 'remembered', time = now) => model.completeVocabularyReview(
  model.makePrediction([], 'ja', '覚える', time, 'word', undefined, time), outcome, time, id);

function harness(initialOwner = null) {
  let owner = initialOwner;
  const storage = new Map();
  const remote = new Map();
  const calls = [];
  let intercept;
  const wx = {
    getStorageSync: key => storage.has(key) ? plain(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, plain(value)),
  };
  const accountRows = () => {
    if (!remote.has(owner)) remote.set(owner, new Map());
    return remote.get(owner);
  };
  const api = {
    getSession: () => owner ? { user: { id: owner } } : null,
    async request(url, method = 'GET', data) {
      calls.push({ owner, url, method, data });
      if (intercept) {
        const result = await intercept({ owner, url, method, data });
        if (result !== undefined) return result;
      }
      const rows = accountRows();
      if (method === 'POST') {
        assert.equal(url, '/api/vocab/reviews');
        let inserted = 0;
        for (const item of data.events) if (!rows.has(item.id)) { rows.set(item.id, item); inserted++; }
        return { ok: true, count: data.events.length, inserted };
      }
      const query = new URL(url, 'https://fixture.test').searchParams;
      const offset = Number(query.get('cursor') || 0);
      const events = [...rows.values()].slice(offset, offset + 500);
      return { events, nextCursor: offset + 500 < rows.size ? String(offset + 500) : null };
    },
    async getStats() {
      if (intercept) {
        const result = await intercept({ owner, url: '/api/stats', method: 'GET' });
        if (result !== undefined) return result;
      }
      const counts = syncing.reviewCounts([...accountRows().values()]);
      return { progress: {}, bookmarks: [], vocab: Object.entries(counts).map(([key, stat]) => {
        const colon = key.indexOf(':'); return { language: key.slice(0, colon), lemma: key.slice(colon + 1), ...stat };
      }) };
    },
  };
  const vocabulary = moduleFrom(code('vocabulary'), {
    './api': api, '../data/content-locale': contentLocale(), '../data/bank': bank, '../data/shared': shared,
    '../data/vocabulary-model': model, '../data/vocabulary-review-sync': syncing,
  }, { wx });
  return { vocabulary, storage, remote, calls, wx, api,
    owner(value) { owner = value; }, intercept(value) { intercept = value; } };
}
function choose(h, memory, extra = {}) {
  return h.vocabulary.select(memory, { language: 'ja', level: 'M', mode: 'context', now, random: () => 0, ...extra });
}

test('unified entries retain every canonical word, cumulative CFGM levels, readings and neutral details', () => {
  const h = harness();
  assert.equal(h.vocabulary.entries({ language: 'ja' }).length, bank.vocabularyCards.filter(card => card.language === 'ja').length);
  for (const language of bank.languageOrder) {
    for (const level of ['C', 'F', 'G', 'M']) {
      const expected = bank.vocabularyCards.filter(card => card.language === language && shared.vocabularyMatchesLevel(card, level));
      assert.deepEqual(h.vocabulary.entries({ language, level }).map(card => card.id), expected.map(card => card.id));
      assert.deepEqual(h.vocabulary.entries({ language, level, scope: 'all' }).map(card => card.id), expected.map(card => card.id), 'obsolete scope cannot bypass the current level');
    }
  }
  const senses = bank.vocabularyCards.find(card => card.senses && card.senses.length > 1);
  assert.ok(senses);
  assert.ok(h.vocabulary.entries({ language: senses.language, query: senses.senses[1].reading }).some(card => card.id === senses.id));
  assert.deepEqual(plain(h.vocabulary.details(senses).senses), senses.senses.map(({ reading, gloss }) => ({ reading, gloss })));
  for (const card of bank.vocabularyCards) {
    const details = h.vocabulary.details(card);
    for (const key of ['sourcePages', 'sourceQuestionIds', 'notes', 'sourceNotes', 'batch']) assert.equal(Object.hasOwn(details, key), false);
  }
  const citation = bank.vocabularyCards.find(card => card.dictionaryReferences && card.dictionaryReferences.length);
  assert.ok(citation);
  assert.deepEqual(plain(h.vocabulary.details(citation).dictionaryReferences), citation.dictionaryReferences);
});

test('guest feedback is saved before advancement, idempotent and isolated from signed-in accounts', async () => {
  const h = harness();
  let memory = h.vocabulary.load(null, { 'ja:旧记录': { seen: 4, correct: 2 } });
  const selection = choose(h, memory);
  assert.ok(selection);
  memory = h.vocabulary.review(memory, selection, 'approximate', now);
  assert.equal(memory.reviews.length, 1);
  assert.equal(memory.reviews[0].outcome, 'approximate');
  assert.equal(memory.reviews[0].modelVersion, 'pikku-recall-v2');
  const stat = h.vocabulary.wordStats(memory, selection.card);
  assert.deepEqual(plain(stat), { seen: 1, correct: 0, approximate: 1, lastOutcome: 'approximate', lastAnsweredAt: now });
  assert.deepEqual(plain(h.vocabulary.review(memory, selection, 'remembered', now)), plain(memory));
  assert.deepEqual(plain(memory.stats['ja:旧记录']), { seen: 4, correct: 2 });
  assert.equal((await h.vocabulary.sync(null)).memory.reviews.length, 1);
  assert.equal(h.calls.length, 0);
  h.owner('alice');
  assert.equal(h.vocabulary.load('alice').reviews.length, 0);
  assert.throws(() => h.vocabulary.review(memory, selection, 'remembered', now), { code: 'SESSION_CHANGED' });
  await h.vocabulary.sync('alice');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 0, 'Guest records never auto-import');
  assert.equal(h.storage.get(storageKey(null)).reviews.length, 1);
});

test('frozen evidence uses effective word mode, future exploration does not write feedback and storage failure is visible', () => {
  const h = harness();
  const memory = h.vocabulary.load(null);
  const noContext = bank.vocabularyCards.find(card => card.language === 'ja' && !card.context.trim());
  const selection = choose(h, memory, { scope: 'all', focusId: noContext.id });
  assert.equal(selection.prediction.mode, 'word');
  assert.equal(selection.prediction.features[5], 0);
  const future = h.vocabulary.forecast(memory, selection.card, '2026-10-08T00:00:00.000Z', 'context', now);
  assert.equal(future.targetAt, '2026-10-08T00:00:00.000Z');
  assert.equal(h.storage.size, 0);
  assert.throws(() => h.vocabulary.review(memory, { ...selection, prediction: future }, 'remembered', now), /answer must follow/);
  h.wx.setStorageSync = () => { throw new Error('Storage full'); };
  assert.throws(() => h.vocabulary.review(memory, selection, 'remembered', now), /Storage full/);
  assert.equal(memory.reviews.length, 0);
});

test('partial POST success is retried without duplicate counts and preserves all 500-record pages', async () => {
  const h = harness('alice');
  const rows = Array.from({ length: 105 }, (_, index) => event(`local-${index}`, index % 2 ? 'approximate' : 'remembered'));
  h.storage.set(storageKey('alice'), { owner: 'alice', stats: syncing.reviewCounts(rows), reviews: rows, pendingReviewIds: rows.map(item => item.id) });
  h.remote.set('alice', new Map(Array.from({ length: 501 }, (_, index) => { const item = event(`remote-${index}`, 'forgotten'); return [item.id, item]; })));
  let posts = 0;
  h.intercept(async ({ method }) => { if (method === 'POST' && ++posts === 2) throw new Error('Offline'); });
  await assert.rejects(h.vocabulary.sync('alice'), /Offline/);
  assert.equal(h.storage.get(storageKey('alice')).pendingReviewIds.length, 105);
  assert.equal(h.remote.get('alice').size, 601);
  h.intercept(null);
  const result = await h.vocabulary.sync('alice');
  assert.equal(result.memory.reviews.length, 606);
  assert.equal(result.memory.pendingReviewIds.length, 0);
  assert.deepEqual(plain(result.memory.stats), { 'ja:覚える': { seen: 606, correct: 53 } });
  const postsAfterRetry = h.calls.filter(call => call.method === 'POST');
  assert.equal(postsAfterRetry[postsAfterRetry.length - 1].data.events.length, 5);
  await h.vocabulary.sync('alice');
  assert.equal(h.remote.get('alice').size, 606);
});

test('malformed remote pages and acknowledgments retain local pending feedback', async () => {
  for (const bad of ['page', 'ack']) {
    const h = harness('alice');
    const memory = h.vocabulary.load('alice');
    h.vocabulary.review(memory, choose(h, memory), 'remembered', now);
    h.intercept(async ({ url, method }) => {
      if (bad === 'page' && method === 'GET') return { events: [{ id: 'invalid' }], nextCursor: null };
      if (bad === 'ack' && method === 'POST') return { ok: true, count: 0, inserted: 0 };
    });
    await assert.rejects(h.vocabulary.sync('alice'), /Invalid vocabulary review/);
    assert.equal(h.vocabulary.load('alice').pendingReviewIds.length, 1);
  }
});

test('account changes during download cannot upload or overwrite either owner, and account history resumes', async () => {
  const h = harness('alice');
  const a = h.vocabulary.load('alice');
  h.vocabulary.review(a, choose(h, a), 'remembered', now);
  let release;
  h.intercept(({ method }) => method === 'GET' ? new Promise(resolve => { release = resolve; }) : undefined);
  const pending = h.vocabulary.sync('alice');
  h.owner('bob');
  release({ events: [], nextCursor: null });
  await assert.rejects(pending, { code: 'SESSION_CHANGED' });
  assert.equal(h.vocabulary.load('bob').reviews.length, 0);
  assert.equal(h.vocabulary.load('alice').pendingReviewIds.length, 1);
  assert.equal(h.calls.some(call => call.method === 'POST'), false);
  h.owner('alice'); h.intercept(null);
  assert.equal((await h.vocabulary.sync('alice')).memory.pendingReviewIds.length, 0);
});

test('a concurrent local feedback survives sync while the original event becomes acknowledged', async () => {
  const h = harness('alice');
  let memory = h.vocabulary.load('alice');
  memory = h.vocabulary.review(memory, choose(h, memory), 'remembered', now);
  let appended = false;
  h.intercept(async ({ url }) => {
    if (url === '/api/stats' && !appended) {
      appended = true;
      memory = h.vocabulary.review(memory, choose(h, memory), 'approximate', now);
    }
  });
  const result = await h.vocabulary.sync('alice');
  assert.equal(result.memory.reviews.length, 2);
  assert.equal(result.memory.pendingReviewIds.length, 1);
  assert.deepEqual(plain(result.memory.stats), plain(syncing.reviewCounts(result.memory.reviews)));
  assert.equal((await h.vocabulary.sync('alice')).memory.pendingReviewIds.length, 0);
});

test('API permits only the required authenticated review pagination query', async () => {
  const calls = [];
  const config = moduleFrom(code('config'), {});
  const session = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_at: Date.now() / 1000 + 3600, user: { id: 'alice' } };
  const api = moduleFrom(code('api'), { './config': config }, { wx: {
    getStorageSync: () => session,
    request(options) { calls.push(options); options.success({ statusCode: 200, data: { events: [], nextCursor: null } }); },
  } });
  await api.request('/api/vocab/reviews?limit=500&cursor=YWJjXy0');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].header.Authorization, 'Bearer fixture-access');
  for (const url of ['/api/vocab/reviews?limit=501', '/api/vocab/reviews?limit=500&owner=bob', '/api/vocab/reviews?limit=500&cursor=//evil', '/api/questions?foo=bar', 'https://evil.test/api/vocab/reviews']) {
    await assert.rejects(api.request(url), { code: 'INVALID_REQUEST' });
  }
  await assert.rejects(api.request('/api/vocab/reviews?limit=500', 'POST', {}), { code: 'INVALID_REQUEST' });
  assert.equal(calls.length, 1);
});

test('actual mini API and Worker share v1/v2 events and retry a committed write without inflation', async t => {
  const { default: worker } = await import('../worker/index.js?mini-vocabulary-real');
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  class Statement {
    constructor(sql, values = []) { this.sql = sql; this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    execute() {
      const prepared = database.prepare(this.sql);
      if (/^\s*(SELECT|PRAGMA)\b/i.test(this.sql)) return { results: prepared.all(...this.values) };
      return { results: [], meta: { changes: Number(prepared.run(...this.values).changes) } };
    }
    async all() { return this.execute(); }
    async run() { return this.execute(); }
    async first() { return database.prepare(this.sql).get(...this.values) || null; }
  }
  let chain = Promise.resolve();
  const env = { SUPABASE_URL: 'https://auth.fixture.test', SUPABASE_PUBLISHABLE_KEY: 'fixture-key', DB: {
    prepare: sql => new Statement(sql),
    batch(statements) {
      const result = chain.then(() => {
        database.exec('BEGIN');
        try { const values = statements.map(statement => statement.execute()); database.exec('COMMIT'); return values; }
        catch (error) { database.exec('ROLLBACK'); throw error; }
      });
      chain = result.catch(() => {}); return result;
    },
  } };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const id = options.headers.authorization.replace('Bearer ', '');
    return Response.json({ id, email: `${id}@example.test`, app_metadata: { provider: 'email' } });
  });
  const h = harness('alice');
  const config = moduleFrom(code('config'), {});
  h.storage.set(config.sessionStorageKey, { access_token: 'alice', refresh_token: 'alice-refresh', expires_at: Date.now() / 1000 + 3600, user: { id: 'alice' } });
  let dropReply = false;
  const requests = [];
  h.wx.request = options => {
    requests.push({ method: options.method, url: options.url });
    const headers = { 'content-type': 'application/json', authorization: options.header.Authorization || '' };
    const request = new Request(options.url, { method: options.method, headers,
      ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.data) }) });
    worker.fetch(request, env).then(async response => {
      const data = await response.json();
      if (dropReply && options.method === 'POST' && options.url.endsWith('/api/vocab/reviews')) {
        dropReply = false; options.fail({ errMsg: 'reply lost after server committed' });
      } else options.success({ statusCode: response.status, data });
    }).catch(options.fail);
  };
  const api = moduleFrom(code('api'), { './config': config }, { wx: h.wx });
  Object.assign(h.api, api);
  const first = choose(h, h.vocabulary.load('alice'));
  await api.request('/api/vocab', 'POST', { language: 'ja', answers: [{ lemma: first.card.term, seen: 5, correctCount: 3 }] });
  const legacy = { ...event('web-old-v1'), lemma: first.card.term, modelVersion: 'pikku-recall-v1', probability: 0.98 };
  delete legacy.probabilities;
  await api.request('/api/vocab/reviews', 'POST', { events: [legacy] });
  let { memory } = await h.vocabulary.sync('alice');
  assert.deepEqual(plain(memory.stats[`ja:${first.card.term}`]), { seen: 6, correct: 4 });
  assert.equal(memory.reviews[0].modelVersion, 'pikku-recall-v1');
  const selection = choose(h, memory, { focusId: first.card.id });
  memory = h.vocabulary.review(memory, selection, 'approximate', now);
  dropReply = true;
  await assert.rejects(h.vocabulary.sync('alice'), { code: 'NETWORK_ERROR' });
  assert.equal(h.vocabulary.load('alice').pendingReviewIds.length, 1);
  const afterCommit = await api.getStats();
  assert.deepEqual(plain(afterCommit.vocab.map(({ language, lemma, seen, correct }) => ({ language, lemma, seen, correct }))),
    [{ language: 'ja', lemma: first.card.term, seen: 7, correct: 4 }]);
  ({ memory } = await h.vocabulary.sync('alice'));
  assert.equal(memory.pendingReviewIds.length, 0);
  assert.equal(memory.reviews.length, 2);
  assert.deepEqual(plain(memory.stats[`ja:${first.card.term}`]), { seen: 7, correct: 4 });
  const web = await api.request('/api/vocab/reviews?limit=500');
  assert.equal(web.events.find(item => item.id === selection.eventId).outcome, 'approximate');
  assert.equal(web.events.find(item => item.id === selection.eventId).modelVersion, 'pikku-recall-v2');
  assert.equal(requests.filter(item => item.method === 'POST' && item.url.endsWith('/api/vocab/reviews')).length, 2,
    'The retry discovers the committed event rather than posting its count again');
});

test('malformed aggregate stats cannot acknowledge or discard a pending local event', async () => {
  const h = harness('alice');
  const memory = h.vocabulary.load('alice');
  h.vocabulary.review(memory, choose(h, memory), 'remembered', now);
  h.intercept(async ({ url }) => url === '/api/stats' ? { vocab: [{ language: 'ja', lemma: 'x', seen: -1, correct: 0 }] } : undefined);
  await assert.rejects(h.vocabulary.sync('alice'), /Invalid vocabulary statistics/);
  assert.equal(h.vocabulary.load('alice').pendingReviewIds.length, 1);
  h.intercept(null);
  assert.equal((await h.vocabulary.sync('alice')).memory.pendingReviewIds.length, 0);
});
