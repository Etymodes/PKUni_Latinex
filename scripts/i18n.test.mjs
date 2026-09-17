import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availableLearningLanguages,
  getCopy,
  getLearningLanguage,
  learningLanguages,
  normalizeLearningLanguage,
} from "../app/i18n.ts";
import { multilingualSeedQuestions } from "../data/multilingual-seeds.ts";
import { matchesLevel, questions } from "../data/questions.ts";

test("the display language excludes itself and offers its counterpart first", () => {
  const chineseUi = availableLearningLanguages("zh-CN").map((language) => language.id);
  const englishUi = availableLearningLanguages("en").map((language) => language.id);

  assert.equal(chineseUi[0], "en-us");
  assert.equal(englishUi[0], "zh-mandarin");
  assert.equal(chineseUi.includes("zh-mandarin"), false);
  assert.equal(englishUi.includes("en-us"), false);
});

test("core and switch-test languages remain available in both interfaces", () => {
  const required = ["la", "ja", "es", "grc", "ru"];
  for (const locale of ["zh-CN", "en"]) {
    const available = availableLearningLanguages(locale).map((language) => language.id);
    required.forEach((id) => assert.equal(available.includes(id), true));
  }
});

test("Russian and Ancient Greek expose localized labels and wordmark palettes", () => {
  const russian = getLearningLanguage("ru");
  const ancientGreek = getLearningLanguage("grc");

  assert.deepEqual([russian.labels["zh-CN"], russian.labels.en, russian.nativeName, russian.palette], ["俄语", "Russian", "русский", "ru"]);
  assert.deepEqual([ancientGreek.labels["zh-CN"], ancientGreek.labels.en, ancientGreek.nativeName, ancientGreek.palette], ["古希腊语", "Ancient Greek", "Ἑλληνική", "gr"]);
  assert.equal(russian.microLabels.practice, "Практика");
  assert.equal(ancientGreek.microLabels.knowledge, "Περὶ τῆς γλώττης");
});

test("changing the display language repairs an invalid learning-language choice", () => {
  assert.equal(normalizeLearningLanguage("zh-CN", "zh-mandarin"), "en-us");
  assert.equal(normalizeLearningLanguage("en", "en-us"), "zh-mandarin");
  assert.equal(normalizeLearningLanguage("en", "la"), "la");
});

test("language identifiers and English interface labels are complete", () => {
  assert.equal(new Set(learningLanguages.map((language) => language.id)).size, learningLanguages.length);
  const english = getCopy("en");
  [english.todayOverview, english.orderedPractice, english.randomExam, english.vocabularyMeasure, english.scope]
    .forEach((label) => assert.equal(/[一-龥]/u.test(label), false));
});

test("English Pikku level names match the C F G M codes", () => {
  const english = getCopy("en");
  assert.deepEqual(
    [english.elementary, english.intermediate, english.advanced, english.mixed],
    ["Core", "Functional", "Generative", "Mastery"],
  );
});

test("every language supplies the complete target-language heading set", () => {
  const expected = ["overview", "story", "knowledge", "courses", "grammar", "reading", "practice", "vocabulary", "review", "exam", "progress", "scope", "archive", "admin"];
  for (const language of learningLanguages) {
    assert.deepEqual(Object.keys(language.microLabels).sort(), [...expected].sort());
    expected.forEach((key) => assert.ok(language.microLabels[key].trim()));
  }
});

test("every target language has C F G M learning content without Latin fallback", () => {
  const bank = [...questions, ...multilingualSeedQuestions];
  const levels = ["C", "F", "G", "M"];
  for (const language of learningLanguages) {
    const languageBank = bank.filter((question) => (question.language || "la") === language.id);
    levels.forEach((level) => assert.ok(languageBank.some((question) => matchesLevel(question, level)), `${language.id} is missing ${level}`));
  }
  assert.equal(matchesLevel({ ...multilingualSeedQuestions[0], level: "C" }, "M"), false);
});

test("the language picker has no flag element or visible plus separator", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.equal(page.includes("LanguageFlag"), false);
  assert.equal(css.includes(".language-flag"), false);
  assert.equal(/aria-hidden=["']true["']>\+</u.test(page), false);
  assert.ok(page.includes("LanguageWordmark"));
});
