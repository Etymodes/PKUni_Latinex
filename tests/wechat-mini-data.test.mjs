import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { buildWechat, createSourceLoader } from "../scripts/build-wechat.mjs";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pikku-wechat-"));
const source = createSourceLoader();
let bank;
let shared;
let receipt;

function loadCommonJs(filename, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const require = (specifier) => {
    assert.equal(specifier, "./bank.js", "Generated helpers must not depend on Node, TypeScript, or npm at runtime.");
    return loadCommonJs(path.resolve(path.dirname(filename), specifier), cache);
  };
  vm.runInThisContext(`(function(module, exports, require) {\n${fs.readFileSync(filename, "utf8")}\n})`, { filename })(module, module.exports, require);
  return module.exports;
}

function hashes(directory, prefix = "") {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    const name = `${prefix}${entry.name}`;
    return entry.isDirectory() ? Object.entries(hashes(filename, `${name}/`)) : [[name, createHash("sha256").update(fs.readFileSync(filename)).digest("hex")]];
  }));
}

before(async () => {
  receipt = await buildWechat({ outputDir: temporaryDirectory });
  const cache = new Map();
  bank = loadCommonJs(path.join(temporaryDirectory, "data/bank.js"), cache);
  shared = loadCommonJs(path.join(temporaryDirectory, "data/shared.js"), cache);
});
after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

test("native bank preserves the complete website composition, metadata, IDs, and review status", () => {
  const expected = [
    ...source("data/questions.ts").questions,
    ...source("data/complete-bank.ts").completeQuestions,
    ...source("data/multilingual-questions.ts").multilingualQuestions,
    ...source("data/multilingual-seeds.ts").multilingualSeedQuestions,
  ];
  assert.deepEqual(bank.questions, JSON.parse(JSON.stringify(expected)));
  assert.equal(new Set(bank.questions.map((question) => question.id)).size, expected.length);
  assert.deepEqual(bank.vocabularyCards, source("data/vocabulary.ts").vocabularyCards);
  assert.deepEqual(bank.languageConfigs, source("data/languages.ts").languageConfigs);
  assert.deepEqual(bank.learningLanguages, source("app/i18n.ts").learningLanguages);
  assert.deepEqual(bank.textbookCatalog, source("data/resources.ts").textbookCatalog);
  assert.deepEqual(bank.dictionarySources, source("data/resources.ts").dictionarySources);
  assert.deepEqual(bank.languageOrder, ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"]);
  for (const language of bank.languageOrder) {
    assert.deepEqual(bank.languageConfigs[language].levels, ["C", "F", "G", "M"]);
    for (const level of ["C", "F", "G", "M"]) {
      assert.ok(bank.questions.some((question) => (question.language ?? "la") === language && shared.matchesLevel(question, level)), `${language}/${level} needs its existing seed`);
    }
  }
});

test("legacy levels and question matching stay identical to the website", () => {
  const original = source("data/questions.ts");
  const levels = ["C", "F", "G", "M", "elementary", "intermediate", "advanced", "mixed", "n4", "n3", "n2", "n1", "a1", "a2", "b1", "b2", "c1", "c2", "unknown"];
  for (const language of bank.languageOrder) {
    for (const level of levels) assert.equal(shared.normalizePikkuLevel(language, level), original.normalizePikkuLevel(language, level));
  }
  assert.equal(shared.normalizePikkuLevel("la", "mixed"), "C");
  for (const question of bank.questions) {
    for (const level of levels) assert.equal(shared.matchesLevel(question, level), original.matchesLevel(question, level));
  }
});

test("word statistics keys, cumulative pools, and adaptive selection match existing algorithms", () => {
  const original = source("data/vocabulary.ts");
  const levels = ["C", "F", "G", "M", "elementary", "intermediate", "advanced", "mixed", "n4", "n3", "n2", "n1", "a1", "a2", "b1", "b2", "c1", "c2"];
  const stats = {};
  bank.vocabularyCards.forEach((card, index) => {
    const key = shared.vocabularyKey(card.language, card.term);
    assert.equal(key, original.vocabularyKey(card.language, card.term));
    assert.equal(key, `${card.language}:${card.term}`);
    stats[key] = { seen: index % 5, correct: index % 3 };
    for (const level of levels) assert.equal(shared.vocabularyMatchesLevel(card, level), original.vocabularyMatchesLevel(card, level));
  });
  for (const language of bank.languageOrder) {
    for (const level of levels) assert.deepEqual(shared.vocabularyLevelsFor(language, level), original.vocabularyLevelsFor(language, level));
    const cards = bank.vocabularyCards.filter((card) => card.language === language);
    assert.ok(cards.length);
    const recent = cards.slice(0, 2).map((card) => card.id);
    for (const random of [-1, 0, 0.1, 0.5, 0.999999, 1, 2]) {
      assert.equal(shared.chooseNextVocabularyCard(cards, stats, recent, () => random)?.id, original.chooseNextVocabularyCard(cards, stats, recent, () => random)?.id);
    }
  }
  assert.equal(shared.chooseNextVocabularyCard([], {}, [], () => 0), null);
});

test("display locale keeps the website learning-language exclusions and fallback", () => {
  const original = source("app/i18n.ts");
  for (const locale of ["zh-CN", "en"]) {
    const available = shared.availableLearningLanguages(locale);
    assert.deepEqual(available, original.availableLearningLanguages(locale));
    assert.equal(available.length, 6);
    assert.equal(available.some((language) => language.id === (locale === "en" ? "en-us" : "zh-mandarin")), false);
    for (const id of [...bank.languageOrder, "unknown"]) assert.equal(shared.normalizeLearningLanguage(locale, id), original.normalizeLearningLanguage(locale, id));
  }
});

test("question overrides preserve ordering, deletions, replacements, and draft visibility", () => {
  const base = [{ id: "first", reviewStatus: "draft" }, { id: "second", reviewStatus: "published" }, { id: "third" }];
  const replacement = { id: "second", reviewStatus: "archived", prompt: "Updated" };
  const added = { id: "fourth", reviewStatus: "draft" };
  const before = structuredClone(base);
  assert.deepEqual(shared.mergeQuestionOverrides(base), base);
  assert.deepEqual(shared.mergeQuestionOverrides(base, [
    { id: "first", deleted: true }, { id: "second", question: replacement }, { id: "fourth", question: added }, { id: "ignored" },
  ]), [replacement, base[2], added]);
  assert.deepEqual(base, before);
});

test("option shuffle is copied from the website and does not mutate the bank", () => {
  const options = ["A", "B", "C", "D"];
  for (const value of [0, 0.2, 0.8, 0.999999]) assert.deepEqual(shared.shuffle(options, () => value), source("lib/shuffle.ts").shuffle(options, () => value));
  assert.deepEqual(options, ["A", "B", "C", "D"]);
});

test("generated JavaScript and original-image PNGs rebuild deterministically below the main-package limit", async () => {
  const firstHashes = hashes(temporaryDirectory);
  const second = await buildWechat({ outputDir: temporaryDirectory });
  assert.deepEqual(hashes(temporaryDirectory), firstHashes);
  assert.deepEqual(second, receipt);
  assert.ok(receipt.packageBytes < 2 * 1024 * 1024);
  assert.equal(fs.readFileSync(path.join(temporaryDirectory, "assets/logo.png")).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  for (const level of ["c", "f", "g", "m"]) {
    const png = fs.readFileSync(path.join(temporaryDirectory, `assets/level-${level}.png`));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 192);
    assert.equal(png.readUInt32BE(20), 192);
  }
});
