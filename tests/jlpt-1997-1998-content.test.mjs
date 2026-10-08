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
// Independently copied from printed answer tables, physical PDF pp. 541–542 and 501–502.
const keys={
1997:{vocabulary:[4,2,1,3,1,3,1,4,3,1,2,2,4,3,1,2,4,3,2,1,4,2,4,4,2,3,3,1,3,1,3,4,1,2,3,3,4,1,2,4,4,1,3,4,1,2,4,1,2,3,2,3,2,3,1,4,3,2,2,1,3,1,2,3,4],reading:[2,4,3,1,4,1,3,4,2,3,2,1,4,3,3,4,2,1,4,1,3],sentencePattern:[4,1,2,2,1,3,1,4,3,4,1,1,2,3,1,4,3,4,4,2,3,2,4,1,2,3,2,2,3,3,4,2,1,3,2],I:[3,4,1,2,3,1,3,4,2,1,4,3,2,2],II:[3,4,3,1,4,3,2,4,1,2,2,4,1]},
1998:{vocabulary:[2,3,4,4,1,3,4,1,4,4,2,3,2,1,3,4,4,2,3,1,2,3,1,2,1,2,1,3,4,4,3,1,1,3,4,2,4,3,2,1,1,2,1,3,4,2,3,2,3,4,3,4,4,2,1,3,1,2,3,4,2,3,1,4,4],reading:[3,1,2,3,4,2,1,4,3,1,3,2,1,4,4,3,1,3,2,4,2,2],sentencePattern:[3,4,1,1,4,2,4,1,2,3,4,2,4,2,4,2,2,3,3,1,2,1,1,4,2,3,3,1,4,4,2,1,4,3,1],I:[2,1,4,2,2,1,3,3,4,3,2,1,1,3,4],II:[4,1,1,2,1,2,3,3,4,3,3,1,4,2,2,4,3]}};
for(const year of [1997,1998]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,year===1997?148:154);assert.equal(bank.length,raw.length);
  assert.equal(new Set(raw.map(q=>q.id)).size,raw.length);
  for(const cat of ['vocabulary','reading','sentencePattern'])assert.deepEqual(raw.filter(q=>q.category===cat).map(q=>q.answer+1),keys[year][cat]);
  for(const part of ['I','II'])keys[year][part].forEach((a,i)=>assert.equal(raw.find(q=>q.id===`jlpt-${year}-1-listening-${part}-${i+1}`)?.answer,a-1));
  for(const incoming of raw){
   const canonical=bank.find(q=>q.occurrences.some(o=>o.sourceQuestionId===incoming.id));assert(canonical);
   const q=questionForCollection(canonical,`jlpt-${year}-1`),en=localizeQuestion(q,'en');
   for(const k of ['text','passage','options','answer','transcript','audio','level','originalNumber']){assert.deepEqual(q[k],incoming[k],`${incoming.id}.${k}`);assert.deepEqual(en[k],incoming[k],`${incoming.id}.en.${k}`);}
   assert.notEqual(en.explanation,q.explanation);assert(/[A-Za-z]{3}/.test(en.explanation));assert.equal(q.shuffleOptions,false);
   assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert(q.options.every(Boolean));
   for(const m of [...(q.images||[]),...(q.audio?[q.audio]:[])])assert(fs.statSync(new URL('../public'+m.src,import.meta.url)).size>1000);
   if(q.category==='listening'){assert(q.transcript.length>50);assert(!/[男女][:：]|回答|答え：|淘宝|你我日语/.test(q.text));assert.equal(classifyJlptQuestion(q),null);assert.equal(q.optionsInAudio,q.id.includes('-II-')?true:undefined);}
  }
  assert.equal(manifest.inferredAnswers,0);assert.deepEqual(manifest.pending,[]);assert.equal(manifest.publicationStatus,'ready-for-release');
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===1997?2355:2267));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===1997?15:16}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${year===1997?17:21}`)),null);
 });
}
test('1997/98 source recovery retains figures and all formerly omitted hearing passages',()=>{
 const y97=read(1997),y98=read(1998);
 for(const id of ['reading-II-14','reading-III-17','reading-III-18'])assert(y97.find(q=>q.id===`jlpt-1997-1-${id}`).images.length);
 assert(y98.find(q=>q.id==='jlpt-1998-1-reading-III-21').images.length);
 for(const [n,word] of [[6,'枝'],[7,'あべこべ'],[8,'中三日']])assert(y98.find(q=>q.id===`jlpt-1998-1-listening-I-${n}`).transcript.includes(word));
 const ja=vocabularyCards.filter(c=>c.language==='ja');assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
});
