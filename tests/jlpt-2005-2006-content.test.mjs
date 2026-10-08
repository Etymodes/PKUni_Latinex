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
// Answer tables independently transcribed from compendium pages 230–231 and 190–191.
const digits=s=>[...s].map(Number);
const keys={2005:{vocabulary:digits('33421122113331422244234244324341343114212233422441311313421131242'),reading:digits('132112414221332434213144'),sentencePattern:digits('21314112432421434123342131324342321'),I:digits('342322132414342'),II:digits('321241342233141')},2006:{vocabulary:digits('43132132113432442434412331431124421212412322144134133143241424132'),reading:digits('214434342121421433121233'),sentencePattern:digits('22131432443113144223314312214234142'),I:digits('224333231224343'),II:digits('213134131211424')}};
for(const year of [2005,2006]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,154);assert.equal(bank.length,raw.length);
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
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===2005?2005:2971));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===2005?19:20}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${24}`)),null);
 });
}

test('2005/2006: source repairs preserve independent passages, choices and cloze boundaries',()=>{
 const a=read(2005),b=read(2006),find=(qs,s)=>qs.find(q=>q.id.endsWith(s));
 assert(find(a,'reading-III-23').passage.startsWith('言語は人間'));assert(!find(a,'reading-III-22').options[3].includes('言語'));
 assert.equal(find(a,'listening-I-10').answer,3);assert.equal(find(a,'listening-II-8').answer,3);assert.equal(read(2005,'-provenance').answerCorrections.length,2);
 assert.equal(find(b,'vocab-I-3').text,'迫られて');assert.equal(find(b,'vocab-III-31').options[3],'然焼');
 assert(find(b,'vocab-III-31').passage.startsWith('プラスチック'));assert(find(b,'vocab-III-28').passage.includes('カメラマン'));
 assert.equal(find(b,'grammar-IV-26').options[1],'早いか');assert(find(b,'grammar-V-50').text.includes('中止に（ ）'));
 for(const q of [...a,...b]){
  assert(!/HYPERLINK|MERGEFORMAT|INCLUDEPICTURE|[\u0000-\u0008\u0013-\u0015]|問題用紙|答え[：:]/.test([q.text,q.passage,q.transcript,...q.options].join('\n')),q.id);
  if(q.category==='sentencePattern'||q.id.includes('-vocab-V-'))assert.equal(q.text.split('（ ）').length-1,/grammar-IV-(43|38)$/.test(q.id)&&(q.id.startsWith('jlpt-2005')?q.id.endsWith('-43'):q.id.endsWith('-38'))?2:1,q.id);
 }
 const ja=vocabularyCards.filter(c=>c.language==='ja');assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
});
