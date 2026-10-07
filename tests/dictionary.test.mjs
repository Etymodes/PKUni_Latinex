import assert from "node:assert/strict";
import test from "node:test";
import { vocabularyCards, vocabularyKey } from "../data/vocabulary.ts";
import { localizeVocabularyCard } from "../lib/content-locale.ts";
import { dictionaryEntry, dictionaryFacets, dictionaryFold, dictionaryIndex, searchDictionary } from "../lib/dictionary.ts";

const byId = id => { const card = vocabularyCards.find(item => item.id === id); assert(card, id); return card; };
const ids = values => values.map(value => value.id);

// Search normalizes a comparison value only: canonical spellings, readings and stats keys are untouched.
test("search accepts unvocalized Arabic, Latin without macrons and hiragana/katakana equivalents", () => {
  const cards = [
    { id: "arabic", language: "ar", level: "C", term: "كِتَاب", reading: "kitāb", meaning: "书", context: "" },
    { id: "latin", language: "la", level: "C", term: "amīcus", reading: "amīcus", meaning: "朋友", context: "" },
    { id: "japanese", language: "ja", level: "F", term: "兄弟", reading: "きょうだい", meaning: "兄弟姐妹", context: "" },
  ];
  const before = JSON.stringify(cards);
  for (const [language, query, field, id] of [["ar", "كتاب", "headword", "arabic"], ["la", "amicus", "headword", "latin"], ["ja", "キョウダイ", "reading", "japanese"], ["ja", "ｷｮｳﾀﾞｲ", "reading", "japanese"]]) {
    const found = searchDictionary(cards, { language, query, field });
    assert.deepEqual(ids(found), [id]);
    assert.equal(found[0], cards.find(card => card.id === id));
  }
  assert.equal(dictionaryFold("ĀMĪCUS"), "amicus");
  assert.equal(dictionaryFold("كِتَاب"), dictionaryFold("كتاب"));
  assert.equal(JSON.stringify(cards), before);
});

test("field searches include both interface languages but keep target headwords and readings separate", () => {
  const card = byId("ja-001");
  const english = localizeVocabularyCard(card, "en").meaning;
  assert.notEqual(english, card.meaning);
  for (const locale of ["zh-CN", "en"]) {
    for (const query of [card.meaning, english]) assert.deepEqual(ids(searchDictionary([card], { language: "ja", locale, field: "meaning", query })), [card.id]);
    assert.deepEqual(searchDictionary([card], { language: "ja", locale, field: "reading", query: english }), []);
    assert.deepEqual(searchDictionary([card], { language: "ja", locale, field: "headword", query: english }), []);
  }
});

test("real merged source readings remain searchable with the same canonical identity and learning key", () => {
  for (const [id, reading] of [["ja-1992-272bebb1b468", "ほどく"], ["ja-1992-1ed1c3abe2c0", "ほどける"]]) {
    const card = byId(id), before = JSON.stringify(card), key = vocabularyKey(card.language, card.term);
    assert.equal(card.sourceReading, reading);
    for (const field of ["reading", "all"]) {
      const found = searchDictionary(vocabularyCards, { language: "ja", field, query: reading });
      assert(found.includes(card), `${card.term}: ${reading} in ${field}`);
    }
    const entry = dictionaryEntry(card, "zh-CN");
    assert.equal(entry.id, id);
    assert.equal(vocabularyKey(card.language, entry.term), key);
    assert(entry.senses.some(sense => sense.reading === reading && sense.gloss === card.sourceMeaning));
    assert.equal(JSON.stringify(card), before);
  }
});

test("alternate readings preserve meaning pairs rather than assigning every meaning to the main reading", () => {
  const card = { id: "paired", language: "ja", level: "F", term: "人気", reading: "ひとけ", meaning: "人的气息", sourceReading: "にんき", sourceMeaning: "人气", senses: [{ reading: "にんき", gloss: "人气" }, { reading: "ひとけ", gloss: "人的气息" }], context: "", spellingVariants: ["人気", "ひとけ"] };
  const entry = dictionaryEntry(card, "zh-CN");
  assert.deepEqual(entry.senses.map(({ reading, gloss }) => [reading, gloss]), [["ひとけ", "人的气息"], ["にんき", "人气"]]);
  assert.deepEqual(entry.senses.map(sense => sense.number), [1, 2]);
  assert.deepEqual(entry.spellings, ["ひとけ"]);
  assert(entry.readings.includes("にんき"));
  assert.equal(searchDictionary([card], { language: "ja", field: "headword", query: "ひとけ" })[0], card);
});

test("facets and explicit dictionary level filters leave cumulative study levels and source batches untouched", () => {
  const cards = [
    { id: "a", language: "ja", level: "C", term: "学校", reading: "がっこう", meaning: "school", partOfSpeech: "名词", context: "", batch: "collection-a" },
    { id: "b", language: "ja", level: "F", term: "話す", reading: "はなす", meaning: "speak", partOfSpeech: "动词", context: "", batch: "collection-b" },
    { id: "c", language: "ja", level: "G", term: "概念", reading: "がいねん", meaning: "concept", partOfSpeech: "名词", context: "" },
    { id: "other", language: "la", level: "C", term: "aqua", meaning: "water", context: "" },
  ];
  const before = JSON.stringify(cards);
  assert.equal(dictionaryIndex(cards[0], "reading"), "か");
  assert.equal(dictionaryIndex(cards[0], "headword"), "漢字");
  assert.deepEqual(dictionaryFacets(cards, "ja", "reading").indices, ["か", "は"]);
  assert.deepEqual(new Set(dictionaryFacets(cards, "ja").partsOfSpeech), new Set(["名词", "动词"]));
  assert.deepEqual(ids(searchDictionary(cards, { language: "ja", level: "F" })), ["b"]);
  assert.deepEqual(ids(searchDictionary(cards, { language: "ja", partOfSpeech: "名词", order: "reading" })), ["c", "a"]);
  assert.equal(searchDictionary(cards, { language: "ja", level: "all" }).length, 3);
  assert.equal(JSON.stringify(cards), before);
});

test("dictionary additions do not replace shared levels, terms, IDs or learning-state keys", () => {
  const original = byId("fr-starter-c-01");
  const before = JSON.stringify(original), originalKey = vocabularyKey(original.language, original.term);
  for (const locale of ["zh-CN", "en"]) {
    const entry = dictionaryEntry(original, locale);
    assert(entry.senses.length > 1, "The entry gains detail without promoting the learning card.");
    assert.equal(entry.level, original.level);
    assert.equal(entry.id, original.id);
    assert.equal(entry.term, original.term);
    assert.equal(vocabularyKey(original.language, entry.term), originalKey);
  }
  assert.equal(JSON.stringify(original), before);
});

test("only sourced enrichment supplies etymology; import context is an unattributed study example", () => {
  const card = { id: "unverified-fixture", language: "ja", level: "F", term: "例", reading: "れい", meaning: "例子", context: "これは一つの例です。", notes: "PDF p. 1", dictionary: { pie: "invented historical origin" }, dictionaryReferences: [{ name: "小学館『大辞泉』", url: "https://kotobank.jp/word/example", note: "reference" }, { name: "N1 source PDF", url: "https://example.com/source.pdf", note: "imported source" }] };
  const entry = dictionaryEntry(card, "zh-CN");
  assert.deepEqual(entry.etymology, []);
  assert.deepEqual(entry.examples, [{ text: card.context, editorial: true }]);
  assert.equal(entry.references.length, 1);
  assert.equal(entry.references[0].name, "小学館『大辞泉』");
  assert.doesNotMatch(JSON.stringify(entry), /invented historical origin|N1 source PDF|PDF p/);
});

test("dictionary projection preserves distinct sources on one page and licenses for sourced material", () => {
  const japanese = dictionaryEntry(byId("ja-n1-list-cefe81dd8db6"), "en");
  const samePage = japanese.references.filter(source => source.url === "https://kotobank.jp/word/取組-585764");
  assert(samePage.some(source => source.name.includes("大辞泉")));
  assert(samePage.some(source => source.name.includes("日本国語大辞典")), "Two dictionaries hosted at one URL remain distinct attributions.");
  assert(japanese.examples.every(example => example.editorial && !example.source));
  assert.deepEqual(japanese.etymology, []);
  const latin = dictionaryEntry(byId("lexicon-la-ferō"), "en");
  const sourced = [...latin.senses.flatMap(sense => sense.source ? [sense.source] : []), ...latin.etymology.map(item => item.source), ...latin.examples.flatMap(example => example.source ? [example.source] : [])];
  assert(sourced.length >= 6);
  for (const source of sourced) {
    assert.equal(source.license, "CC BY-SA 4.0");
    assert.equal(source.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
    assert.match(source.url, /oldid=/);
  }
  assert(latin.examples.some(example => !example.editorial && example.source.name.includes("Livy")));
});

test("unfiltered dictionaries expose every canonical word for each language without rebuilding or mutating cards", () => {
  const before = JSON.stringify(vocabularyCards);
  const languages = [...new Set(vocabularyCards.map(card => card.language))];
  for (const language of languages) {
    const expected = vocabularyCards.filter(card => card.language === language);
    for (const order of ["headword", "reading"]) {
      const found = searchDictionary(vocabularyCards, { language, order });
      assert.equal(found.length, expected.length);
      assert.equal(new Set(ids(found)).size, expected.length);
      assert.deepEqual(new Set(ids(found)), new Set(ids(expected)));
      assert(found.every(card => vocabularyCards.includes(card)), "The selected object remains the shared canonical card.");
    }
  }
  assert.equal(JSON.stringify(vocabularyCards), before);
});
