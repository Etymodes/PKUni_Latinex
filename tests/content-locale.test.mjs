import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader, loadProjectData } from "../scripts/build-wechat.mjs";

const load = createSourceLoader();
const { questions, vocabularyCards, dictionarySources } = loadProjectData();
const { contentText, hasEnglishContent, localizeQuestion, localizeVocabularyCard } = load("lib/content-locale.ts");
const { vocabularyKey, publicDictionaryReferences } = load("data/vocabulary.ts");
const { questionForCollection } = load("data/question-collections.ts");
const han = /[\u3400-\u9fff]/;

// These tags are Japanese learning targets, not Chinese instructional labels.
// Keep the list explicit so a newly added untranslated Chinese tag cannot silently pass.
const japaneseTargetTags = new Set([
  "とは限らない", "効率", "精度", "信頼性", "効果", "怠る", "必須", "必修", "下落", "下降", "株価",
  "研ぐ", "濯ぐ", "漁船", "負かす", "負ける", "意地になる", "意図", "勇ましい", "利息", "利益",
  "粘る", "張る", "頑張る", "処分", "処置", "善処", "対処", "柱", "一家の柱", "大規模",
  "緻密", "密接", "濃密", "密着", "遠ざかる", "見送る", "にも増して", "に先立って", "接触", "接着",
  "指標", "棚上げ", "賃上げ", "値上げ", "仕上げ", "打ち解ける", "打ち明ける", "を限りに", "を境に",
  "否決", "貧血", "荘厳", "辞意", "表明する", "辞退", "固辞", "世辞", "揉める", "裂ける",
  "見るに堪えない", "に足りない", "お話しできる",
]);
const japaneseTargetOptionIds = new Set(["ja-n1-002", "ja-n1-003", "ja-n1-004"]);
const optionsAreTargets = question => question.language === "zh-mandarin"
  || question.id.startsWith("jlpt-") || question.id.startsWith("ja-hlb1000-")
  || japaneseTargetOptionIds.has(question.id);

function expectEnglish(original, translated, scope, id, field) {
  if (!original || !han.test(original)) return;
  const label = `${id}.${field}: ${original}`;
  assert(hasEnglishContent(original, scope), `Missing English mapping for ${label}`);
  assert.equal(typeof translated, "string", label);
  assert(translated.trim(), `Empty English content for ${label}`);
  assert.notEqual(translated, original, `Untranslated instructional content: ${label}`);
  assert(/[A-Za-z]/.test(translated), `English prose is absent: ${label}`);
}

function checkQuestionCopy(question, label = question.id) {
  const english = localizeQuestion(question, "en");
  for (const field of ["prompt", "explanation", "context", "source"]) {
    expectEnglish(question[field], english[field], "question", label, field);
  }
  if (question.language !== "zh-mandarin") {
    expectEnglish(question.modelAnswer, english.modelAnswer, "question", label, "modelAnswer");
  }
  for (const [index, text] of (question.distractorExplanations ?? []).entries()) {
    expectEnglish(text, english.distractorExplanations[index], "question", label, `distractorExplanations[${index}]`);
  }
  for (const [index, text] of question.tags.entries()) {
    if (question.language === "ja" && japaneseTargetTags.has(text)) {
      assert.equal(english.tags[index], text, `${label}: Japanese target tag`);
    } else {
      expectEnglish(text, english.tags[index], "question", label, `tags[${index}]`);
    }
  }
  for (const [index, image] of (question.images ?? []).entries()) {
    expectEnglish(image.alt, english.images[index].alt, "question", label, `images[${index}].alt`);
  }
  if (!optionsAreTargets(question)) {
    for (const [index, text] of (question.options ?? []).entries()) {
      expectEnglish(text, english.options[index], "question", label, `options[${index}]`);
    }
  }
}

test("all built-in question instructions, translations, sources, image labels and occurrence copies have English content", () => {
  assert(questions.length >= 844, "The complete built-in bank must be checked, not a small fixture.");
  for (const question of questions) {
    checkQuestionCopy(question);
    for (const occurrence of question.occurrences ?? []) {
      checkQuestionCopy(questionForCollection(question, occurrence.collectionId), `${question.id}@${occurrence.collectionId}`);
    }
  }
  const first1993 = questions.find(question => question.id === "jlpt-1993-1-vocab-I-1-1");
  assert(first1993);
  assert.equal(localizeQuestion(first1993, "en").prompt, "Choose the correct reading of the marked word.");
});

test("localizing questions preserves target texts, answer indices, option order and source identities without mutation", () => {
  const before = JSON.stringify(questions);
  const preserved = ["id", "language", "level", "type", "category", "skill", "answer", "text", "targetText", "latin",
    "passage", "transcript", "originalNumber", "shuffleOptions", "optionsInAudio", "audio", "occurrences", "provenance"];
  for (const question of questions) {
    assert.equal(localizeQuestion(question, "zh-CN"), question);
    const english = localizeQuestion(question, "en");
    for (const field of preserved) assert.deepEqual(english[field], question[field], `${question.id}.${field}`);
    if (optionsAreTargets(question)) assert.deepEqual(english.options, question.options, `${question.id}: target options`);
    if (question.language === "zh-mandarin") assert.equal(english.modelAnswer, question.modelAnswer, `${question.id}: Chinese target answer`);
    for (const [index, original] of (question.options ?? []).entries()) {
      if (!han.test(original)) assert.equal(english.options[index], original, `${question.id}: non-Chinese target option ${index}`);
    }
    if (question.options && new Set(question.options).size === question.options.length) {
      assert.equal(new Set(english.options).size, question.options.length, `${question.id}: English options must remain distinguishable`);
    }
    assert.deepEqual(english.images?.map(image => image.src), question.images?.map(image => image.src), `${question.id}: image assets`);
  }
  assert.equal(JSON.stringify(questions), before, "The canonical question bank must not be mutated.");
});

test("every built-in vocabulary meaning, sense, usage note and dictionary explanation has English content", () => {
  assert(vocabularyCards.length >= 3265, "Check the full shared dictionary and trainer bank.");
  for (const card of vocabularyCards) {
    const english = localizeVocabularyCard(card, "en");
    for (const field of ["meaning", "sourceMeaning", "usageNotes", "partOfSpeech"]) {
      expectEnglish(card[field], english[field], "vocabulary", card.id, field);
    }
    for (const [index, sense] of (card.senses ?? []).entries()) {
      expectEnglish(sense.gloss, english.senses[index].gloss, "vocabulary", card.id, `senses[${index}].gloss`);
    }
    for (const [index, reference] of (card.dictionaryReferences ?? []).entries()) {
      expectEnglish(reference.note, english.dictionaryReferences[index].note, "vocabulary", card.id, `dictionaryReferences[${index}].note`);
    }
    if (card.dictionary) {
      for (const field of ["pie", "gloss", "partOfSpeech"]) {
        expectEnglish(card.dictionary[field], english.dictionary[field], "vocabulary", card.id, `dictionary.${field}`);
      }
      for (const [index, derivative] of card.dictionary.derivatives.entries()) {
        expectEnglish(derivative, english.dictionary.derivatives[index], "vocabulary", card.id, `dictionary.derivatives[${index}]`);
      }
    }
  }
});

test("vocabulary localization preserves learning keys, reading-sense pairs, target examples and official dictionary names", () => {
  const before = JSON.stringify(vocabularyCards);
  const preserved = ["id", "language", "level", "term", "reading", "readingVariants", "spellingVariants", "context",
    "sourceReading", "sourceQuestionIds", "sourcePages", "sourceCollections"];
  for (const card of vocabularyCards) {
    assert.equal(localizeVocabularyCard(card, "zh-CN"), card);
    const english = localizeVocabularyCard(card, "en");
    for (const field of preserved) assert.deepEqual(english[field], card[field], `${card.id}.${field}`);
    assert.equal(vocabularyKey(english.language, english.term), vocabularyKey(card.language, card.term), `${card.id}: saved learning key`);
    assert.deepEqual(english.senses?.map(sense => ({ ...sense, gloss: undefined })),
      card.senses?.map(sense => ({ ...sense, gloss: undefined })), `${card.id}: readings stay paired with the same senses`);
    assert.deepEqual(english.dictionaryReferences?.map(reference => ({ ...reference, note: undefined })),
      card.dictionaryReferences?.map(reference => ({ ...reference, note: undefined })), `${card.id}: official names, URLs and verification metadata`);
    const officialIdentity = reference => ({ name: reference.name, url: reference.url });
    assert.deepEqual(publicDictionaryReferences(english).map(officialIdentity),
      publicDictionaryReferences(card).map(officialIdentity), `${card.id}: official-reference filtering`);
    if (card.dictionary) {
      for (const field of ["language", "lemma", "principalParts", "dictionaryStatus", "reviewStatus"]) {
        assert.deepEqual(english.dictionary[field], card.dictionary[field], `${card.id}: dictionary.${field}`);
      }
    }
  }
  assert.equal(JSON.stringify(vocabularyCards), before, "The canonical vocabulary bank must not be mutated.");
});

test("legacy vocabulary measurements and language facts have English instructional content", () => {
  const labItems = [
    ...load("data/curriculum.ts").vocabItems,
    ...load("data/complete-bank.ts").completeVocabItems,
    ...load("data/multilingual-seeds.ts").multilingualVocabItems,
  ];
  assert(labItems.length > 100);
  for (const item of labItems) {
    for (const field of ["gloss", "family"]) {
      expectEnglish(item[field], contentText(item[field], "en"), "all", item.lemma, `lab.${field}`);
    }
    for (const [index, text] of item.distractors.entries()) {
      expectEnglish(text, contentText(text, "en"), "all", item.lemma, `lab.distractors[${index}]`);
    }
  }
  for (const facts of Object.values(load("data/language-facts.ts").languageFacts)) {
    for (const fact of facts) {
      for (const field of ["kind", "title", "summary"]) {
        expectEnglish(fact[field], contentText(fact[field], "en"), "all", fact.id, field);
      }
    }
  }
  for (const source of dictionarySources) {
    for (const field of ["scope", "access"]) {
      expectEnglish(source[field], contentText(source[field], "en"), "all", source.id, field);
    }
  }
});

test("Japanese choices cannot collide with dictionary glosses and unknown external content stays intact", () => {
  const japanese = {
    id: "jlpt-test-projection", language: "ja", prompt: "选择标注词语的正确读音。",
    explanation: "Unknown user-supplied explanation", tags: [], source: "Unknown source",
    text: "学生の生活", options: ["学生", "生活", "结果", "条件"], answer: 1,
  };
  assert.notEqual(contentText("学生", "en"), "学生", "The fixture must exercise a real mapping collision.");
  assert.deepEqual(localizeQuestion(japanese, "en").options, japanese.options);
  assert.equal(localizeQuestion(japanese, "en").text, japanese.text);
  assert.equal(localizeQuestion(japanese, "en").explanation, japanese.explanation);
  assert.equal(contentText("自定义尚未收录的内容 Ω", "en"), "自定义尚未收录的内容 Ω");
});
