import { matchesLevel, normalizePikkuLevel, type Question, type StudyLevel } from "../data/questions.ts";
import { vocabularyLevelsFor, type VocabularyCard } from "../data/vocabulary.ts";
import { shuffle } from "./shuffle.ts";

export function buildRandomExam(questions: readonly Question[], level: StudyLevel, mixed = false, random: () => number = Math.random): Question[] {
  const eligible = questions.filter(question => mixed || matchesLevel(question, level));
  return [...shuffle(eligible.filter(question => question.type === "choice"), random).slice(0, 8),
    ...shuffle(eligible.filter(question => question.type === "self-check"), random).slice(0, 1)];
}

export type VocabularyMeasurementItem = { id: string; lemma: string; gloss: string; level: string; options: string[] };

// Pass one language's canonical cards, projected to the current display language.
export function buildVocabularyMeasurement(cards: readonly VocabularyCard[], level: StudyLevel, random: () => number = Math.random): VocabularyMeasurementItem[] {
  const eligible = cards.filter(card => card.level && vocabularyLevelsFor(card.language, level).includes(normalizePikkuLevel(card.language, card.level)));
  const meanings = [...new Set(cards.map(card => card.meaning.trim()).filter(Boolean))];
  if (meanings.length < 2) return [];
  return shuffle(eligible, random).slice(0, 20).map(card => ({
    id: card.id, lemma: card.term, gloss: card.meaning.trim(), level: normalizePikkuLevel(card.language, card.level!),
    options: shuffle([card.meaning.trim(), ...shuffle(meanings.filter(meaning => meaning !== card.meaning.trim()), random).slice(0, 3)], random),
  }));
}
