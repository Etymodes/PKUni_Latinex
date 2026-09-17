import assert from "node:assert/strict";
import test from "node:test";
import { languageConfigs, languageOrder } from "../data/languages.ts";
import { matchesLevel, normalizePikkuLevel, pikkuLevels, questions } from "../data/questions.ts";
import { completeQuestions } from "../data/complete-bank.ts";
import { multilingualQuestions } from "../data/multilingual-questions.ts";
import { multilingualSeedQuestions } from "../data/multilingual-seeds.ts";
import { vocabularyCards, vocabularyKey, vocabularyMatchesLevel } from "../data/vocabulary.ts";

const allQuestions = [...questions, ...completeQuestions, ...multilingualQuestions, ...multilingualSeedQuestions];

test("all seven languages expose only CFGM and start at C", () => {
  assert.deepEqual(languageOrder, ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"]);
  for (const language of languageOrder) {
    assert.deepEqual(languageConfigs[language].levels, ["C", "F", "G", "M"]);
    assert.equal(languageConfigs[language].defaultLevel, "C");
  }
});

test("stored legacy levels route to CFGM without changing mixed into mastery", () => {
  const mappings = {
    la: { elementary: "C", intermediate: "F", advanced: "G", mixed: "C" },
    ja: { n4: "C", n3: "F", n2: "G", n1: "M" },
    es: { a1: "C", a2: "F", b1: "F", b2: "G", c1: "G", c2: "M" },
  };
  for (const [language, levels] of Object.entries(mappings)) {
    for (const [legacy, expected] of Object.entries(levels)) {
      assert.equal(normalizePikkuLevel(language, legacy), expected, `${language}:${legacy}`);
    }
  }
  const legacyIntermediate = questions.find((question) => question.level === "intermediate");
  assert.equal(matchesLevel(legacyIntermediate, "mixed"), true);
  assert.equal(matchesLevel(legacyIntermediate, "F"), true);
  assert.equal(matchesLevel(legacyIntermediate, "C"), false);
  const recoveredMastery = multilingualSeedQuestions.find((question) => question.id === "la-m-seed-01");
  assert.equal(recoveredMastery.level, "M");
  assert.equal(matchesLevel(recoveredMastery, "M"), true);
  assert.equal(matchesLevel(recoveredMastery, "mixed"), false);
});

test("every language and tier has its own real question and cumulative vocabulary pool", () => {
  for (const language of languageOrder) {
    for (const level of pikkuLevels) {
      const pool = allQuestions.filter((question) => (question.language ?? "la") === language && matchesLevel(question, level));
      assert.ok(pool.length > 0, `${language}:${level} needs a question`);
      assert.ok(pool.some((question) => (question.text ?? question.latin ?? question.targetText)?.length > 0));
      assert.ok(pool.every((question) => question.prompt.length > 0));
      const cards = vocabularyCards.filter((card) => card.language === language && vocabularyMatchesLevel(card, level));
      assert.ok(cards.length > 0, `${language}:${level} needs vocabulary`);
    }
  }
});

test("recovered seed IDs and target-language text remain stable", () => {
  const expectedIds = [
    "la-m-seed-01",
    "en-us-c-seed-02", "en-us-f-seed-03", "en-us-g-seed-04", "en-us-m-seed-05",
    "zh-mandarin-c-seed-06", "zh-mandarin-f-seed-07", "zh-mandarin-g-seed-08", "zh-mandarin-m-seed-09",
    "ja-c-seed-10", "ja-f-seed-11", "ja-g-seed-12", "ja-m-seed-13",
    "es-c-seed-14", "es-f-seed-15", "es-g-seed-16", "es-m-seed-17",
    "grc-c-seed-18", "grc-f-seed-19", "grc-g-seed-20", "grc-m-seed-21",
    "ru-c-seed-22", "ru-f-seed-23", "ru-g-seed-24", "ru-m-seed-25",
  ];
  assert.deepEqual(multilingualSeedQuestions.map((question) => question.id), expectedIds);
  for (const question of multilingualSeedQuestions) {
    assert.equal(question.text, question.targetText);
    assert.ok(question.targetLang.length > 0);
    assert.equal(new Set(question.options).size, 4);
    assert.equal(question.answer, 0);
    assert.equal(question.reviewStatus, undefined);
  }
  assert.equal(new Set(allQuestions.map((question) => question.id)).size, allQuestions.length);
});

test("canonical cumulative vocabulary retains original IDs and statistics keys", () => {
  const originals = vocabularyCards.filter((card) => /^(la|ja|es)-\d{3}$/.test(card.id));
  assert.equal(originals.length, 56);
  const originalJapanese = originals.find((card) => card.id === "ja-010");
  assert.deepEqual(originalJapanese, {
    id: "ja-010", language: "ja", level: "n2", term: "見極める", meaning: "看清；辨明", context: "情報の真偽を見極める。",
  });
  assert.equal(vocabularyKey(originalJapanese.language, originalJapanese.term), "ja:見極める");
  assert.equal(vocabularyMatchesLevel(originalJapanese, "F"), false);
  assert.equal(vocabularyMatchesLevel(originalJapanese, "G"), true);
  assert.equal(vocabularyMatchesLevel(originalJapanese, "M"), true);
  const keys = vocabularyCards.map((card) => vocabularyKey(card.language, card.term));
  assert.equal(new Set(keys).size, keys.length);
  for (const card of originals) {
    assert.equal(vocabularyMatchesLevel(card, "M"), true, `${card.id} remains reachable`);
  }
});
