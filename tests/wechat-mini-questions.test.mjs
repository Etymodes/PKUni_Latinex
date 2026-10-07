import { createSourceLoader as localeSourceLoader } from '../scripts/build-wechat.mjs';
const contentLocale = () => localeSourceLoader()('lib/content-locale.ts');
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildSharedSource, loadProjectData } from '../scripts/build-wechat.mjs';

const miniRoot = new URL('../wechat/miniprogram/', import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const event = dataset => ({ currentTarget: { dataset } });
const fixedMath = Object.create(Math);
fixedMath.random = () => 0;
let bank;
let shared;
let copy;

function evaluate(relative, modules, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(new URL(relative, miniRoot), 'utf8'), {
    module, exports: module.exports, Math: fixedMath,
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency ${relative}: ${name}`);
      return modules[name];
    }, ...extra,
  }, { filename: `wechat/miniprogram/${relative}` });
  return module.exports;
}

before(() => {
  bank = loadProjectData();
  const module = { exports: {} };
  vm.runInNewContext(buildSharedSource(), { module, exports: module.exports, Math: fixedMath,
    require: name => { assert.equal(name, './bank.js'); return bank; },
  });
  shared = module.exports;
  copy = evaluate('lib/copy.js', {});
});

function harness({ language = 'ja', level = 'F', account = false } = {}) {
  const calls = [];
  const audios = [];
  const storage = new Map();
  const api = {
    getSession: () => account ? { user: { id: 'account' } } : null,
    request: async (path, method, data) => { calls.push({ path, method, data: plain(data) }); return { ok: true }; },
  };
  const wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, plain(value)),
    showToast() {},
    previewImage: options => { calls.push({ previewImage: plain(options) }); },
    createInnerAudioContext() {
      const listeners = {};
      const audio = { currentTime: 0, duration: 0, playCount: 0, pauseCount: 0, stopCount: 0, destroyCount: 0, seeks: [],
        play() { this.playCount++; listeners.Play(); },
        pause() { this.pauseCount++; listeners.Pause(); },
        stop() { this.stopCount++; if (listeners.Stop) listeners.Stop(); },
        destroy() { this.destroyCount++; },
        seek(position) { this.seeks.push(position); this.currentTime = position; },
        emit(name) { listeners[name](); },
      };
      for (const name of ['Play', 'Pause', 'Ended', 'Stop', 'Canplay', 'TimeUpdate', 'Error']) audio[`on${name}`] = handler => { listeners[name] = handler; };
      audios.push(audio);
      return audio;
    },
  };
  const questions = evaluate('lib/questions.js', { './api': api, './config': { apiOrigin: 'https://pikku.qzz.io/' }, '../data/bank': bank, '../data/shared': shared, '../data/content-locale': contentLocale() }, { wx });
  let definition;
  evaluate('pages/index/index.js', {
    '../../lib/api': api, '../../lib/vocabulary': {}, '../../lib/vocabulary-page': { vocabularyActions: {} },
    '../../data/content-locale': contentLocale(), '../../data/bank': bank, '../../data/shared': shared, '../../lib/copy': copy, '../../lib/questions': questions,
  }, { wx, Page: value => { definition = value; } });
  const page = { ...definition, data: plain(definition.data), alive: true, generation: 0, owner: account ? 'account' : null,
    questions: bank.questions, queue: [],
    record: { progress: {}, bookmarks: [], vocab: {}, preference: { language, level, vocabMode: 'context' } },
    setData(update) { Object.assign(this.data, update); },
    renderVocabulary() {}, initVocabulary() {}, nextCard() {},
  };
  Object.assign(page.data, { language, level });
  page.render();
  return { page, calls, storage, audios, questions };
}

const paper = () => bank.questions.filter(q => q.id.startsWith('jlpt-1992-1-'));
const listening = () => paper().find(q => q.audio);

test('the original 149-question paper crosses CFGM levels without changing the learning preference', () => {
  const h = harness({ level: 'C' });
  assert.equal(h.page.range.some(q => q.id.startsWith('jlpt-1992-1-')), false);
  h.page.openPaper(event({}));
  assert.equal(h.page.data.level, 'C');
  assert.equal(h.page.record.preference.level, 'C');
  assert.equal(h.page.data.fullPaper, true);
  assert.equal(h.page.data.questionTotal, 149);
  assert.deepEqual(plain(h.page.queue.map(q => q.id)), paper().map(q => q.id));
  assert.deepEqual(new Set(h.page.queue.map(q => q.level)), new Set(['F', 'G']));
  assert.equal(h.calls.length, 0);
  for (const [category, count] of [['vocabulary', 65], ['listening', 30], ['reading', 23], ['sentencePattern', 31]]) {
    h.page.openPaper(event({ category }));
    assert.equal(h.page.queue.length, count);
    assert.ok(h.page.queue.every(q => q.category === category));
    assert.equal(h.page.data.level, 'C');
  }
  h.page.exitPaper();
  assert.equal(h.page.data.fullPaper, false);
  assert.equal(h.page.data.level, 'C');
  assert.ok(h.page.range.every(q => shared.matchesLevel(q, 'C')));
});

test('paper jumps use canonical IDs and original numbers; fixed options keep original answer indexes', () => {
  const h = harness();
  h.page.openPaper(event({}));
  for (const q of paper()) {
    h.page.showQuestion(q);
    assert.deepEqual(plain(h.page.data.choices.map(choice => choice.index)), [0, 1, 2, 3], q.id);
    assert.deepEqual(plain(h.page.data.choices.map(choice => choice.text)), q.options, q.id);
    assert.ok(h.page.data.paperQuestions[h.page.data.paperQuestionIndex].label.includes(q.originalNumber));
  }
  const target = paper().find(q => q.category === 'reading');
  const index = h.page.data.paperQuestions.findIndex(q => q.id === target.id);
  h.page.jumpQuestion({ detail: { value: String(index) } });
  assert.equal(h.page.data.question.id, target.id);
  assert.equal(h.page.data.questionIndex, index);
  h.page.jumpQuestion({ detail: { value: '99999' } });
  assert.equal(h.page.data.question.id, target.id);
  h.page.openQuestion(event({ id: 'not-a-question' }));
  assert.equal(h.page.data.question.id, target.id);
});

test('ordinary level/filter selection and shuffle continue to use original answer indexes', async () => {
  const h = harness({ language: 'la', level: 'C' });
  const q = bank.questions.find(q => (q.language || 'la') === 'la' && q.type === 'choice' && q.answer === 0 && q.options.length === 4 && shared.matchesLevel(q, 'C'));
  h.page.record.bookmarks = [q.id];
  h.page.changeFilter(event({ filter: 'saved' }));
  h.page.changeCategory({ detail: { value: String(h.questions.questionCategories.indexOf(q.category)) } });
  h.page.changeSearch({ detail: { value: q.id } });
  assert.deepEqual(plain(h.page.filtered.map(q => q.id)), [q.id]);
  h.page.setData({ view: 'practice' });
  h.page.startPractice();
  const slot = h.page.data.choices.findIndex(choice => choice.index === q.answer);
  assert.notEqual(slot, q.answer);
  await h.page.answer(event({ index: h.page.data.choices[slot].index }));
  assert.equal(h.page.record.progress[q.id], 'correct');
  assert.equal(h.page.data.answerCorrect, true);
  assert.equal(h.calls.length, 0);
});

test('reading passages, 1992 figure URLs and per-question audio survive Page display intact', () => {
  const h = harness();
  const q = paper().find(q => q.category === 'reading');
  h.page.showQuestion(q);
  assert.equal(h.page.data.question.passage, q.passage);
  assert.ok(q.passage.length > 500);
  const audio = listening();
  h.page.showQuestion(audio);
  assert.equal(h.page.data.questionAudioSource, `https://pikku.qzz.io${audio.audio.src}`);
  assert.equal(h.page.data.questionImages[0].src, `https://pikku.qzz.io${audio.images[0].src}`);
  h.page.previewQuestionImage(event({ index: '0' }));
  assert.deepEqual(h.calls[0].previewImage, { current: `https://pikku.qzz.io${audio.images[0].src}`, urls: [`https://pikku.qzz.io${audio.images[0].src}`] });
  assert.equal(h.audios.length, 0, 'showing a question must not start or create audio');
  for (const src of ['http://example.test/file', 'javascript:alert(1)', 'file:///private', undefined]) assert.equal(h.questions.mediaUrl(src), '');
});

test('transcript is available only after a valid submission, which records the canonical question once', async () => {
  const h = harness({ account: true });
  const q = listening();
  h.page.showQuestion(q);
  assert.equal(h.page.data.visibleTranscript, '');
  h.page.toggleTranscript();
  h.page.revealAnswer();
  assert.equal(h.page.data.transcriptOpen, false);
  assert.equal(h.page.data.revealed, false);
  await h.page.answer(event({ index: '-1' }));
  await h.page.answer(event({ index: '4' }));
  assert.equal(h.page.data.submitted, false);
  assert.equal(h.calls.length, 0);
  await h.page.answer(event({ index: String(q.answer) }));
  assert.equal(h.page.data.visibleTranscript, q.transcript);
  h.page.toggleTranscript();
  assert.equal(h.page.data.transcriptOpen, true);
  await h.page.answer(event({ index: String(q.answer) }));
  assert.deepEqual(h.calls, [{ path: '/api/progress', method: 'POST', data: {
    questionId: q.id, language: 'ja', level: q.level, category: q.category, status: 'correct',
  } }]);
  h.page.showQuestion(paper()[0]);
  assert.equal(h.page.data.visibleTranscript, '');
  assert.equal(h.page.data.transcriptOpen, false);
  assert.equal(h.page.data.submitted, false);
});

test('audio controls handle pause, seek, restart, completion and stale player callbacks', () => {
  const h = harness();
  h.page.openPaper(event({ category: 'listening' }));
  h.page.toggleQuestionAudio();
  const audio = h.audios[0];
  assert.equal(audio.autoplay, false);
  assert.equal(audio.src, h.page.data.questionAudioSource);
  assert.equal(audio.playCount, 1);
  assert.equal(h.page.data.audioPlaying, true);
  audio.currentTime = 65.9;
  audio.duration = 100;
  audio.emit('Canplay');
  assert.equal(h.page.data.audioTime, '1:05');
  assert.equal(h.page.data.audioTotal, '1:40');
  h.page.toggleQuestionAudio();
  assert.equal(audio.pauseCount, 1);
  assert.equal(h.page.data.audioPlaying, false);
  h.page.seekQuestionAudio({ detail: { value: '200' } });
  h.page.seekQuestionAudio({ detail: { value: '-7' } });
  assert.deepEqual(audio.seeks, [100, 0]);
  audio.currentTime = 100;
  audio.emit('TimeUpdate');
  audio.emit('Ended');
  h.page.toggleQuestionAudio();
  assert.equal(audio.seeks.at(-1), 0);
  h.page.restartQuestionAudio();
  assert.equal(audio.stopCount, 1);
  assert.equal(audio.destroyCount, 1);
  assert.equal(h.audios.length, 2);
  assert.equal(h.audios[1].playCount, 1);
  h.page.nextQuestion();
  assert.equal(h.audios[1].destroyCount, 1);
  audio.emit('Play');
  audio.emit('Error');
  audio.emit('TimeUpdate');
  assert.equal(h.page.data.audioPlaying, false);
  assert.equal(h.page.data.audioError, '');
  assert.equal(h.page.data.audioTime, '0:00');
  assert.equal(h.page.questionAudio, null);
});

test('real Page navigation, locale/level/language changes and lifecycle stop and destroy question audio', async () => {
  for (const change of [
    page => page.changeView(event({ view: 'home' })),
    page => page.changeLocale(),
    page => page.changeLevel({ detail: { level: 'F' } }),
    page => page.changeLanguage({ detail: { value: String(page.data.languages.findIndex(x => x.id === 'la')) } }),
    page => page.onHide(),
    page => page.onUnload(),
  ]) {
    const h = harness();
    h.page.openPaper(event({ category: 'listening' }));
    h.page.toggleQuestionAudio();
    await change(h.page);
    assert.equal(h.audios[0].stopCount, 1);
    assert.equal(h.audios[0].destroyCount, 1);
    assert.equal(h.page.questionAudio, null);
    const playingAfterExit = h.page.data.audioPlaying;
    h.audios[0].emit('Play');
    assert.equal(h.page.data.audioPlaying, playingAfterExit, 'old callbacks cannot change the departed page');
    if (h.page.alive) assert.equal(h.page.data.audioPlaying, false);
  }
});

test('wrong/saved paper filters and original-number search keep all levels; preference selection exits paper', async () => {
  const h = harness({ level: 'C' });
  const q = paper().find(q => q.level === 'G' && q.category === 'reading');
  h.page.record.progress[q.id] = 'review';
  h.page.record.bookmarks = [q.id];
  h.page.openPaper(event({}));
  h.page.changeFilter(event({ filter: 'wrong' }));
  assert.deepEqual(plain(h.page.filtered.map(q => q.id)), [q.id]);
  h.page.changeFilter(event({ filter: 'saved' }));
  h.page.changeSearch({ detail: { value: q.originalNumber } });
  assert.deepEqual(plain(h.page.filtered.map(q => q.id)), [q.id]);
  await h.page.changeLevel({ detail: { level: 'C' } });
  assert.equal(h.page.data.fullPaper, false);
  assert.equal(h.page.data.level, 'C');
  assert.ok(h.page.range.every(q => shared.matchesLevel(q, 'C')));
  assert.equal(h.page.data.question, null);
});


test('all three source papers open across levels and retain source order on picker changes', () => {
  const h = harness({ level: 'C' });
  for (const [index, count] of [[0,149],[1,152],[2,36]]) {
    h.page.changePaper({ detail: { value: String(index) } });
    assert.equal(h.page.data.selectedPaper, bank.questionCollections[index].id);
    assert.equal(h.page.data.questionTotal, count);
    assert.equal(h.page.data.level, 'C');
    assert.ok(h.page.queue.every(q => shared.questionInCollection(q, bank.questionCollections[index].id)));
    assert.ok(h.page.queue.every(q => q.shuffleOptions === false));
    assert.equal(h.page.data.question.id, h.page.queue[0].id);
    assert.equal(h.page.data.submitted, false);
  }
});

test('both historical papers preserve audio-only choices and expose their transcript only after answering', async () => {
  const h = harness();
  const source = fs.readFileSync(new URL('pages/index/index.wxml', miniRoot), 'utf8');
  assert.match(source, /wx:if="{{!question.optionsInAudio \|\| submitted}}">{{item.text}}/);
  for (const prefix of ['jlpt-1992-1-', 'jlpt-1993-1-']) {
    const items = bank.questions.filter(q => q.id.startsWith(prefix) && q.optionsInAudio);
    assert.equal(items.length, prefix.includes('1992') ? 20 : 19);
    const q = items[0];
    h.page.showQuestion(q);
    assert.equal(h.page.data.submitted, false);
    assert.equal(h.page.data.visibleTranscript, '');
    assert.deepEqual(plain(h.page.data.choices.map(choice => choice.index)), [0,1,2,3]);
    await h.page.answer(event({ index: q.answer }));
    assert.equal(h.page.data.answerCorrect, true);
    assert.equal(h.page.data.visibleTranscript, q.transcript);
  }
});


test('native paper occurrence labels localize while canonical learning metadata stays unchanged', () => {
  const h = harness();
  for (const collection of bank.questionCollections) {
    h.page.openPaper(event({ collection: collection.id }));
    const canonical = h.page.activeQuestion;
    const saved = plain(canonical.occurrences);
    assert.ok(saved.length);
    h.page.changeLocale();
    assert.equal(h.page.data.locale, 'en');
    assert.notEqual(h.page.data.question.occurrences[0].label, saved[0].label);
    assert.deepEqual(plain(h.page.data.question.occurrences), saved.map(item => ({ ...item, label: contentLocale().contentText(item.label, 'en') })));
    assert.deepEqual(plain(canonical.occurrences), saved);
    assert.equal(h.page.activeQuestion, canonical);
    h.page.changeLocale();
    assert.deepEqual(plain(h.page.data.question.occurrences), saved);
  }
});
