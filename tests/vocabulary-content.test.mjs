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
    assert.deepEqual(cards[0].sourceQuestionIds, item.sourceQuestionIds);
    assert.equal(cards[0].meaning, item.gloss);
    assert.equal(cards[0].level, item.level);
  }
  for (const item of n1Vocabulary) {
    const card = japanese.find(card => card.term.normalize("NFKC") === item.lemma.normalize("NFKC"));
    assert.ok(card, item.lemma);
    assert.deepEqual(card.sourcePages, item.sourcePages);
    assert.equal(card.sourceReading, item.reading);
    assert.equal(card.sourceMeaning, item.gloss);
    assert.deepEqual(card.spellingVariants, item.spellingVariants);
    assert.deepEqual(card.readingVariants, item.readingVariants);
    assert.deepEqual(card.senses, item.senses);
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

test("the N1 source label is not an automatic CFGM grade and ungraded entries remain explicit", () => {
  const ungraded = vocabularyCards.filter(card => card.sourcePages?.length && !card.level);
  assert.ok(ungraded.length > 0);
  for (const card of ungraded) for (const level of ["C", "F", "G", "M"]) assert.equal(vocabularyMatchesLevel(card, level), false);
  assert.ok(vocabularyCards.some(card => card.sourceQuestionIds?.length && card.level === "F"));
});
