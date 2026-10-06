import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import questions from "../data/jlpt-1992.json" with { type: "json" };
import audit from "../data/jlpt-1992-provenance.json" with { type: "json" };
import difficulty from "../data/jlpt-1992-difficulty.json" with { type: "json" };

test("the complete 1992 old-Level-1 paper contains 149 distinct questions in the original sections", () => {
  assert.equal(questions.length, 149);
  assert.equal(new Set(questions.map(q => q.id)).size, 149);
  assert.deepEqual(Object.fromEntries(["vocabulary", "listening", "reading", "sentencePattern"].map(c => [c, questions.filter(q => q.category === c).length])), { vocabulary: 65, listening: 30, reading: 23, sentencePattern: 31 });
  for (const q of questions) {
    assert.equal(q.language, "ja"); assert(["C", "F", "G", "M"].includes(q.level));
    assert.equal(q.provenance.level, "旧1級");
    assert.equal(q.options.length, 4, q.id);
    assert(q.options.every(o => o.trim().length), q.id);
    assert.equal(q.shuffleOptions, false, q.id);
    assert(q.provenance.sourceFiles[0].pages.length, q.id);
  }
});

test("every imported item uses its assessed CFGM level and explains the decision without changing its exam label", () => {
  assert.equal(difficulty.questions.length, 149);
  const assessments = new Map(difficulty.questions.map(q => [q.id, q]));
  assert.equal(assessments.size, 149);
  assert.equal(audit.difficultyRubric, difficulty.rubric.id);
  for (const q of questions) {
    const grade = assessments.get(q.id);
    assert(grade, q.id);
    assert.equal(q.level, grade.level, q.id);
    assert(grade.knowledgePoints.length > 0 && grade.knowledgePoints.every(p => typeof p === "string" && p.trim()), q.id);
    assert(grade.rationale.trim().length > 10, q.id);
    assert(q.explanation.includes(`CFGM 内容分级：${grade.level}。${grade.rationale}`), q.id);
    assert.equal(q.provenance.level, "旧1級");
  }
  assert.deepEqual(audit.difficultyCounts, Object.fromEntries(["C", "F", "G", "M"].map(level => [level, questions.filter(q => q.level === level).length])));
  assert(new Set(questions.map(q => q.level)).size > 1, "The source exam level must not replace item assessment");
});

test("CFGM examples distinguish everyday comprehension from abstract argument and formal language", () => {
  const examples = {
    "jlpt-1992-1-vocab-I-1-2": "F", // 首相: reading a familiar word, not political argument.
    "jlpt-1992-1-vocab-III-4-2": "G", // 対照 / 対称 / 対象 / 対症.
    "jlpt-1992-1-listening-II-0-7": "F", // Negotiating schedules.
    "jlpt-1992-1-listening-III-0-4": "G", // Agency across complex business honorifics.
    "jlpt-1992-1-reading_grammar-I-0-4": "F", // Local reference in the same long passage.
    "jlpt-1992-1-reading_grammar-I-0-8": "G", // Abstract comparison in that passage.
    "jlpt-1992-1-reading_grammar-IV-0-1": "F", // Embedded question.
    "jlpt-1992-1-reading_grammar-IV-0-31": "G", // Result state and formal honorific expression.
  };
  for (const [id, level] of Object.entries(examples)) assert.equal(questions.find(q => q.id === id)?.level, level, id);
});

test("148 printed answers match the source ledger and the one missing answer is visibly identified", () => {
  assert.equal(audit.questions.filter(q => q.answerSource === "printed-answer-key").length, 148);
  for (const q of questions) {
    const source = audit.questions.find(s => s.id === q.id);
    assert.equal(q.answer + 1, source.answer, q.id);
    assert(q.answer >= 0 && q.answer < 4, q.id);
  }
  const inferred = questions.filter(q => q.reviewStatus === "draft");
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "jlpt-1992-1-reading_grammar-II-0-7");
  assert.equal(inferred[0].answer, 0);
  assert.match(inferred[0].explanation, /漏印.*推断/s);
  assert.match(inferred[0].context, /漏印/);
});

test("reading context and underlined target words survive extraction", () => {
  for (const q of questions.filter(q => q.category === "reading")) assert(q.passage.length > 80, q.id);
  const marked = questions.filter(q => q.id.startsWith("jlpt-1992-1-vocab-II-"));
  ["維持", "証人", "該当", "有効", "携帯"].forEach((word, i) => assert(marked[i].text.includes(`【${word}】`)));
});

test("question images exist, and neither the example nor the answer sheet is shown as a question", async () => {
  const images = new Set(questions.flatMap(q => q.images ?? []).map(i => i.src));
  assert.equal(images.size, 11);
  for (const src of images) {
    assert.doesNotMatch(src, /\/image(?:1|13)\./);
    assert((await stat(new URL(`../public${src}`, import.meta.url))).size > 1000);
  }
  assert.equal(questions.filter(q => q.category === "listening" && q.images?.length).length, 10);
});

test("all 30 listening questions have ordered verified intervals in the actual recording", async () => {
  const listening = questions.filter(q => q.audio);
  assert.equal(listening.length, 30);
  assert.equal(audit.audioIntervalsVerified, 30);
  let previousEnd = 0;
  for (const q of listening) {
    const { startSeconds, endSeconds } = audit.audioIntervals.find(c => c.id === q.id);
    assert(Number.isFinite(startSeconds) && Number.isFinite(endSeconds), q.id);
    assert(startSeconds >= previousEnd && endSeconds > startSeconds + 10 && endSeconds <= 2430.5, q.id);
    assert(q.transcript.length > 50, q.id);
    assert.doesNotMatch(q.text, /(?:男|女)[：:]/, `${q.id} must not leak the dialogue before submission`);
    previousEnd = endSeconds;
    const clip = audit.audioClips.find(c => c.id === q.id);
    assert.equal(q.audio.src, clip.src);
    const bytes = await readFile(new URL(`../public${q.audio.src}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), clip.sha256);
    assert.equal(bytes.length, clip.sizeBytes);
    assert(bytes.length < 25 * 1024 * 1024, "Cloudflare asset size limit");
  }
  assert.equal(new Set(listening.map(q => q.audio.src)).size, 30);
  assert.equal(audit.transcriptCorrections.length, 3);
  assert(questions.find(q => q.id === "jlpt-1992-1-listening-III-0-6").options[1].includes("今年は行きます"));
});
