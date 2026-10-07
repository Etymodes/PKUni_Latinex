import { createSourceLoader as localeSourceLoader } from '../scripts/build-wechat.mjs';
const contentLocale = () => localeSourceLoader()('lib/content-locale.ts');
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSharedSource, buildVocabularySource, loadProjectData } from '../scripts/build-wechat.mjs';

const miniRoot = fileURLToPath(new URL('../wechat/miniprogram/', import.meta.url));
const bank = loadProjectData();
const plain = value => JSON.parse(JSON.stringify(value));
const event = dataset => ({ currentTarget: { dataset } });

async function harness() {
  const storage = new Map();
  const payloadSizes = [];
  const api = { getSession: () => null, getOverrides: async () => ({ overrides: [] }) };
  const wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    showToast() {}, stopPullDownRefresh() {}, pageScrollTo() {},
  };
  const modules = new Map([
    [path.join(miniRoot, 'data/content-locale.js'), { exports: contentLocale() }],
    [path.join(miniRoot, 'data/bank.js'), { exports: bank }],
    [path.join(miniRoot, 'lib/api.js'), { exports: api }],
  ]);
  let definition;
  function load(filename) {
    if (!path.extname(filename)) filename += '.js';
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const basename = path.basename(filename, '.js');
    const source = filename === path.join(miniRoot, 'data/shared.js') ? buildSharedSource()
      : filename.startsWith(path.join(miniRoot, 'data/')) && basename.startsWith('vocabulary-') ? buildVocabularySource(basename)
        : fs.readFileSync(filename, 'utf8');
    vm.runInNewContext(source, { module, exports: module.exports, wx,
      require: name => { assert.ok(name.startsWith('.')); return load(path.resolve(path.dirname(filename), name)); },
      Page: value => { definition = value; },
    }, { filename });
    return module.exports;
  }
  load(path.join(miniRoot, 'pages/index/index.js'));
  const page = { ...definition, data: plain(definition.data), setData(update) {
    const bytes = Buffer.byteLength(JSON.stringify(update));
    payloadSizes.push(bytes);
    assert.ok(bytes < 1024 * 1024, `setData payload exceeds WeChat's 1 MiB limit: ${bytes}`);
    Object.assign(this.data, update);
  } };
  let refreshing;
  const refresh = page.refresh;
  page.refresh = function (...args) { refreshing = refresh.apply(this, args); return refreshing; };
  page.onLoad();
  await refreshing;
  await page.preference({ language: 'ja', level: 'F' });
  page.openDictionary();
  return { page, payloadSizes };
}

test('every Japanese entry can be browsed in bounded 40-word Page updates without missing or duplicate words', async () => {
  const h = await harness();
  const expected = bank.vocabularyCards.filter(card => card.language === 'ja').map(card => card.id);
  assert.ok(expected.length >= 2290);
  assert.equal(h.page.data.dictionaryOffset, 0);
  const visited = [];
  const offsets = [];
  for (let pageNumber = 0; pageNumber < Math.ceil(expected.length / 40); pageNumber++) {
    assert.equal(h.page.data.dictionaryOffset, pageNumber * 40);
    assert.ok(h.page.data.dictionaryRows.length > 0 && h.page.data.dictionaryRows.length <= 40);
    offsets.push(h.page.data.dictionaryOffset);
    visited.push(...h.page.data.dictionaryRows.map(row => row.id));
    h.page.moreDictionary();
  }
  assert.deepEqual(visited, expected);
  assert.equal(new Set(visited).size, expected.length);
  assert.equal(h.page.data.dictionaryOffset, offsets.at(-1), 'next cannot move beyond the last page');
  assert.equal(h.page.data.dictionaryRows.length, expected.length % 40 || 40);
  h.page.previousDictionary();
  assert.equal(h.page.data.dictionaryOffset, offsets.at(-2));
  assert.deepEqual(plain(h.page.data.dictionaryRows.map(row => row.id)), expected.slice(offsets.at(-2), offsets.at(-2) + 40));
  assert.ok(Math.max(...h.payloadSizes) < 1024 * 1024);
});

test('search, language changes and practising a dictionary entry keep the pager and shared word identity aligned', async () => {
  const h = await harness();
  h.page.moreDictionary();
  assert.equal(h.page.data.dictionaryOffset, 40);
  const target = bank.vocabularyCards.find(card => card.language === 'ja' && card.level === 'G');
  assert.ok(target, 'fixture includes vocabulary above the current F level');
  h.page.searchDictionary({ detail: { value: target.term } });
  assert.equal(h.page.data.dictionaryOffset, 0);
  assert.ok(h.page.data.dictionaryRows.some(row => row.id === target.id));
  h.page.practiseWord(event({ id: target.id }));
  assert.equal(h.page.data.view, 'words');
  assert.equal(h.page.data.card.id, target.id);
  assert.equal(h.page.data.level, 'F');
  assert.equal(h.page.record.preference.level, 'F');
  assert.equal(h.page.data.focusedWord, true);
  assert.equal(Object.hasOwn(h.page.data, 'wordScope'), false);
  assert.equal(h.page.data.wordRevealed, false);
  assert.equal(h.page.wordSelection.card.id, target.id);
  const focused = h.page.wordSelection;
  h.page.changeLocale();
  assert.equal(h.page.wordSelection, focused, 'locale preserves the focused card and frozen prediction');
  h.page.nextCard();
  assert.ok(['C', 'F'].includes(h.page.wordSelection.card.level), 'the next card returns to the cumulative current level');
  assert.equal(h.page.data.focusedWord, false);
  h.page.practiseWord(event({ id: target.id }));
  h.page.openDictionary();
  assert.equal(h.page.data.dictionaryOffset, 0);
  assert.equal(h.page.data.dictionaryQuery, target.term);
  h.page.searchDictionary({ detail: { value: '' } });
  h.page.moreDictionary();
  h.page.moreDictionary();
  assert.equal(h.page.data.dictionaryOffset, 80);
  await h.page.preference({ language: 'la' });
  assert.equal(h.page.data.dictionaryOffset, 0);
  assert.ok(h.page.data.dictionaryRows.every(row => row.card.language === 'la'));
  h.page.previousDictionary();
  assert.equal(h.page.data.dictionaryOffset, 0, 'previous cannot move before the first page');
  assert.ok(Math.max(...h.payloadSizes) < 1024 * 1024);
});
