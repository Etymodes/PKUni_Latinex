import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { studyQuestions, questionAliases, duplicateQuestionOccurrences } from '../data/study-questions.ts';
import { questionInCollection, questionForCollection } from '../data/question-collections.ts';
import { vocabularyCards, vocabularyInCollection, publicDictionaryReferences } from '../data/vocabulary.ts';
const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const sources = [['jlpt-1992-1','jlpt-1992',149],['jlpt-1993-1','jlpt-1993',152],['ja-hlb1000-n1-u01','ja-hlb1000-n1-u01',36]];

test('published collections keep every original question, answer, option order and stable progress ID', () => {
  assert.equal(new Set(studyQuestions.map(q => q.id)).size, studyQuestions.length);
  assert.equal(duplicateQuestionOccurrences.length, 0, 'Independent review found no true repeats in this batch');
  for (const [collection,file,count] of sources) {
    const raw = read(file);
    const pool = studyQuestions.filter(q => questionInCollection(q,collection));
    assert.equal(pool.length,count);
    for (const incoming of raw) {
      assert.equal(questionAliases[incoming.id],incoming.id);
      const q = questionForCollection(pool.find(item => item.id===incoming.id),collection);
      for (const key of ['id','prompt','text','targetText','context','passage','options','answer','originalNumber','level','audio','images','transcript']) assert.deepEqual(q[key],incoming[key],`${incoming.id}.${key}`);
      assert.equal(q.shuffleOptions,false);
      assert.equal(q.occurrences[0].collectionId,collection);
    }
  }
});

test('new source answers match their independently checked answer ledger and CFGM ratings', () => {
  const q1993 = read('jlpt-1993');
  const ledger = read('jlpt-1993-provenance');
  const grades = read('jlpt-1993-difficulty').questions;
  for (const q of q1993) {
    assert.equal(q.answer,ledger.questions.find(row=>row.id===q.id).answerIndex,q.id);
    assert.equal(q.level,grades.find(row=>row.id===q.id).level,q.id);
    assert.ok(grades.find(row=>row.id===q.id).rationale.length>10);
  }
  assert.deepEqual(Object.fromEntries(['vocabulary','listening','reading','sentencePattern'].map(category=>[category,q1993.filter(q=>q.category===category).length])),{vocabulary:65,listening:28,reading:22,sentencePattern:37});
  assert.equal(q1993.filter(q=>q.optionsInAudio).length,19);
  assert.equal(q1993.filter(q=>q.level==='M').length,0);
  const unitGrades=read('ja-hlb1000-n1-u01-difficulty');
  for(const q of read('ja-hlb1000-n1-u01')) assert.equal(q.level,unitGrades.find(row=>row.id===q.id).level,q.id);
});

test('every 1993 media asset is byte-identical to the reviewed image/audio manifest', () => {
  const manifest=read('jlpt-1993-provenance');
  const media=[...manifest.images,...manifest.audioClips];
  assert.equal(media.length,39);
  const indexed=new Map(media.map(row=>[row.src,row]));
  for(const q of read('jlpt-1993')) for(const src of [...(q.images??[]).map(x=>x.src),...(q.audio?[q.audio.src]:[])]) {
    assert.ok(indexed.has(src),src);
    const bytes=fs.readFileSync(new URL(`../public${src}`,import.meta.url));
    assert.equal(bytes.length,indexed.get(src).sizeBytes,src);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),indexed.get(src).sha256,src);
  }
});

test('dictionary and trainer share deduplicated vocabulary covering every imported question', () => {
  const words=vocabularyCards.filter(card=>card.language==='ja');
  assert.equal(new Set(words.map(card=>card.term.normalize('NFKC').trim())).size,words.length);
  assert.equal(new Set(vocabularyCards.map(card=>card.id)).size,vocabularyCards.length);
  for(const [collection,file] of sources) {
    const pool=words.filter(card=>vocabularyInCollection(card,collection));
    const linked=new Set(pool.flatMap(card=>card.sourceQuestionIds??[]));
    for(const q of read(file)) assert.ok(linked.has(q.id),q.id);
    for(const card of pool) for(const ref of publicDictionaryReferences(card)) {
      assert.match(ref.name,/大辞泉|大辞林|広辞苑|廣辭苑|日本国語大辞典|日本國語大辭典|明鏡国語辞典|新明解国語辞典/);
    }
  }
});

test('public imports omit personal answers, private source IDs and local file paths', () => {
  const forbidden=new Set(['attempts','firstAttemptSummary','selectedChoiceNumber','selectedIndex','isCorrect','libraryFileId','questionImage','answerImage','coverImage']);
  const inspect = value => {
    if(Array.isArray(value)) value.forEach(inspect);
    else if(value && typeof value==='object') for(const [key,item] of Object.entries(value)) {assert.ok(!forbidden.has(key),key);inspect(item);}
    else if(typeof value==='string') assert.doesNotMatch(value,/[CD]:[\\/](?:Users|Etymodes|Downloads)[\\/]/);
  };
  for(const file of ['jlpt-1993','ja-hlb1000-n1-u01']) for(const suffix of ['','-vocabulary','-difficulty','-provenance']) inspect(read(file+suffix));
});
