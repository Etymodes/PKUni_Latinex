import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRandomExam, buildVocabularyMeasurement } from "../lib/study-modes.ts";
import { vocabularyCards, vocabularyLevelsFor } from "../data/vocabulary.ts";
import { languageOrder } from "../data/languages.ts";
import { localizeVocabularyCard } from "../lib/content-locale.ts";
import { normalizePikkuLevel } from "../data/questions.ts";

const deterministic = () => .35;
test("every language has a cumulative canonical measurement in Chinese and English", () => {
  for (const language of languageOrder) for (const locale of ["zh-CN", "en"]) for (const level of ["C", "F", "G", "M"]) {
    const cards = vocabularyCards.filter(card => card.language === language).map(card => localizeVocabularyCard(card, locale));
    const snapshot = JSON.stringify(cards);
    const eligible = cards.filter(card => vocabularyLevelsFor(language, level).includes(normalizePikkuLevel(language, card.level)));
    const sample = buildVocabularyMeasurement(cards, level, deterministic);
    assert.equal(sample.length, Math.min(eligible.length, 20), `${language}/${locale}/${level}`);
    assert.equal(new Set(sample.map(item => item.id)).size, sample.length);
    for (const item of sample) {
      assert(eligible.some(card => card.id === item.id && card.term === item.lemma));
      assert(item.options.includes(item.gloss));
      assert.equal(new Set(item.options).size, item.options.length);
      assert(item.options.length >= 2 && item.options.length <= 4);
      if (locale === "en") assert.doesNotMatch(item.options.join(" "), /[\u3400-\u9fff]/, `${language} English meanings`);
    }
    assert.equal(JSON.stringify(cards), snapshot, "canonical input is unchanged");
  }
});
test("measurement avoids impossible single-choice questions", () => {
  assert.deepEqual(buildVocabularyMeasurement([{id:"a",language:"la",term:"a",meaning:"same",level:"C"},{id:"b",language:"la",term:"b",meaning:"same",level:"F"}], "M"), []);
});
test("random exams honor stage, question types, caps, and stable original IDs", () => {
  const questions = Array.from({length:20}, (_,i) => ({id:`q${i}`,language:"la",level:i%2?"F":"C",type:i<15?"choice":"self-check"}));
  const snapshot = JSON.stringify(questions);
  const core = buildRandomExam(questions, "C", false, deterministic);
  assert.equal(core.length, 9); assert(core.every(item => item.level === "C"));
  const mixed = buildRandomExam(questions, "M", true, deterministic);
  assert.equal(mixed.filter(item => item.type === "choice").length, 8);
  assert.equal(mixed.filter(item => item.type === "self-check").length, 1);
  assert.equal(new Set(mixed.map(item => item.id)).size, mixed.length);
  assert.deepEqual(buildRandomExam(questions, "M", false), []);
  assert.equal(JSON.stringify(questions), snapshot);
});
test("story prototype is withdrawn and all languages share the course navigation", () => {
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /xiangshanLatinStory|StoryMode|香山碑文/);
  assert.match(page, /view === "story" && <StoryOutline/);
  assert.match(page, /\{\(\["practice", "story", "exam", "vocab-trainer", "vocabulary"\]/);
  assert.doesNotMatch(page, /language !== "la" && \(\["practice", "vocab-trainer"/);
  assert(!fs.existsSync(new URL("../data/story.ts", import.meta.url)));
});
