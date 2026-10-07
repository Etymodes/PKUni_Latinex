import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { compressedFiles } from './helpers/wechat-generated.mjs';
import { buildWechat } from '../scripts/build-wechat.mjs';

const root = fileURLToPath(new URL('../wechat/miniprogram/', import.meta.url));
const generated = fs.mkdtempSync(path.join(os.tmpdir(), 'pikku-parity-'));
const plain = value => JSON.parse(JSON.stringify(value));
const event = dataset => ({ currentTarget: { dataset } });
before(async () => { await buildWechat({ outputDir: generated }); });
after(() => fs.rmSync(generated, { recursive: true, force: true }));

async function harness() {
  const storage = new Map([['pikku-mini-guest-v1', { progress: {}, bookmarks: [], vocab: {}, preference: { language: 'ja', level: 'G', vocabMode: 'context' } }]]);
  const previews = [], files = [], shares = [], toasts = [], clipboard = [];
  const wx = {
    getStorageSync: key => storage.has(key) ? plain(storage.get(key)) : '',
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    showToast: value => toasts.push(value), setClipboardData: value => { clipboard.push(value.data); value.success(); }, stopPullDownRefresh() {},
    previewImage: value => previews.push(value),
    env: { USER_DATA_PATH: '/fixture-user-data' },
    getFileSystemManager: () => ({ ...compressedFiles(generated), writeFile(value) { files.push(value); value.success(); } }),
    shareFileMessage: value => shares.push(value),
  };
  const api = { getSession: () => null, getOverrides: async () => ({ overrides: [] }),
    getStats: async () => { throw new Error('Guest flow must not read private cloud records'); },
    request: async () => { throw new Error('Guest flow must not make a cloud write'); } };
  let definition;
  const fixedMath = Object.create(Math); fixedMath.random = () => 0;
  const context = vm.createContext({ wx, Math: fixedMath, Page: value => { definition = value; } });
  const cache = new Map([[path.join(root, 'lib/api.js'), { exports: api }]]);
  function load(filename) {
    filename = path.resolve(filename);
    if (!path.extname(filename)) filename += '.js';
    const relative = path.relative(root, filename);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = fs.readFileSync(relative.startsWith(`data${path.sep}`) ? path.join(generated, relative) : filename, 'utf8');
    const execute = vm.runInContext(`(function(module, exports, require) {\n${source}\n})`, context, { filename });
    execute(module, module.exports, specifier => {
      assert.ok(specifier.startsWith('.'), `No external dependency in isolated Page: ${specifier}`);
      return load(path.resolve(path.dirname(filename), specifier));
    });
    return module.exports;
  }
  load(path.join(root, 'pages/index/index.js'));
  const bank = load(path.join(root, 'data/bank.js'));
  const page = { ...definition, data: plain(definition.data), setData(update) { Object.assign(this.data, update); } };
  let refreshing; const refresh = page.refresh;
  page.refresh = function (...args) { refreshing = refresh.apply(this, args); return refreshing; };
  page.onLoad(); await refreshing;
  assert.equal(page.data.busy, false); assert.equal(page.owner, null);
  return { page, bank, storage, previews, files, shares, toasts, clipboard };
}

function cardFor(h) {
  return h.bank.vocabularyCards.find(card => card.language === 'ja' && card.sourcePages?.length && !card.context.trim());
}
function practise(h, card) {
  h.page.changeView(event({ view: 'dictionary' }));
  h.page.searchDictionary({ detail: { value: card.term } });
  assert.ok(h.page.data.dictionaryRows.some(row => row.id === card.id));
  h.page.practiseWord(event({ id: card.id }));
  assert.equal(h.page.data.view, 'words'); assert.equal(h.page.data.card.id, card.id);
  assert.equal(h.page.wordSelection.prediction.mode, 'word', 'a PDF word without context uses the displayed word-only mode');
}

test('dictionary to practice to approximate returns to the same entry and persists one guest review', async () => {
  const h = await harness(); const card = cardFor(h);
  practise(h, card);
  const frozen = plain(h.page.wordSelection.prediction);
  h.page.revealWord();
  await Promise.all([h.page.rateWord(event({ outcome: 'approximate' })), h.page.rateWord(event({ outcome: 'approximate' }))]);
  assert.equal(h.page.wordMemory.reviews.length, 1);
  const saved = h.page.wordMemory.reviews[0];
  assert.equal(saved.outcome, 'approximate'); assert.equal(saved.lemma, card.term);
  assert.deepEqual(plain(saved.probabilities), frozen.probabilities);
  assert.equal(h.page.data.roundApproximate, 1); assert.equal(h.page.data.roundRemembered, 0);
  h.page.openDictionary(); h.page.searchDictionary({ detail: { value: card.term } });
  const row = h.page.data.dictionaryRows.find(item => item.id === card.id);
  assert.deepEqual(plain({ seen: row.stat.seen, correct: row.stat.correct, approximate: row.stat.approximate, lastOutcome: row.stat.lastOutcome }),
    { seen: 1, correct: 0, approximate: 1, lastOutcome: 'approximate' });
  assert.equal(h.storage.get('pikku-mini-vocabulary-v2:guest').reviews.length, 1);
  assert.equal(h.page.data.pendingWords, 0, 'guest feedback is saved locally, not presented as an account sync failure');
});

test('date exploration changes only the forecast and cannot replace the frozen feedback evidence', async () => {
  const h = await harness(); const card = cardFor(h);
  practise(h, card);
  const frozen = plain(h.page.wordSelection.prediction);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const far = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  h.page.changeForecastDate({ detail: { value: tomorrow } });
  assert.equal(h.page.data.future.hasTimedHistory, false);
  h.page.changeForecastDate({ detail: { value: far } });
  assert.deepEqual(plain(h.page.wordSelection.prediction), frozen);
  assert.equal(h.page.wordMemory.reviews.length, 0);
  h.page.revealWord(); await h.page.rateWord(event({ outcome: 'remembered' }));
  assert.equal(h.page.wordMemory.reviews[0].targetAt, frozen.targetAt);
  h.page.practiseWord(event({ id: card.id }));
  h.page.changeForecastDate({ detail: { value: tomorrow } });
  const near = h.page.data.future.remembered;
  assert.equal(h.page.data.future.hasTimedHistory, true);
  h.page.changeForecastDate({ detail: { value: far } });
  assert.ok(h.page.data.future.remembered <= near);
  assert.equal(h.page.wordMemory.reviews.length, 1);
});

test('support author shows the existing original image and viewing it never changes learning records', async () => {
  const h = await harness(); const before = plain(h.page.wordMemory);
  assert.equal(h.page.data.showSupport, false);
  h.page.toggleSupport(); assert.equal(h.page.data.showSupport, true);
  h.page.previewSupport();
  assert.deepEqual(plain(h.previews), [{ current: '/assets/support-author.png', urls: ['/assets/support-author.png'] }]);
  const original = fs.readFileSync(new URL('../wechat/static/support-author.png', import.meta.url));
  assert.deepEqual(fs.readFileSync(path.join(generated, 'assets/support-author.png')), original);
  assert.deepEqual(plain(h.page.wordMemory), before);
});

test('personal JSON export writes only the current language evidence and invokes the user-facing share sheet', async () => {
  const h = await harness(); const card = cardFor(h);
  practise(h, card); h.page.revealWord(); await h.page.rateWord(event({ outcome: 'approximate' }));
  h.page.exportWordReviews();
  assert.equal(h.files.length, 1); assert.equal(h.shares.length, 1);
  const file = h.files[0], content = JSON.parse(file.data);
  assert.equal(file.encoding, 'utf8'); assert.match(file.filePath, /^\/fixture-user-data\/pikku-ja-learning-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(content.language, 'ja'); assert.equal(content.reviews.length, 1);
  assert.equal(content.reviews[0].outcome, 'approximate');
  assert.ok(content.reviews.every(row => row.language === 'ja'));
  assert.equal(h.shares[0].filePath, file.filePath);
  assert.deepEqual(Object.keys(content).sort(), ['exportedAt', 'language', 'reviews', 'version']);
});

test('feedback sits beside support and copies the authorized form with an honest browser instruction', async () => {
  const h = await harness();
  const url='https://docs.qq.com/sheet/DQ3h3YWt0cE5IS1pG';
  const before=plain(h.page.wordMemory);
  for (const locale of ['zh-CN','en']) {
    if(h.page.data.locale!==locale)h.page.changeLocale();
    h.page.copyResource(event({url}));
    assert.equal(h.clipboard.at(-1),url);
    assert.equal(h.toasts.at(-1).title,h.page.data.t.copied);
    assert.match(h.page.data.t.feedbackHelp, locale==='en' ? /browser/ : /浏览器/);
  }
  const wxml=fs.readFileSync(new URL('../wechat/miniprogram/pages/index/index.wxml',import.meta.url),'utf8');
  assert.match(wxml, /support-feedback[^]*toggleSupport[^]*feedback-link/);
  assert.ok(wxml.includes(url));
  assert.deepEqual(plain(h.page.wordMemory),before);
});
