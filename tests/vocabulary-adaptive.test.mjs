import assert from "node:assert/strict";
import test from "node:test";

const {
  adaptiveVocabularyWeight,
  chooseNextVocabularyCard,
  vocabularyCards,
  vocabularyLevelsFor,
  vocabularyMatchesLevel,
} = await import("../data/vocabulary.ts");

test("all historic word-card identities survive dictionary unification and individual regrading", () => {
  for (const [language, count] of [["la", 16], ["ja", 16], ["es", 24]]) {
    for (let index = 1; index <= count; index++) {
      const id = `${language}-${String(index).padStart(3, "0")}`;
      const card = vocabularyCards.find(item => item.id === id);
      assert.ok(card, `Preserve existing progress identity: ${id}`);
      assert.equal(card.language, language);
      assert.ok(card.context.length > 0, `${id} retains its learning context`);
    }
  }
  assert.ok(vocabularyCards.every(card => card.term.trim() && card.meaning.trim()));
});

test("weak words outweigh new words and mastered words", () => {
  const weak = adaptiveVocabularyWeight({ seen: 3, correct: 0 });
  const unseen = adaptiveVocabularyWeight();
  const mastered = adaptiveVocabularyWeight({ seen: 3, correct: 3 });
  assert.ok(weak > unseen);
  assert.ok(unseen > mastered);
  assert.ok(adaptiveVocabularyWeight({ seen: 3, correct: 0 }, true) < weak);
});

test("the selector remains deterministic when a random value is injected", () => {
  const cards = vocabularyCards.filter((card) => card.language === "ja" && card.level === "n4");
  assert.equal(chooseNextVocabularyCard(cards, {}, [], () => 0)?.id, cards[0].id);
  assert.equal(chooseNextVocabularyCard(cards, {}, [], () => 0.999999)?.id, cards[cards.length - 1].id);
  assert.equal(chooseNextVocabularyCard([], {}, [], () => 0), null);
});

test("higher levels include every lower vocabulary level", () => {
  assert.deepEqual(vocabularyLevelsFor("la", "intermediate"), ["elementary", "intermediate"]);
  assert.deepEqual(vocabularyLevelsFor("la", "mixed"), ["elementary", "intermediate"]);
  assert.deepEqual(vocabularyLevelsFor("la", "advanced"), ["elementary", "intermediate", "advanced"]);
  assert.deepEqual(vocabularyLevelsFor("ja", "n2"), ["n4", "n3", "n2"]);
  assert.deepEqual(vocabularyLevelsFor("es", "c2"), ["a1", "a2", "b1", "b2", "c1", "c2"]);

  const japaneseN2 = vocabularyCards.filter((card) => card.language === "ja" && vocabularyMatchesLevel(card, "n2"));
  assert.deepEqual([...new Set(japaneseN2.map((card) => card.level))], ["n4", "n3", "n2"]);
});
