import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import { buildSharedSource, loadProjectData } from '../scripts/build-wechat.mjs';
import worker, { __test } from '../worker/index.js';

const miniRoot = new URL('../wechat/miniprogram/', import.meta.url);
const source = name => readFileSync(new URL(name, miniRoot), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const event = dataset => ({ currentTarget: { dataset } });

function commonJs(code, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, ...globals,
    require: name => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

// The same in-memory D1 adapter used by the existing Worker compatibility test.
class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  async run() { return this.database.prepare(this.sql).run(...this.values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
}

test('native answers and word ratings round-trip through the real API and Worker once per action, with account isolation', async t => {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  const config = commonJs(source('lib/config.js'));
  const env = {
    DB: {
      prepare: sql => new Statement(database, sql),
      batch: async statements => Promise.all(statements.map(statement => /^\s*(SELECT|PRAGMA)\b/i.test(statement.sql) ? statement.all() : statement.run())),
    },
    SUPABASE_URL: config.supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
  };
  // Both auth boundaries are local fixtures. Unexpected outbound URLs fail the test.
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `${config.supabaseUrl}/auth/v1/user`);
    const token = options.headers.authorization;
    const id = ['alice', 'bob'].find(account => token === `Bearer fixture-access-${account}`);
    assert.ok(id, 'Worker must authenticate the native bearer');
    return Response.json({ id, email: `${id}@example.test`, app_metadata: { provider: 'email' } });
  });
  await __test.ensureSchema(env);
  const storage = new Map();
  const calls = [];
  const transportErrors = [];
  const wx = {
    getStorageSync: key => storage.has(key) ? plain(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    removeStorageSync: key => storage.delete(key),
    showToast() {}, stopPullDownRefresh() {},
    request(options) {
      calls.push({ url: options.url, method: options.method });
      Promise.resolve().then(async () => {
        if (options.url === `${config.supabaseUrl}/auth/v1/token?grant_type=password`) {
          const id = ['alice', 'bob'].find(account => options.data.email === `${account}@example.test`);
          assert.ok(id);
          return Response.json({ access_token: `fixture-access-${id}`, refresh_token: `fixture-refresh-${id}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: options.data.email } });
        }
        assert.equal(new URL(options.url).origin, config.apiOrigin);
        return worker.fetch(new Request(options.url, {
          method: options.method, headers: options.header,
          ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }),
        }), env);
      }).then(async response => options.success({ statusCode: response.status, data: await response.json() }))
        .catch(error => { transportErrors.push(error); options.fail(); });
    },
  };
  const api = commonJs(source('lib/api.js'), { './config': config }, { wx });
  const bank = plain(loadProjectData());
  const shared = commonJs(buildSharedSource(), { './bank.js': bank });
  let definition;
  commonJs(source('pages/index/index.js'), {
    '../../lib/api': api, '../../data/bank': bank, '../../data/shared': shared,
    '../../lib/copy': commonJs(source('lib/copy.js')),
  }, { wx, Page: value => { definition = value; } });
  const page = { ...definition, data: plain(definition.data), setData(update) { Object.assign(this.data, update); } };
  const refresh = page.refresh;
  let loading;
  page.refresh = function (...args) { loading = refresh.apply(this, args); return loading; };
  page.onLoad();
  await loading;
  const login = async id => {
    page.inputEmail({ detail: { value: `${id}@example.test` } });
    page.inputPassword({ detail: { value: 'fixture-password' } });
    await page.signIn();
    assert.equal(page.data.user.id, id);
    assert.equal(page.data.sync, 'synced');
  };
  await login('alice');

  const choice = bank.questions.find(question => (question.language || 'la') === 'la' && question.type === 'choice');
  const selfCheck = bank.questions.find(question => (question.language || 'la') === 'la' && question.type === 'self-check');
  for (const [question, answer] of [[choice, { index: choice.answer }], [selfCheck, { correct: 'no' }]]) {
    page.showQuestion(question);
    if (question.type === 'self-check') page.revealAnswer();
    await Promise.all([page.answer(event(answer)), page.answer(event(answer))]);
    await page.answer(event(answer));
  }
  assert.deepEqual(plain(database.prepare('SELECT user_email, language, question_id, status, level, category FROM attempts_by_language ORDER BY id').all()),
    [[choice, 'correct'], [selfCheck, 'wrong']].map(([question, status]) => ({
      user_email: 'supabase:alice', language: question.language || 'la', question_id: question.id,
      status, level: question.level, category: question.category,
    })));

  page.changeView(event({ view: 'words' }));
  const expectedWords = {};
  for (const correct of [true, false]) {
    const card = page.data.card;
    const key = shared.vocabularyKey(card.language, card.term);
    const previous = expectedWords[key] || { seen: 0, correct: 0 };
    expectedWords[key] = { seen: previous.seen + 1, correct: previous.correct + Number(correct) };
    page.revealWord();
    const answer = event({ correct: correct ? 'yes' : 'no' });
    await Promise.all([page.rateWord(answer), page.rateWord(answer)]);
    await page.rateWord(answer);
  }
  for (const path of ['progress', 'vocab']) {
    assert.equal(calls.filter(call => call.url === `${config.apiOrigin}/api/${path}` && call.method === 'POST').length, 2);
  }

  // Read the exact endpoint used by the website, independently of native UI state.
  const response = await worker.fetch(new Request(`${config.apiOrigin}/api/stats`, {
    headers: { authorization: 'Bearer fixture-access-alice' },
  }), env);
  assert.equal(response.status, 200);
  const cloud = await response.json();
  const expectedProgress = { [choice.id]: 'correct', [selfCheck.id]: 'wrong' };
  assert.deepEqual(cloud.progress, expectedProgress);
  assert.deepEqual(Object.fromEntries(cloud.vocab.map(row => [shared.vocabularyKey(row.language, row.lemma), { seen: row.seen, correct: row.correct }])), expectedWords);
  await page.refresh();
  assert.deepEqual(plain(page.record.progress), expectedProgress);
  assert.deepEqual(plain(page.record.vocab), expectedWords);

  page.signOut();
  assert.equal(api.getSession(), null);
  assert.deepEqual(plain(page.record.progress), {});
  assert.deepEqual(plain(page.record.vocab), {});
  await login('bob');
  assert.deepEqual(plain(page.record.progress), {});
  assert.deepEqual(plain(page.record.vocab), {});
  page.signOut();
  await login('alice');
  assert.deepEqual(plain(page.record.progress), expectedProgress);
  assert.deepEqual(plain(page.record.vocab), expectedWords);
  assert.equal(storage.has('pikku-mini-guest-v1'), false);
  assert.deepEqual(transportErrors, []);
});
