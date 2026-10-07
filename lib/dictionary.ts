import type { VocabularyCard } from "../data/vocabulary.ts";
import { publicDictionaryReferences } from "../data/vocabulary.ts";
import { normalizePikkuLevel } from "../data/questions.ts";
import { localizeVocabularyCard, contentText } from "./content-locale.ts";
import { dictionaryEnrichment, type DictionaryCitation } from "../data/dictionary-enrichment.ts";

export type DictionaryOptions = {
  language: string; locale?: string; query?: string; field?: "all" | "headword" | "reading" | "meaning";
  order?: "headword" | "reading"; index?: string; level?: string; partOfSpeech?: string;
};
export type DictionaryDisplaySense = { number: number; reading: string; gloss: string; partOfSpeech?: string; source?: DictionaryCitation };
export type DictionaryDisplayExample = { text: string; translation?: string; source?: DictionaryCitation; editorial: boolean };
export type DictionaryReference = DictionaryCitation & { note?: string };

export function dictionaryFold(value: string): string {
  return value.normalize("NFKC").replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed\u3099\u309a]/g, "").toLowerCase().trim();
}

function readingOf(card: VocabularyCard): string { return card.reading || card.sourceReading || ""; }
function partOfSpeechOf(card: VocabularyCard): string { return card.partOfSpeech || card.dictionary?.partOfSpeech || ""; }

export function dictionaryIndex(card: VocabularyCard, order: "headword" | "reading" = "headword"): string {
  const text = dictionaryFold(order === "reading" ? readingOf(card) : card.term);
  const first = Array.from(text.replace(/^[^\p{L}]+/u, ""))[0];
  if (!first) return "#";
  const rows = ["あいうえおぁぃぅぇぉ", "かきくけこがぎぐげご", "さしすせそざじずぜぞ", "たちつてとだぢづでどっ", "なにぬねの", "はひふへほばびぶべぼぱぴぷぺぽ", "まみむめも", "やゆよゃゅょ", "らりるれろ", "わをんゎ"];
  const row = rows.find(value => value.includes(first));
  if (row) return row[0];
  if (/\p{Script=Han}/u.test(first)) return "漢字";
  return first.toUpperCase();
}

export function dictionaryFacets(cards: readonly VocabularyCard[], language: string, order: "headword" | "reading" = "headword") {
  const entries = cards.filter(card => card.language === language);
  return {
    indices: [...new Set(entries.map(card => dictionaryIndex(card, order)))].sort((a, b) => a.localeCompare(b)),
    partsOfSpeech: [...new Set(entries.map(partOfSpeechOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
}

export function searchDictionary(cards: readonly VocabularyCard[], options: DictionaryOptions): VocabularyCard[] {
  const query = dictionaryFold(options.query || ""), field = options.field || "all", order = options.order || "headword";
  return cards.filter(card => {
    if (card.language !== options.language) return false;
    if (options.level && options.level !== "all" && (!card.level || normalizePikkuLevel(card.language, card.level) !== options.level)) return false;
    if (options.partOfSpeech && options.partOfSpeech !== "all" && partOfSpeechOf(card) !== options.partOfSpeech) return false;
    if (options.index && options.index !== "all" && dictionaryIndex(card, order) !== options.index) return false;
    if (!query) return true;
    const en = localizeVocabularyCard(card, "en"), extra = dictionaryEnrichment[card.id];
    const headword = [card.term, ...(card.spellingVariants || [])];
    const reading = [readingOf(card), card.sourceReading, ...(card.readingVariants || []), ...(card.senses || []).map(sense => sense.reading), ...(extra?.senses || []).map(sense => sense.reading)];
    const meaning = [card.meaning, en.meaning, card.sourceMeaning, en.sourceMeaning,
      ...(card.senses || []).map(sense => sense.gloss), ...(en.senses || []).map(sense => sense.gloss),
      ...(extra?.senses || []).flatMap(sense => [sense.gloss["zh-CN"], sense.gloss.en])];
    const values = field === "headword" ? headword : field === "reading" ? reading : field === "meaning" ? meaning : [...headword, ...reading, ...meaning, ...(card.dictionary?.derivatives || [])];
    return values.some(value => value && dictionaryFold(value).includes(query));
  }).sort((a, b) => {
    const left = dictionaryFold(order === "reading" ? readingOf(a) || a.term : a.term);
    const right = dictionaryFold(order === "reading" ? readingOf(b) || b.term : b.term);
    return left.localeCompare(right) || a.id.localeCompare(b.id);
  });
}

export function dictionaryEntry(originalCard: VocabularyCard, locale: string) {
  const card = localizeVocabularyCard(originalCard, locale), extra = dictionaryEnrichment[card.id];
  const displayLocale = locale === "en" ? "en" : "zh-CN";
  let senses: DictionaryDisplaySense[];
  if (extra?.senses?.length) senses = extra.senses.map((sense, index) => ({ number: index + 1, gloss: sense.gloss[displayLocale], reading: sense.reading || card.reading || "", partOfSpeech: sense.partOfSpeech?.[displayLocale], source: sense.source }));
  else {
    const candidates = [{ reading: card.reading || "", gloss: card.meaning },
      ...(card.sourceMeaning && card.sourceMeaning !== card.meaning ? [{ reading: card.sourceReading || "", gloss: card.sourceMeaning }] : []), ...(card.senses || [])];
    const seen = new Set<string>();
    senses = candidates.filter(sense => { const key = `${sense.reading}:${sense.gloss}`; if (!sense.gloss || seen.has(key)) return false; seen.add(key); return true; })
      .map((sense, index) => ({ number: index + 1, reading: sense.reading, gloss: sense.gloss }));
  }
  const examples: DictionaryDisplayExample[] = (extra?.examples || []).map(example => ({ text: example.text, translation: example.translation?.[displayLocale], source: example.source, editorial: !example.source }));
  if (card.context && card.context.trim() !== card.term.trim() && !examples.some(example => example.text === card.context)) examples.push({ text: card.context, editorial: true });
  const etymology = (extra?.etymology || []).map(item => ({ text: item.text[displayLocale], source: item.source }));
  const references: DictionaryReference[] = [...publicDictionaryReferences(originalCard).map(reference => ({ ...reference, note: contentText(reference.note, locale) })),
    ...(extra?.references || []), ...senses.flatMap(sense => sense.source ? [sense.source] : []), ...examples.flatMap(example => example.source ? [example.source] : []), ...etymology.map(item => item.source)]
    .filter((reference, index, list) => /^https:\/\//.test(reference.url) && list.findIndex(other => other.url === reference.url && other.name === reference.name) === index);
  return { id: card.id, term: card.term, reading: card.reading || card.sourceReading || "", level: card.level ? normalizePikkuLevel(card.language, card.level) : "",
    partOfSpeech: card.partOfSpeech || (card.dictionary?.partOfSpeech && contentText(card.dictionary.partOfSpeech, locale)) || "",
    senses, examples, etymology, references, usageNotes: card.usageNotes || "", spellings: [...new Set(card.spellingVariants || [])].filter(value => value !== card.term),
    readings: [...new Set([...(card.readingVariants || []), card.sourceReading || "", ...(card.senses || []).map(sense => sense.reading), ...(extra?.senses || []).map(sense => sense.reading || "")].filter(Boolean))].filter(value => value !== card.reading) };
}
