import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { contentText, localizeVocabularyCard } from "../lib/content-locale.ts";
import { vocabularyLevelsFor, publicDictionaryReferences, vocabularyCards as canonicalCards } from "../data/vocabulary.ts";
import { dictionaryEntry, dictionaryFacets, searchDictionary } from "../lib/dictionary.ts";

import { getCopy, getLearningLanguage } from "../app/i18n.ts";
import { matchesLevel } from "../data/questions.ts";
import { buildRandomExam, buildVocabularyMeasurement } from "../lib/study-modes.ts";

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/vocabulary-model.ts", import.meta.url), "utf8"))).toString("base64")}`);
const source = fs.readFileSync(new URL("../app/vocabulary-workspace.tsx", import.meta.url), "utf8");
const code = compile(source.replace(/^import .*;\r?$/gm, "").replace(/^export /gm, ""));
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const lab = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === "VocabularyLab");
const exam = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === "ExamMode");
const at = day => new Date(Date.UTC(2026, 0, day, 12)).toISOString();
const plain = value => JSON.parse(JSON.stringify(value));
const cards = [
  { id: "both", language: "ja", level: "F", term: "合同", reading: "ごうどう", meaning: "联合", context: "合同で調査する。", batch: "1992 · 旧1級", sourceQuestionIds: ["question-1"], sourcePages: [5], sourceReading: "ごうどう", sourceMeaning: "合并；共同", notes: "1992 原卷 question-1", sourceNotes: "2000词 PDF 原页 5", usageNotes: "词义用法提示", dictionaryReferences: [{ name: "小学馆《大辞泉》", url: "https://kotobank.jp/word/example", note: "已核对读音" }], dictionary: { reviewStatus: "reviewed", batch: "1992 · 旧1級", derivatives: [], dictionaryStatus: {}, pie: "待核" } },
  { id: "pdf", language: "ja", level: "C", term: "日向", spellingVariants: ["日向", "日なた"], readingVariants: ["ヒナタ"], reading: "ひなた", meaning: "向阳处", context: "", sourcePages: [9, 15], senses: [{ reading: "ひなた", gloss: "向阳处", sourcePages: [9] }, { reading: "ひゅうが", gloss: "旧国名日向", sourcePages: [15] }] },
  { id: "exam", language: "ja", level: "G", term: "躊躇", reading: "ちゅうちょ", meaning: "犹豫", context: "", sourceQuestionIds: ["question-2"], batch: "1992 · 旧1級" },
  { id: "latin", language: "la", level: "C", term: "casa", meaning: "房屋", context: "", dictionary: { reviewStatus: "published", batch: "foundation", pie: "Latin origin", derivatives: ["case"], dictionaryStatus: { old: "已核", ls: "待核" } } },
];
const review = (id = "past", lemma = "合同") => model.completeVocabularyReview(model.makePrediction([], "ja", lemma, at(2), "word", undefined, at(2)), "remembered", at(2), id);
function nodes(tree) { return tree && typeof tree === "object" ? [tree, ...(tree.children ?? []).flat(Infinity).flatMap(nodes)] : []; }
function content(tree) { return tree == null || tree === false ? "" : typeof tree !== "object" ? String(tree) : (tree.children ?? []).flat(Infinity).map(content).join(" "); }

// Execute the real components and callback closures with a small synchronous hooks host.
// Effects and memo dependencies survive rerenders, so frozen predictions are tested as state.
function harness(component = "VocabularyTrainer", props = {}, entries = cards, { strictEffects = false } = {}) {
  const slots = []; let cursor = 0, dirty = true, effects = [], tree, sequence = 0, focused;
  const animationFrames = [];
  let didReplayMountEffects = false;
  const predictions = [], accepted = [];
  const c = {
    contentText, localizeVocabularyCard, vocabularyCards: cards, dictionaryEntries: entries, vocabularyLevelsFor, publicDictionaryReferences, dictionaryEntry, dictionaryFacets, searchDictionary,
    dictionarySources: [{ id: "old", name: "Oxford Latin Dictionary", scope: "Latin", access: "Print" }, { id: "ls", name: "Lewis & Short", scope: "Latin", access: "Public domain" }],
    vocabularyKey: (language, term) => `${language}:${term}`,
    vocabularyMatchesLevel: (card, level) => card.level && ["C", "F", "G", "M"].indexOf(card.level) <= ["C", "F", "G", "M"].indexOf(level),
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [at(10)])); } static now() { return new Date(at(10)).getTime(); } },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    trainVocabularyModel: model.trainVocabularyModel,
    makePrediction(...args) { const prediction = model.makePrediction(...args); predictions.push(prediction); return prediction; },
    completeVocabularyReview: (prediction, outcome) => model.completeVocabularyReview(prediction, outcome, at(10), `event-${++sequence}`),
    requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; },
    React: { Fragment: "fragment", createElement: (type, props, ...children) => {
      if (typeof type === "function") return type({ ...props, children });
      const node = { type, props: props ?? {}, children, focus() { focused = node; } };
      return node;
    } },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => {
        const next = typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(slots[index].value, next)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(compute, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) slots[index] = { value: compute(), deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) { slots[index] = { deps }; effects.push(effect); }
    },
  };
  for (const icon of ["BookOpen", "CheckCircle2", "Search", "Settings", "XCircle", "Shuffle", "TargetKicker", "EmptyState", "Languages", "Trophy", "TimerReset", "Landmark", "BarChart3", "Clock3", "FileText", "ArrowRight", "RotateCcw", "ArrowLeft", "Check", "QuestionCard"]) c[icon] = icon;
  vm.createContext(c); vm.runInContext(code, c);
  c.buildVocabularyMeasurement = buildVocabularyMeasurement;
  c.buildRandomExam = buildRandomExam; c.matchesLevel = matchesLevel; c.LEVEL_ORDER = ["C", "F", "G", "M"];
  c.window = { setInterval: () => 1, clearInterval() {} }; c.formatTime = seconds => String(seconds);
  if (component === "VocabularyLab") c.vocabularyCards = [cards[0], { ...cards[2], meaning: "分裂" }];
  c.useI18n = () => component === "ExamMode"
    ? ({ copy: getCopy(current.locale), language: getLearningLanguage(current.language), locale: current.locale })
    : ({ copy: { vocabularyRound: () => "Round", vocabularyEstimate: () => "Estimate", submitMeasure: "Submit" }, language: { id: current.language, htmlLang: current.language }, locale: current.locale });
  c.normalizePikkuLevel = (_, level) => level; c.levelName = (_, level) => level; c.shuffle = items => [...items];
  vm.runInContext(compile(lab.getText(ast) + "\n" + exam.getText(ast)), c);
  const current = { language: "ja", locale: component === "VocabularyLab" ? "zh-CN" : "en", level: "F", mode: "word", stats: {}, reviews: [], owner: "guest", ready: true, focusId: "both", onReview(event) { accepted.push(event); return true; }, onDictionary() {}, onSettings() {}, onPractice() {}, ...props };
  function render(update) {
    if (update) Object.assign(current, update);
    let passes = 0;
    do {
      dirty = false; cursor = 0; effects = []; tree = c[component](current);
      for (const node of nodes(tree)) if (node.props.ref && typeof node.props.ref === "object") node.props.ref.current = node;
      const cleanups = effects.map(effect => effect());
      if (strictEffects && !didReplayMountEffects) {
        // React StrictMode replays the same committed setup closures with refs/state retained.
        // Cleanup and setup happen before processing their queued state updates.
        cleanups.forEach(cleanup => { if (typeof cleanup === "function") cleanup(); });
        effects.forEach(effect => effect());
        didReplayMountEffects = true;
      }
      assert(++passes < 15, "component effects must settle");
    } while (dirty);
    animationFrames.splice(0).forEach(callback => callback());
    return tree;
  }
  render();
  return { props: current, c, predictions, accepted, render, tree: () => tree, focused: () => focused,
    find: predicate => nodes(tree).find(predicate),
    button: text => nodes(tree).find(node => node.type === "button" && content(node).includes(text)),
    select: label => nodes(tree).find(node => node.type === "label" && typeof node.children[0] === "string" && node.children[0] === label)?.children.find(child => child?.type === "select"),
    input: type => nodes(tree).find(node => node.type === "input" && node.props.type === type),
    change(select, value) { select.props.onChange({ target: { value } }); render(); },
    click(button) { assert(button, "button exists"); assert(!button.props.disabled, "button is enabled"); button.props.onClick({ currentTarget: button }); render(); },
  };
}

function resultIds(h) {
  return nodes(h.find(node => node.props.className === "dictionary-results"))
    .filter(node => node.type === "button" && node.props.key).map(node => node.props.key);
}
function searchField(h) { return h.find(node => node.type === "select" && node.props["aria-label"] === "Search field"); }

test("dictionary separates a canonical entry list from one detail, with kana/headword indices and explicit level filters", () => {
  const h = harness("VocabularyDictionary", { focusId: undefined });
  assert.deepEqual(resultIds(h), searchDictionary(cards, { language: "ja", order: "reading" }).map(card => card.id));
  assert.equal(nodes(h.tree()).filter(node => node.type === "article" && node.props.id).length, 1, "Do not render every card as a detail wall.");
  assert.doesNotMatch(content(h.tree()), /1992|2000|PDF|question-1|question-2|pages|foundation/);
  assert.match(content(h.tree()), /小学馆《大辞泉》.*已核对读音/);
  assert.match(content(h.tree()), /词义用法提示/);
  for (const internalFilter of ["Source", "Collection", "Content status"]) assert.equal(h.select(internalFilter), undefined);
  h.click(h.find(node => node.type === "button" && node.props.key === "は"));
  assert.deepEqual(resultIds(h), ["pdf"]);
  h.change(h.select("Index order"), "headword");
  h.click(h.button("Han characters"));
  assert.equal(resultIds(h).length, 3);
  h.change(h.select("Level"), "G");
  assert.deepEqual(resultIds(h), ["exam"], "Dictionary level filters are explicit; trainer levels remain cumulative.");
  h.click(h.button("Reset"));
  assert.equal(resultIds(h).length, 3);
  assert.equal(h.accepted.length, 0, "Looking up and filtering never emits learning feedback.");
});

test("dictionary searches Chinese and English meanings independently of interface locale and respects the selected field", () => {
  const entries = canonicalCards.filter(card => ["ja-001", "ja-002", "ja-003"].includes(card.id));
  assert.equal(entries.length, 3);
  const h = harness("VocabularyDictionary", { focusId: undefined, locale: "en" }, entries);
  h.change(searchField(h), "meaning");
  h.change(h.input("search"), "student");
  assert.deepEqual(resultIds(h), ["ja-001"]);
  h.render({ locale: "zh-CN" });
  assert.deepEqual(resultIds(h), ["ja-001"], "English search survives switching display language.");
  h.change(h.input("search"), "学生");
  assert.deepEqual(resultIds(h), ["ja-001"]);
  h.render({ locale: "en" });
  h.change(searchField(h), "headword");
  h.change(h.input("search"), "student");
  assert.deepEqual(resultIds(h), []);
  assert.match(content(h.tree()), /No matching entries/);
  assert.equal(h.find(node => node.type === "article"), undefined);
  h.change(h.input("search"), "食べる");
  assert.deepEqual(resultIds(h), ["ja-002"]);
});

test("alternate readings retain their paired senses, canonical practice ID and existing learning key", () => {
  const practised = [];
  const h = harness("VocabularyDictionary", { focusId: undefined, stats: { "ja:日向": { seen: 3, correct: 2 } }, onPractice: id => practised.push(id) });
  h.change(searchField(h), "reading"); h.change(h.input("search"), "ひゅうが");
  const article = h.find(node => node.type === "article" && node.props.id);
  assert.equal(article.props.id, "word-pdf");
  const meanings = nodes(article).filter(node => node.type === "li").map(content);
  assert(meanings.some(text => /ひゅうが.*旧国名日向/.test(text)));
  assert.match(content(article), /Reviewed 3/); assert.doesNotMatch(content(article), /pages|PDF|2000/);
  h.click(h.find(node => node.type === "button" && node.props.key === "pdf"));
  assert.match(h.find(node => node.props.className?.startsWith("dictionary-layout")).props.className, /has-selection/);
  assert.equal(h.focused()?.type, "h2");
  assert.equal(h.focused()?.props.tabIndex, -1);
  assert.equal(content(h.focused()), "日向", "Opening a detail moves keyboard focus out of the now-hidden mobile list.");
  h.click(h.button("Practise this word")); assert.deepEqual(practised, ["pdf"]);
  assert.match(content(article), /Other spellings.*日なた/);
  h.click(h.button("Back to entries"));
  assert.doesNotMatch(h.find(node => node.props.className?.startsWith("dictionary-layout")).props.className, /has-selection/);
  assert.equal(h.focused()?.props.key, "pdf", "Returning restores focus to the chosen canonical entry.");
  h.change(searchField(h), "headword"); h.change(h.input("search"), "日なた");
  assert.deepEqual(resultIds(h), ["pdf"]);
  h.change(searchField(h), "reading"); h.change(h.input("search"), "ヒナタ");
  assert.deepEqual(resultIds(h), ["pdf"]);
});

test("dictionary pagination exposes every canonical card exactly once and resets after filtering", () => {
  const entries = Array.from({ length: 95 }, (_, i) => ({ id: `page-${i}`, language: "ja", level: i % 2 ? "F" : "G", term: `単語${String(i).padStart(3, "0")}`, reading: `たんご${i}`, meaning: `meaning ${i}`, context: "" }));
  const before = JSON.stringify(entries);
  const h = harness("VocabularyDictionary", { focusId: undefined }, entries);
  assert.equal(resultIds(h).length, 40);
  h.click(h.button("Show more entries")); assert.equal(resultIds(h).length, 80);
  h.click(h.button("Show more entries")); assert.equal(resultIds(h).length, 95);
  assert.equal(h.button("Show more entries"), undefined);
  assert.equal(new Set(resultIds(h)).size, 95);
  assert.deepEqual(resultIds(h), searchDictionary(entries, { language: "ja", order: "reading" }).map(card => card.id));
  h.change(h.select("Level"), "F");
  assert.equal(resultIds(h).length, 40);
  h.click(h.button("Show more entries")); assert.equal(resultIds(h).length, 47);
  h.click(h.button("Reset")); assert.equal(resultIds(h).length, 40);
  assert.equal(JSON.stringify(entries), before);
});

test("dictionary sources are citations, never attribution for unrelated study context or unsupported legacy etymology", () => {
  const h = harness("VocabularyDictionary", { focusId: "both" });
  const figure = h.find(node => node.type === "figure");
  assert.match(content(figure), /合同で調査する。.*Study example/);
  assert.equal(nodes(figure).filter(node => node.type === "a").length, 0, "A dictionary reference does not turn a study sentence into a dictionary quote.");
  const sources = h.find(node => node.props.className === "dictionary-reference-list");
  assert.match(content(sources), /小学馆《大辞泉》/);
  assert(nodes(sources).some(node => node.type === "a" && node.props.href === "https://kotobank.jp/word/example"));
  const latin = harness("VocabularyDictionary", { language: "la", focusId: undefined });
  assert.match(content(latin.tree()), /No sourced etymology has been added yet/);
  assert.doesNotMatch(content(latin.tree()), /Latin origin|OLD.*Verified|LS.*Pending|foundation/);
  assert.match(content(latin.tree()), /Dictionary citations have not been added yet/);
});

test("selected sourced entries render numbered meanings, authentic attribution and a separate license link", () => {
  const card = canonicalCards.find(card => card.id === "lexicon-la-ferō"); assert(card);
  const h = harness("VocabularyDictionary", { language: "la", focusId: card.id }, [card]);
  const senses = h.find(node => node.props.className === "dictionary-senses");
  assert(nodes(senses).filter(node => node.type === "li").length >= 4);
  const quote = h.find(node => node.type === "figure" && content(node).includes("Faustulo"));
  assert.match(content(quote), /Livy, Ab urbe condita 1.4/);
  assert.doesNotMatch(content(quote), /Study example/);
  const links = nodes(quote).filter(node => node.type === "a");
  assert(links.some(node => node.props.href.includes("oldid=")));
  assert(links.some(node => node.props.href === "https://creativecommons.org/licenses/by-sa/4.0/" && content(node) === "CC BY-SA 4.0"));
  assert(links.every(node => node.props.target === "_blank" && node.props.rel === "noopener noreferrer"));
});

test("trainer uses one cumulative bank and reveals alternate senses only after revealing the answer", () => {
  const h = harness();
  assert(!content(h.tree()).includes("合并；共同"));
  assert(!content(h.tree()).includes("ごうどう"));
  assert.equal(h.select("Vocabulary scope"), undefined);
  assert.match(content(h.tree()), /One vocabulary bank.*C · F/);
  h.click(h.button("Reveal meaning"));
  assert.match(content(h.tree()), /合并；共同/);
  const meaning = h.find(node => node.props.className === "vocab-reveal");
  assert.doesNotMatch(content(meaning), /1992|2000|PDF|question-1|pages/);
  assert.match(content(meaning), /小学馆《大辞泉》.*已核对读音/);
  h.change(h.find(node => node.type === "input" && node.props["aria-label"] === "Filter cards"), "日向");
  assert.equal(h.find(node => node.type === "h2").children[0], "日向");
  assert(!content(h.tree()).includes("ひゅうが"));
  h.click(h.button("Reveal meaning")); assert.match(content(h.tree()), /旧国名日向/);
});

test("feedback retains the frozen before-answer prediction despite history refresh/date exploration and cannot submit a stale button twice", () => {
  const h = harness();
  const before = h.predictions.find(prediction => prediction.lemma === "合同" && prediction.targetAt === prediction.predictedAt);
  h.render({ reviews: [review()] });
  h.click(h.button("Reveal meaning"));
  h.change(h.input("date"), "2030-01-01");
  const explored = h.predictions.at(-1);
  assert(explored.targetAt.startsWith("2030-01-01")); assert(explored.features[1] > before.features[1]);
  const callback = h.button("Remembered").props.onClick;
  callback(); callback(); h.render();
  assert.equal(h.accepted.length, 1);
  assert.equal(h.accepted[0].outcome, "remembered");
  assert.equal(h.accepted[0].probability, before.probability);
  assert.deepEqual(h.accepted[0].features, before.features);
  assert.equal(h.accepted[0].targetAt, before.predictedAt, "actual feedback never labels the future forecast");
  assert(h.button("Reveal meaning"), "the next card starts hidden");
});

test("declined or account-switch feedback does not advance the card, and cold-date forecasts disclose missing timed history", () => {
  let accepted = false, calls = 0;
  const h = harness("VocabularyTrainer", { onReview() { calls++; return accepted; } });
  h.click(h.button("Reveal meaning"));
  assert.match(content(h.tree()), /no dated feedback yet/);
  const currentForecast = h.predictions.at(-1); h.change(h.input("date"), "2030-01-01");
  assert.equal(h.predictions.at(-1).probability, currentForecast.probability);
  h.click(h.button("Forgotten"));
  assert.equal(calls, 1); assert(h.button("Forgotten"), "rejected feedback leaves the answer visible");
  accepted = true; h.click(h.button("Forgotten")); assert.equal(calls, 2); assert(h.button("Reveal meaning"));
  h.render({ ready: false }); h.click(h.button("Reveal meaning"));
  const disabled = h.button("Forgotten"); assert.equal(disabled.props.disabled, true);
  disabled.props.onClick(); assert.equal(calls, 2, "a stale invocation cannot write during owner changes");
});

test("legacy measurement waits for accepted persistence and records one result per rendered test", () => {
  let allow = false; const submissions = [];
  const h = harness("VocabularyLab", { onSubmit: answers => { submissions.push(plain(answers)); return allow; } });
  h.click(h.button("联合")); h.click(h.button("Submit"));
  assert(h.button("Submit"), "a refused save does not show a completed result");
  allow = true; const callback = h.button("Submit").props.onClick; callback(); callback(); h.render();
  assert.equal(submissions.length, 2); assert.deepEqual(submissions[1], [{ lemma: "合同", correct: true }]);
  assert(!h.button("Submit"));
});

test("approximate is the middle feedback state, saved once and shown distinctly in the linked dictionary", () => {
  const h = harness("VocabularyTrainer", { locale: "zh-CN" });
  h.click(h.button("显示释义"));
  const feedback = h.find(node => node.props["aria-label"] === "记忆反馈");
  const buttons = feedback.children.filter(node => node?.type === "button");
  assert.deepEqual(buttons.map(button => content(nodes(button).find(node => node.type === "strong"))), ["忘了", "近似", "记得"]);
  assert.match(content(buttons[1]), /近似.*有印象，但词义有偏差/);
  const frozen = h.predictions.find(prediction => prediction.lemma === "合同" && prediction.targetAt === prediction.predictedAt);
  const submit = buttons[1].props.onClick; submit(); submit(); h.render();
  assert.equal(h.accepted.length, 1);
  assert.equal(h.accepted[0].outcome, "approximate");
  assert.deepEqual(h.accepted[0].probabilities, frozen.probabilities);
  const stats = h.find(node => node.props["aria-label"] === "背词统计");
  assert.match(content(stats).replace(/\s+/g, " "), /记得 0 · 近似 1 · 忘了 0/);
  const dictionary = harness("VocabularyDictionary", { locale: "zh-CN", focusId: "both", stats: { "ja:合同": { seen: 1, correct: 0 } }, reviews: h.accepted });
  assert.match(content(dictionary.tree()), /已练 1 · 记得 0 · 近似 1.*最近: 近似/);
  assert.doesNotMatch(content(dictionary.tree()), /最近: 忘了/);
});


test("context preference uses the actual displayed mode for frozen predictions, forecasts and feedback", () => {
  for (const [focusId, expectedMode, indicator] of [["pdf", "word", 0], ["both", "context", 1]]) {
    const h = harness("VocabularyTrainer", { mode: "context", focusId });
    const current = h.predictions.find(prediction => prediction.lemma === cards.find(card => card.id === focusId).term && prediction.targetAt === prediction.predictedAt);
    assert.equal(current.mode, expectedMode); assert.equal(current.features[5], indicator);
    const article = h.find(node => node.props.className === "adaptive-vocab-card");
    assert(content(article).includes(indicator ? "Word and context" : "Word only"));
    assert.equal(Boolean(h.find(node => node.props.className === "vocab-context")), Boolean(indicator));
    h.click(h.button("Reveal meaning")); h.change(h.input("date"), "2030-01-01");
    assert.equal(h.predictions.at(-1).mode, expectedMode); assert.equal(h.predictions.at(-1).features[5], indicator);
    h.click(h.button("Remembered"));
    assert.equal(h.accepted[0].mode, expectedMode); assert.equal(h.accepted[0].features[5], indicator);
  }
});

test("switching the interface locale preserves the current word, reveal state and frozen prediction", () => {
  const h = harness("VocabularyTrainer", { locale: "zh-CN" });
  const before = h.predictions.find(prediction => prediction.lemma === "合同" && prediction.targetAt === prediction.predictedAt);
  assert(before);
  h.click(h.button("显示释义"));
  h.change(h.input("date"), "2030-01-01");
  const predictionCount = h.predictions.length;
  h.render({ locale: "en" });
  assert.equal(h.find(node => node.type === "h2").children[0], "合同");
  assert(h.button("Approximate"), "The same card remains revealed with English feedback controls.");
  assert.equal(h.input("date").props.value, "2030-01-01");
  assert.equal(h.predictions.length, predictionCount, "Locale changes do not recompute a frozen prediction or forecast.");
  assert.equal(h.accepted.length, 0);
  h.render({ locale: "zh-CN" });
  assert(h.button("近似"));
  assert.equal(h.find(node => node.type === "h2").children[0], "合同");
  assert.equal(h.predictions.length, predictionCount);
  h.render({ locale: "en" });
  const submit = h.button("Approximate").props.onClick;
  submit(); submit(); h.render();
  assert.equal(h.accepted.length, 1);
  assert.equal(h.accepted[0].outcome, "approximate");
  assert.equal(h.accepted[0].lemma, "合同", "Feedback retains the canonical learning key.");
  assert.deepEqual(h.accepted[0].features, before.features);
  assert.deepEqual(h.accepted[0].probabilities, before.probabilities);
  assert.equal(h.accepted[0].targetAt, before.predictedAt, "Exploring a future date never labels that forecast as an actual review.");
});

test("StrictMode setup replay preserves the requested dictionary word and its original before-answer prediction", () => {
  // Math.random() selects 合同; requesting 日向 must survive the second effect setup.
  const h = harness("VocabularyTrainer", { level: "F", focusId: "pdf" }, cards, { strictEffects: true });
  assert.equal(h.find(node => node.type === "h2").children[0], "日向");
  const draws = h.predictions.filter(prediction => prediction.targetAt === prediction.predictedAt);
  assert.equal(draws.length, 2, "The two eligible words are predicted exactly once; replay cannot draw again.");
  const frozen = draws.find(prediction => prediction.lemma === "日向"); assert(frozen);
  const totalPredictions = h.predictions.length;
  h.render({ reviews: [review()], locale: "zh-CN" });
  h.click(h.button("显示释义"));
  assert.equal(h.find(node => node.type === "h2").children[0], "日向");
  assert.equal(h.predictions.filter(prediction => prediction.targetAt === prediction.predictedAt).length, 2, "History/locale refresh never replaces a committed draw.");
  assert(h.predictions.length >= totalPredictions, "Only the separately displayed forecast may be refreshed.");
  const submit = h.button("近似").props.onClick;
  submit(); submit(); h.render();
  assert.equal(h.accepted.length, 1);
  assert.equal(h.accepted[0].lemma, "日向");
  assert.deepEqual(h.accepted[0].features, frozen.features);
  assert.deepEqual(h.accepted[0].probabilities, frozen.probabilities);
  assert.equal(h.accepted[0].targetAt, frozen.predictedAt);
  assert.equal(h.find(node => node.type === "h2").children[0], "合同", "A consumed focus returns to the normal pool on the next accepted answer.");
});

test("StrictMode replay guard still allows new draws for real query, owner, readiness and mode changes", () => {
  const h = harness("VocabularyTrainer", { level: "F", focusId: "pdf" }, cards, { strictEffects: true });
  const draws = () => h.predictions.filter(prediction => prediction.targetAt === prediction.predictedAt);
  let count = draws().length;
  h.click(h.button("Reveal meaning"));
  h.change(h.find(node => node.type === "input" && node.props["aria-label"] === "Filter cards"), "合同");
  assert(draws().length > count); count = draws().length;
  assert.equal(h.find(node => node.type === "h2").children[0], "合同");
  assert(h.button("Reveal meaning"), "A new filtered draw starts hidden.");
  h.render({ owner: "account-b" });
  assert(draws().length > count); count = draws().length;
  assert.equal(h.find(node => node.type === "h2").children[0], "日向", "A distinct owner gets its own focus request and prediction.");
  h.render({ mode: "context" });
  assert(draws().length > count); count = draws().length;
  assert.equal(h.find(node => node.type === "h2").children[0], "合同");
  assert.equal(draws().at(-1).mode, "context");
  assert.equal(content(h.find(node => node.props.className === "vocab-context")), "合同で調査する。");
  h.render({ ready: false });
  assert(draws().length > count); count = draws().length;
  h.click(h.button("Reveal meaning")); assert.equal(h.button("Remembered").props.disabled, true);
  h.render({ ready: true });
  assert(draws().length > count);
  assert(h.button("Reveal meaning"));
  assert.equal(h.accepted.length, 0, "Changing draw inputs never fabricates feedback.");
});

test("dictionary focus targets one higher-level word, then returns to the cumulative pool without widening it", () => {
  const h = harness("VocabularyTrainer", { level: "C", focusId: "exam" });
  assert.equal(h.find(node => node.type === "h2").children[0], "躊躇");
  assert.match(content(h.tree()), /Focused practice/);
  h.click(h.button("Reveal meaning"));
  h.click(h.button("Approximate"));
  assert.equal(h.accepted[0].lemma, "躊躇");
  assert.equal(h.find(node => node.type === "h2").children[0], "日向");
  assert.doesNotMatch(content(h.tree()), /Focused practice/);
  assert.equal(h.props.level, "C");
});


test("measurement locale switches preserve sampled words, canonical option order, selections and one accepted submission", () => {
  const submissions = [];
  const h = harness("VocabularyLab", { locale: "zh-CN", level: "G", onSubmit: answers => { submissions.push(plain(answers)); return true; } });
  const articles = () => nodes(h.tree()).filter(node => node.type === "article" && node.props.className === "vocab-item");
  const snapshot = () => articles().map(article => ({ lemma: article.props.key, options: nodes(article).filter(node => node.type === "button").map(button => button.props.key) }));
  const before = snapshot();
  const union = articles().find(article => article.props.key === "合同");
  h.click(nodes(union).find(node => node.type === "button" && node.props.key === "联合"));
  const selectedBefore = nodes(h.tree()).filter(node => node.type === "button" && /selected/.test(node.props.className || "")).map(button => button.props.key);
  h.render({ locale: "en" });
  assert.deepEqual(snapshot(), before, "Locale does not resample or reshuffle this round");
  assert.deepEqual(nodes(h.tree()).filter(node => node.type === "button" && /selected/.test(node.props.className || "")).map(button => button.props.key), selectedBefore);
  assert.equal(content(h.find(node => node.type === "button" && node.props.key === "分裂")), contentText("分裂", "en"));
  assert.notEqual(contentText("分裂", "en"), "分裂", "The selected round still updates its visible translation");
  h.render({ locale: "zh-CN" });
  assert.deepEqual(snapshot(), before);
  for (const article of articles()) {
    const answer = article.props.key === "合同" ? "联合" : "分裂";
    h.click(nodes(article).find(node => node.type === "button" && node.props.key === answer));
  }
  const submit = h.button("Submit").props.onClick; submit(); submit(); h.render();
  assert.equal(submissions.length, 1);
  assert.deepEqual(submissions[0].slice().sort((a,b) => a.lemma.localeCompare(b.lemma)), [{ lemma: "合同", correct: true }, { lemma: "躊躇", correct: true }].sort((a,b) => a.lemma.localeCompare(b.lemma)));
  h.render({ locale: "en" });
  assert(!h.button("Submit"), "Changing the interface language does not reopen a completed measurement");
  assert.match(content(h.tree()), /2\s*\/\s*2/);
  let mountingKey = "";
  const visit = node => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "VocabularyLab") mountingKey = node.attributes.properties.find(prop => prop.name?.text === "key")?.getText(ast) || ""; ts.forEachChild(node, visit); };
  visit(ast);
  assert(mountingKey && !/locale/.test(mountingKey), "The real App mount identity must not discard the round on locale changes");
});

test("random-exam completion counts only this round and resets on restart rather than reusing historical progress", () => {
  let mountExpression;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ExamMode") mountExpression = node.attributes.properties.find(prop => prop.name?.text === "key")?.initializer?.expression;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert(mountExpression, "The real App mounts exam state under an account-specific identity");
  const mountKey = (email, locale = "en", language = "ja") => vm.runInNewContext(mountExpression.getText(ast), { language, locale, session: { user: email ? { email } : null } });
  assert.equal(mountKey("alice@example.test"), "ja:alice@example.test");
  assert.notEqual(mountKey("alice@example.test"), mountKey("bob@example.test"));
  assert.notEqual(mountKey("alice@example.test"), mountKey(null));
  assert.notEqual(mountKey("alice@example.test"), mountKey("alice@example.test", "en", "la"));
  assert.equal(mountKey("alice@example.test", "en"), mountKey("alice@example.test", "zh-CN"));
  const bank = ["old-correct", "old-wrong"].map(id => ({ id, language: "ja", level: "F", type: "choice", category: "vocabulary", prompt: "Choose", options: ["one", "two"], answer: 0, explanation: "Reason", tags: [], source: "test" }));
  const saved = [];
  const h = harness("ExamMode", { bank, level: "F", progress: { "old-correct": "correct", "old-wrong": "wrong" }, setLevel() {}, onResult: (question, status) => saved.push([question.id, status]) });
  h.click(h.button("Start mock exam"));
  const displayed = () => h.find(node => node.type === "QuestionCard");
  assert.equal(displayed().props.status, undefined, "Old progress must not mark a new round as already answered");
  h.click(h.button("Submit"));
  assert.match(content(h.tree()), /completed 0 of 2/);
  assert.deepEqual(saved, []);
  h.click(h.button("Try another paper"));
  const first = displayed().props.question.id;
  displayed().props.onResult("wrong"); h.render();
  assert.equal(displayed().props.status, "wrong");
  h.click(h.button("Next"));
  assert.notEqual(displayed().props.question.id, first);
  assert.equal(displayed().props.status, undefined);
  h.click(h.button("Submit"));
  assert.match(content(h.tree()), /completed 1 of 2/);
  assert.deepEqual(saved, [[first, "wrong"]]);
  h.click(h.button("Try another paper"));
  assert.equal(displayed().props.status, undefined);
  h.click(h.button("Submit"));
  assert.match(content(h.tree()), /completed 0 of 2/);
});
