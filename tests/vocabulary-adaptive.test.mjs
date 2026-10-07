import assert from "node:assert/strict";
import test from "node:test";

const {
  adaptiveVocabularyWeight,
  chooseNextVocabularyCard,
  vocabularyCards,
  vocabularyKey,
  vocabularyLevelsFor,
  vocabularyMatchesLevel,
} = await import("../data/vocabulary.ts");

const cumulativeStages = { C: ["C"], F: ["C", "F"], G: ["C", "F", "G"], M: ["C", "F", "G", "M"] };

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
  for (const [id, key] of [["la-001", "la:castra, -ōrum n. pl."], ["ja-001", "ja:学生"], ["es-001", "es:casa"]]) {
    const card = vocabularyCards.find(item => item.id === id);
    assert.equal(vocabularyKey(card.language, card.term), key, "Regrading must retain saved statistics keys.");
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

test("the selector remains deterministic within the real cumulative pool", () => {
  const cards = vocabularyCards.filter(card => card.language === "ja" && vocabularyMatchesLevel(card, "F"));
  assert.ok(cards.length > 1, "The test must select from real C/F cards rather than an empty legacy-label pool.");
  assert.ok(cards.every(card => ["C", "F"].includes(card.level)));
  assert.equal(chooseNextVocabularyCard(cards, {}, [], () => 0), cards[0]);
  assert.equal(chooseNextVocabularyCard(cards, {}, [], () => 0.999999), cards[cards.length - 1]);
  assert.equal(chooseNextVocabularyCard([], {}, [], () => 0), null);
});

test("each CFGM boundary includes precisely the current and lower stages in every language", () => {
  for (const language of new Set(vocabularyCards.map(card => card.language))) {
    const cards = vocabularyCards.filter(card => card.language === language);
    for (const [stage, allowed] of Object.entries(cumulativeStages)) {
      assert.deepEqual(vocabularyLevelsFor(language, stage), allowed, `${language}/${stage}`);
      const actual = cards.filter(card => vocabularyMatchesLevel(card, stage));
      const expected = cards.filter(card => allowed.includes(card.level));
      assert.deepEqual(actual.map(card => card.id), expected.map(card => card.id), `${language}/${stage}: no upper-stage leakage or missing lower stages`);
      for (const candidateStage of ["C", "F", "G", "M"]) {
        assert.equal(vocabularyMatchesLevel({ id: "boundary", language, level: candidateStage, term: "boundary", meaning: "", context: "" }, stage),
          allowed.includes(candidateStage), `${language}: ${candidateStage} card at ${stage} boundary`);
      }
    }
    assert.equal(cards.filter(card => vocabularyMatchesLevel(card, "M")).length, cards.length, `${language}: M covers the complete graded bank`);
  }
});

test("legacy saved level preferences route to CFGM prefixes without determining a word's grade", () => {
  for (const [language, legacy, expected] of [
    ["la", "elementary", "C"], ["la", "intermediate", "F"], ["la", "mixed", "F"], ["la", "advanced", "G"],
    ["ja", "n4", "C"], ["ja", "n3", "F"], ["ja", "n2", "G"], ["ja", "n1", "M"],
    ["es", "a1", "C"], ["es", "a2", "F"], ["es", "b1", "F"], ["es", "b2", "G"], ["es", "c1", "G"], ["es", "c2", "M"],
  ]) {
    assert.deepEqual(vocabularyLevelsFor(language, legacy), cumulativeStages[expected]);
    const cards = vocabularyCards.filter(card => card.language === language);
    assert.deepEqual(cards.filter(card => vocabularyMatchesLevel(card, legacy)).map(card => card.id),
      cards.filter(card => vocabularyMatchesLevel(card, expected)).map(card => card.id), `${language}/${legacy}`);
  }
});

test("source batches cannot widen the stage pool or create new learning keys", () => {
  const metadataVariants = [
    { batch: "1992 · 旧1級", sourceCollections: ["jlpt-1992-1"], sourceQuestionIds: ["jlpt-1992-1-example"] },
    { batch: "N1必背2000词", sourcePages: [1], sourceCollections: ["n1-2000"] },
    { batch: "Unit 1", sourceCollections: ["ja-hlb1000-n1-u01"] },
    { batch: undefined, sourcePages: undefined, sourceCollections: undefined, sourceQuestionIds: undefined },
  ];
  for (const grade of ["C", "F", "G", "M"]) {
    const original = { id: `stable-${grade}`, language: "ja", level: grade, term: `同一词头-${grade}`, meaning: "same", context: "" };
    const key = vocabularyKey(original.language, original.term), stats = { [key]: { seen: 12, correct: 7 } };
    for (const metadata of metadataVariants) {
      const card = { ...original, ...metadata };
      assert.equal(card.id, original.id);
      assert.equal(stats[vocabularyKey(card.language, card.term)], stats[key]);
      for (const [stage, allowed] of Object.entries(cumulativeStages)) {
        assert.equal(vocabularyMatchesLevel(card, stage), allowed.includes(grade), `${grade}/${stage}: ${metadata.batch ?? "no source"}`);
      }
    }
  }
});
