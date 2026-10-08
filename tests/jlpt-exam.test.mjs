import assert from "node:assert/strict";
import test from "node:test";
import { buildJlptExam, classifyJlptQuestion, jlptExamProfiles } from "../lib/jlpt-exam.ts";
import { normalizePikkuLevel } from "../data/questions.ts";
import { loadProjectData } from "../scripts/build-wechat.mjs";

const bank = loadProjectData().questions;
const Japanese = bank.filter(question => question.language === "ja");
const ids = questions => questions.map(question => question.id);
function fixture(id, type = "kanji-reading", level = "G", changes = {}) {
  const category = type.startsWith("listening-") ? "listening" : type.startsWith("reading-") || type === "information-retrieval" ? "reading" : ["grammar-selection", "sentence-composition", "text-grammar"].includes(type) ? "sentencePattern" : "vocabulary";
  return { id, language: "ja", level, category, type: "choice", skill: `jlpt:${type}`, prompt: "正しい答えを選んでください。", text: "これはテスト用の問題です。", options: ["いち", "に", "さん", "よん"], answer: 1, explanation: "テスト専用の説明。", tags: [], source: "isolated test fixture",
    ...(category === "reading" ? { passage: `共通の文章：${id}` } : {}), ...(category === "listening" ? { audio: { src: `/test/${id}.m4a` } } : {}), ...changes };
}
const quota = (plan, typeId) => plan.coverage.find(item => item.typeId === typeId);

test("templates retain official section times and approximate item quotas without changing CFGM compatibility", () => {
  assert.deepEqual(jlptExamProfiles.map(profile => [profile.id, profile.level]), [["n3", "C"], ["n2", "F"], ["n1", "G"]]);
  const expected = { n3: { minutes: [30, 70, 40], counts: [35, 39, 28], total: 102 }, n2: { minutes: [105, 50], counts: [75, 32], total: 107 }, n1: { minutes: [110, 55], counts: [71, 30], total: 101 } };
  for (const profile of jlptExamProfiles) {
    const plan = buildJlptExam([], profile.id, () => 0), value = expected[profile.id];
    assert.deepEqual(profile.sections.map(section => section.minutes), value.minutes);
    assert.deepEqual(profile.sections.map(section => section.types.reduce((n, type) => n + type.count, 0)), value.counts);
    assert.equal(plan.totalRequired, value.total);
    assert.equal(plan.totalSelected, 0); assert.equal(plan.complete, false);
    assert.equal(plan.sections.length, profile.sections.length, "Empty sections must remain visible in coverage.");
    assert(plan.sections.every(section => section.questions.length === 0));
    assert.equal(profile.countBasis, "approximate");
    assert(profile.notes.zh && profile.notes.en);
    assert(profile.sources.every(source => source.label && source.url.startsWith("https://www.jlpt.jp/")));
  }
  const n1 = buildJlptExam([], "n1");
  assert.deepEqual(n1.coverage.filter(row => row.sectionId === "listening").map(row => row.required), [5, 6, 5, 11, 3]);
  assert.equal(normalizePikkuLevel("ja", "n4"), "C");
  assert.equal(normalizePikkuLevel("ja", "n3"), "F", "Template N3/C is not a replacement for the saved-content compatibility map.");
  assert.equal(normalizePikkuLevel("ja", "n2"), "G");
  assert.equal(normalizePikkuLevel("ja", "n1"), "M");
});

test("a sufficiently populated exact-level bank meets every quota without duplicate IDs or mutations", () => {
  for (const profile of jlptExamProfiles) {
    const candidates = profile.sections.flatMap(section => section.types.flatMap(type => Array.from({ length: type.count + 2 }, (_, i) => fixture(`${profile.id}-${type.id}-${i}`, type.id, profile.level))));
    const before = JSON.stringify(candidates);
    const plan = buildJlptExam(candidates, profile.id, () => 0.37);
    assert.equal(plan.complete, true); assert.deepEqual(plan.missing, []);
    assert.equal(plan.totalSelected, plan.totalRequired);
    assert.equal(new Set(ids(plan.questions)).size, plan.totalSelected);
    assert.deepEqual(plan.sections.flatMap(section => ids(section.questions)), ids(plan.questions));
    for (const item of plan.coverage) {
      assert.equal(item.available, item.required + 2); assert.equal(item.selected, item.required); assert.equal(item.missing, 0);
      const matching = plan.questions.filter(question => plan.questionTypes[question.id].typeId === item.typeId);
      assert.equal(matching.length, item.required);
      assert(matching.every(question => plan.questionTypes[question.id].sectionId === item.sectionId));
    }
    assert(plan.questions.every(question => candidates.includes(question)), "Plans retain the canonical object and option/answer identity.");
    assert.equal(JSON.stringify(candidates), before);
  }
});

test("shortfalls remain visible; other levels, other languages and unknown level labels cannot fill them", () => {
  const candidates = [fixture("accepted-c", "grammar-selection", "C"), fixture("draft-c", "grammar-selection", "C", { reviewStatus: "draft" }),
    fixture("legacy-n4", "grammar-selection", "n4"), fixture("legacy-n3", "grammar-selection", "n3"), fixture("f", "grammar-selection", "F"),
    fixture("g", "grammar-selection", "G"), fixture("m", "grammar-selection", "M"), fixture("unknown", "grammar-selection", "future-level"),
    fixture("foreign", "grammar-selection", "C", { language: "la" }), fixture("archived", "grammar-selection", "C", { reviewStatus: "archived" })];
  const n3 = buildJlptExam(candidates, "n3", () => 0);
  assert.deepEqual(new Set(ids(n3.questions)), new Set(["accepted-c", "draft-c", "legacy-n4"]));
  assert.equal(quota(n3, "grammar-selection").missing, 10);
  assert.equal(n3.complete, false);
  assert.equal(n3.excluded.invalid, 2);
  const n2 = buildJlptExam(candidates, "n2", () => 0);
  assert.deepEqual(new Set(ids(n2.questions)), new Set(["legacy-n3", "f"]));
  assert(n2.missing.every(item => item.required > item.selected));
});

test("incomplete choices and required media are rejected while complete audio-only and context-reading tasks work", () => {
  const validAudio = fixture("audio-only", "listening-response", "G", { text: undefined, options: ["はい", "いいえ", "わかりません"], optionsInAudio: true });
  const validReading = fixture("context-reading", "reading-short", "G", { passage: undefined, context: "文章を読んでください。この文章が問題の文脈です。" });
  const invalid = [fixture("no-audio", "listening-response", "G", { audio: undefined }), fixture("empty-audio", "listening-response", "G", { audio: { src: " " } }),
    fixture("no-passage", "reading-short", "G", { passage: undefined, context: "" }), fixture("no-options", "kanji-reading", "G", { options: undefined }),
    fixture("empty-option", "kanji-reading", "G", { options: ["あ", "い", " ", "え"] }), fixture("duplicated-options", "kanji-reading", "G", { options: ["あ", "い", "あ", "え"] }),
    fixture("bad-answer", "kanji-reading", "G", { answer: 4 }), fixture("fractional-answer", "kanji-reading", "G", { answer: 1.5 }),
    fixture("no-explanation", "kanji-reading", "G", { explanation: "" }), fixture("self-check", "kanji-reading", "G", { type: "self-check" })];
  const plan = buildJlptExam([validAudio, validReading, ...invalid], "n1", () => 0);
  assert.deepEqual(new Set(ids(plan.questions)), new Set(["audio-only", "context-reading"]));
  assert.equal(plan.excluded.invalid, invalid.length);
  assert.equal(plan.questions.find(question => question.id === validAudio.id).optionsInAudio, true);
  assert.equal(plan.questions.find(question => question.id === validAudio.id).audio, validAudio.audio);
});

test("old formats are classified from inspected task evidence, not source levels, passage length or an audio attachment", () => {
  const find = id => { const value = Japanese.find(question => question.id === id); assert(value, id); return value; };
  assert.equal(classifyJlptQuestion(find("jlpt-1992-1-vocab-I-1-1")), "kanji-reading");
  assert.equal(classifyJlptQuestion(find("jlpt-1993-1-vocab-III-1-1")), "orthography");
  assert.equal(classifyJlptQuestion(find("jlpt-1992-1-vocab-V-0-1")), "context-vocabulary");
  assert.equal(classifyJlptQuestion(find("ja-hlb1000-n1-u01-004")), "context-vocabulary", "The adverb cloze selects a word from sentence context, not a usage-example sentence.");
  for (const type of ["II", "IV", "VI"]) assert.equal(classifyJlptQuestion(find(`jlpt-1992-1-vocab-${type}-0-1`)), null);
  assert.equal(classifyJlptQuestion(find("jlpt-1993-1-reading_grammar-I-0-1")), null, "A single-passage question is not integrated just because a second text is displayed.");
  assert.equal(classifyJlptQuestion(find("jlpt-1993-1-reading_grammar-I-0-6")), "reading-integrated");
  assert.equal(classifyJlptQuestion(find("jlpt-1993-1-reading_grammar-III-5-1")), "reading-integrated");
  assert.equal(classifyJlptQuestion(find("jlpt-1992-1-reading_grammar-III-1-1")), "reading-short");
  assert.equal(classifyJlptQuestion(find("jlpt-1992-1-reading_grammar-III-2-1")), null, "A statistical graph is not automatically modern information retrieval.");
  const listening = Japanese.filter(question => question.category === "listening");
  assert.equal(listening.length, 301);
  assert(listening.every(question => question.audio && classifyJlptQuestion(question) === null));
  assert.equal(classifyJlptQuestion(fixture("wrong-category", "reading-short", "G", { category: "vocabulary" })), null);
  assert.equal(classifyJlptQuestion(fixture("unknown-type", "invented-task")), null);
});

test("related passage questions stay adjacent and in source order under random group selection and quota truncation", () => {
  const candidates = ["A", "B"].flatMap(group => Array.from({ length: 5 }, (_, i) => fixture(`${group}-${i + 1}`, "reading-medium", "G", {
    passage: `${group}：完全な共通文章。`, originalNumber: `問${i + 1}`, occurrences: [{ collectionId: `fixture-${group}`, sourceQuestionId: `${group}-source-${i + 1}`, label: "fixture", originalNumber: `問${i + 1}`, order: i }],
  }))).reverse();
  const before = JSON.stringify(candidates);
  for (const random of [() => 0, () => 0.9]) {
    const plan = buildJlptExam(candidates, "n1", random), selected = plan.questions;
    assert.equal(selected.length, 9); assert.equal(quota(plan, "reading-medium").available, 10);
    const positions = new Map();
    selected.forEach((question, i) => { if (!positions.has(question.passage)) positions.set(question.passage, []); positions.get(question.passage).push(i); });
    for (const [passage, indices] of positions) {
      assert.equal(indices.at(-1) - indices[0] + 1, indices.length, "Do not interleave a related passage's questions.");
      const items = selected.filter(question => question.passage === passage);
      assert.deepEqual(items.map(question => question.occurrences[0].order), Array.from({ length: items.length }, (_, i) => i));
      assert(items.every(question => candidates.includes(question)));
    }
  }
  assert.equal(JSON.stringify(candidates), before, "Grouping never truncates the passage or edits source metadata.");
});

test("source occurrences allow reliable task matching without replacing canonical IDs or option order", () => {
  const source = Japanese.find(question => question.id === "jlpt-1992-1-vocab-I-1-1"); assert(source);
  const question = { ...source, id: "canonical-merged", level: "G", occurrences: [{ collectionId: "jlpt-1992-1", sourceQuestionId: source.id, label: "old source", originalNumber: source.originalNumber, order: 1, options: [...source.options].reverse(), answer: 2 }] };
  const plan = buildJlptExam([question, { ...question }], "n1", () => 0);
  assert.deepEqual(ids(plan.questions), ["canonical-merged"]);
  assert.equal(plan.excluded.duplicate, 1);
  assert.equal(plan.questions[0], question);
  assert.equal(plan.questions[0].options, question.options); assert.equal(plan.questions[0].answer, question.answer);
  assert.equal(plan.questionTypes[question.id].typeId, "kanji-reading");
  assert.equal(plan.questionTypes[source.id], undefined);
});

test("real-bank previews disclose the current gaps and keep original CFGM, media and draft annotations intact", () => {
  const before = JSON.stringify(Japanese);
  const expected = { n3: [2, 102], n2: [35, 107], n1: [30, 101] };
  for (const profile of jlptExamProfiles) {
    const plan = buildJlptExam(bank, profile.id, () => 0), repeated = buildJlptExam(bank, profile.id, () => 0);
    assert.deepEqual([plan.totalSelected, plan.totalRequired], expected[profile.id]);
    assert.deepEqual(ids(plan.questions), ids(repeated.questions), "Preview sampling is reproducible.");
    assert.equal(plan.complete, false);
    assert.equal(plan.sections.find(section => section.id === "listening").questions.length, 0);
    assert(plan.questions.every(question => normalizePikkuLevel("ja", question.level) === profile.level));
    assert(plan.questions.every(question => Japanese.includes(question)));
    assert.equal(new Set(ids(plan.questions)).size, plan.questions.length);
    assert.equal(plan.missing.reduce((sum, item) => sum + item.missing, 0), plan.totalRequired - plan.totalSelected);
  }
  assert.deepEqual(buildJlptExam(bank, "n3", () => 0).questions.map(q => q.id), ["jlpt-2001-1-vocab-III-33", "ja-n4-001"]);
  assert.equal(JSON.stringify(Japanese), before);
  assert.throws(() => buildJlptExam(bank, "n9"), /Unknown JLPT structure/);
});
