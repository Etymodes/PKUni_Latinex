import assert from "node:assert/strict";
import test from "node:test";
import { languageConfigs } from "../data/languages.ts";
import { categoryLabels } from "../data/questions.ts";
import { getCopy } from "../app/i18n.ts";
import { __test } from "../worker/index.js";

test("Japanese reading and listening categories do not alter other languages", () => {
  const previous = ["morphology", "syntax", "sentencePattern", "vocabulary", "classics", "translation"];
  for (const [language, config] of Object.entries(languageConfigs)) {
    assert.deepEqual(config.categories, language === "ja" ? [...previous, "reading", "listening"] : previous);
  }
});

test("question validation accepts Japanese comprehension and preserves every existing category", () => {
  const question = { id: "category-check", level: "M", type: "choice", prompt: "Choose.", explanation: "Example." };
  for (const language of Object.keys(languageConfigs)) {
    for (const category of Object.keys(categoryLabels)) {
      assert.equal(__test.validQuestion({ ...question, language, category }), language === "ja" || !["reading", "listening"].includes(category), `${language}:${category}`);
    }
  }
  assert.equal(__test.validQuestion({ ...question, category: "translation" }), true);
  assert.equal(__test.validQuestion({ ...question, category: "reading" }), false);
});

test("comprehension labels identify reading and listening in both display languages", () => {
  assert.deepEqual([getCopy("zh-CN").categoryReading, getCopy("zh-CN").categoryListening], ["阅读理解", "听力理解"]);
  assert.deepEqual([getCopy("en").categoryReading, getCopy("en").categoryListening], ["Reading comprehension", "Listening comprehension"]);
});
