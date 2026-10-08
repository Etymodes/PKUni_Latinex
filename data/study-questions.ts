import { frenchArabicQuestions } from "./french-arabic.ts";
import { questions } from "./questions.ts";
import { completeQuestions } from "./complete-bank.ts";
import { multilingualQuestions } from "./multilingual-questions.ts";
import { multilingualSeedQuestions } from "./multilingual-seeds.ts";
import { jlpt1992Questions } from "./jlpt-1992.ts";
import jlpt1993 from "./jlpt-1993.json" with { type: "json" };
import jlpt1994 from "./jlpt-1994.json" with { type: "json" };
import jlpt1995 from "./jlpt-1995.json" with { type: "json" };
import jlpt1996 from "./jlpt-1996.json" with { type: "json" };
import jlpt1997 from "./jlpt-1997.json" with { type: "json" };
import jlpt1998 from "./jlpt-1998.json" with { type: "json" };
import jlpt1999 from "./jlpt-1999.json" with { type: "json" };
import jlpt2000 from "./jlpt-2000.json" with { type: "json" };
import jlpt2001 from "./jlpt-2001.json" with { type: "json" };
import jlpt2002 from "./jlpt-2002.json" with { type: "json" };
import unit01 from "./ja-hlb1000-n1-u01.json" with { type: "json" };
import { addQuestionCollections } from "./question-collections.ts";
import type { Question } from "./questions.ts";

const combined = addQuestionCollections([...questions, ...completeQuestions, ...multilingualQuestions, ...multilingualSeedQuestions, ...frenchArabicQuestions], [
  { id: "jlpt-1992-1", questions: jlpt1992Questions.map(question => question.category === "listening" && !question.images?.length ? { ...question, optionsInAudio: true } : question) },
  { id: "jlpt-1993-1", questions: jlpt1993 as Question[] },
  { id: "jlpt-1994-1", questions: jlpt1994 as Question[] },
  { id: "ja-hlb1000-n1-u01", questions: unit01 as Question[] },
  { id: "jlpt-1995-1", questions: jlpt1995 as Question[] },
  { id: "jlpt-1996-1", questions: jlpt1996 as Question[] },
  { id: "jlpt-1997-1", questions: jlpt1997 as Question[] },
  { id: "jlpt-1998-1", questions: jlpt1998 as Question[] },
  { id: "jlpt-1999-1", questions: jlpt1999 as Question[] },
  { id: "jlpt-2000-1", questions: jlpt2000 as Question[] },
  { id: "jlpt-2001-1", questions: jlpt2001 as Question[] },
  { id: "jlpt-2002-1", questions: jlpt2002 as Question[] },
]);
export const studyQuestions: Question[] = combined.questions;
export const questionAliases = combined.aliases;
export const duplicateQuestionOccurrences = combined.duplicates;
