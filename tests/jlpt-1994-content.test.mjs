import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadProjectData, createSourceLoader } from '../scripts/build-wechat.mjs';
const {questions,vocabularyCards}=loadProjectData();
const load=createSourceLoader();
const {questionInCollection,questionForCollection}=load('data/question-collections.ts');
const {classifyJlptQuestion}=load('lib/jlpt-exam.ts');
const read=n=>JSON.parse(fs.readFileSync(new URL(`../data/jlpt-1994${n}.json`,import.meta.url),'utf8'));
const raw=read('');
const byId=new Map(raw.map(q=>[q.id,q]));
test('1994 partial collection preserves the printed answer key and excludes unusable source tasks',()=>{
  const bank=questions.filter(q=>questionInCollection(q,'jlpt-1994-1'));
  assert.equal(bank.length,123);
  assert.deepEqual(Object.fromEntries(['vocabulary','reading','sentencePattern','listening'].map(c=>[c,bank.filter(q=>q.category===c).length])),{vocabulary:65,reading:20,sentencePattern:38,listening:0});
  const groups={
    'vocab-I-1':[3,1,4,4,2],'vocab-I-2':[4,1,3,2,1],'vocab-I-3':[3,2,4,1,3],'vocab-II':[2,1,3,2,2],
    'vocab-III-1':[4,2,3,4,3],'vocab-III-2':[1,2,3,1,4],'vocab-III-3':[4,3,1,4,2],
    'vocab-IV':[3,3,1,3,4],'vocab-V':[3,1,4,2,3,1,2,4,3,2,3,4,1,4,3],'vocab-VI':[2,4,1,3,4,1,2,1,3,2],
    'reading-I':[3,4,1,3,2,4,1,2],'reading-II':[2,1,2,4,3,1],'reading-III':[2,3,1,null,4,null,1,3],
    'grammar-IV':[1,3,2,3,4,4,2,2,3,4,1,2,4,3,1,4,1,2,1,4,3,2,3,4,1,3,2],
    'grammar-V':[3,3,1,4,2,4],'grammar-VI':[3,1,1,2,4],
  };
  for(const [group,answers] of Object.entries(groups)) answers.forEach((answer,i)=>{
    const id=`jlpt-1994-1-${group}-${i+1}`;
    if(answer===null) assert(!byId.has(id),id);
    else assert.equal(byId.get(id)?.answer,answer-1,id);
  });
  for(const incoming of raw){
    const canonical=bank.find(q=>q.occurrences.some(o=>o.sourceQuestionId===incoming.id));assert(canonical,incoming.id);
    const q=questionForCollection(canonical,'jlpt-1994-1');
    for(const key of ['options','answer','text','passage','level','originalNumber'])assert.deepEqual(q[key],incoming[key],incoming.id+'.'+key);
    assert.equal(q.shuffleOptions,false);
    assert(!/无图片|TODO/.test(q.text+' '+q.passage));
  }
  const ledger=read('-provenance');assert.equal(ledger.status,'partial');assert.equal(ledger.inferredAnswers,0);
  assert.equal(ledger.pending.reduce((n,row)=>n+(row.questionCount||1),0),29);
  assert.equal(ledger.sourceDocument.sha256,'79ba511172eac1a3de2df17eeded853cedbc7b9e9189a0ad83369506a330cd33');
});
test('1994 vocabulary links enter one bilingual shared bank and reviewed task metadata reaches JLPT practice',()=>{
  const pool=vocabularyCards.filter(c=>c.sourceCollections?.includes('jlpt-1994-1'));
  const linked=new Set(pool.flatMap(c=>c.sourceQuestionIds||[]));
  for(const q of raw)assert(linked.has(q.id),q.id);
  const ja=vocabularyCards.filter(c=>c.language==='ja');
  assert.equal(new Set(ja.map(c=>c.term.normalize('NFKC').trim())).size,ja.length);
  const find=id=>byId.get('jlpt-1994-1-'+id);
  assert.equal(classifyJlptQuestion(find('vocab-I-1-1')),'kanji-reading');
  assert.equal(classifyJlptQuestion(find('vocab-III-1-1')),'orthography');
  assert.equal(classifyJlptQuestion(find('vocab-V-1')),'context-vocabulary');
  assert.equal(classifyJlptQuestion(find('reading-III-1')),'reading-short');
  for(const part of ['II','IV','VI'])assert.equal(classifyJlptQuestion(find('vocab-'+part+'-1')),null);
  assert.equal(classifyJlptQuestion(find('reading-I-1')),null);
});
