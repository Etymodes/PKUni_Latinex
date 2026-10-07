import { frenchArabicQuestions } from "./french-arabic.ts";
import { questions } from "./questions.ts";
import { completeQuestions } from "./complete-bank.ts";
import { multilingualQuestions } from "./multilingual-questions.ts";
import { multilingualSeedQuestions } from "./multilingual-seeds.ts";
import { jlpt1992Questions } from "./jlpt-1992.ts";
import jlpt1993 from "./jlpt-1993.json" with { type: "json" };
import unit01 from "./ja-hlb1000-n1-u01.json" with { type: "json" };
import { addQuestionCollections } from "./question-collections.ts";
import type { Question } from "./questions.ts";

const combined = addQuestionCollections([...questions, ...completeQuestions, ...multilingualQuestions, ...multilingualSeedQuestions, ...frenchArabicQuestions], [
  { id: "jlpt-1992-1", questions: jlpt1992Questions.map(question => question.category === "listening" && !question.images?.length ? { ...question, optionsInAudio: true } : question) },
  { id: "jlpt-1993-1", questions: jlpt1993 as Question[] },
  { id: "ja-hlb1000-n1-u01", questions: unit01 as Question[] },
]);
export const studyQuestions: Question[] = combined.questions;
export const questionAliases = combined.aliases;
export const duplicateQuestionOccurrences = combined.duplicates;
