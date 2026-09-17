import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildWechat } from '../scripts/build-wechat.mjs';

const miniRoot = new URL('../wechat/miniprogram/', import.meta.url);
const pageSource = fs.readFileSync(new URL('pages/index/index.js', miniRoot), 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pikku-mini-page-'));
const plain = value => JSON.parse(JSON.stringify(value));
const guestKey = 'pikku-mini-guest-v1';
const sessionFor = id => ({ user: { id, email: `${id}@example.test` } });
const emptyRecord = () => ({ progress: {}, bookmarks: [], vocab: {}, preference: { language: 'la', level: 'C', vocabMode: 'context' } });
const event = dataset => ({ currentTarget: { dataset } });
let bank;
let shared;
let copy;

function commonJs(filename, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  vm.runInThisContext(`(function(module,exports,require){\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename })(
    module, module.exports, specifier => commonJs(path.resolve(path.dirname(filename), specifier), cache));
  return module.exports;
}

before(async () => {
  await buildWechat({ outputDir: temporaryDirectory });
  bank = commonJs(path.join(temporaryDirectory, 'data/bank.js'));
  shared = commonJs(path.join(temporaryDirectory, 'data/shared.js'));
  const module = { exports: {} };
  vm.runInThisContext(`(function(module){${fs.readFileSync(new URL('lib/copy.js', miniRoot), 'utf8')}\n})`)(module);
  copy = module.exports;
});
after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

async function harness(options = {}) {
  const storage = new Map(options.guest ? [[guestKey, plain(options.guest)]] : []);
  const calls = [];
  const state = {
    session: options.session || null,
    stats: options.stats || { progress: {}, bookmarks: [], vocab: [] },
    overrides: [],
    statsError: null,
    request: null,
  };
  const api = {
    getSession: () => state.session && plain(state.session),
    getOverrides: async () => ({ overrides: plain(state.overrides) }),
    getStats: async () => {
      calls.push({ path: '/api/stats', method: 'GET' });
      if (state.statsError) throw state.statsError;
      return plain(state.stats);
    },
    request: async (url, method, data) => {
      calls.push({ path: url, method, data: plain(data), owner: state.session?.user.id || null });
      if (state.request) return state.request(url, method, data);
      return { ok: true };
    },
    signIn: async () => { state.session = sessionFor('signed-in'); return state.session; },
    signOut: () => { state.session = null; },
  };
  let definition;
  const wx = {
    getStorageSync: key => storage.has(key) ? plain(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    showToast() {}, stopPullDownRefresh() {}, setClipboardData() {},
  };
  const fixedMath = Object.create(Math);
  fixedMath.random = () => 0;
  vm.runInNewContext(pageSource, {
    Page: value => { definition = value; }, wx, Math: fixedMath,
    require: name => {
      const modules = { '../../lib/api': api, '../../data/bank': bank, '../../data/shared': shared, '../../lib/copy': copy };
      assert.ok(Object.hasOwn(modules, name), `Unexpected page dependency ${name}`);
      return modules[name];
    },
  }, { filename: 'wechat/miniprogram/pages/index/index.js' });
  const page = { ...definition, data: plain(definition.data), setData(update) { Object.assign(this.data, update); } };
  const refresh = page.refresh;
  let refreshing;
  page.refresh = function (...args) { refreshing = refresh.apply(this, args); return refreshing; };
  page.onLoad();
  await refreshing;
  assert.equal(page.data.busy, false);
  return { page, api, state, storage, calls };
}

function latinChoice() {
  return bank.questions.find(question => (question.language || 'la') === 'la' && question.type === 'choice' && question.answer === 0 && question.options.length === 4 && shared.matchesLevel(question, 'C'));
}

test('guest answers stay local; signed answers preserve original question IDs and metadata without merging guest progress', async () => {
  const question = latinChoice();
  const guest = await harness();
  guest.page.showQuestion(question);
  await guest.page.answer(event({ index: question.answer }));
  assert.equal(guest.storage.get(guestKey).progress[question.id], 'correct');
  assert.equal(guest.calls.some(call => call.method === 'POST'), false);

  const savedGuest = emptyRecord();
  savedGuest.progress['guest-only'] = 'correct';
  const account = await harness({ session: sessionFor('website-uuid'), guest: savedGuest });
  account.page.showQuestion(question);
  await account.page.answer(event({ index: question.answer }));
  const write = account.calls.find(call => call.path === '/api/progress');
  assert.deepEqual(write, {
    path: '/api/progress', method: 'POST', owner: 'website-uuid',
    data: { questionId: question.id, language: question.language || 'la', level: question.level, category: question.category, status: 'correct' },
  });
  assert.equal(account.page.record.progress['guest-only'], undefined);
  assert.deepEqual(account.storage.get(guestKey), savedGuest);
});

test('shuffled display positions still submit the original answer index', async () => {
  const h = await harness();
  const question = latinChoice();
  const originalOptions = [...question.options];
  h.page.showQuestion(question);
  const slot = h.page.data.choices.findIndex(choice => choice.index === question.answer);
  assert.notEqual(slot, question.answer, 'fixture must actually move the correct answer');
  assert.equal(h.page.data.choices[slot].text, question.options[question.answer]);
  await h.page.answer(event({ index: h.page.data.choices[slot].index }));
  assert.equal(h.page.data.answerCorrect, true);
  assert.equal(h.page.record.progress[question.id], 'correct');
  assert.deepEqual(question.options, originalOptions);
  h.page.showQuestion(question);
  await h.page.answer(event({ index: h.page.data.choices.find(choice => choice.index !== question.answer).index }));
  assert.equal(h.page.data.answerCorrect, false);
});

test('successful login followed by a failed cloud load clears displayed guest statistics', async () => {
  const question = latinChoice();
  const guest = emptyRecord();
  guest.progress[question.id] = 'correct';
  guest.bookmarks = [question.id];
  guest.vocab['la:amor'] = { seen: 7, correct: 5 };
  const h = await harness({ guest });
  assert.equal(h.page.data.stats.answered, 1);
  h.state.statsError = Object.assign(new Error('offline'), { status: 0 });
  h.page.inputEmail({ detail: { value: 'signed-in@example.test' } });
  h.page.inputPassword({ detail: { value: 'fixture-password' } });
  await h.page.signIn();
  assert.equal(h.page.data.user.id, 'signed-in');
  assert.equal(h.page.data.sync, 'failed');
  assert.deepEqual(plain(h.page.data.stats), { answered: 0, correct: 0, bookmarks: 0, words: 0 });
  assert.deepEqual(plain(h.page.record.progress), {});
  assert.equal(h.page.data.password, '');
  assert.deepEqual(h.storage.get(guestKey), guest);
});

test('session invalidation never persists account records under the guest storage key', async () => {
  const question = latinChoice();
  const guest = emptyRecord();
  const h = await harness({ guest, session: sessionFor('account'), stats: {
    progress: { [question.id]: 'correct', 'account-only': 'wrong' }, bookmarks: [question.id],
    vocab: [{ language: 'la', lemma: 'amor', seen: 12, correct: 11 }],
  } });
  h.page.showQuestion(question);
  h.state.request = async () => {
    h.state.session = null;
    throw Object.assign(new Error('session expired'), { status: 401 });
  };
  await h.page.answer(event({ index: 1 }));
  assert.equal(h.page.data.user, null);
  assert.equal(h.page.owner, null);
  assert.deepEqual(h.storage.get(guestKey), guest);
  assert.deepEqual(plain(h.page.record), guest);
  h.state.request = null;
  await h.page.preference({ level: 'F' });
  const persisted = h.storage.get(guestKey);
  assert.deepEqual(persisted.progress, {});
  assert.deepEqual(persisted.bookmarks, []);
  assert.deepEqual(persisted.vocab, {});
});

test('switching learning language clears the previous quiz and its queued questions', async () => {
  const h = await harness();
  h.page.startPractice();
  assert.ok(h.page.data.question);
  assert.ok(h.page.queue.length > 1);
  const index = h.page.data.languages.findIndex(language => language.id === 'ja');
  await h.page.changeLanguage({ detail: { value: String(index) } });
  assert.equal(h.page.data.language, 'ja');
  assert.equal(h.page.data.question, null);
  assert.equal(h.page.data.card, null);
  assert.equal(h.page.queue.length, 0);
  h.page.nextQuestion();
  assert.equal(h.page.data.question, null);
  h.page.startPractice();
  assert.ok(h.page.queue.every(question => question.language === 'ja'));
  assert.equal(h.page.data.question.language, 'ja');
});

test('Home Start clears stale filters while Practice Start retains the chosen selection', async () => {
  const h = await harness();
  h.page.changeView(event({ view: 'practice' }));
  h.page.changeFilter(event({ filter: 'saved' }));
  h.page.changeCategory({ detail: { value: '1' } });
  h.page.changeSearch({ detail: { value: 'no-match-fixture-000000' } });
  assert.equal(h.page.data.resultCount, 0);
  h.page.changeView(event({ view: 'home' }));
  h.page.startPractice();
  assert.equal(h.page.data.filter, 'all');
  assert.equal(h.page.data.category, 'all');
  assert.equal(h.page.data.search, '');
  assert.equal(h.page.queue.length, h.page.range.length);
  assert.ok(h.page.data.question);

  const question = latinChoice();
  h.page.record.bookmarks = [question.id];
  h.page.changeFilter(event({ filter: 'saved' }));
  h.page.changeCategory({ detail: { value: String(h.page.data.categoryItems.findIndex(item => item.id === question.category)) } });
  h.page.changeSearch({ detail: { value: question.id } });
  h.page.startPractice();
  assert.equal(h.page.data.filter, 'saved');
  assert.equal(h.page.data.category, question.category);
  assert.equal(h.page.data.search, question.id);
  assert.deepEqual(plain(h.page.queue.map(item => item.id)), [question.id]);
});

test('fresh deleted or edited cloud questions invalidate the active quiz and old queue', async () => {
  for (const deleted of [true, false]) {
    const h = await harness();
    h.page.startPractice();
    const question = h.page.data.question;
    assert.ok(h.page.queue.length > 1);
    const replacement = { ...question, prompt: 'Updated question from cloud review' };
    h.state.overrides = [deleted ? { id: question.id, deleted: true } : { id: question.id, question: replacement }];
    await h.page.refresh();
    assert.equal(h.page.data.question, null);
    assert.equal(h.page.queue.length, 0);
    h.page.nextQuestion();
    assert.equal(h.page.data.question, null);
    if (deleted) {
      assert.equal(h.page.questions.some(item => item.id === question.id), false);
      assert.equal(h.page.filtered.some(item => item.id === question.id), false);
    } else {
      assert.equal(h.page.questions.find(item => item.id === question.id).prompt, replacement.prompt);
      h.page.openQuestion(event({ id: question.id }));
      assert.equal(h.page.data.question.prompt, replacement.prompt);
    }
  }
});

test('refreshing changed cloud language and level in the words view selects a card from the new pool', async () => {
  const h = await harness({ session: sessionFor('account') });
  h.page.changeView(event({ view: 'words' }));
  assert.equal(h.page.data.card.language, 'la');
  h.state.stats = { progress: {}, bookmarks: [], vocab: [], preference: { language: 'ru', level: 'M', vocabMode: 'context' } };
  await h.page.refresh();
  assert.equal(h.page.data.view, 'words');
  assert.equal(h.page.data.language, 'ru');
  assert.equal(h.page.data.level, 'M');
  assert.ok(h.page.data.card, 'a nonempty new pool should immediately have a visible word card');
  assert.equal(h.page.data.card.language, 'ru');
  assert.equal(shared.vocabularyMatchesLevel(h.page.data.card, 'M'), true);
  assert.equal(h.page.data.wordRevealed, false);
});

test('bookmark replacement contains only the selected language and preserves other-device and other-language bookmarks', async () => {
  const h = await harness({ session: sessionFor('account') });
  const question = latinChoice();
  const otherLatin = bank.questions.find(item => (item.language || 'la') === 'la' && item.id !== question.id);
  const japanese = bank.questions.find(item => item.language === 'ja');
  h.state.stats = { progress: {}, bookmarks: [otherLatin.id, japanese.id], vocab: [],
    byLanguage: { la: { bookmarks: [otherLatin.id] }, ja: { bookmarks: [japanese.id] } } };
  h.page.showQuestion(question);
  await h.page.toggleBookmark();
  assert.deepEqual(h.calls.find(call => call.path === '/api/bookmarks').data, { language: 'la', questionIds: [otherLatin.id, question.id] });
  assert.deepEqual(new Set(h.page.record.bookmarks), new Set([otherLatin.id, japanese.id, question.id]));
  assert.equal(h.storage.has(guestKey), false);
});

test('removing the last bookmark sends an empty language list and stays removed after a cloud refresh', async () => {
  const question = latinChoice();
  const japanese = bank.questions.find(item => item.language === 'ja');
  const h = await harness({ session: sessionFor('account'), stats: {
    progress: {}, bookmarks: [question.id, japanese.id], vocab: [],
    byLanguage: { la: { bookmarks: [question.id] }, ja: { bookmarks: [japanese.id] } },
  } });
  h.page.showQuestion(question);
  h.state.request = async (url, method, data) => {
    assert.equal(url, '/api/bookmarks');
    assert.equal(method, 'PUT');
    assert.deepEqual(plain(data), { language: 'la', questionIds: [] });
    h.state.stats.byLanguage.la.bookmarks = [];
    h.state.stats.bookmarks = [japanese.id];
    return { ok: true, bookmarks: [] };
  };
  await h.page.toggleBookmark();
  assert.equal(h.page.data.isBookmarked, false);
  assert.deepEqual(plain(h.page.record.bookmarks), [japanese.id]);
  await h.page.refresh();
  assert.deepEqual(plain(h.page.record.bookmarks), [japanese.id]);
  assert.equal(h.calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(h.storage.has(guestKey), false);
});

test('an ambiguous failed vocabulary POST is not repeated or counted locally', async () => {
  const h = await harness({ session: sessionFor('account') });
  h.page.nextCard();
  const card = h.page.data.card;
  h.page.revealWord();
  h.state.request = async () => { throw Object.assign(new Error('reply lost after write'), { status: 0 }); };
  await h.page.rateWord(event({ correct: 'yes' }));
  assert.equal(h.calls.filter(call => call.path === '/api/vocab').length, 1);
  assert.deepEqual(h.calls.find(call => call.path === '/api/vocab').data, { language: card.language, answers: [{ lemma: card.term, correct: true }] });
  assert.equal(h.page.record.vocab[shared.vocabularyKey(card.language, card.term)], undefined);
  assert.equal(h.page.data.wordRevealed, false);
  await h.page.rateWord(event({ correct: 'yes' }));
  await h.page.refresh();
  assert.equal(h.calls.filter(call => call.path === '/api/vocab').length, 1);
});

test('locale choices, level labels and colors, and question filters match the native learning range', async () => {
  const h = await harness();
  assert.equal(h.page.data.languages.some(language => language.id === 'zh-mandarin'), false);
  assert.equal(h.page.data.languages.some(language => language.id === 'en-us'), true);
  assert.deepEqual(plain(h.page.data.levels.map(level => level.prefix + level.emphasis + level.suffix)), ['初级', '凡级', '高级', '准母语级']);
  h.page.changeLocale();
  assert.equal(h.page.data.languages.some(language => language.id === 'en-us'), false);
  assert.equal(h.page.data.languages.some(language => language.id === 'zh-mandarin'), true);
  assert.deepEqual(plain(h.page.data.levels.map(level => level.prefix + level.emphasis + level.suffix)), ['Core', 'Functional', 'Generative', 'Mastery']);
  const css = fs.readFileSync(new URL('components/level-selector/index.wxss', miniRoot), 'utf8').toLowerCase();
  for (const [level, color] of [['c', '#256f60'], ['f', '#336a9a'], ['g', '#946319'], ['m', '#79517c']]) {
    assert.match(css, new RegExp(`\\.level-button\\.tone-${level}\\s*\\{[^}]*color:\\s*${color}`));
  }
  const question = latinChoice();
  h.page.record.progress[question.id] = 'wrong';
  h.page.record.bookmarks = [question.id];
  h.page.changeFilter(event({ filter: 'wrong' }));
  assert.deepEqual(plain(h.page.filtered.map(item => item.id)), [question.id]);
  h.page.changeFilter(event({ filter: 'saved' }));
  assert.deepEqual(plain(h.page.filtered.map(item => item.id)), [question.id]);
  h.page.changeFilter(event({ filter: 'all' }));
  h.page.changeSearch({ detail: { value: question.id } });
  assert.ok(h.page.filtered.some(item => item.id === question.id));
  assert.ok(h.page.filtered.every(item => shared.matchesLevel(item, h.page.data.level) && (item.language || 'la') === h.page.data.language));
  h.page.changeSearch({ detail: { value: 'no-match-fixture-000000' } });
  assert.equal(h.page.data.resultCount, 0);
});

test('the level selector emits the native detail event and waits for the account preference update', async () => {
  const h = await harness({ session: sessionFor('website-uuid') });
  let definition;
  vm.runInNewContext(fs.readFileSync(new URL('components/level-selector/index.js', miniRoot), 'utf8'), {
    Component: value => { definition = value; },
    require: name => { assert.equal(name, '../../lib/copy'); return copy; },
  }, { filename: 'wechat/miniprogram/components/level-selector/index.js' });
  let pending;
  const emitted = [];
  const component = {
    ...definition.methods,
    properties: { value: h.page.data.level, locale: h.page.data.locale, disabled: h.page.data.busy },
    data: plain(definition.data),
    setData(update) { Object.assign(this.data, update); },
    triggerEvent(name, detail) {
      emitted.push({ name, detail: plain(detail) });
      assert.equal(name, 'change');
      pending = h.page.changeLevel({ detail });
    },
  };
  // Mirror the page's property bindings without letting the component own selection.
  const setPageData = h.page.setData;
  h.page.setData = function (update) {
    setPageData.call(this, update);
    const changed = component.properties.value !== this.data.level || component.properties.locale !== this.data.locale;
    Object.assign(component.properties, { value: this.data.level, locale: this.data.locale, disabled: this.data.busy });
    if (changed) definition.observers['value, locale'].call(component);
  };
  definition.lifetimes.attached.call(component);
  let completeWrite;
  h.state.request = () => new Promise(resolve => { completeWrite = resolve; });
  component.choose(event({ level: 'M' }));
  assert.deepEqual(emitted, [{ name: 'change', detail: { level: 'M' } }]);
  assert.deepEqual(h.calls.find(call => call.path === '/api/preferences'), {
    path: '/api/preferences', method: 'PUT', owner: 'website-uuid',
    data: { language: 'la', level: 'M', vocabMode: 'context' },
  });
  assert.equal(h.page.data.level, 'C');
  assert.equal(component.data.selected.id, 'C');
  assert.equal(component.properties.disabled, true);
  component.choose(event({ level: 'F' }));
  assert.equal(emitted.length, 1);
  assert.equal(h.calls.filter(call => call.path === '/api/preferences').length, 1);
  completeWrite({ ok: true });
  await pending;
  assert.equal(h.page.data.level, 'M');
  assert.equal(component.data.selected.id, 'M');
  assert.equal(component.properties.disabled, false);
  component.choose(event({ level: 'M' }));
  assert.equal(emitted.length, 1);
  const selectedLabel = () => component.data.selected.prefix + component.data.selected.emphasis + component.data.selected.suffix;
  assert.equal(selectedLabel(), '准母语级');
  h.page.changeLocale();
  assert.equal(selectedLabel(), 'Mastery');
  h.page.changeLocale();
  assert.equal(selectedLabel(), '准母语级');
});
