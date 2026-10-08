import type { Question } from "./questions.ts";

export const questionCollections = [
  { id: "jlpt-1992-1", zh: "1992 · 旧1級真题", en: "1992 · Old Level 1", categories: ["vocabulary", "listening", "reading", "sentencePattern"] },
  { id: "jlpt-1993-1", zh: "1993 · 旧1級真题", en: "1993 · Old Level 1", categories: ["vocabulary", "listening", "reading", "sentencePattern"] },
  { id: "ja-hlb1000-n1-u01", zh: "红蓝宝书 N1 · Unit 1", en: "N1 Red & Blue · Unit 1", categories: ["vocabulary", "sentencePattern"] },
  { id: "jlpt-1994-1", zh: "1994 · 旧1級真题（部分）", en: "1994 · Old Level 1 (partial)", categories: ["vocabulary", "reading", "sentencePattern"] },
  { id: "jlpt-1995-1", zh: "1995 · 旧1級真题（部分）", en: "1995 · Old Level 1 (partial)", categories: ["vocabulary", "listening", "reading", "sentencePattern"] },
  { id: "jlpt-1996-1", zh: "1996 · 旧1級真题（部分）", en: "1996 · Old Level 1 (partial)", categories: ["vocabulary", "listening", "reading", "sentencePattern"] },
];

export function questionInCollection(question: Question, collectionId: string): boolean {
  return Boolean(question.occurrences?.some(item => item.collectionId === collectionId));
}

export function questionForCollection(question: Question, collectionId: string): Question {
  const occurrence = question.occurrences?.find(item => item.collectionId === collectionId);
  return occurrence ? { ...question, originalNumber: occurrence.originalNumber, shuffleOptions: false,
    ...(occurrence.options ? { options: occurrence.options, answer: occurrence.answer } : {}),
    ...(occurrence.explanation ? { explanation: occurrence.explanation } : {}),
    ...(occurrence.distractorExplanations ? { distractorExplanations: occurrence.distractorExplanations } : {}) } : question;
}

export function collectionOrder(question: Question, collectionId: string): number {
  return question.occurrences?.find(item => item.collectionId === collectionId)?.order ?? Number.MAX_SAFE_INTEGER;
}

const normalized = (value: string | undefined) => (value ?? "").normalize("NFKC").replace(/[\s\u200b]/g, "");

// Compare the actual task and its options. Similar topics or shared vocabulary are not duplicates.
export function questionFingerprint(question: Question): string {
  const body = question.targetText || question.text || question.latin || question.prompt;
  return JSON.stringify([question.language ?? "la", question.category, question.type,
    normalized(question.prompt), normalized(body), normalized(question.passage), normalized(question.context),
    normalized(question.transcript), question.audio && !question.transcript ? question.audio.src : "",
    (question.images ?? []).map(image => image.src),
    (question.options ?? []).map(normalized).sort(),
    question.type === "self-check" ? normalized(question.modelAnswer) : ""]);
}

export function addQuestionCollections(existing: Question[], collections: { id: string; questions: Question[] }[]) {
  const questions = existing.map(question => ({ ...question, tags: [...question.tags], occurrences: [...(question.occurrences ?? [])] }));
  const byFingerprint = new Map(questions.map(question => [questionFingerprint(question), question]));
  const byId = new Map(questions.map(question => [question.id, question]));
  const aliases: Record<string, string> = {};
  const duplicates: { sourceId: string; canonicalId: string; collectionId: string }[] = [];
  for (const collection of collections) {
    const definition = questionCollections.find(item => item.id === collection.id);
    if (!definition) throw new Error(`Unknown question collection: ${collection.id}`);
    collection.questions.forEach((incoming, order) => {
      const fingerprint = questionFingerprint(incoming);
      const candidate = byId.get(incoming.id) ?? byFingerprint.get(fingerprint);
      if (candidate && questionFingerprint(candidate) !== fingerprint) throw new Error(`Conflicting question ID: ${incoming.id}`);
      if (candidate && incoming.type === "choice"
        && normalized(candidate.options?.[candidate.answer ?? -1]) !== normalized(incoming.options?.[incoming.answer ?? -1])) {
        throw new Error(`Conflicting answers: ${candidate.id} / ${incoming.id}`);
      }
      const question = candidate ?? { ...incoming, tags: [...incoming.tags], occurrences: [...(incoming.occurrences ?? [])] };
      if (!candidate) { questions.push(question); byId.set(question.id, question); byFingerprint.set(fingerprint, question); }
      if (!question.occurrences.some(item => item.collectionId === collection.id && item.sourceQuestionId === incoming.id)) {
        const reordered = candidate && JSON.stringify(candidate.options) !== JSON.stringify(incoming.options);
        question.occurrences.push({ collectionId: collection.id, label: definition.zh,
          sourceQuestionId: incoming.id, originalNumber: incoming.originalNumber ?? incoming.id, order,
          ...(reordered ? { options: incoming.options, answer: incoming.answer } : {}),
          ...(candidate && incoming.explanation !== candidate.explanation ? { explanation: incoming.explanation } : {}),
          ...(candidate && JSON.stringify(incoming.distractorExplanations) !== JSON.stringify(candidate.distractorExplanations)
            ? { distractorExplanations: incoming.distractorExplanations ?? [] } : {}) });
      }
      question.tags = [...new Set([...question.tags, definition.zh])];
      aliases[incoming.id] = question.id;
      if (candidate && candidate.id !== incoming.id) duplicates.push({ sourceId: incoming.id, canonicalId: candidate.id, collectionId: collection.id });
    });
  }
  return { questions, aliases, duplicates };
}
