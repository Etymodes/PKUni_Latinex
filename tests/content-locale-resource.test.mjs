import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "../scripts/build-wechat.mjs";

const load = createSourceLoader();
const { contentText, hasEnglishContent } = load("lib/content-locale.ts");
const { curriculumDomains, textbookCoverage } = load("data/curriculum.ts");
const { textbookCatalog, resourceChapterMappings, classicalAuthors, dictionarySources } = load("data/resources.ts");
const { languageConfigs } = load("data/languages.ts");
const { archiveEntries } = load("data/archive.ts");
const han = /\p{Script=Han}/u;
const targetVocabulary = "効率／精度／信頼性／効果";

function english(text, label, preserveTitle = false) {
  if (!text || !han.test(text)) return;
  assert(hasEnglishContent(text), `Missing translation: ${label}: ${text}`);
  const translated = contentText(text, "en");
  assert.notEqual(translated, text, `Untranslated description: ${label}`);
  assert(/[A-Za-z]/.test(translated), `Missing English prose: ${label}`);
  if (!preserveTitle) assert(!han.test(translated), `Chinese description remains: ${label}: ${translated}`);
  assert.equal(contentText(text, "zh-CN"), text, `Chinese source changed: ${label}`);
}

test("curriculum scope and all 75 textbook chapters have English descriptions", () => {
  assert.equal(textbookCoverage.length, 75);
  for (const domain of curriculumDomains) {
    for (const field of ["title", "authors", "examUse", "wheelock", "llpsi"]) english(domain[field], `${domain.level}.${field}`);
    for (const field of ["vocabulary", "morphology", "syntax", "patterns", "classics"]) {
      for (const [index, value] of domain[field].entries()) english(value, `${domain.level}.${field}[${index}]`);
    }
  }
  for (const unit of textbookCoverage) {
    for (const field of ["title", "topics", "stage"]) english(unit[field], `${unit.book}.${unit.chapter}.${field}`);
  }
});

test("resource descriptions, chapter mappings, author periods and genres have English content", () => {
  for (const book of textbookCatalog) {
    for (const field of ["authors", "edition", "language", "accessNote"]) english(book[field], `${book.id}.${field}`);
    for (const [level, value] of Object.entries(book.alignment)) english(value, `${book.id}.alignment.${level}`);
    for (const value of book.strengths) english(value, `${book.id}.strengths`);
  }
  for (const mapping of resourceChapterMappings) {
    for (const field of ["chapter", "exerciseLogic", "publicDomainStatus", "licenseNote"]) english(mapping[field], `${mapping.id}.${field}`);
    for (const field of ["grammarTargets", "vocabularyTargets"]) {
      for (const value of mapping[field]) {
        if (value === targetVocabulary) assert.equal(contentText(value, "en"), value, "Japanese study terms must remain unchanged");
        else english(value, `${mapping.id}.${field}`);
      }
    }
  }
  for (const author of classicalAuthors) {
    english(author.period, `${author.id}.period`);
    for (const genre of author.genres) english(genre, `${author.id}.genres`);
  }
  for (const dictionary of dictionarySources) {
    for (const field of ["scope", "access"]) english(dictionary[field], `${dictionary.id}.${field}`);
  }
});

test("language configuration and every archive entry have English explanatory copy", () => {
  for (const config of Object.values(languageConfigs)) {
    for (const field of ["name", "breadcrumb", "mascotCopy", "note"]) english(config[field], `${config.code}.${field}`);
  }
  assert.equal(archiveEntries.length, 10);
  for (const entry of archiveEntries) {
    english(entry.verified, `${entry.year}.verified`);
    english(entry.sourceLabel, `${entry.year}.sourceLabel`, entry.sourceLabel === "《拉丁语言文化研究》第 7 期");
  }
});

test("official resource titles and original-language learning material are preserved", () => {
  for (const book of textbookCatalog) assert.equal(contentText(book.title, "en"), book.title, book.id);
  for (const mapping of resourceChapterMappings) assert.equal(contentText(mapping.title, "en"), mapping.title, mapping.id);
  for (const author of classicalAuthors) {
    assert.equal(contentText(author.name, "en"), author.name, author.id);
    for (const work of author.works) assert.equal(contentText(work, "en"), work, `${author.id}.${work}`);
  }
  for (const dictionary of dictionarySources) assert.equal(contentText(dictionary.name, "en"), dictionary.name, dictionary.id);
  for (const config of Object.values(languageConfigs)) assert.equal(contentText(config.nativeName, "en"), config.nativeName, config.code);
  assert.equal(contentText("派生词常保存 lūc- 这一词干。", "en"), "The stem lūc- is retained in derivatives.");
  assert.equal(contentText("《拉丁语言文化研究》第 7 期", "en"), "《拉丁语言文化研究》, Issue 7");
});
