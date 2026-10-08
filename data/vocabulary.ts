import { frenchArabicVocabulary } from "./french-arabic.ts";
import type { LanguageLevel } from "./languages";
import type { LanguageCode } from "./questions";
import { normalizePikkuLevel, pikkuLevels, type PikkuLevel } from "./questions.ts";
import { multilingualSeedQuestions, multilingualVocabItems } from "./multilingual-seeds.ts";
import { lexiconSeed, type LexiconEntry } from "./resources.ts";
import importedVocabulary from "./jlpt-1992-vocabulary.json" with { type: "json" };
import n1Vocabulary from "./n1-2000-vocabulary.json" with { type: "json" };
import vocabulary1993 from "./jlpt-1993-vocabulary.json" with { type: "json" };
import vocabulary1994 from "./jlpt-1994-vocabulary.json" with { type: "json" };
import vocabulary1995 from "./jlpt-1995-vocabulary.json" with { type: "json" };
import vocabulary1996 from "./jlpt-1996-vocabulary.json" with { type: "json" };
import vocabulary1997 from "./jlpt-1997-vocabulary.json" with { type: "json" };
import vocabulary1998 from "./jlpt-1998-vocabulary.json" with { type: "json" };
import vocabulary1999 from "./jlpt-1999-vocabulary.json" with { type: "json" };
import vocabulary2001 from "./jlpt-2001-vocabulary.json" with { type: "json" };
import vocabulary2002 from "./jlpt-2002-vocabulary.json" with { type: "json" };
import vocabulary2000 from "./jlpt-2000-vocabulary.json" with { type: "json" };
import vocabularyUnit01 from "./ja-hlb1000-n1-u01-vocabulary.json" with { type: "json" };
import vocabularyLevelOverrides from "./vocabulary-levels.json" with { type: "json" };

export type VocabularyMode = "word" | "context";

export type VocabularyCard = {
  id: string;
  language: LanguageCode;
  level?: LanguageLevel;
  term: string;
  meaning: string;
  context: string;
  reading?: string;
  partOfSpeech?: string;
  batch?: string;
  sourceQuestionIds?: string[];
  sourceCollections?: string[];
  sourcePages?: number[];
  sourceReading?: string;
  sourceMeaning?: string;
  sourceNotes?: string;
  spellingVariants?: string[];
  readingVariants?: string[];
  senses?: { reading: string; gloss: string; sourcePages: number[] }[];
  notes?: string;
  usageNotes?: string;
  dictionaryReferences?: { name: string; url: string; note: string }[];
  dictionary?: LexiconEntry;
};

export type VocabularyStat = { seen: number; correct: number };
export type VocabularyStats = Record<string, VocabularyStat>;
type VocabularySeed = [term: string, meaning: string, context: string, level: LanguageLevel];

const latinCards: VocabularyCard[] = ([
  ["castra, -ōrum n. pl.", "军营", "Castra prope flūmen posita sunt.", "elementary"],
  ["dūcō, dūcere, dūxī, ductum", "引导；率领", "Dux exercitum in Italiam dūcit.", "elementary"],
  ["cōgnōscō, -ere, cōgnōvī, cōgnitum", "认识；得知", "Tandem cōgnōvī quid accidisset.", "elementary"],
  ["proficīscor, proficīscī, profectus sum", "出发", "Mīlitēs prīmā lūce proficīscuntur.", "elementary"],
  ["praesidium, -ī n.", "守备；保护；驻军", "Praesidium urbem dēfendit.", "elementary"],
  ["quod", "因为；这一事实；关系代词中性", "Gaudeō quod advenistī.", "elementary"],
  ["virtūs, virtūtis f.", "勇德；卓越；勇气", "Virtūs in perīculīs appāret.", "elementary"],
  ["auctoritās, -ātis f.", "威望；权威；影响力", "Auctoritās senātūs magna erat.", "intermediate"],
  ["cupīdō, -inis f.", "欲望；贪求", "Cupīdō pecūniae multōs corrumpit.", "intermediate"],
  ["coniūrātiō, -ōnis f.", "共谋；阴谋", "Coniūrātiō ā Cicerōne patefacta est.", "intermediate"],
  ["dignitās, -ātis f.", "身份；威望；尊严", "Dignitātem suam dēfendit.", "intermediate"],
  ["neglegō, -ere, neglēxī, neglēctum", "忽视；疏忽", "Officium neglegere nōn dēbēmus.", "intermediate"],
  ["quamquam", "虽然；尽管", "Quamquam fessus erat, perrexit.", "intermediate"],
  ["ultro", "主动地；此外；甚至", "Hostēs ultrō pācem petīvērunt.", "advanced"],
  ["quippe", "诚然；因为显然", "Quippe rem iam sciēbat.", "advanced"],
  ["faxō", "我一定会做到／使……（古式）", "Faxō sciēs.", "advanced"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `la-${String(index + 1).padStart(3, "0")}`,
  language: "la",
  level,
  term,
  meaning,
  context,
}));

const japaneseCards: VocabularyCard[] = ([
  ["学生", "学生", "学生です。", "n4"],
  ["食べる", "吃", "朝ご飯を食べる。", "n4"],
  ["大切", "重要；珍贵", "健康は大切です。", "n4"],
  ["勉強", "学习", "毎日、日本語を勉強します。", "n4"],
  ["経験", "经验；经历", "日本で働いた経験があります。", "n3"],
  ["続ける", "继续", "練習を続けてください。", "n3"],
  ["確認", "确认", "予定をもう一度確認する。", "n3"],
  ["増える", "增加", "利用者が増えている。", "n3"],
  ["省く", "省略；节省", "無駄な説明を省く。", "n2"],
  ["見極める", "看清；辨明", "情報の真偽を見極める。", "n2"],
  ["信頼性", "可靠性", "この資料は信頼性が高い。", "n2"],
  ["招く", "招致；引起", "誤解を招きかねない。", "n2"],
  ["見解", "见解", "専門家が見解を示した。", "n1"],
  ["促す", "促使；催促", "改善を促す。", "n1"],
  ["顕著", "显著", "差が顕著に現れた。", "n1"],
  ["踏まえる", "根据；立足于", "結果を踏まえて判断する。", "n1"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `ja-${String(index + 1).padStart(3, "0")}`,
  language: "ja",
  level,
  term,
  meaning,
  context,
}));

const spanishCards: VocabularyCard[] = ([
  ["casa", "房子；家", "La casa es pequeña.", "a1"],
  ["comer", "吃", "Quiero comer ahora.", "a1"],
  ["trabajo", "工作", "Busco trabajo.", "a1"],
  ["aprender", "学习；学会", "Aprendo español.", "a1"],
  ["viaje", "旅行", "El viaje fue corto.", "a2"],
  ["todavía", "仍然；还", "Todavía estoy aquí.", "a2"],
  ["elegir", "选择", "Puedes elegir uno.", "a2"],
  ["mejorar", "改善；提高", "Quiero mejorar mi español.", "a2"],
  ["lograr", "实现；成功做到", "Logró terminar a tiempo.", "b1"],
  ["aunque", "虽然；即使", "Aunque llueva, iremos.", "b1"],
  ["desarrollar", "发展；开发", "El equipo desarrolla una aplicación.", "b1"],
  ["entorno", "环境；周边", "Trabaja en un entorno tranquilo.", "b1"],
  ["plantear", "提出；构成", "El informe plantea varias dudas.", "b2"],
  ["llevar a cabo", "实施；完成", "Llevaron a cabo el proyecto.", "b2"],
  ["matiz", "细微差别；色调", "Hay un matiz importante.", "b2"],
  ["fiable", "可靠的", "Es una fuente fiable.", "b2"],
  ["conllevar", "伴随；导致", "La decisión conlleva riesgos.", "c1"],
  ["suscitar", "引起；激起", "La noticia suscitó un debate.", "c1"],
  ["contundente", "有力的；明确的", "Presentó pruebas contundentes.", "c1"],
  ["desempeño", "表现；履职", "Evaluaron su desempeño.", "c1"],
  ["dilucidar", "阐明；查明", "El estudio intenta dilucidar la causa.", "c2"],
  ["soslayar", "回避；忽略", "No podemos soslayar el problema.", "c2"],
  ["acuciante", "紧迫的", "Es una necesidad acuciante.", "c2"],
  ["a todas luces", "显然；明摆着", "La propuesta es, a todas luces, insuficiente.", "c2"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `es-${String(index + 1).padStart(3, "0")}`,
  language: "es",
  level,
  term,
  meaning,
  context,
}));

const legacyVocabularyCards = [...latinCards, ...japaneseCards, ...spanishCards];
const legacyVocabularyKeys = new Set(legacyVocabularyCards.map((card) => vocabularyKey(card.language, card.term)));
const restoredVocabularyCards: VocabularyCard[] = multilingualVocabItems.map((item, index) => ({
  id: multilingualSeedQuestions[index].id,
  language: item.language,
  level: item.level,
  term: item.lemma,
  meaning: item.gloss,
  context: item.lemma,
})).filter((card) => !legacyVocabularyKeys.has(vocabularyKey(card.language, card.term)));

// The dictionary and trainer consume these same objects. Keep old stats keys and IDs.
const sharedCards = [...legacyVocabularyCards, ...restoredVocabularyCards, ...frenchArabicVocabulary];
for (const entry of lexiconSeed) {
  const existing = sharedCards.find(card => card.language === entry.language
    && (card.term === entry.lemma || card.term.split(",")[0] === entry.lemma));
  if (existing) {
    Object.assign(existing, { dictionary: entry, reading: entry.principalParts, partOfSpeech: entry.partOfSpeech, batch: entry.batch });
  } else {
    sharedCards.push({ id: `lexicon-${entry.language}-${entry.lemma}`, language: entry.language,
      term: entry.lemma, meaning: entry.gloss, context: "", reading: entry.principalParts,
      partOfSpeech: entry.partOfSpeech, batch: entry.batch, dictionary: entry });
  }
}
for (const entry of importedVocabulary) {
  const existing = sharedCards.find(card => card.language === "ja" && card.term === entry.lemma);
  const fields = { reading: entry.reading, partOfSpeech: entry.partOfSpeech,
    sourceQuestionIds: entry.sourceQuestionIds, sourceCollections: ["jlpt-1992-1"], notes: entry.notes,
    usageNotes: entry.usageNotes, dictionaryReferences: entry.dictionaryReferences, batch: "1992 · 旧1級",
    context: entry.context, meaning: entry.gloss };
  if (existing) Object.assign(existing, fields, { level: entry.level as LanguageLevel });
  else sharedCards.push({ id: entry.id, language: "ja", term: entry.lemma, level: entry.level as LanguageLevel, ...fields });
}
for (const entry of n1Vocabulary) {
  const existing = sharedCards.find(card => card.language === "ja" && card.term.normalize("NFKC") === entry.lemma.normalize("NFKC"));
  const source = { sourcePages: entry.sourcePages, sourceReading: entry.reading,
    sourceMeaning: entry.gloss, sourceNotes: entry.notes,
    spellingVariants: (entry as { spellingVariants?: string[] }).spellingVariants,
    readingVariants: (entry as { readingVariants?: string[] }).readingVariants,
    senses: (entry as { senses?: VocabularyCard["senses"] }).senses };
  if (existing) {
    Object.assign(existing, source);
    if (!existing.reading) existing.reading = entry.reading;
    if (!existing.partOfSpeech) existing.partOfSpeech = entry.partOfSpeech;
  } else {
    sharedCards.push({ id: entry.id, language: "ja", term: entry.lemma, reading: entry.reading,
      meaning: entry.gloss, partOfSpeech: entry.partOfSpeech, context: entry.context,
      batch: "N1必背2000词", ...source });
  }
}
type ImportedVocabulary = {
  id: string; lemma: string; reading: string; gloss: string; partOfSpeech: string; context: string;
  level?: LanguageLevel; sourceQuestionIds: string[]; spellingVariants?: string[]; readingVariants?: string[];
  usageNotes?: string; dictionaryReferences?: VocabularyCard["dictionaryReferences"];
  senses?: { reading: string; gloss: string }[];
};

export function mergeVocabularyCollection(cards: VocabularyCard[], entries: ImportedVocabulary[], collectionId: string): void {
  const normalize = (term: string) => term.normalize("NFKC").trim();
  const lookup = new Map<string, VocabularyCard>();
  for (const card of cards.filter(card => card.language === "ja")) {
    lookup.set(normalize(card.term), card);
    for (const variant of card.spellingVariants ?? []) if (!lookup.has(normalize(variant))) lookup.set(normalize(variant), card);
  }
  for (const entry of entries) {
    const existing = lookup.get(normalize(entry.lemma));
    const card: VocabularyCard = existing ?? { id: entry.id, language: "ja", term: entry.lemma,
      reading: entry.reading, meaning: entry.gloss, partOfSpeech: entry.partOfSpeech, context: entry.context,
      ...(entry.level ? { level: entry.level } : {}) };
    if (!existing) { cards.push(card); lookup.set(normalize(entry.lemma), card); }
    card.sourceQuestionIds = [...new Set([...(card.sourceQuestionIds ?? []), ...entry.sourceQuestionIds])];
    card.sourceCollections = [...new Set([...(card.sourceCollections ?? []), collectionId])];
    if (!card.reading) card.reading = entry.reading;
    if (!card.partOfSpeech) card.partOfSpeech = entry.partOfSpeech;
    if (!card.context) card.context = entry.context;
    if (!card.level && entry.level) card.level = entry.level;
    if (entry.spellingVariants?.length) card.spellingVariants = [...new Set([...(card.spellingVariants ?? []), ...entry.spellingVariants])];
    const incomingSenses = [{ reading: entry.reading, gloss: entry.gloss }, ...(entry.senses ?? [])];
    const readings = [...(entry.readingVariants ?? []), ...incomingSenses.map(sense => sense.reading)]
      .filter(reading => reading !== card.reading && reading !== card.sourceReading);
    if (readings.length) card.readingVariants = [...new Set([...(card.readingVariants ?? []), ...readings])];
    for (const sense of incomingSenses) {
      const primary = sense.reading === card.reading && sense.gloss === card.meaning;
      const source = sense.reading === card.sourceReading && sense.gloss === card.sourceMeaning;
      if (!primary && !source && !card.senses?.some(item => item.reading === sense.reading && item.gloss === sense.gloss)) {
        card.senses = [...(card.senses ?? []), { reading: sense.reading, gloss: sense.gloss, sourcePages: [] }];
      }
    }
    if (!card.usageNotes && entry.usageNotes) card.usageNotes = entry.usageNotes;
    for (const variant of card.spellingVariants ?? []) if (!lookup.has(normalize(variant))) lookup.set(normalize(variant), card);
    if (entry.dictionaryReferences?.length) card.dictionaryReferences = [...new Map([...(card.dictionaryReferences ?? []), ...entry.dictionaryReferences].map(reference => [reference.url, reference])).values()];
  }
}

// Only dictionary citations are shown with Japanese definitions; exam/book provenance stays internal.
export function publicDictionaryReferences(card: VocabularyCard) {
  return (card.dictionaryReferences ?? []).filter(reference => /^https:\/\//.test(reference.url)
    && (card.language !== "ja" || /大辞泉|大辞林|広辞苑|廣辭苑|日本国語大辞典|日本國語大辭典|明鏡国語辞典|新明解国語辞典/.test(reference.name)));
}

export function vocabularyInCollection(card: VocabularyCard, source: string): boolean {
  if (source === "2000" || source === "n1-2000") return Boolean(card.sourcePages?.length);
  const collectionId = source === "1992" || source === "jlpt-1992" ? "jlpt-1992-1" : source;
  return collectionId === "all" || Boolean(card.sourceCollections?.includes(collectionId)
    || card.sourceQuestionIds?.some(id => id.startsWith(collectionId + "-")));
}

mergeVocabularyCollection(sharedCards, vocabulary1993 as ImportedVocabulary[], "jlpt-1993-1");
mergeVocabularyCollection(sharedCards, vocabularyUnit01 as ImportedVocabulary[], "ja-hlb1000-n1-u01");
mergeVocabularyCollection(sharedCards, vocabulary1994 as ImportedVocabulary[], "jlpt-1994-1");
mergeVocabularyCollection(sharedCards, vocabulary1995 as ImportedVocabulary[], "jlpt-1995-1");
mergeVocabularyCollection(sharedCards, vocabulary1996 as ImportedVocabulary[], "jlpt-1996-1");
mergeVocabularyCollection(sharedCards, vocabulary1997 as ImportedVocabulary[], "jlpt-1997-1");
mergeVocabularyCollection(sharedCards, vocabulary1998 as ImportedVocabulary[], "jlpt-1998-1");
mergeVocabularyCollection(sharedCards, vocabulary1999 as ImportedVocabulary[], "jlpt-1999-1");
mergeVocabularyCollection(sharedCards, vocabulary2000 as ImportedVocabulary[], "jlpt-2000-1");
mergeVocabularyCollection(sharedCards, vocabulary2001 as ImportedVocabulary[], "jlpt-2001-1");
mergeVocabularyCollection(sharedCards, vocabulary2002 as ImportedVocabulary[], "jlpt-2002-1");
// Grade the unified canonical entries without replacing IDs, terms or learning keys.
const reviewedLevels: Record<string, string> = vocabularyLevelOverrides;
for (const card of sharedCards) {
  const level = reviewedLevels[card.id] ?? card.level;
  if (!pikkuLevels.includes(level as PikkuLevel)) throw new Error(`Missing CFGM vocabulary level: ${card.id}`);
  card.level = level as PikkuLevel;
}
export const vocabularyCards: VocabularyCard[] = sharedCards;
export const dictionaryEntries = vocabularyCards;

export function vocabularyKey(language: LanguageCode, term: string) {
  return `${language}:${term}`;
}

export function vocabularyLevelsFor(language: LanguageCode, level: LanguageLevel) {
  // Legacy saved preferences still route to a CFGM stage; cards are graded independently.
  const selected = language === "la" && level === "mixed" ? "F" : normalizePikkuLevel(language, level);
  return pikkuLevels.slice(0, pikkuLevels.indexOf(selected) + 1);
}

export function vocabularyMatchesLevel(card: VocabularyCard, level: LanguageLevel) {
  return Boolean(card.level && vocabularyLevelsFor(card.language, level).includes(normalizePikkuLevel(card.language, card.level)));
}

export function adaptiveVocabularyWeight(stat?: VocabularyStat, recentlyShown = false) {
  const seen = Math.max(0, stat?.seen ?? 0);
  const correct = Math.min(seen, Math.max(0, stat?.correct ?? 0));
  const weight = seen === 0 ? 3 : 1 + (1 - correct / seen) * 5 + 1 / (seen + 1);
  return weight * (recentlyShown ? 0.15 : 1);
}

export function chooseNextVocabularyCard(
  cards: VocabularyCard[],
  stats: VocabularyStats,
  recentlyShown: string[],
  random: () => number = Math.random,
) {
  if (!cards.length) return null;
  const recent = new Set(recentlyShown);
  const weights = cards.map((card) => adaptiveVocabularyWeight(stats[vocabularyKey(card.language, card.term)], recent.has(card.id)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = Math.min(Math.max(random(), 0), 0.999999999999) * total;
  for (let index = 0; index < cards.length; index += 1) {
    target -= weights[index];
    if (target < 0) return cards[index];
  }
  return cards[cards.length - 1];
}
