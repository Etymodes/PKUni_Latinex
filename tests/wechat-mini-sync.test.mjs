import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSharedSource, buildVocabularySource, loadProjectData } from '../scripts/build-wechat.mjs';
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

// Recursively load real page helpers in one isolated VM, while keeping the
// fixture API and generated bank/shared modules authoritative for every import.
function loadPageModule(mocks, globals) {
  const root = fileURLToPath(miniRoot);
  const context = vm.createContext(globals);
  const cache = new Map(Object.entries(mocks).map(([name, exports]) => [path.resolve(root, name), { exports }]));
  const generated = new Map(['vocabulary-model', 'vocabulary-review-sync'].map(name =>
    [path.resolve(root, `data/${name}.js`), buildVocabularySource(name)]));
  function load(filename) {
    filename = path.resolve(filename);
    if (!path.extname(filename)) filename += '.js';
    const relative = path.relative(root, filename);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Unexpected page dependency ${filename}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = generated.has(filename) ? generated.get(filename) : readFileSync(filename, 'utf8');
    const execute = vm.runInContext(`(function(module, exports, require) {\n${code}\n})`, context, { filename });
    execute(module, module.exports, specifier => {
      assert.ok(specifier.startsWith('.'), `Unexpected external page dependency ${specifier}`);
      return load(path.resolve(path.dirname(filename), specifier));
    });
    return module.exports;
  }
  return load(path.join(root, 'pages/index/index.js'));
}

// The same in-memory D1 adapter used by the existing Worker compatibility test.
class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  execute() {
    const prepared = this.database.prepare(this.sql);
    if (/^\s*(SELECT|PRAGMA)\b/i.test(this.sql)) return { results: prepared.all(...this.values) };
    const result = prepared.run(...this.values);
    return { results: [], meta: { changes: Number(result.changes) } };
  }
  async run() { return this.execute(); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return this.execute(); }
}

test('native answers and word ratings round-trip through the real API and Worker once per action, with account isolation', async t => {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  const config = commonJs(source('lib/config.js'));
  let batchChain = Promise.resolve();
  const env = {
    DB: {
      prepare: sql => new Statement(database, sql),
      batch(statements) {
        assert.ok(statements.length <= 50);
        assert.ok(statements.every(statement => statement.values.length <= 100));
        const operation = batchChain.then(() => {
          database.exec('BEGIN');
          try {
            const results = statements.map(statement => statement.execute());
            database.exec('COMMIT');
            return results;
          } catch (error) { database.exec('ROLLBACK'); throw error; }
        });
        batchChain = operation.catch(() => {});
        return operation;
      },
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
  loadPageModule({
    'lib/api.js': api, 'data/bank.js': bank, 'data/shared.js': shared,
    'lib/copy.js': commonJs(source('lib/copy.js')),
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
  for (const outcome of ['remembered', 'approximate', 'forgotten']) {
    const card = page.data.card;
    const key = shared.vocabularyKey(card.language, card.term);
    const previous = expectedWords[key] || { seen: 0, correct: 0 };
    expectedWords[key] = { seen: previous.seen + 1, correct: previous.correct + Number(outcome === 'remembered') };
    page.revealWord();
    const answer = event({ outcome });
    await Promise.all([page.rateWord(answer), page.rateWord(answer)]);
    await page.rateWord(answer);
  }
  assert.equal(calls.filter(call => call.url === `${config.apiOrigin}/api/progress` && call.method === 'POST').length, 2);
  assert.equal(calls.filter(call => call.url === `${config.apiOrigin}/api/vocab/reviews` && call.method === 'POST').length, 3);
  assert.equal(calls.filter(call => call.url === `${config.apiOrigin}/api/vocab` && call.method === 'POST').length, 0);

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
