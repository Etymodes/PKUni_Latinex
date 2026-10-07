import { createSourceLoader as localeSourceLoader } from '../scripts/build-wechat.mjs';
const contentLocale = () => localeSourceLoader()('lib/content-locale.ts');
const dictionary = localeSourceLoader()('lib/dictionary.ts');
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
    [path.join(miniRoot, 'data/dictionary.js'), { exports: dictionary }],
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
  const expected = dictionary.searchDictionary(bank.vocabularyCards, { language: 'ja', order: 'reading' }).map(card => card.id);
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


test('native dictionary filters and numbered detail reuse canonical entries without changing frozen practice', async () => {
  const h = await harness();
  const target = bank.vocabularyCards.find(card => card.language === 'ja' && card.level === 'G' && card.reading);
  h.page.practiseWord(event({ id: target.id }));
  const selection = h.page.wordSelection;
  h.page.changeView(event({ view: 'dictionary' }));
  const pick = (field, index) => h.page.changeDictionaryFilter({ currentTarget: { dataset: { filter: field } }, detail: { value: String(index) } });
  pick('field', h.page.data.dictionaryFields.findIndex(item => item.id === 'reading'));
  h.page.searchDictionary({ detail: { value: target.reading } });
  assert.ok(h.page.data.dictionaryRows.some(row => row.id === target.id));
  pick('level', h.page.data.dictionaryLevels.findIndex(item => item.id === 'G'));
  assert.ok(h.page.data.dictionaryRows.every(row => row.card.level === 'G'));
  assert.equal(h.page.data.level, 'F', 'dictionary filters never change the training grade');
  h.page.openDictionaryEntry(event({ id: target.id }));
  const detail = h.page.data.dictionaryDetail;
  assert.equal(detail.id, target.id);
  assert.deepEqual(plain(detail.senses.map(item => item.number)), detail.senses.map((_, index) => index + 1));
  assert.deepEqual(plain(detail.etymology), plain(dictionary.dictionaryEntry(target, h.page.data.locale).etymology));
  assert.ok(detail.etymology.every(item => item.source?.url));
  h.page.changeLocale();
  assert.equal(h.page.data.dictionaryDetail.id, target.id);
  assert.equal(h.page.wordSelection, selection);
  h.page.closeDictionaryEntry();
  assert.equal(h.page.data.dictionaryDetail, null);
  assert.ok(h.page.data.dictionaryRows.some(row => row.id === target.id));
  const template = fs.readFileSync(path.join(miniRoot, 'pages/index/index.wxml'), 'utf8');
  const list = template.slice(template.indexOf('<view class="dictionary-list">'), template.indexOf('<block wx:else><button class="text-button" bindtap="closeDictionaryEntry">'));
  assert.doesNotMatch(list, /bindtap="practiseWord"|word-feedback|dictionaryEtymology/);
  assert.match(template, /item.editorial.*t.learningExample/);
});


test('different dictionaries sharing a citation URL retain separate native list identities', async () => {
  const h = await harness();
  h.page.openDictionaryEntry(event({ id: 'ja-n1-list-cefe81dd8db6' }));
  const refs = h.page.data.dictionaryDetail.references;
  const sharedUrl = refs.filter(item => item.url === 'https://kotobank.jp/word/取組-585764');
  assert.equal(sharedUrl.length, 2);
  assert.equal(new Set(sharedUrl.map(item => item.key)).size, 2);
});


test('native dictionary preserves localized historical usage notes in both interfaces', async () => {
  const h = await harness();
  h.page.openDictionaryEntry(event({ id: 'ja-1993-95527740599b' }));
  const card = bank.vocabularyCards.find(item => item.id === 'ja-1993-95527740599b');
  assert.equal(h.page.data.dictionaryDetail.usageNotes, dictionary.dictionaryEntry(card, 'zh-CN').usageNotes);
  assert.match(h.page.data.dictionaryDetail.usageNotes, /看護師/);
  const original = h.page.data.dictionaryDetail.usageNotes;
  h.page.changeLocale();
  assert.equal(h.page.data.dictionaryDetail.usageNotes, dictionary.dictionaryEntry(card, 'en').usageNotes);
  assert.notEqual(h.page.data.dictionaryDetail.usageNotes, original);
  assert.match(h.page.data.dictionaryDetail.usageNotes, /historical term/i);
  assert.match(fs.readFileSync(path.join(miniRoot, 'pages/index/index.wxml'), 'utf8'), /wx:if="\{\{dictionaryDetail.usageNotes\}\}"[^>]*>\{\{dictionaryDetail.usageNotes\}\}/);
});
