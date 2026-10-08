import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadProjectData, createSourceLoader } from '../scripts/build-wechat.mjs';
const load = createSourceLoader();
const { questions, vocabularyCards } = loadProjectData();
const { questionInCollection, questionForCollection } = load('data/question-collections.ts');
const { classifyJlptQuestion } = load('lib/jlpt-exam.ts');
const { localizeQuestion, localizeVocabularyCard } = load('lib/content-locale.ts');
const read = (year, suffix = '') => JSON.parse(fs.readFileSync(new URL(`../data/jlpt-${year}${suffix}.json`, import.meta.url), 'utf8'));
// Independently transcribed printed answer keys, PDF physical pp. 618–619 / 581.
const keys = {
  1995: {
    vocabulary: [3,4,1,4,2,2,3,4,1,3,1,3,1,4,2,4,3,1,1,2,3,2,1,2,4,2,1,3,4,1,2,3,3,2,4,2,4,3,4,1,2,3,2,4,3,1,2,2,1,4,3,1,3,4,2,3,4,1,2,2,3,4,1,2,3],
    reading: [4,1,2,1,2,3,3,1,2,3,4,1,4,3,1,2,3,2,4,1,4,2],
    sentencePattern: [2,3,1,3,1,3,3,2,1,2,4,1,2,1,4,2,4,1,3,1,2,3,4,1,2,2,4,1,3,2,2,4,4,4,2,3,4,3],
    I: [2,null,3,3,2,1,2,null,1,4], II: [2,4,1,1,2,4,3,3,2,2,4,3,2,3,1,4],
  },
  1996: {
    vocabulary: [1,2,1,3,3,4,1,3,4,1,3,1,4,1,3,3,4,1,2,4,3,1,4,3,3,1,2,4,2,1,4,3,1,2,3,2,2,3,2,4,1,4,3,3,4,1,3,4,2,4,3,2,2,3,1,1,3,1,4,1,2,3,2,4,4],
    reading: [4,2,2,3,3,1,4,3,4,2,4,1,2,3,3,3,2,4,4,1,2],
    sentencePattern: [1,1,4,2,3,1,1,3,4,1,2,2,2,3,2,4,2,4,4,1,3,1,3,2,1,4,1,1,3,1,2,3,4,3,1],
    I: [3,4,2,4,2,3,4,1,1,null,4], II: [2,2,3,4,2,4,4,1,2,1,3,1,4,1,3],
  },
};
for (const year of [1995, 1996]) {
  test(`${year}: original answer order, source tags, media and missing-option quarantine survive both bank and localization`, () => {
    const raw = read(year), manifest = read(year, '-provenance');
    const bank = questions.filter(q => questionInCollection(q, `jlpt-${year}-1`));
    assert.equal(raw.length, year === 1995 ? 149 : 146); assert.equal(bank.length, raw.length);
    for (const category of ['vocabulary', 'reading', 'sentencePattern']) {
      assert.deepEqual(raw.filter(q => q.category === category).map(q => q.answer + 1), keys[year][category]);
    }
    for (const part of ['I', 'II']) keys[year][part].forEach((answer, i) => {
      const id = `jlpt-${year}-1-listening-${part}-${i+1}`, q = raw.find(q => q.id === id);
      if (answer === null) { assert(!q); assert(manifest.pending.some(item => item.id === id)); }
      else assert.equal(q?.answer, answer - 1, id);
    });
    for (const incoming of raw) {
      const canonical = bank.find(q => q.occurrences.some(o => o.sourceQuestionId === incoming.id)); assert(canonical);
      const restored = questionForCollection(canonical, `jlpt-${year}-1`);
      const english = localizeQuestion(restored, 'en');
      for (const key of ['options','answer','text','passage','level','originalNumber','transcript','audio']) {
        assert.deepEqual(restored[key], incoming[key], `${incoming.id}.${key}`);
        assert.deepEqual(english[key], incoming[key], `${incoming.id}.en.${key}`);
      }
      assert.notEqual(english.explanation, restored.explanation);
      assert.equal(restored.shuffleOptions, false);
      assert(['F','G'].includes(restored.level));
      assert(restored.options.every(Boolean)); assert.equal(new Set(restored.options).size,4);
      for (const media of [...(restored.images || []), ...(restored.audio ? [restored.audio] : [])]) {
        assert(media.src.startsWith(`/media/jlpt-${year}/`));
        assert(fs.statSync(new URL('../public' + media.src, import.meta.url)).size > 1000);
      }
      if (restored.category === 'listening') {
        assert(restored.transcript.length > 100);
        assert(!/[男女][:：]/.test(restored.text), 'Dialogue belongs after answering, not in the visible prompt');
        assert(!/\.com|答え：|微信|淘宝|淘寶/.test(restored.transcript));
        assert.equal(classifyJlptQuestion(restored), null, 'Old listening is not silently relabeled as a modern format');
      }
    }
    assert.equal(manifest.inferredAnswers, 0);
    assert.equal(manifest.publicationStatus, 'ready-for-release');
    assert.equal(manifest.pending.length, year === 1995 ? 2 : 1);
    for (const segment of manifest.audioAlignment) {
      const q = raw.find(q => q.id === segment.id), bytes = fs.readFileSync(new URL('../public' + q.audio.src, import.meta.url));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), segment.sha256);
      assert(segment.endSeconds > segment.startSeconds + 20);
      assert(segment.endSeconds - segment.startSeconds < 140);
      assert(segment.endSeconds < (year === 1995 ? 2279 : 2361));
    }
  });
  test(`${year}: every question links to the bilingual shared dictionary/trainer; reviewed reading and spelling tasks enter random practice`, () => {
    const raw = read(year), pool = vocabularyCards.filter(c => c.sourceCollections?.includes(`jlpt-${year}-1`));
    const links = new Set(pool.flatMap(c => c.sourceQuestionIds || []));
    for (const q of raw) assert(links.has(q.id), q.id);
    for (const c of pool) assert.notEqual(localizeVocabularyCard(c,'en').meaning, c.meaning, c.id);
    const find = suffix => raw.find(q => q.id === `jlpt-${year}-1-${suffix}`);
    assert.equal(classifyJlptQuestion(find('vocab-I-1')), 'kanji-reading');
    assert.equal(classifyJlptQuestion(find('vocab-III-21')), 'orthography');
    assert.equal(classifyJlptQuestion(find('vocab-V-41')), 'context-vocabulary');
    assert.equal(classifyJlptQuestion(find('reading-III-17')), 'reading-short');
    assert.equal(classifyJlptQuestion(find('reading-III-19')), null);
  });
}
test('the two imports preserve canonical spelling identities and never create textbook dictionary citations', () => {
  const ja = vocabularyCards.filter(c => c.language === 'ja');
  assert.equal(new Set(ja.map(c => c.term.normalize('NFKC').trim())).size, ja.length);
  for (const [term, id, variant] of [['蘇る','ja-n1-list-cdf3a0b4de98','よみがえる'],['相応しい','ja-n1-list-dc5dcfe9ba70','ふさわしい']]) {
    const c = ja.find(c => c.term === term); assert.equal(c.id,id); assert(c.spellingVariants.includes(variant));
    assert(c.sourceCollections.includes('jlpt-1996-1')); assert(!ja.some(c => c.term === variant));
  }
  for (const year of [1995,1996]) for (const entry of read(year,'-vocabulary')) assert.equal(entry.dictionaryReferences,undefined);
});
