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
// Checked against the original printed answer tables (physical pp. 460–461, 420–421).
// 1999's first row erroneously repeats five answers; subsequent rows are shifted by five.
const digits=s=>[...s].map(Number);
const keys={
1999:{vocabulary:digits('11231321431431131434413421133142233124143114423322223123113214342'),reading:digits('2432313213442331241342'),sentencePattern:digits('143242414341213223314421332412412213'),I:digits('2143121124342311'),II:digits('444112213313421223')},
2000:{vocabulary:digits('32424342311412341213132313422443414243141312434132431241332411423'),reading:digits('3124321234214344124123'),sentencePattern:digits('324314322144113413233441232214132341'),I:digits('2432344113124332'),II:digits('11123244342323143')}};
for(const year of [1999,2000]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,year===1999?157:155);assert.equal(bank.length,raw.length);
  assert.equal(new Set(raw.map(q=>q.id)).size,raw.length);
  for(const cat of ['vocabulary','reading','sentencePattern'])assert.deepEqual(raw.filter(q=>q.category===cat).map(q=>q.answer+1),keys[year][cat]);
  for(const part of ['I','II'])keys[year][part].forEach((a,i)=>{if(year===2000&&part==='I'&&i===4)return;assert.equal(raw.find(q=>q.id===`jlpt-${year}-1-listening-${part}-${i+1}`)?.answer,a-1);});
  for(const incoming of raw){
   const canonical=bank.find(q=>q.occurrences.some(o=>o.sourceQuestionId===incoming.id));assert(canonical);
   const q=questionForCollection(canonical,`jlpt-${year}-1`),en=localizeQuestion(q,'en');
   for(const k of ['text','passage','options','answer','transcript','audio','level','originalNumber']){assert.deepEqual(q[k],incoming[k],`${incoming.id}.${k}`);assert.deepEqual(en[k],incoming[k],`${incoming.id}.en.${k}`);}
   assert.notEqual(en.explanation,q.explanation);assert(/[A-Za-z]{3}/.test(en.explanation));assert.equal(q.shuffleOptions,false);
   assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert(q.options.every(Boolean));
   for(const m of [...(q.images||[]),...(q.audio?[q.audio]:[])])assert(fs.statSync(new URL('../public'+m.src,import.meta.url)).size>1000);
   if(q.category==='listening'){assert(q.transcript.length>50);assert(!/[男女][:：]|回答|答え：|淘宝|你我日语/.test(q.text));assert.equal(classifyJlptQuestion(q),null);assert.equal(q.optionsInAudio,q.id.includes('-II-')?true:undefined);}
  }
  assert.equal(manifest.inferredAnswers,0);assert.equal(manifest.pending.length,year===1999?0:1);assert.equal(manifest.publicationStatus,'ready-for-release');
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===1999?2553:2725));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===1999?15:21}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${year===1999?19:20}`)),null);
 });
}
test('1999/2000: recovered graph, homophone targets, cloze formatting and disputed date',()=>{
 const y99=read(1999),y00=read(2000);
 const find=(qs,s)=>qs.find(q=>q.id.endsWith(s));
 for(const id of ['reading-III-17','reading-III-19','reading-III-20','reading-III-21','reading-III-22'])assert(find(y99,id).images.length);
 assert(find(y00,'reading-III-20').images.length);
 assert.equal(find(y00,'reading-III-20').answer,0);
 assert(!find(y00,'listening-I-5'));
 assert(read(2000,'-provenance').pending[0].reason.includes('9th'));
 assert.equal(find(y99,'vocab-II-16').text,'軽快');
 assert.equal(find(y00,'vocab-II-16').text,'後悔');
 assert.equal(find(y00,'vocab-V-46').text,'事務所ではアルバイトを2名（ ）している。');
 assert.equal(find(y00,'vocab-V-54').text,'高速道路で制限速度を50キロ（ ）して走り、スピード違反でつかまった。');
 assert(find(y00,'listening-II-4').transcript.includes('部下の話をよく聞く'));
 assert(find(y00,'listening-II-15').transcript.includes('定食'));
 for(const q of [...y99,...y00]){
  assert(!/INCLUDEPICTURE|MERGEFORMAT|\u0001|（＿）/.test(JSON.stringify(q)),q.id);
  if(q.category==='sentencePattern'||q.id.includes('-vocab-V-'))assert(/_{2,}|[（(]\s*[）)]/.test(q.text),q.id);
 }
 const ja=vocabularyCards.filter(c=>c.language==='ja');assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
});
