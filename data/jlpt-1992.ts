import type { Question } from "./questions";
import imported from "./jlpt-1992.json" with { type: "json" };

// The importer validates the source paper, choices, answer indices and media.
export const jlpt1992Questions = imported as Question[];
