import questionEnglish from "../data/content-en-questions.json" with { type: "json" };
import examEnglish from "../data/content-en-exams.json" with { type: "json" };
import vocabularyEnglish from "../data/content-en-vocabulary.json" with { type: "json" };
import resourceEnglish from "../data/content-en-resources.json" with { type: "json" };
import { frenchArabicEnglish } from "../data/french-arabic.ts";
import type { Question } from "../data/questions";
import type { VocabularyCard } from "../data/vocabulary";

// Display projections only. Canonical content, answer indices and learning keys never change.
const questionCopy: Record<string, string> = { ...resourceEnglish, ...questionEnglish, ...examEnglish, ...frenchArabicEnglish };
const vocabularyCopy: Record<string, string> = { ...resourceEnglish, ...vocabularyEnglish, ...frenchArabicEnglish };
const contentCopy: Record<string, string> = { ...questionCopy, ...vocabularyCopy };
export function contentText(text: string, locale: string): string {
  return locale === "en" ? contentCopy[text] ?? text : text;
}
export function hasEnglishContent(text: string, scope: "question" | "vocabulary" | "all" = "all"): boolean {
  return Object.prototype.hasOwnProperty.call(scope === "question" ? questionCopy : scope === "vocabulary" ? vocabularyCopy : contentCopy, text);
}
export function localizeQuestion(question: Question, locale: string): Question {
  if (locale !== "en") return question;
  // A dictionary gloss must never replace a Japanese option that happens to share its spelling.
  const t = (text: string) => questionCopy[text] ?? text;
  return { ...question, prompt: t(question.prompt), explanation: t(question.explanation),
    context: question.context && t(question.context),
    modelAnswer: question.language === "zh-mandarin" ? question.modelAnswer : question.modelAnswer && t(question.modelAnswer),
    options: question.language === "zh-mandarin" || question.id.startsWith("jlpt-") || question.id.startsWith("ja-hlb1000-") ? question.options : question.options?.map(t),
    distractorExplanations: question.distractorExplanations?.map(t),
    tags: question.tags.map(t), source: t(question.source),
    images: question.images?.map(item => ({ ...item, alt: t(item.alt) })),
  };
}
export function localizeVocabularyCard(card: VocabularyCard, locale: string): VocabularyCard {
  if (locale !== "en") return card;
  const t = (text: string) => vocabularyCopy[text] ?? text;
  return { ...card, meaning: t(card.meaning),
    partOfSpeech: card.partOfSpeech && t(card.partOfSpeech),
    sourceMeaning: card.sourceMeaning && t(card.sourceMeaning),
    usageNotes: card.usageNotes && t(card.usageNotes),
    senses: card.senses?.map(sense => ({ ...sense, gloss: t(sense.gloss) })),
    // Keep official dictionary names for provenance filtering; translate their explanatory notes.
    dictionaryReferences: card.dictionaryReferences?.map(reference => ({ ...reference, note: t(reference.note) })),
    dictionary: card.dictionary && { ...card.dictionary, gloss: t(card.dictionary.gloss),
      partOfSpeech: t(card.dictionary.partOfSpeech), pie: t(card.dictionary.pie), derivatives: card.dictionary.derivatives.map(t) },
  };
}
