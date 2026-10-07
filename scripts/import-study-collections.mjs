// Imports reviewed processing outputs; never publish the original Unit01 container or personal attempts.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [unitDirectory, examDirectory] = process.argv.slice(2);
assert(unitDirectory && examDirectory, "Usage: node scripts/import-study-collections.mjs <reviewed-unit-directory> <reviewed-1993-directory>");
const read = (directory, name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const questionFields = new Set("id sourceId language level category skill type prompt latin text targetText targetLang context passage images audio transcript optionsInAudio shuffleOptions originalNumber provenance options answer modelAnswer explanation tags source sourceUrl sourceStatus reviewStatus distractorExplanations".split(" "));
const wordFields = new Set("id lemma reading gloss partOfSpeech level context sourceQuestionIds notes usageNotes dictionaryReferences spellingVariants readingVariants senses".split(" "));
const privateKeys = new Set(["attempts", "firstAttemptSummary", "selectedChoiceNumber", "selectedIndex", "isCorrect", "libraryFileId", "questionImage", "answerImage", "coverImage"]);
function checkPublic(value) {
  if (Array.isArray(value)) value.forEach(checkPublic);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    assert(!privateKeys.has(key), `Private source field: ${key}`); checkPublic(item);
  }
}
function write(name, value) {
  checkPublic(value);
  fs.writeFileSync(path.join(root, "data", name), JSON.stringify(value, null, 2) + "\n");
}
for (const input of [
  { directory: unitDirectory, input: "questions.json", wordInput: "vocabulary.json", gradeInput: "difficulty.json", provenanceInput: "provenance.json", output: "ja-hlb1000-n1-u01", count: 36 },
  { directory: examDirectory, input: "jlpt-1993.json", wordInput: "jlpt-1993-vocabulary.json", gradeInput: "jlpt-1993-difficulty.json", provenanceInput: "jlpt-1993-provenance.json", output: "jlpt-1993", count: 152 },
]) {
  const questions = read(input.directory, input.input);
  assert.equal(questions.length, input.count); assert.equal(new Set(questions.map(q => q.id)).size, input.count);
  for (const q of questions) {
    for (const key of Object.keys(q)) assert(questionFields.has(key), `Unexpected question field: ${key}`);
    assert.equal(q.language, "ja"); assert(["C", "F", "G", "M"].includes(q.level), q.id);
    assert.equal(q.type, "choice"); assert.equal(q.options.length, 4); assert(q.options.every(option => typeof option === "string" && option.trim()));
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4); assert.equal(q.shuffleOptions, false);
  }
  const words = read(input.directory, input.wordInput);
  assert.equal(new Set(words.map(word => word.lemma.normalize("NFKC").trim())).size, words.length);
  const ids = new Set(questions.map(question => question.id));
  for (const word of words) {
    for (const key of Object.keys(word)) assert(wordFields.has(key), `Unexpected word field: ${key}`);
    assert(word.id && word.lemma && word.reading && word.gloss && word.partOfSpeech, word.lemma);
    assert((word.senses ?? []).every(sense => sense.reading && sense.gloss), word.lemma);
    assert(word.sourceQuestionIds.length && word.sourceQuestionIds.every(id => ids.has(id)), word.lemma);
  }
  write(input.output + ".json", questions); write(input.output + "-vocabulary.json", words);
  write(input.output + "-difficulty.json", read(input.directory, input.gradeInput));
  write(input.output + "-provenance.json", read(input.directory, input.provenanceInput));
  console.log(`${input.output}: ${questions.length} questions, ${words.length} vocabulary entries`);
}
// Copy only resources used on question faces. Never include the example or answer sheet.
const exam = read(examDirectory, "jlpt-1993.json");
for (const q of exam) for (const src of [...(q.images ?? []).map(image => image.src), ...(q.audio ? [q.audio.src] : [])]) {
  assert(/^\/media\/jlpt-1993\/(?:audio\/[^/]+\.m4a|image(?:[2-9]|10)\.png|image1[12]\.jpeg)$/.test(src), `Unexpected public media: ${src}`);
  const source = path.join(examDirectory, "publish-media", src.replace(/^\/media\//, ""));
  const target = path.join(root, "public", src);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
}
