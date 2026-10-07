import assert from "node:assert/strict";
import test from "node:test";
import { addQuestionCollections, questionInCollection, questionForCollection } from "../data/question-collections.ts";
import { mergeVocabularyCollection, vocabularyInCollection, publicDictionaryReferences, vocabularyKey } from "../data/vocabulary.ts";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { compressedJsonLoaderSource } from "../scripts/build-wechat.mjs";
import vm from "node:vm";

const question = { id: "old", language: "ja", level: "F", category: "vocabulary", type: "choice",
  prompt: "文中の語を選ぶ", text: "値段が（　）した。", options: ["下落", "飛行", "存在", "信頼"], answer: 0,
  originalNumber: "語彙1", explanation: "Existing explanation", tags: ["original"], source: "Original exam", shuffleOptions: false };

test("a repeated exam item keeps its original ID, grade and explanation, with both occurrences and original option order", () => {
  const first = { id: "jlpt-1992-1", questions: [question] };
  const repeat = { ...question, id: "new", originalNumber: "問12", level: "G", options: ["信頼", "下落", "存在", "飛行"], answer: 1, explanation: "New explanation" };
  const result = addQuestionCollections([], [first, { id: "jlpt-1993-1", questions: [repeat] }]);
  assert.equal(result.questions.length, 1);
  const kept = result.questions[0];
  assert.equal(kept.id, "old"); assert.equal(kept.level, "F"); assert.equal(kept.explanation, "Existing explanation");
  assert.equal(result.aliases.new, "old"); assert.equal(kept.occurrences.length, 2);
  assert.ok(questionInCollection(kept, "jlpt-1992-1")); assert.ok(questionInCollection(kept, "jlpt-1993-1"));
  assert.ok(kept.tags.some(tag => tag.includes("1993")));
  const paper = questionForCollection(kept, "jlpt-1993-1");
  assert.equal(paper.id, "old"); assert.equal(paper.originalNumber, "問12"); assert.equal(paper.answer, 1);
  assert.equal(paper.shuffleOptions, false); assert.equal(paper.explanation, "New explanation");
  assert.deepEqual(paper.options, repeat.options); assert.deepEqual(kept.options, question.options);
  assert.equal(addQuestionCollections(result.questions, [{ id: "jlpt-1993-1", questions: [repeat] }]).questions.length, 1);
  assert.equal(question.occurrences, undefined, "Source files must not be mutated");
});

test("different passages, target context and answers do not silently collapse into a repeated item", () => {
  for (const changes of [{ prompt: "選択肢の反対の意味を選ぶ" }, { passage: "別の文章" }, { context: "別の下線語" }, { text: "別の問題文" }]) {
    assert.equal(addQuestionCollections([question], [{ id: "jlpt-1993-1", questions: [{ ...question, id: "different", ...changes }] }]).questions.length, 2);
  }
  assert.throws(() => addQuestionCollections([question], [{ id: "jlpt-1993-1", questions: [{ ...question, id: "different", answer: 1 }] }]), /Conflicting answers/);
});

test("same-word imports retain prior learning IDs and keys and union sources and useful senses", () => {
  const cards = [{ id: "known", language: "ja", term: "備わる", reading: "そなわる", meaning: "具备", context: "", level: "F", sourceCollections: ["jlpt-1992-1"], sourceQuestionIds: ["jlpt-1992-1-one"] }];
  const entry = { id: "incoming", lemma: "備わる", reading: "そなわる", gloss: "配备有", partOfSpeech: "动词", context: "設備が備わる。", sourceQuestionIds: ["ja-hlb1000-n1-u01-001"] };
  mergeVocabularyCollection(cards, [entry, entry], "ja-hlb1000-n1-u01");
  assert.equal(cards.length, 1); assert.equal(cards[0].id, "known"); assert.equal(vocabularyKey("ja", cards[0].term), "ja:備わる");
  assert.equal(cards[0].meaning, "具备"); assert.equal(cards[0].senses.length, 1);
  assert.equal(cards[0].sourceQuestionIds.length, 2);
  assert.ok(vocabularyInCollection(cards[0], "1992")); assert.ok(vocabularyInCollection(cards[0], "ja-hlb1000-n1-u01"));
  assert.equal(vocabularyInCollection(cards[0], "jlpt-1993-1"), false);
});

test("Japanese definitions expose real dictionary references only", () => {
  const dictionary = { name: "小学馆《デジタル大辞泉》", url: "https://kotobank.jp/word/example", note: "读音" };
  assert.deepEqual(publicDictionaryReferences({ language: "ja", dictionaryReferences: [dictionary,
    { name: "红蓝宝书", url: "https://example.com/book", note: "题页" },
    { name: "1993真题", url: "https://example.com/exam", note: "考试" },
    { name: "大辞泉", url: "javascript:alert(1)", note: "" }] }), [dictionary]);
});

test("native Brotli data is lossless for passages, definitions, Unicode and special property names", () => {
  const passage = '長い同じ文章。'.repeat(30);
  const data = { questions: [{ text: passage, options: [passage, "\\\"\n"] }, { text: passage }], vocabulary: [{ sourceNotes: passage }], empty: [], zero: 0, nil: null };
  const module = { exports: {} };
  const packed = brotliCompressSync(Buffer.from(JSON.stringify(data), 'utf16le'));
  vm.runInNewContext(compressedJsonLoaderSource(), { module, wx: { getFileSystemManager: () => ({ readCompressedFileSync: () => {
    const bytes = brotliDecompressSync(packed);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } }) } });
  assert.deepEqual(JSON.parse(JSON.stringify(module.exports('fixture'))), data);
  assert.ok(packed.byteLength < Buffer.byteLength(JSON.stringify(data)));
});

test("new spelling aliases within one import resolve to the same card and study key", () => {
  const cards = [];
  const first = { id: "meet", lemma: "出会う", reading: "であう", gloss: "遇见", partOfSpeech: "动词", context: "", spellingVariants: ["出逢う"], sourceQuestionIds: ["one"] };
  mergeVocabularyCollection(cards, [first, { ...first, id: "alternate", lemma: "出逢う", sourceQuestionIds: ["two"] }], "ja-hlb1000-n1-u01");
  assert.equal(cards.length, 1); assert.equal(cards[0].id, "meet"); assert.equal(cards[0].term, "出会う");
  assert.deepEqual(cards[0].sourceQuestionIds, ["one", "two"]);
});


test("imported secondary senses retain their reading-meaning pairs on new and existing words", () => {
  const cards = [{ id:"old",language:"ja",term:"大家",reading:"たいか",meaning:"大师",context:"旧例句" }];
  const entry = {id:"new",lemma:"大家",reading:"おおや",gloss:"房东",partOfSpeech:"名词",context:"新例句",sourceQuestionIds:["q"],senses:[{reading:"おおや",gloss:"出租房屋的人"},{reading:"たいか",gloss:"大师"}]};
  mergeVocabularyCollection(cards,[entry],"jlpt-1993-1");
  assert.equal(cards.length,1); assert.equal(cards[0].id,"old"); assert.equal(cards[0].reading,"たいか");
  assert.deepEqual(cards[0].senses.map(({reading,gloss})=>({reading,gloss})),[{reading:"おおや",gloss:"房东"},{reading:"おおや",gloss:"出租房屋的人"}]);
  const fresh=[]; mergeVocabularyCollection(fresh,[entry],"jlpt-1993-1");
  assert.equal(fresh[0].meaning,"房东"); assert.equal(fresh[0].senses.length,2);
});
