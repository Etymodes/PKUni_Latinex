import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSourceLoader } from "../scripts/build-wechat.mjs";

const load = createSourceLoader();
const { vocabularyCards, vocabularyKey } = load("data/vocabulary.ts");
const { dictionaryEnrichment } = load("data/dictionary-enrichment.ts");
const { localizeVocabularyCard } = load("lib/content-locale.ts");
const { dictionaryEntry } = load("lib/dictionary.ts");
const imported = JSON.parse(readFileSync(new URL("../data/n1-2000-vocabulary.json", import.meta.url), "utf8"));
const expected = {
  "lexicon-la-aqua": ["la", "aqua"],
  "lexicon-la-ferō": ["la", "ferō"],
  "ja-n1-list-254cc0af9f90": ["ja", "決め手"],
  "ja-n1-list-cefe81dd8db6": ["ja", "取り組み"],
  "en-us-c-seed-02": ["en-us", "hello"],
  "fr-starter-c-01": ["fr", "bonjour"],
  "ar-starter-f-01": ["ar", "مَوْعِد"],
};
const citations = entry => [
  ...(entry.references || []),
  ...(entry.senses || []).flatMap(item => item.source ? [item.source] : []),
  ...(entry.examples || []).flatMap(item => item.source ? [item.source] : []),
  ...(entry.etymology || []).map(item => item.source),
];
function bilingual(value, name) {
  assert.deepEqual(Object.keys(value).sort(), ["en", "zh-CN"], name);
  assert(value.en.trim() && value["zh-CN"].trim(), name);
  assert(/[A-Za-z]/.test(value.en), `${name}: English text`);
}

test("selected enrichment points to canonical cards without replacing IDs or claiming whole-bank verification", () => {
  assert.deepEqual(Object.keys(dictionaryEnrichment).sort(), Object.keys(expected).sort());
  assert(vocabularyCards.length > Object.keys(dictionaryEnrichment).length * 100);
  for (const [id, [language, term]] of Object.entries(expected)) {
    const matches = vocabularyCards.filter(card => card.id === id);
    assert.equal(matches.length, 1, id);
    assert.equal(matches[0].language, language, id);
    assert.equal(matches[0].term, term, id);
    assert.equal(vocabularyKey(language, term), `${language}:${term}`);
    assert.equal(Object.hasOwn(dictionaryEnrichment[id], "verified"), false);
    assert(dictionaryEnrichment[id].senses.length > 0, id);
  }
});

test("all selected senses, examples and etymologies have bilingual text and real dictionary links", () => {
  for (const [id, entry] of Object.entries(dictionaryEnrichment)) {
    for (const sense of entry.senses) {
      bilingual(sense.gloss, `${id}: sense`);
      if (sense.partOfSpeech) bilingual(sense.partOfSpeech, `${id}: part of speech`);
      assert(sense.source, `${id}: sense source`);
    }
    for (const example of entry.examples || []) {
      assert(example.text.trim(), id);
      bilingual(example.translation, `${id}: example translation`);
    }
    for (const item of entry.etymology || []) bilingual(item.text, `${id}: etymology`);
    for (const citation of citations(entry)) {
      assert(citation.name.trim(), id);
      const url = new URL(citation.url);
      assert.equal(url.protocol, "https:");
      assert(["en.wiktionary.org", "kotobank.jp", "www.etymonline.com"].includes(url.hostname), citation.url);
    }
    assert.doesNotMatch(JSON.stringify(entry), /JLPT|N1必背|1992|1993|sourceQuestionIds|sourcePages|PDF/);
  }
});

test("Wiktionary adaptations carry contributor attribution, revision links and share-alike licenses", () => {
  for (const entry of Object.values(dictionaryEnrichment)) {
    for (const citation of citations(entry)) {
      if (new URL(citation.url).hostname !== "en.wiktionary.org") continue;
      assert.match(citation.name, /Wiktionary contributors/);
      assert.match(citation.name, /adapted by Pikku|translation by Pikku/);
      assert.match(citation.url, /oldid=\d+/);
      assert.equal(citation.license, "CC BY-SA 4.0");
      assert.equal(citation.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
    }
  }
  const externalSummary = dictionaryEnrichment["en-us-c-seed-02"].etymology[0];
  assert.equal(externalSummary.source.url, "https://www.etymonline.com/word/hello");
  assert.equal(externalSummary.source.license, undefined, "Do not apply Wiktionary's license to Etymonline.");
});

test("verified short examples retain their text and original Japanese examples never become attributed quotations", () => {
  const expectedQuotes = {
    "lexicon-la-aqua": ["Lavō cum aquā."],
    "lexicon-la-ferō": ["Faustulo fuisse nomen ferunt"],
    "en-us-c-seed-02": ["Hello, everyone.", "Hello? Is anyone there?"],
    "fr-starter-c-01": ["Bonjour, mon ami !", "Tu passeras le bonjour à ta mère !"],
    "ar-starter-f-01": ["حَانَ مَوْعِدُ الرَّحِيلِ."],
  };
  for (const [id, texts] of Object.entries(expectedQuotes)) {
    assert.deepEqual(dictionaryEnrichment[id].examples.map(example => example.text), texts);
    assert(dictionaryEnrichment[id].examples.every(example => example.source));
  }
  for (const id of ["ja-n1-list-254cc0af9f90", "ja-n1-list-cefe81dd8db6"]) {
    assert(dictionaryEnrichment[id].examples.every(example => !example.source));
    assert.equal(dictionaryEnrichment[id].etymology, undefined, "No unsupported historical origin is invented.");
    const card = vocabularyCards.find(item => item.id === id);
    assert(dictionaryEntry(card, "en").examples.every(example => example.editorial));
  }
});

test("Japanese corrections reach both trainer glosses and source glosses while preserving identity and internal provenance", () => {
  const cases = [
    { id: "ja-n1-list-254cc0af9f90", term: "決め手", reading: "きめて", old: "决策者；决定性的方法", page: 15,
      meaning: "决定性因素；决定性手段或依据；最终作决定的人", english: /deciding factor.*final decision/, secondary: /最终作决定的人/ },
    { id: "ja-n1-list-cefe81dd8db6", term: "取り組み", reading: "とりくみ", old: "搭配，配合；成交", page: 68,
      meaning: "为解决问题所作的努力或措施；搭配、对阵（尤指相扑）；（金融）买卖双方的头寸关系或交易约定", english: /efforts.*sumo.*finance.*trade agreement/, secondary: /金融.*交易约定/ },
  ];
  for (const item of cases) {
    const source = imported.find(entry => entry.id === item.id);
    const card = vocabularyCards.find(entry => entry.id === item.id);
    assert.equal(source.gloss, item.meaning);
    assert(source.notes.includes(item.old), "Retain the imported wording only in internal provenance.");
    assert.equal(card.term, item.term);
    assert.equal(card.reading, item.reading);
    assert.equal(card.level, "G");
    assert.deepEqual(card.sourcePages, [item.page]);
    assert.equal(card.meaning, item.meaning);
    assert.equal(card.sourceMeaning, item.meaning);
    assert(!(card.senses || []).some(sense => sense.gloss === item.old));
    const english = localizeVocabularyCard(card, "en");
    assert.match(english.meaning, item.english);
    assert.equal(english.sourceMeaning, english.meaning);
    const entry = dictionaryEntry(card, "zh-CN");
    assert.match(entry.senses.map(sense => sense.gloss).join(" "), item.secondary);
    assert.doesNotMatch(JSON.stringify(entry), /原资料|内部溯源|N1必背|PDF/);
    assert(!JSON.stringify(entry).includes(item.old), "Old shorthand must not leak into the dictionary view.");
  }
});
