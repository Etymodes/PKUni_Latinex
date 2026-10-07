import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { contentText, localizeVocabularyCard } from "../lib/content-locale.ts";
import { vocabularyLevelsFor, publicDictionaryReferences } from "../data/vocabulary.ts";

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/vocabulary-model.ts", import.meta.url), "utf8"))).toString("base64")}`);
const source = fs.readFileSync(new URL("../app/vocabulary-workspace.tsx", import.meta.url), "utf8");
const code = compile(source.replace(/^import .*;\r?$/gm, "").replace(/^export /gm, ""));
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const lab = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === "VocabularyLab");
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
function harness(component = "VocabularyTrainer", props = {}) {
  const slots = []; let cursor = 0, dirty = true, effects = [], tree, sequence = 0;
  const predictions = [], accepted = [];
  const c = {
    contentText, localizeVocabularyCard, vocabularyCards: cards, dictionaryEntries: cards, vocabularyLevelsFor, publicDictionaryReferences,
    dictionarySources: [{ id: "old", name: "Oxford Latin Dictionary", scope: "Latin", access: "Print" }, { id: "ls", name: "Lewis & Short", scope: "Latin", access: "Public domain" }],
    vocabularyKey: (language, term) => `${language}:${term}`,
    vocabularyMatchesLevel: (card, level) => card.level && ["C", "F", "G", "M"].indexOf(card.level) <= ["C", "F", "G", "M"].indexOf(level),
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [at(10)])); } static now() { return new Date(at(10)).getTime(); } },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    trainVocabularyModel: model.trainVocabularyModel,
    makePrediction(...args) { const prediction = model.makePrediction(...args); predictions.push(prediction); return prediction; },
    completeVocabularyReview: (prediction, outcome) => model.completeVocabularyReview(prediction, outcome, at(10), `event-${++sequence}`),
    React: { Fragment: "fragment", createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : ({ type, props: props ?? {}, children }) },
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
  for (const icon of ["BookOpen", "CheckCircle2", "Search", "Settings", "XCircle", "Shuffle", "TargetKicker", "EmptyState", "Languages", "Trophy"]) c[icon] = icon;
  vm.createContext(c); vm.runInContext(code, c);
  c.allVocabItems = [{ language: "ja", level: "F", lemma: "合同", gloss: "联合", distractors: ["分裂"], family: "test" }];
  c.useI18n = () => ({ copy: { vocabularyRound: () => "Round", vocabularyEstimate: () => "Estimate", submitMeasure: "Submit" }, language: { id: "ja", htmlLang: "ja" } });
  c.normalizePikkuLevel = (_, level) => level; c.levelName = (_, level) => level; c.shuffle = items => [...items];
  vm.runInContext(compile(lab.getText(ast)), c);
  const current = { language: "ja", locale: "en", level: "F", mode: "word", stats: {}, reviews: [], owner: "guest", ready: true, focusId: "both", onReview(event) { accepted.push(event); return true; }, onDictionary() {}, onSettings() {}, onPractice() {}, ...props };
  function render(update) {
    if (update) Object.assign(current, update);
    let passes = 0;
    do { dirty = false; cursor = 0; effects = []; tree = c[component](current); effects.forEach(effect => effect()); assert(++passes < 15, "component effects must settle"); } while (dirty);
    return tree;
  }
  render();
  return { props: current, c, predictions, accepted, render, tree: () => tree,
    find: predicate => nodes(tree).find(predicate),
    button: text => nodes(tree).find(node => node.type === "button" && content(node).includes(text)),
    select: label => nodes(tree).find(node => node.type === "label" && typeof node.children[0] === "string" && node.children[0] === label)?.children.find(child => child?.type === "select"),
    input: type => nodes(tree).find(node => node.type === "input" && node.props.type === type),
    change(select, value) { select.props.onChange({ target: { value } }); render(); },
    click(button) { assert(button, "button exists"); assert(!button.props.disabled, "button is enabled"); button.props.onClick(); render(); },
  };
}

test("dictionary hides import provenance and collection labels while retaining status filtering", () => {
  const h = harness("VocabularyDictionary", { focusId: undefined });
  const ids = () => nodes(h.tree()).filter(node => node.type === "article" && node.props.id).map(node => node.props.id);
  assert.deepEqual(ids(), ["word-both", "word-pdf", "word-exam"]);
  assert.doesNotMatch(content(h.tree()), /1992|2000|PDF|question-1|question-2|pages|foundation/);
  assert.match(content(h.tree()), /小学馆《大辞泉》.*已核对读音/);
  assert.match(content(h.tree()), /词义用法提示/);
  assert.equal(h.select("Source"), undefined);
  assert.equal(h.select("Collection"), undefined);
  h.change(h.select("Content status"), "reviewed");
  assert.deepEqual(ids(), ["word-both"]);
  h.change(h.select("Content status"), "draft");
  assert.deepEqual(ids(), ["word-pdf", "word-exam"]);
});

test("alternate PDF readings and senses are searchable, with the same practice ID and learning key", () => {
  const practised = [];
  const h = harness("VocabularyDictionary", { focusId: undefined, stats: { "ja:日向": { seen: 3, correct: 2 } }, onPractice: id => practised.push(id) });
  const search = h.find(node => node.type === "input"); h.change(search, "ひゅうが");
  const article = h.find(node => node.type === "article" && node.props.id);
  assert.equal(article.props.id, "word-pdf");
  assert.match(content(article), /旧国名日向/); assert.match(content(article), /Reviewed 3/); assert.doesNotMatch(content(article), /pages|PDF|2000/);
  h.click(h.button("Practise this word")); assert.deepEqual(practised, ["pdf"]);
  assert.match(content(article), /Other spellings.*日なた/);
  h.change(h.find(node => node.type === "input"), "日なた");
  assert.equal(h.find(node => node.type === "article" && node.props.id)?.props.id, "word-pdf", "alternate spelling finds the canonical card");
  h.change(h.find(node => node.type === "input"), "ヒナタ");
  assert.equal(h.find(node => node.type === "article" && node.props.id)?.props.id, "word-pdf", "alternate reading finds the canonical card");
});

test("Latin dictionary verification and content status remain available without labeling Japanese PDFs as Latin sources", () => {
  const latin = harness("VocabularyDictionary", { language: "la", focusId: undefined });
  assert.match(content(latin.tree()), /OLD\s+·\s+Verified/); assert.match(content(latin.tree()), /LS\s+·\s+Pending/);
  latin.change(latin.select("Content status"), "draft");
  assert(!latin.find(node => node.type === "article" && node.props.id));
  const japanese = harness("VocabularyDictionary", { focusId: "pdf" });
  assert(!content(japanese.tree()).includes("Oxford Latin Dictionary"));
  assert.match(content(japanese.tree()), /Language-specific dictionary · pending/);
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
