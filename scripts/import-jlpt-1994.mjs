// Import only reviewed public data; source documents and processing files stay outside Git.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
assert(input, 'Usage: node scripts/import-jlpt-1994.mjs <reviewed-directory>');
const read = name => JSON.parse(fs.readFileSync(path.join(input, name + '.json'), 'utf8'));
const questions = read('jlpt-1994');
const provenance = read('jlpt-1994-provenance');
const grades = read('jlpt-1994-difficulty');
const words = read('jlpt-1994-vocabulary');
assert.equal(questions.length, 123);
assert.equal(new Set(questions.map(q => q.id)).size, 123);
const ids = new Set(questions.map(q => q.id));
for (const q of questions) {
  assert.equal(q.language, 'ja'); assert.equal(q.type, 'choice');
  assert.equal(q.options.length, 4); assert(q.options.every(x => typeof x === 'string' && x.trim()));
  assert.equal(q.shuffleOptions, false); assert(['C','F','G','M'].includes(q.level));
  assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
  assert.equal(q.answer, provenance.questions.find(row => row.id === q.id).answerIndex);
  assert.equal(q.level, grades.questions.find(row => row.id === q.id).level);
  assert(!q.audio && !q.images && q.category !== 'listening', 'This batch excludes unverified listening/figures');
}
assert.equal(new Set(words.map(w => w.lemma.normalize('NFKC').trim())).size, words.length);
for (const word of words) {
  assert(word.id && word.lemma && word.reading && word.gloss && word.partOfSpeech);
  assert(word.sourceQuestionIds.length && word.sourceQuestionIds.every(id => ids.has(id)));
}
function checkPublic(value) {
  if (Array.isArray(value)) value.forEach(checkPublic);
  else if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) {
    assert(!['attempts','selectedChoiceNumber','selectedIndex','isCorrect','libraryFileId','questionImage','answerImage','coverImage'].includes(key));
    checkPublic(item);
  } else if (typeof value === 'string') assert(!/[CD]:[\\/](?:Users|Etymodes|Downloads)[\\/]/.test(value));
}
for (const [name,data] of [['jlpt-1994',questions],['jlpt-1994-vocabulary',words],['jlpt-1994-difficulty',grades],['jlpt-1994-provenance',provenance]]) {
  checkPublic(data); fs.writeFileSync(path.join(root,'data',name+'.json'),JSON.stringify(data,null,2)+'\n');
}
for (const [name, additions] of [['content-en-exams',read('question-english')],['content-en-vocabulary',read('vocabulary-english')]]) {
  const filename=path.join(root,'data',name+'.json');
  const existing=JSON.parse(fs.readFileSync(filename,'utf8'));
  // Existing translations also serve older entries; preserve them on shared text keys.
  fs.writeFileSync(filename,JSON.stringify({...additions,...existing},null,2)+'\n');
}
console.log(`${questions.length} questions; ${words.length} linked vocabulary entries`);
