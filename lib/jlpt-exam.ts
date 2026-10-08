import { normalizePikkuLevel, type Question } from "../data/questions.ts";
import { shuffle } from "./shuffle.ts";

export type JlptProfileId = "n3" | "n2" | "n1";
export type JlptLabel = { zh: string; en: string };
export type JlptTypeId = "kanji-reading" | "orthography" | "word-formation" | "context-vocabulary" | "paraphrase" | "usage"
  | "grammar-selection" | "sentence-composition" | "text-grammar" | "reading-short" | "reading-medium" | "reading-long"
  | "reading-integrated" | "reading-thematic" | "information-retrieval" | "listening-task" | "listening-key-points"
  | "listening-outline" | "listening-expression" | "listening-response" | "listening-integrated";
export type JlptTypeQuota = { id: JlptTypeId; label: JlptLabel; count: number };
export type JlptSection = { id: string; label: JlptLabel; minutes: number; types: JlptTypeQuota[] };
export type JlptProfile = { id: JlptProfileId; level: "C" | "F" | "G"; label: JlptLabel; sections: JlptSection[];
  countBasis: "approximate"; sources: { label: string; url: string }[]; notes: JlptLabel };
export type JlptCoverage = { sectionId: string; typeId: JlptTypeId; label: JlptLabel; required: number; available: number; selected: number; missing: number };

export const jlptTypeLabels: Record<JlptTypeId, JlptLabel> = {
  "kanji-reading": { zh: "汉字读音", en: "Kanji reading" },
  orthography: { zh: "汉字表记", en: "Orthography" },
  "word-formation": { zh: "构词", en: "Word formation" },
  "context-vocabulary": { zh: "语境选词", en: "Contextual vocabulary" },
  paraphrase: { zh: "近义替换", en: "Paraphrase" },
  usage: { zh: "用法", en: "Usage" },
  "grammar-selection": { zh: "语法形式选择", en: "Grammar selection" },
  "sentence-composition": { zh: "句子重组", en: "Sentence composition" },
  "text-grammar": { zh: "篇章语法", en: "Text grammar" },
  "reading-short": { zh: "短篇理解", en: "Short-passage comprehension" },
  "reading-medium": { zh: "中篇理解", en: "Mid-size passage comprehension" },
  "reading-long": { zh: "长篇理解", en: "Long-passage comprehension" },
  "reading-integrated": { zh: "综合对读", en: "Integrated reading" },
  "reading-thematic": { zh: "长篇主旨", en: "Thematic comprehension" },
  "information-retrieval": { zh: "信息检索", en: "Information retrieval" },
  "listening-task": { zh: "任务理解", en: "Task-based listening" },
  "listening-key-points": { zh: "要点理解", en: "Listening for key points" },
  "listening-outline": { zh: "概要理解", en: "Listening for general outline" },
  "listening-expression": { zh: "情景表达", en: "Verbal expressions" },
  "listening-response": { zh: "即时应答", en: "Quick response" },
  "listening-integrated": { zh: "综合听解", en: "Integrated listening" },
};
const vocabularyTypes: JlptTypeId[] = ["kanji-reading", "orthography", "word-formation", "context-vocabulary", "paraphrase", "usage"];
const grammarTypes: JlptTypeId[] = ["grammar-selection", "sentence-composition", "text-grammar"];
const readingTypes: JlptTypeId[] = ["reading-short", "reading-medium", "reading-long", "reading-integrated", "reading-thematic", "information-retrieval"];
const listeningTypes: JlptTypeId[] = ["listening-task", "listening-key-points", "listening-outline", "listening-expression", "listening-response", "listening-integrated"];
const quotas = (ids: JlptTypeId[], counts: number[]): JlptTypeQuota[] => ids.flatMap((id, i) => counts[i] ? [{ id, label: jlptTypeLabels[id], count: counts[i] }] : []);
const sources = [
  { label: "JLPT: current test sections, times and item types", url: "https://www.jlpt.jp/e/guideline/testsections.html" },
  { label: "JLPT guidebook (2009), approximate item counts, printed page 7", url: "https://www.jlpt.jp/e/reference/pdf/guidebook_s_e.pdf" },
  { label: "JLPT: N1 listening revision from December 2022", url: "https://www.jlpt.jp/e/topics/list2022.html" },
];
const notes: JlptLabel = {
  zh: "按官方科目及近似题量组织的结构练习；题量不是每场固定保证。N3/C、N2/F、N1/G仅为本功能的模板关联，不是能力或证书换算。沿用题目现有CFGM及旧记录兼容分级。旧卷仅将已核对的题面任务归类，保留原题号与说明，不称为现代真题。缺题不跨级补齐，完整结构也不提供官方分数或合格判定。",
  en: "Structured practice using official sections and approximate item counts, which can vary by test. N3/C, N2/F and N1/G are template associations only, not proficiency or certificate equivalences. Existing CFGM and legacy compatibility levels remain unchanged. Only reviewed task formats from older papers are mapped; their original numbers and notes remain, without claiming modern test authenticity. Shortfalls are not filled from other levels. Even a complete plan does not provide official scores or a pass decision.",
};
function profile(id: JlptProfileId, level: "C" | "F" | "G", vocabulary: number[], grammar: number[], reading: number[], listening: number[], minutes: number[]): JlptProfile {
  const vocab = quotas(vocabularyTypes, vocabulary), gramRead = [...quotas(grammarTypes, grammar), ...quotas(readingTypes, reading)];
  const sections: JlptSection[] = id === "n3" ? [
    { id: "vocabulary", label: { zh: "语言知识（文字・词汇）", en: "Language knowledge (vocabulary)" }, minutes: minutes[0], types: vocab },
    { id: "grammar-reading", label: { zh: "语言知识（语法）・阅读", en: "Grammar and reading" }, minutes: minutes[1], types: gramRead },
  ] : [{ id: "knowledge-reading", label: { zh: "语言知识（文字・词汇・语法）・阅读", en: "Language knowledge and reading" }, minutes: minutes[0], types: [...vocab, ...gramRead] }];
  sections.push({ id: "listening", label: { zh: "听力", en: "Listening" }, minutes: minutes[minutes.length - 1], types: quotas(listeningTypes, listening) });
  return { id, level, label: { zh: `${id.toUpperCase()} 结构 · ${level}`, en: `${id.toUpperCase()} structure · ${level}` }, sections, countBasis: "approximate", sources, notes };
}
// Counts follow the official guidebook's approximate reference, not a fixed current test form.
// Its superseded N1 listening row is replaced by the December 2022 reference: 5+6+5+11+3=30.
export const jlptExamProfiles: JlptProfile[] = [
  profile("n3", "C", [8, 6, 0, 11, 5, 5], [13, 5, 5], [4, 6, 4, 0, 0, 2], [6, 6, 3, 4, 9, 0], [30, 70, 40]),
  profile("n2", "F", [5, 5, 5, 7, 5, 5], [12, 5, 5], [5, 9, 0, 2, 3, 2], [5, 6, 5, 0, 12, 4], [105, 50]),
  profile("n1", "G", [6, 0, 0, 7, 6, 6], [10, 5, 5], [4, 9, 4, 3, 4, 2], [5, 6, 5, 0, 11, 3], [110, 55]),
];

// Explicitly inspected short passages; length alone cannot identify a task's reading type.
const shortReadingIds = new Set([
  ...[17, 18, 20, 21].map(item => `jlpt-1995-1-reading-III-${item}`),
  ...[15, 16, 17, 18].map(item => `jlpt-1996-1-reading-III-${item}`),
  ...[1, 2, 3, 5].map(item => `jlpt-1994-1-reading-III-${item}`),
  ...[1, 3, 4, 5, 6, 7].map(group => `jlpt-1992-1-reading_grammar-III-${group}-1`),
  ...[2, 4].map(group => `jlpt-1993-1-reading_grammar-III-${group}-1`),
]);
const integratedReadingIds = new Set([
  ...[6, 7, 8].map(item => `jlpt-1993-1-reading_grammar-I-0-${item}`),
  "jlpt-1993-1-reading_grammar-III-5-1",
]);
const sourceIds = (question: Question) => [question.id, ...(question.occurrences ?? []).map(item => item.sourceQuestionId)];
const body = (question: Question) => question.targetText || question.text || question.latin || "";
const isCloze = (question: Question) => /_{2,}|[（(]\s*[）)]/.test(body(question));
function categoryFits(question: Question, type: JlptTypeId): boolean {
  if (listeningTypes.includes(type)) return question.category === "listening";
  if (readingTypes.includes(type)) return question.category === "reading";
  if (vocabularyTypes.includes(type)) return question.category === "vocabulary";
  return ["syntax", "sentencePattern", "morphology"].includes(question.category);
}

export function classifyJlptQuestion(question: Question): JlptTypeId | null {
  // Future editor-authored metadata must name an exact task, never infer it from an exam label.
  if (question.skill?.startsWith("jlpt:")) {
    const type = question.skill.slice(5) as JlptTypeId;
    return Object.prototype.hasOwnProperty.call(jlptTypeLabels, type) && categoryFits(question, type) ? type : null;
  }
  const ids = sourceIds(question);
  if (question.category === "vocabulary") {
    if (question.skill === "kanji-reading" || ids.some(id => /^jlpt-199[23456]-1-vocab-I-/.test(id))) return "kanji-reading";
    if (ids.some(id => /^jlpt-199[23456]-1-vocab-III-/.test(id))) return "orthography";
    if (isCloze(question) && (ids.some(id => /^jlpt-199[23456]-1-vocab-V-/.test(id)) || ["semantic-distinction", "adverb-usage"].includes(question.skill || ""))) return "context-vocabulary";
    // Old II tests homophones, IV same-kanji spelling, VI a defined sense's usage.
    // None is silently substituted for modern paraphrase, word formation or usage.
  }
  if (["syntax", "sentencePattern", "morphology"].includes(question.category) && isCloze(question)
    && (question.skill === "grammar" || question.skill === "particles" || ids.some(id => /^jlpt-199[23]-1-reading_grammar-(IV|V|VI)-/.test(id)))) return "grammar-selection";
  if (question.category === "reading") {
    if (ids.some(id => shortReadingIds.has(id))) return "reading-short";
    if (ids.some(id => integratedReadingIds.has(id))) return "reading-integrated";
  }
  // Old listening I/II/III and generic reading labels do not establish modern subtypes.
  return null;
}

function usable(question: Question): boolean {
  return question.reviewStatus !== "archived" && typeof question.id === "string" && Boolean(question.id.trim())
    && question.type === "choice" && Boolean(question.prompt?.trim()) && Boolean(question.explanation?.trim())
    && Boolean(body(question).trim() || question.passage?.trim() || (question.category === "reading" && question.context?.trim()) || (question.category === "listening" && question.audio?.src?.trim()))
    && Array.isArray(question.options) && question.options.length >= 3 && question.options.length <= 4
    && question.options.every(option => typeof option === "string" && Boolean(option.trim()))
    && new Set(question.options.map(option => option.trim())).size === question.options.length
    && Number.isInteger(question.answer) && question.answer! >= 0 && question.answer! < question.options.length
    && (question.category !== "listening" || Boolean(question.audio?.src?.trim()))
    && (question.category !== "reading" || Boolean(question.passage?.trim() || question.context?.trim()));
}
function ordering(question: Question): string {
  const occurrence = question.occurrences?.[0];
  return occurrence ? `${occurrence.collectionId}:${String(occurrence.order).padStart(10, "0")}`
    : (question.originalNumber || question.id).replace(/\d+/g, value => value.padStart(10, "0"));
}
function selectGrouped(candidates: Question[], count: number, random: () => number): Question[] {
  const groups = new Map<string, Question[]>();
  for (const question of candidates) {
    const text = question.passage?.trim() || (question.category === "reading" ? question.context?.trim() : "");
    const key = text || `id:${question.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(question);
  }
  const chosen: Question[] = [];
  for (const group of shuffle([...groups.values()], random)) {
    // Keep related tasks adjacent, in source order, even if the quota uses only a subset.
    // Each selected Question still includes the complete source passage; no text is truncated.
    chosen.push(...[...group].sort((a, b) => ordering(a).localeCompare(ordering(b)) || a.id.localeCompare(b.id)).slice(0, count - chosen.length));
    if (chosen.length === count) break;
  }
  return chosen;
}

export function buildJlptExam(questions: readonly Question[], profileId: JlptProfileId, random: () => number = Math.random) {
  const profile = jlptExamProfiles.find(item => item.id === profileId);
  if (!profile) throw new RangeError(`Unknown JLPT structure: ${profileId}`);
  const excluded = { invalid: 0, unmapped: 0, wrongLevel: 0, duplicate: 0 };
  const seen = new Set<string>(), buckets = new Map<JlptTypeId, Question[]>();
  const profileTypes = new Set(profile.sections.flatMap(section => section.types.map(type => type.id)));
  for (const question of questions) {
    if (question.language !== "ja") continue;
    if (seen.has(question.id)) { excluded.duplicate++; continue; }
    seen.add(question.id);
    if (!usable(question) || !["C", "F", "G", "M", "n4", "n3", "n2", "n1"].includes(question.level)) { excluded.invalid++; continue; }
    // Retain the application's established legacy compatibility mapping, without inventing
    // a new N-level-to-CFGM conversion based on this feature's template associations.
    if (normalizePikkuLevel("ja", question.level) !== profile.level) { excluded.wrongLevel++; continue; }
    const type = classifyJlptQuestion(question);
    if (!type || !profileTypes.has(type)) { excluded.unmapped++; continue; }
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type)!.push(question);
  }
  const coverage: JlptCoverage[] = [];
  const questionTypes: Record<string, { sectionId: string; typeId: JlptTypeId; label: JlptLabel }> = Object.create(null);
  const sections = profile.sections.map(section => {
    const selected: Question[] = [];
    for (const type of section.types) {
      const candidates = buckets.get(type.id) || [], picked = selectGrouped(candidates, type.count, random);
      coverage.push({ sectionId: section.id, typeId: type.id, label: type.label, required: type.count, available: candidates.length, selected: picked.length, missing: type.count - picked.length });
      for (const question of picked) { selected.push(question); questionTypes[question.id] = { sectionId: section.id, typeId: type.id, label: type.label }; }
    }
    return { ...section, questions: selected };
  });
  const selected = sections.flatMap(section => section.questions), missing = coverage.filter(item => item.missing > 0);
  return { profile, sections, questions: selected, questionTypes, coverage, missing, complete: missing.length === 0,
    totalRequired: coverage.reduce((sum, item) => sum + item.required, 0), totalSelected: selected.length, excluded };
}
export type JlptExamPlan = ReturnType<typeof buildJlptExam>;
