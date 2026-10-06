import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Input is the reviewed extraction of the user-provided 1992 paper, not an OCR guess.
const [sourceFile, audioFile, timelineFile, correctionsFile] = process.argv.slice(2);
assert(sourceFile && audioFile && timelineFile && correctionsFile, "Usage: node scripts/import-jlpt-1992.mjs extraction.json listening.m4a timeline.json corrections.json");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const difficulty = JSON.parse(await readFile(path.join(root, "data", "jlpt-1992-difficulty.json"), "utf8"));
const source = JSON.parse(await readFile(sourceFile, "utf8"));
const timeline = JSON.parse(await readFile(timelineFile, "utf8"));
const corrections = JSON.parse(await readFile(correctionsFile, "utf8"));
const clips = new Map((Array.isArray(timeline) ? timeline : timeline.questions).map(q => [q.id, q]));
assert.equal(clips.size, 30);
function correctedText(text, changes) {
  for (const change of changes) {
    const pattern = [...change.original].filter(c => !/\s/.test(c)).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
    text = text.replace(new RegExp(pattern, "g"), change.corrected);
  }
  return text;
}
const passages = new Map(source.passages.map(p => [p.id, p]));
assert.equal(source.questions.length, 149);
assert.equal(new Set(source.questions.map(q => q.id)).size, 149);
const grades = new Map(difficulty.questions.map(q => [q.id, q]));
assert.equal(difficulty.questions.length, source.questions.length, "Every source question needs an explicit CFGM assessment");
assert.equal(grades.size, source.questions.length, "Duplicate CFGM assessment IDs");
for (const q of source.questions) {
  const grade = grades.get(q.id);
  assert(grade && ["C", "F", "G", "M"].includes(grade.level), `Missing or invalid CFGM assessment: ${q.id}`);
  assert(typeof grade.rationale === "string" && grade.rationale.trim(), `Missing CFGM rationale: ${q.id}`);
  assert(Array.isArray(grade.knowledgePoints) && grade.knowledgePoints.length && grade.knowledgePoints.every(p => typeof p === "string" && p.trim()), `Missing knowledge points: ${q.id}`);
}
const mediaPath = path.join(root, "public", "media", "jlpt-1992");
await mkdir(path.join(mediaPath, "audio"), { recursive: true });
const audioName = "jlpt-1992-1kyu-listening.m4a";
const audioHash = createHash("sha256").update(await readFile(audioFile)).digest("hex");
const clipFiles = [];
for (const clip of clips.values()) {
  assert(/^(I|II|III)$/.test(clip.section) && Number.isInteger(clip.number) && clip.number >= 1 && clip.number <= 10);
  const name = `listening-${clip.section}-${String(clip.number).padStart(2, "0")}.m4a`;
  const file = path.resolve(path.dirname(timelineFile), "question-clips", name);
  const bytes = await readFile(file);
  await copyFile(file, path.join(mediaPath, "audio", name));
  clipFiles.push({ id: clip.id, src: `/media/jlpt-1992/audio/${name}`, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const assets = new Set();
const prompts = {
  I: "选择标注词语的正确读音。",
  II: "选择与【】内词语读音相同的词。",
  III: "选择假名对应的正确汉字。",
  IV: "选择与题干中括号内假名使用相同汉字的选项。",
  V: "选择最适合填入空白处的词语。",
  VI: "选择符合所给词义的用法。",
};
const sectionNames = { vocab: "文字・語彙", listening: "聴解", reading_grammar: "読解・文法" };
const questions = source.questions.map(q => {
  assert(q.options.length === 4 && q.options.every(o => typeof o === "string" && o.trim()), q.id);
  assert(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4, q.id);
  assert.equal(q.answerIndex + 1, q.answer, q.id);
  const listening = q.section === "listening";
  const grammar = q.section === "reading_grammar" && q.part === "IV";
  const passage = q.passageId ? passages.get(q.passageId) : null;
  assert(!q.passageId || passage, `Missing passage: ${q.id}`);
  const images = [...new Set([...(q.assets ?? []), ...(passage?.assets ?? [])])].map(asset => {
    assert(/^media\/image(?:[2-9]|1[012])\.(png|jpeg)$/.test(asset), `Unexpected question asset: ${asset}`);
    assets.add(asset);
    return { src: `/media/jlpt-1992/${path.basename(asset)}`, alt: `${q.originalNumber} 原卷题图（保留原选项编号）` };
  });
  const clip = clips.get(q.id);
  if (listening && timelineFile) assert(clip && Number.isFinite(clip.startSeconds) && clip.endSeconds > clip.startSeconds, `Missing verified audio interval: ${q.id}`);
  const changes = corrections.filter(c => c.id === q.id);
  const options = (q.optionsMarked ?? q.options).map(o => correctedText(o, changes));
  let explanation = q.needsReview
    ? "原答案表漏印本题答案。依据正文推断原选项 1「理屈だけで判断しないこと」：作者把「不合理な部分」与不只凭理性、还考虑事情前后经过和具体情况相联系。本答案为推断，待进一步复核。"
    : `所提供试卷的答案表：原选项 ${q.answer}「${options[q.answerIndex]}」。${listening ? "可展开听力原文对照录音。" : ""}`;
  if (changes.length) explanation += "\n录音对照修订（本机语音识别复核）：" + changes.map(c => `原稿「${c.original}」→「${c.corrected}」。`).join(" ");
  const grade = grades.get(q.id);
  explanation += `\nCFGM 内容分级：${grade.level}。${grade.rationale}`;
  const result = {
    id: q.id, language: "ja", level: grade.level,
    category: listening ? "listening" : q.section === "vocab" ? "vocabulary" : grammar ? "sentencePattern" : "reading",
    skill: listening ? "listening" : q.section === "vocab" ? "vocabulary" : grammar ? "grammar" : "reading",
    type: "choice",
    prompt: q.section === "vocab" ? prompts[q.part] : listening ? "听录音，按原编号选择正确答案。" : grammar ? "选择最适合填入空白处的表达。" : "阅读文章，选择正确答案。",
    text: correctedText(q.stemMarked || q.stem, changes), targetLang: "ja",
    ...(passage ? { passage: passage.markedText || passage.text } : {}),
    ...(images.length ? { images } : {}),
    ...(listening ? { audio: { src: clipFiles.find(c => c.id === q.id).src }, transcript: correctedText(q.transcript, changes) } : {}),
    options, answer: q.answerIndex, explanation,
    shuffleOptions: false, originalNumber: q.originalNumber,
    context: q.needsReview ? "本题原答案表漏印；提交后显示依据原文推断的参考答案。" : "【】保留资料中的下划线标记；选项沿用原卷编号。",
    tags: ["1992", "JLPT", "旧1級", sectionNames[q.section], `問題${q.part}`, ...(q.needsReview ? ["答案待复核"] : [])],
    source: "1992 年日本语能力试验旧 1 级 · 用户提供试卷及答案",
    reviewStatus: q.needsReview ? "draft" : "reviewed",
    provenance: {
      exam: "日本語能力試験", year: 1992, level: "旧1級", section: sectionNames[q.section], questionNumber: q.originalNumber,
      sourceFiles: [{ name: path.win32.basename(source.meta.sourceFile), sha256: source.meta.sourceSha256, pages: q.sourcePdfPages }, ...(listening ? [{ name: audioName, sha256: audioHash }] : [])],
      rightsStatus: "rights-unclear",
    },
  };
  assert(!listening || result.transcript?.length > 20, q.id);
  return result;
});
for (const asset of assets) await copyFile(path.resolve(path.dirname(sourceFile), asset), path.join(mediaPath, path.basename(asset)));
const dataPath = path.join(root, "data", "jlpt-1992.json");
await writeFile(dataPath, JSON.stringify(questions, null, 2) + "\n");
const audit = {
  exam: source.meta.exam, counts: source.meta.counts, sourceSha256: source.meta.sourceSha256, audioSha256: audioHash,
  sourceDocumentPages: source.meta.sourcePdfPageCount, printedAnswers: 148, inferredAnswers: 1,
  publicImportRequested: "2026-10-06", rightsStatus: "rights-unclear",
  difficultyRubric: difficulty.rubric.id,
  difficultyCounts: Object.fromEntries(["C", "F", "G", "M"].map(level => [level, questions.filter(q => q.level === level).length])),
  audioIntervalsVerified: 30, audioAlignmentMethod: "local ASR with transcript/topic/number matching and repeated short-segment recognition", humanListeningVerified: false,
  audioIntervals: timeline, audioClips: clipFiles, transcriptCorrections: corrections,
  questions: source.questions.map(q => ({ id: q.id, originalNumber: q.originalNumber, answer: q.answer, answerSource: q.answerSource, sourceParagraphs: q.sourceParagraphs, sourcePdfPages: q.sourcePdfPages, answerSourcePdfPages: q.answerSourcePdfPages })),
  issues: source.issues,
};
await writeFile(path.join(root, "data", "jlpt-1992-provenance.json"), JSON.stringify(audit, null, 2) + "\n");
console.log(JSON.stringify({ questions: questions.length, images: assets.size, listening: questions.filter(q => q.audio).length, verifiedClips: clips.size, output: dataPath }));
