import assert from "node:assert/strict";
import test from "node:test";
import { dictionaryEntries, vocabularyCards, vocabularyKey, vocabularyMatchesLevel } from "../data/vocabulary.ts";
import examVocabulary from "../data/jlpt-1992-vocabulary.json" with { type: "json" };
import n1Vocabulary from "../data/n1-2000-vocabulary.json" with { type: "json" };
import questions from "../data/jlpt-1992.json" with { type: "json" };

test("dictionary and training use one canonical entry and learning key for both imports", () => {
  assert.equal(dictionaryEntries, vocabularyCards);
  assert.equal(new Set(vocabularyCards.map(card => vocabularyKey(card.language, card.term))).size, vocabularyCards.length);
  assert.equal(new Set(vocabularyCards.map(card => card.id)).size, vocabularyCards.length);
  const japanese = vocabularyCards.filter(card => card.language === "ja");
  assert.equal(new Set(japanese.map(card => card.term.normalize("NFKC"))).size, japanese.length);
  for (const item of examVocabulary) {
    const cards = japanese.filter(card => card.term.normalize("NFKC") === item.lemma.normalize("NFKC"));
    assert.equal(cards.length, 1, item.lemma);
    assert.ok(item.sourceQuestionIds.every(id => cards[0].sourceQuestionIds.includes(id)));
    assert.equal(cards[0].meaning, item.gloss);
    assert.equal(cards[0].level, item.level);
  }
  for (const item of n1Vocabulary) {
    const card = japanese.find(card => card.term.normalize("NFKC") === item.lemma.normalize("NFKC"));
    assert.ok(card, item.lemma);
    assert.deepEqual(card.sourcePages, item.sourcePages);
    assert.equal(card.sourceReading, item.reading);
    assert.equal(card.sourceMeaning, item.gloss);
    assert.ok((item.spellingVariants ?? []).every(value => card.spellingVariants.includes(value)));
    assert.ok((item.readingVariants ?? []).every(value => card.readingVariants.includes(value)));
    for (const sense of item.senses ?? []) assert.ok(card.senses.some(value => JSON.stringify(value) === JSON.stringify(sense)));
    assert.ok(item.sourcePages.length && item.sourcePages.every(page => Number.isInteger(page) && page > 0));
    assert.ok(item.reading.trim() && item.gloss.trim());
  }
  const overlaps = japanese.filter(card => card.sourceQuestionIds?.length && card.sourcePages?.length);
  assert.ok(overlaps.length > 0, "The two real sources share canonical words");
  for (const card of overlaps) assert.equal(dictionaryEntries.find(item => item.id === card.id), card);
});

test("exam vocabulary links all 149 source questions without fabricated question IDs", () => {
  assert.equal(examVocabulary.length, 295);
  const ids = new Set(questions.map(question => question.id));
  const linked = new Set();
  for (const item of examVocabulary) {
    assert.ok(["C", "F", "G", "M"].includes(item.level));
    assert.ok(item.reading && item.gloss && item.partOfSpeech && item.context && item.notes);
    for (const id of item.sourceQuestionIds) { assert.ok(ids.has(id), id); linked.add(id); }
  }
  assert.deepEqual(linked, ids);
  for (const lemma of ["政府筋", "首相", "対照的", "積み荷"]) assert.ok(examVocabulary.some(item => item.lemma === lemma), lemma);
  assert.equal(examVocabulary.find(item => item.lemma === "積み荷").reading, "つみに");
});

test("every canonical dictionary card has an explicit CFGM grade and remains trainable", () => {
  const allowed = ["C", "F", "G", "M"];
  assert.equal(dictionaryEntries, vocabularyCards);
  for (const card of vocabularyCards) {
    assert.ok(allowed.includes(card.level), `${card.id}: missing or legacy vocabulary grade ${card.level}`);
    assert.ok(vocabularyMatchesLevel(card, card.level), `${card.id}: eligible at its own grade`);
    assert.ok(vocabularyMatchesLevel(card, "M"), `${card.id}: included in the complete bank`);
    const same = dictionaryEntries.find(item => item.id === card.id);
    assert.equal(same, card, `${card.id}: dictionary and trainer retain one canonical object`);
    assert.equal(vocabularyKey(same.language, same.term), vocabularyKey(card.language, card.term));
  }
  const pdfCards = vocabularyCards.filter(card => card.sourcePages?.length);
  assert.ok(pdfCards.some(card => card.level === "F"), "A source labeled N1 includes ordinary functional vocabulary.");
  assert.ok(pdfCards.some(card => card.level === "G"), "Formal and abstract source vocabulary remains individually graded.");
  assert.ok(new Set(pdfCards.map(card => card.level)).size > 1, "One source label must not become a blanket word grade.");
});
