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
// Answer tables independently transcribed from compendium pages 151–152 and 111.
const digits=s=>[...s].map(Number);
const keys={"2007": {"vocabulary": [2, 1, 3, 2, 4, 1, 4, 1, 3, 2, 1, 4, 2, 3, 4, 2, 3, 1, 3, 4, 2, 4, 3, 3, 2, 1, 1, 3, 1, 3, 4, 4, 2, 4, 2, 3, 4, 2, 1, 1, 3, 2, 4, 3, 2, 1, 1, 4, 2, 4, 2, 3, 1, 3, 4, 3, 1, 4, 1, 2, 2, 3, 4, 4, 1], "reading": [2, 3, 4, 3, 1, 3, 2, 1, 3, 2, 4, 4, 1, 4, 4, 1, 2, 3, 4, 3, 1], "sentencePattern": [3, 4, 1, 2, 2, 1, 4, 4, 4, 2, 3, 1, 1, 2, 2, 3, 3, 4, 3, 1, 2, 2, 3, 2, 1, 4, 2, 1, 4, 1, 4, 3, 2, 3, 1], "I": [4, 2, 3, 3, 2, 2, 4, 2, 1, 3, 2, 1, 2, 3, 3, 1], "II": [2, 3, 4, 1, 4, 1, 4, 3, 1, 4, 4, 3, 3, 4]}, "2008": {"vocabulary": [3, 4, 3, 3, 1, 2, 4, 4, 1, 4, 1, 3, 2, 1, 2, 1, 4, 2, 3, 2, 2, 4, 1, 4, 1, 3, 4, 1, 3, 2, 2, 3, 4, 3, 1, 1, 2, 4, 3, 2, 4, 3, 1, 2, 4, 2, 3, 4, 2, 1, 4, 3, 2, 1, 1, 2, 4, 1, 1, 3, 3, 1, 4, 3, 2], "reading": [4, 4, 3, 1, 4, 2, 3, 4, 3, 1, 2, 3, 2, 3, 4, 1, 2, 1, 2, 4, 1, 1, 3, 2], "sentencePattern": [3, 1, 3, 2, 4, 3, 1, 1, 4, 4, 2, 2, 2, 1, 1, 2, 3, 4, 3, 4, 2, 4, 1, 2, 1, 4, 4, 3, 3, 1, 3, 4, 2, 1, 2], "I": [1, 3, 1, 1, 4, 4, 4, 3, 1, 2, 4, 2, 2, 3, 1], "II": [4, 1, 1, 3, 4, 2, 3, 1, 2, 3, 4, 4, 2, 2, 1]}};
for(const year of [2007,2008]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,year===2007?151:154);assert.equal(bank.length,raw.length);
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
   if(q.category==='listening'){assert(q.transcript.length>50);assert(!/[男女][:：]|答え：|淘宝|你我日语/.test(q.text));assert.equal(classifyJlptQuestion(q),null);assert.equal(q.optionsInAudio,q.id.includes('-II-')?true:undefined);}
  }
  assert.equal(manifest.inferredAnswers,0);assert.equal(manifest.pending.length,0);assert.equal(manifest.publicationStatus,'ready-for-release');
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===2007?2820:2947));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===2007?17:20}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${year===2007?21:24}`)),null);
 });
}

test('2007/2008 repairs preserve missing passage and final-stage listening prompts',()=>{
 const a=read(2007),b=read(2008),find=(qs,s)=>qs.find(q=>q.id.endsWith(s));
 assert(find(b,'reading-III-21').passage.startsWith('「緑を、」'));assert.equal(find(a,'vocab-III-30').options[0],'釘った');
 assert.equal(find(a,'listening-I-10').text,'女の人が買ったのはどれですか。');assert.equal(find(a,'listening-II-13').text,'この調査で何がわかりますか。');
 assert.equal(find(a,'listening-II-2').options[2],'愚痴です。');
 for(const q of [...a,...b]){
  assert(!/MERGEFORMAT|INCLUDEPICTURE|本文檔|商用|[\u0000-\u0008\u0013-\u0015]|摧㚚/.test([q.text,q.passage,q.transcript,...q.options].join('\n')),q.id);
  if(q.category==='sentencePattern'||q.id.includes('-vocab-V-'))assert(q.text.includes('（ ）'),q.id);
 }
});
