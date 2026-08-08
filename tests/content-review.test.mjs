import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const questionSources = await Promise.all([
  readFile(new URL("../data/questions.ts", import.meta.url), "utf8"),
  readFile(new URL("../data/multilingual-questions.ts", import.meta.url), "utf8"),
]);
const questionSource = questionSources.join("\n");
const resourceSource = await readFile(new URL("../data/resources.ts", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

const candidateIds = ["ja-n1-003", "ja-n1-004", "i-mor-04", "i-syn-08", "es-a2-002", "es-b1-003"];

function objectBlock(source, id) {
  const start = source.indexOf(`id: "${id}"`);
  assert.notEqual(start, -1, `${id} must exist`);
  const end = source.indexOf("\n  },", start);
  assert.notEqual(end, -1, `${id} must be a complete object`);
  return source.slice(start, end);
}

test("P3.2 candidate questions are unique and remain explicit drafts", () => {
  const ids = [...questionSource.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "question IDs must remain unique");

  for (const id of candidateIds) {
    const block = objectBlock(questionSource, id);
    assert.match(block, /language:\s*"(?:la|ja|es)"/);
    assert.match(block, /level:\s*"[^"]+"/);
    assert.match(block, /skill:\s*"[^"]+"/);
    assert.match(block, /distractorExplanations:/, `${id} needs mistake explanations`);
    assert.match(block, /source:/);
    assert.match(block, /reviewStatus:\s*"draft"/, `${id} must remain draft before human review`);
  }
});

test("the existing 62 weekly lexicon candidates are batched without reimport", () => {
  const firstBatch = resourceSource.match(/const weeklyLexicon: LexiconEntry\[\] = \[([\s\S]*?)\n\]\.map/)?.[1] ?? "";
  const secondBatch = resourceSource.match(/const weeklyLexicon20260802: LexiconEntry\[\] = \[([\s\S]*?)\n\]\.map/)?.[1] ?? "";
  const firstRows = [...firstBatch.matchAll(/^\s*\["(la|ja|es)",\s*"([^"]+)"/gm)].map((match) => `${match[1]}:${match[2]}`);
  const secondRows = [...secondBatch.matchAll(/^\s*\["(la|ja|es)",\s*"([^"]+)"/gm)].map((match) => `${match[1]}:${match[2]}`);

  assert.equal(firstRows.length, 48);
  assert.equal(secondRows.length, 14);
  assert.equal(firstRows.length + secondRows.length, 62);
  assert.equal(new Set([...firstRows, ...secondRows]).size, 62, "candidate entries must not be duplicated");
  assert.match(resourceSource, /batch: "2026-07-26", reviewStatus: "draft"/);
  assert.match(resourceSource, /batch: "2026-08-02", reviewStatus: "draft"/);
});

test("resource mappings publish metadata only", () => {
  const mappings = resourceSource.slice(resourceSource.indexOf("export const resourceChapterMappings"), resourceSource.indexOf("export type AuthorNode"));
  assert.equal([...mappings.matchAll(/\n\s*id:\s*"/g)].length, 5);
  for (const field of ["targetLanguage", "chapter", "grammarTargets", "vocabularyTargets", "exerciseLogic", "publicDomainStatus", "licenseNote"]) {
    assert.match(mappings, new RegExp(`${field}:`));
  }
  assert.equal([...mappings.matchAll(/targetLanguage:\s*"la"/g)].length, 4);
  assert.equal([...mappings.matchAll(/targetLanguage:\s*"ja"/g)].length, 1);
  assert.doesNotMatch(mappings, /peterpig123456|gmail\.com|password|录音文件|完整学习日志/i);
});

test("resource records declare one target language", () => {
  const catalog = resourceSource.slice(resourceSource.indexOf("export const textbookCatalog"), resourceSource.indexOf("export type ResourceChapterMapping"));
  const records = [...catalog.matchAll(/\n\s*id:\s*"/g)].length;
  const languages = [...catalog.matchAll(/targetLanguage:\s*"(?:la|ja|es)"/g)].length;

  assert.ok(records > 0);
  assert.equal(languages, records);
});

test("resource views consume only the active language datasets", () => {
  const library = pageSource.slice(pageSource.indexOf("function ResourceLibrary"), pageSource.indexOf("function CommunityPreview"));

  assert.match(library, /textbooks\.map/);
  assert.match(library, /chapterMappings\.map/);
  assert.match(library, /languageLexicon\.filter/);
  assert.doesNotMatch(library, /textbookCatalog\.map|resourceChapterMappings\.map/);
  assert.match(library, /language === "la" \? etymologyFacts\.length : currentFacts\.length/);
});
