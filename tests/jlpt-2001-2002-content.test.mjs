import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadProjectData, createSourceLoader} from '../scripts/build-wechat.mjs';
const load=createSourceLoader(), {questions,vocabularyCards}=loadProjectData();
const {questionInCollection,questionForCollection}=load('data/question-collections.ts');
const {localizeQuestion,localizeVocabularyCard}=load('lib/content-locale.ts');
const {classifyJlptQuestion}=load('lib/jlpt-exam.ts');
const read=(y,s='')=>JSON.parse(fs.readFileSync(new URL(`../data/jlpt-${y}${s}.json`,import.meta.url),'utf8'));
// Independently checked answer tables; 2001 listening uses the answer-bearing transcript
// because the compendium rows omit I-5 and II-5 and shift later entries.
const digits=s=>[...s].map(Number);
const keys={2001:{vocabulary:digits('42324213312432142341322431141341322134121123242314311322342443424'),reading:digits('143432342311421442413'),sentencePattern:digits('413212343123144434211122324423414211'),I:digits('43411342421313232'),II:digits('14334312434221423')},
2002:{vocabulary:digits('13414341232331223244224323142342131124131412324214134313241313424'),reading:digits('34243112133143214242434'),sentencePattern:digits('421334212313442131243142143224142133'),I:digits('12221243324313411'),II:digits('441232214111342143')}};
for(const year of [2001,2002]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,year===2001?156:159);assert.equal(bank.length,raw.length);
  assert.equal(new Set(raw.map(q=>q.id)).size,raw.length);
  for(const cat of ['vocabulary','reading','sentencePattern'])assert.deepEqual(raw.filter(q=>q.category===cat).map(q=>q.answer+1),keys[year][cat]);
  for(const part of ['I','II'])keys[year][part].forEach((a,i)=>{assert.equal(raw.find(q=>q.id===`jlpt-${year}-1-listening-${part}-${i+1}`)?.answer,a-1);});
  for(const incoming of raw){
   const canonical=bank.find(q=>q.occurrences.some(o=>o.sourceQuestionId===incoming.id));assert(canonical);
   const q=questionForCollection(canonical,`jlpt-${year}-1`),en=localizeQuestion(q,'en');
   for(const k of ['text','passage','options','answer','transcript','audio','level','originalNumber']){assert.deepEqual(q[k],incoming[k],`${incoming.id}.${k}`);assert.deepEqual(en[k],incoming[k],`${incoming.id}.en.${k}`);}
   assert.notEqual(en.explanation,q.explanation);assert(/[A-Za-z]{3}/.test(en.explanation));assert.equal(q.shuffleOptions,false);
   assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert(q.options.every(Boolean));
   for(const m of [...(q.images||[]),...(q.audio?[q.audio]:[])])assert(fs.statSync(new URL('../public'+m.src,import.meta.url)).size>1000);
   if(q.category==='listening'){assert(q.transcript.length>50);assert(!/[男女][:：]|回答|答え：|淘宝|你我日语/.test(q.text));assert.equal(classifyJlptQuestion(q),null);assert.equal(q.optionsInAudio,q.id.includes('-II-')?true:undefined);}
  }
  assert.equal(manifest.inferredAnswers,0);assert.equal(manifest.pending.length,0);assert.equal(manifest.publicationStatus,'ready-for-release');
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===2001?1817:2755));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===2001?18:19}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${year===2001?21:23}`)),null);
 });
}
test('2001/2002: source corrections, cloze markers, graph options and unique vocabulary',()=>{
 const a=read(2001),b=read(2002),find=(qs,s)=>qs.find(q=>q.id.endsWith(s));
 assert.equal(find(a,'vocab-V-45').text,'この会場は400人（ ）できる。');
 assert.equal(find(a,'grammar-IV-23').text,'無料で映画が見られる（ ）、入り口の前には1時間も前から行列ができた。');
 assert.equal(find(b,'grammar-IV-26').text,'田中さんは、この1週間と（ ）、仕事どころではないようだ。');
 assert.equal(find(b,'reading-III-21').options[0],'ラクである');
 assert.equal(find(b,'reading-III-23').images.length,2);
 assert(find(b,'listening-I-11').transcript.includes('あと3万円戻ってきた'));assert.equal(find(b,'listening-I-11').answer,3);
 assert.equal(find(a,'listening-I-5').answer,0);assert.equal(find(a,'listening-II-5').answer,3);
 assert(read(2001,'-provenance').answerCorrections.length>10);
 for(const q of [...a,...b]){
  assert(!/1番2番|答案|生词|MERGEFORMAT|\u0001/.test([q.text,q.passage,q.transcript,...q.options].join('\n')),q.id);
  if(q.category==='sentencePattern'||q.id.includes('-vocab-V-'))assert.equal(q.text.split('（ ）').length-1,['jlpt-2001-1-grammar-IV-31','jlpt-2002-1-grammar-IV-41'].includes(q.id)?2:1,q.id);
 }
 const ja=vocabularyCards.filter(c=>c.language==='ja');assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
});
