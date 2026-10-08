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
// Answer tables independently transcribed from compendium pages 305–306 and 268–269.
const digits=s=>[...s].map(Number);
const keys={2003:{vocabulary:digits('23122344123212332312233424334414212141434323324143112234243143412'),reading:digits('4411234221321312334412'),sentencePattern:digits('343211314331231424234324321232441421'),I:digits('44234131213244231'),II:digits('4344323212342134')},
2004:{vocabulary:digits('23133424441241141231233432133311142244322334142331422144314241123'),reading:digits('4314221441432311341233422'),sentencePattern:digits('222314411433234341214142413312123243'),I:digits('21332343144214'),II:digits('231321242414133')}};
for(const year of [2003,2004]){
 test(`${year}: all printed answers, original order, bilingual explanations and media survive import`,()=>{
  const raw=read(year),manifest=read(year,'-provenance'),bank=questions.filter(q=>questionInCollection(q,`jlpt-${year}-1`));
  assert.equal(raw.length,year===2003?156:155);assert.equal(bank.length,raw.length);
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
  for(const a of manifest.audioAlignment){const q=raw.find(q=>q.id===a.id);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public'+q.audio.src,import.meta.url))).digest('hex'),a.sha256);assert(a.endSeconds>a.startSeconds+15);assert(a.endSeconds<(year===2003?2831:2545));}
 });
 test(`${year}: each question links to the shared bilingual dictionary and trainer`,()=>{
  const raw=read(year),pool=vocabularyCards.filter(c=>c.sourceCollections?.includes(`jlpt-${year}-1`)),linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  for(const c of pool){assert.notEqual(localizeVocabularyCard(c,'en').meaning,c.meaning,c.id);assert(['C','F','G','M'].includes(c.level));}
  for(const e of read(year,'-vocabulary'))assert.equal(e.dictionaryReferences,undefined,'No invented dictionary citation or textbook citation');
  const find=s=>raw.find(q=>q.id===`jlpt-${year}-1-${s}`);
  assert.equal(classifyJlptQuestion(find('vocab-I-1')),'kanji-reading');assert.equal(classifyJlptQuestion(find('vocab-III-21')),'orthography');assert.equal(classifyJlptQuestion(find('vocab-V-41')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find(`reading-III-${year===2003?18:19}`)),'reading-short');assert.equal(classifyJlptQuestion(find(`reading-III-${year===2003?22:25}`)),null);
 });
}
test('2003/2004: repaired source text, unscored exclusion and cloze boundaries',()=>{
 const a=read(2003),b=read(2004),find=(qs,s)=>qs.find(q=>q.id.endsWith(s));
 assert.equal(find(a,'vocab-I-7').text,'祝賀会');assert.equal(find(a,'vocab-I-8').text,'催された');
 assert(find(a,'vocab-V-47').text.includes('タバコ'));
 assert(find(a,'grammar-V-51').text.includes('運転者が前をよく見ていなかった'));
 assert(find(a,'reading-I-3').text.includes('事故後の状況'));
 assert.equal(find(a,'listening-II-16').answer,3);assert(find(a,'listening-II-16').transcript.includes('わかってなかった'));
 assert.equal(read(2003,'-provenance').answerCorrections[0].documentAnswer,2);
 assert.equal(read(2004,'-provenance').excludedQuestions.length,1);assert(!find(b,'listening-II-16'));
 assert(find(b,'reading-I-1').passage.startsWith('知覚'));assert(find(b,'reading-II-7').passage.includes('二酸化炭素'));
 assert.equal(find(a,'reading-III-22').images.length,1);assert.equal(find(b,'reading-III-25').images.length,1);
 for(const q of [...a,...b]){
  assert(!/哕|邉|摔|龋|MERGEFORMAT|INCLUDEPICTURE|\u0001|20031級|問題用紙/.test([q.text,q.passage,q.transcript,...q.options].join('\n')),q.id);
  if(q.category==='sentencePattern'||q.id.includes('-vocab-V-'))assert.equal(q.text.split('（ ）').length-1,q.id==='jlpt-2003-1-grammar-IV-29'?2:1,q.id);
 }
 const ja=vocabularyCards.filter(c=>c.language==='ja');assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
});
