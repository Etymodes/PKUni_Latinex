import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { localizeQuestion, contentText } from "../lib/content-locale.ts";
import { getCopy, getLearningLanguage } from "../app/i18n.ts";
import { matchesLevel, normalizePikkuLevel, questionOptionOrder, questions } from "../data/questions.ts";
import { completeQuestions } from "../data/complete-bank.ts";
import { languageConfigs } from "../data/languages.ts";
import { multilingualQuestions } from "../data/multilingual-questions.ts";
import { multilingualSeedQuestions } from "../data/multilingual-seeds.ts";
import originalQuestions from "../data/jlpt-1992.json" with { type: "json" };
import { addQuestionCollections, questionCollections, questionInCollection, questionForCollection, collectionOrder } from "../data/question-collections.ts";
const importedQuestions = addQuestionCollections([], [{ id: "jlpt-1992-1", questions: originalQuestions }]).questions;

// Run the handlers and render expressions actually wired into the page.
const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(node => [node.name.text, node]));
function declarationWithin(functionName, variableName) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === variableName) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(functions.get(functionName));
  assert.ok(found, `${functionName}.${variableName} must be connected`);
  return found.getText(ast);
}
const code = ts.transpileModule([
  ...["assetPath", "viewForLanguage", "QuestionAudio", "QuestionCard", "Practice"].map(name => functions.get(name).getText(ast)),
  `globalThis.handleQuestionKey = ${declarationWithin("QuestionCard", "handler")};`,
  ...["selectLanguage", "selectLanguageLevel", "openPractice"].map(name => `globalThis.${name} = ${declarationWithin("App", name)};`),
  `globalThis.dashboardModes = () => {
    ${["levelQs", "grammarCategory", "readingCategory", "extraCategories"].map(name => `const ${name} = ${declarationWithin("Dashboard", name)};`).join("\n")}
    return (${declarationWithin("Dashboard", "modes")});
  };`,
].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;

class Element {
  constructor(tagName) { this.tagName = tagName; }
  closest(selector) { return selector.split(", ").includes(this.tagName) ? this : null; }
}
function harness() {
  const context = {
    localizeQuestion, contentText, publicBasePath: "/PKUni_Latinex", HTMLElement: Element, questionOptionOrder, matchesLevel, normalizePikkuLevel, languageConfigs,
    questionCollections, questionInCollection, questionForCollection, collectionOrder,
    React: { Fragment: "fragment", createElement: (type, props, ...children) => ({ type: typeof type === "function" ? type.name : type, props, children }) },
    copy: getCopy("zh-CN"), language: getLearningLanguage("ja"), level: "M", bank: importedQuestions,
    useInterfaceText: () => text => text,
    useI18n: () => ({ copy: getCopy("zh-CN"), language: getLearningLanguage("ja") }),
    useEffect() {}, useMemo: compute => compute(), categoryName: (_copy, category) => category, levelName: (_copy, level) => level, reviewStatusLabels: {},
    question: { type: "choice", answer: 2 }, submitted: false, selected: null, optionOrder: [0, 1, 2, 3], results: [],
  };
  for (const name of ["Bookmark", "Check", "X", "CircleHelp", "CheckCircle2", "RotateCcw", "Feedback", "DistractorNotes", "Languages", "Layers3", "BookOpen", "Headphones", "TargetKicker", "Search", "ArrowLeft", "ArrowRight", "EmptyState"]) context[name] = name;
  context.setSelected = value => { context.selected = value; };
  context.setSubmitted = value => { context.submitted = value; };
  context.onResult = result => { context.results.push(result); };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(tree) { return tree && typeof tree === "object" ? [tree, ...(tree.children ?? []).flat(Infinity).flatMap(nodes)] : []; }

// Deliberately artificial grades exercise filtering independently of the content rubric.
const mixedPaper = importedQuestions.map((question, index) => ({ ...question, level: ["C", "F", "G", "M"][index % 4] }));
function practiceHarness() {
  const c = harness();
  c.useI18n = () => ({ copy: getCopy("en"), locale: "en", language: getLearningLanguage("ja") });
  const state = ["ordered", 0, "", "jlpt-1992-1", 0];
  const levelChanges = [];
  const props = {
    bank: mixedPaper, level: "F", levels: ["C", "F", "G", "M"], category: "all", fullPaper: false,
    progress: {}, bookmarks: [], onResult() {}, setBookmarks() {},
    setLevel(value) { props.level = value; levelChanges.push(value); },
    setCategory(value) { props.category = value; }, setFullPaper(value) { props.fullPaper = value; },
  };
  function render() {
    let cursor = 0;
    c.useState = () => {
      const position = cursor++;
      return [state[position], value => { state[position] = typeof value === "function" ? value(state[position]) : value; }];
    };
    return nodes(c.Practice(props));
  }
  return { props, state, levelChanges, render };
}

test("question media paths work at the domain root and under GitHub Pages without changing external media", () => {
  const c = harness();
  assert.equal(c.assetPath("/media/question.png"), "/PKUni_Latinex/media/question.png");
  assert.equal(c.assetPath("/PKUni_Latinex/media/question.png"), "/PKUni_Latinex/media/question.png");
  for (const src of ["https://example.test/audio.m4a", "//example.test/audio.m4a", "blob:local-audio", "media/audio.m4a"]) assert.equal(c.assetPath(src), src);
  c.publicBasePath = "";
  assert.equal(c.assetPath("/media/question.png"), "/media/question.png");
});

test("single-question clips use native audio controls and the correct deployment media URL", () => {
  const c = harness();
  const audio = c.QuestionAudio({ audio: { src: "/media/question.m4a" }, label: "Audio" });
  assert.equal(audio.type, "audio");
  assert.equal(audio.props.src, "/PKUni_Latinex/media/question.m4a");
  assert.equal(audio.props.controls, true);
  assert.equal(audio.props.preload, "metadata");
  assert.equal(c.QuestionAudio({ audio: { src: "/media/next-question.m4a" }, label: "Audio" }).props.src, "/PKUni_Latinex/media/next-question.m4a");
});

test("typing into search or the original-question selector cannot choose or submit an answer", () => {
  const c = harness();
  for (const tag of ["input", "textarea", "select", "audio", "video", "[contenteditable]"]) {
    for (const key of ["3", "Enter"]) c.handleQuestionKey({ key, target: new Element(tag) });
  }
  assert.equal(c.selected, null); assert.deepEqual(c.results, []);
  c.handleQuestionKey({ key: "3", target: new Element("body") });
  c.handleQuestionKey({ key: "Enter", target: new Element("body") });
  assert.equal(c.selected, 2); assert.deepEqual(c.results, ["correct"]);
});

test("Enter leaves focused navigation, bookmark and disclosure controls to their native actions", () => {
  const c = harness();
  c.selected = 2;
  for (const tag of ["button", "a", "summary"]) c.handleQuestionKey({ key: "Enter", target: new Element(tag) });
  assert.equal(c.submitted, false); assert.deepEqual(c.results, []);
  c.handleQuestionKey({ key: "1", target: new Element("button") });
  assert.equal(c.selected, 0, "Number shortcuts still work while a button is focused");
});

test("the transcript is absent until submission and image links retain the deployment prefix", () => {
  const c = harness();
  const question = { id: "sample", level: "M", category: "listening", type: "choice", prompt: "Listen.", options: ["1", "2", "3", "4"], answer: 2, source: "Sample", tags: [], explanation: "Answer.", transcript: "Hidden dialogue", images: [{ src: "/media/question.png", alt: "Question image" }] };
  for (const submitted of [false, true]) {
    const states = [null, submitted, false, "", [0, 1, 2, 3]];
    c.useState = () => [states.shift(), () => {}];
    const rendered = nodes(c.QuestionCard({ question, onResult() {}, onBookmark() {}, bookmarked: false }));
    assert.equal(rendered.some(node => node.props?.className === "question-transcript"), submitted);
    assert.equal(rendered.find(node => node.type === "img").props.src, "/PKUni_Latinex/media/question.png");
    assert.equal(rendered.find(node => node.type === "a").props.href, "/PKUni_Latinex/media/question.png");
  }
});

test("Japanese home cards open the actual grammar, reading and listening sections while Latin retains syntax", () => {
  const c = harness();
  c.bank = ["sentencePattern", "reading", "listening"].map(category => ({ ...importedQuestions.find(question => question.category === category), level: "G" }));
  c.level = "G";
  const modes = plain(c.dashboardModes());
  assert.equal(modes.find(mode => mode.category === "sentencePattern").meta, "1 题");
  assert.equal(modes.find(mode => mode.category === "reading").meta, "1 题");
  assert.equal(modes.find(mode => mode.category === "listening").meta, "1 题");
  c.language = getLearningLanguage("la"); c.bank = [];
  assert.deepEqual(plain(c.dashboardModes()).map(mode => mode.category), ["vocabulary", "syntax", "translation"]);
});

test("Japanese Core cards retain legacy syntax and translation routes when new categories only occur at other grades", () => {
  const c = harness();
  c.bank = [...importedQuestions.map(question => ({ ...question, level: "G" })), ...multilingualQuestions.filter(question => question.language === "ja")];
  c.level = "C";
  const modes = plain(c.dashboardModes());
  const grammar = modes.find(mode => mode.title === c.copy.grammarCourse);
  const reading = modes.find(mode => mode.title === c.copy.readingCourse);
  assert.equal(grammar.category, "syntax");
  assert.equal(grammar.meta, "1 题");
  assert.equal(reading.category, "translation");
  assert.deepEqual(c.bank.filter(question => matchesLevel(question, c.level) && question.category === grammar.category).map(question => question.id), ["ja-n4-001"]);
});

test("every current Japanese question retains a home route after F/G regrading, including legacy syntax and morphology", () => {
  const c = harness();
  c.bank = [...questions, ...completeQuestions, ...multilingualQuestions, ...multilingualSeedQuestions, ...importedQuestions].filter(question => question.language === "ja");
  for (const level of ["C", "F", "G", "M"]) {
    c.level = level;
    const modes = plain(c.dashboardModes());
    assert.equal(new Set(modes.map(mode => mode.category)).size, modes.length, `${level}: no duplicated routes`);
    const eligible = c.bank.filter(question => matchesLevel(question, level));
    for (const question of eligible) assert(modes.some(mode => mode.category === question.category), `${level}: missing home route for ${question.id}`);
    for (const mode of modes) {
      const expected = eligible.filter(question => question.category === mode.category);
      assert.equal(mode.meta, c.copy.questionCount(expected.length));
      const h = practiceHarness();
      Object.assign(h.props, { bank: c.bank, level, category: mode.category });
      const count = nodes(h.render().find(node => node.props?.className === "question-search")).find(node => node.type === "span").children[0];
      assert.equal(count, expected.length, `${level}: home count matches the actual practice route`);
    }
    if (level === "G") assert.equal(modes.find(mode => mode.category === "syntax").meta, "1 题", "ja-n2-001 keeps its own syntax route");
  }
  assert.equal(c.bank.filter(question => matchesLevel(question, "F") && question.category === "translation").length, 0, "The current F bank has no legacy translation item");
});

test("Japanese reading and translation coexist without widening the 1992 reading section", () => {
  const c = harness();
  const translation = { ...importedQuestions.find(question => question.level === "F" && question.category === "reading"), id: "legacy-ja-f-translation", category: "translation" };
  c.bank = [...importedQuestions, translation]; c.level = "F";
  const modes = plain(c.dashboardModes());
  assert(modes.some(mode => mode.category === "reading"));
  assert.equal(modes.find(mode => mode.category === "translation").meta, "1 题");
  const h = practiceHarness();
  Object.assign(h.props, { bank: c.bank, category: "translation" });
  assert.equal(h.render().find(node => node.type === "QuestionCard").props.question.id, translation.id);
  const shortcut = h.render().find(node => node.props?.className === "exam-shortcuts");
  nodes(shortcut).find(node => node.type === "button" && node.children[0] === "Reading").props.onClick();
  const selector = h.render().find(node => node.type === "select" && node.props["aria-label"] === "Original question");
  const ids = nodes(selector).filter(node => node.type === "option").map(node => node.props.value);
  assert.deepEqual(ids, importedQuestions.filter(question => question.category === "reading").map(question => question.id));
  assert(!ids.includes(translation.id));
});

test("the full-paper shortcut spans grades without changing the selected grade and original-question jump still works", () => {
  const h = practiceHarness();
  h.state[2] = "no matching question";
  let rendered = h.render();
  const shortcut = rendered.find(node => node.props?.className === "exam-shortcuts");
  assert.deepEqual(plain(nodes(shortcut).filter(node => node.type === "button").map(node => node.children[0])), ["Full paper", "Vocabulary", "Listening", "Reading", "Grammar"]);
  nodes(shortcut).find(node => node.type === "button").props.onClick();
  assert.equal(h.props.fullPaper, true);
  assert.equal(h.state[2], "");
  assert.deepEqual(h.levelChanges, []);
  rendered = h.render();
  const difficulty = rendered.find(node => node.type === "select");
  assert.equal(difficulty.props.value, "paper");
  assert.equal(nodes(difficulty).find(node => node.type === "option").children[0], "Full paper · All levels");
  const selector = rendered.find(node => node.type === "select" && node.props["aria-label"] === "Original question");
  const options = nodes(selector).filter(node => node.type === "option");
  assert.equal(options.length, 149);
  assert.deepEqual([...new Set(options.map(option => option.children.at(-1)))], ["C", "F", "G", "M"]);
  selector.props.onChange({ target: { value: importedQuestions[148].id } });
  assert.equal(h.state[4], 148);
});

test("full-paper searches and section shortcuts stay within the precise source, independent of grade", () => {
  const h = practiceHarness();
  h.props.bank = [...mixedPaper, { ...mixedPaper[0], id: "unrelated-1992-question", occurrences: [] }];
  h.props.fullPaper = true;
  const count = rendered => nodes(rendered.find(node => node.props?.className === "question-search")).find(node => node.type === "span").children[0];
  let rendered = h.render();
  assert.equal(count(rendered), 149, "A different item with the same year, source and tags is excluded");
  rendered.find(node => node.type === "input").props.onChange({ target: { value: mixedPaper[0].id } });
  rendered = h.render();
  assert.ok(count(rendered) > 0 && count(rendered) < 149);
  assert.equal(h.props.fullPaper, true);
  rendered.find(node => node.type === "input").props.onChange({ target: { value: "" } });
  rendered = h.render();
  assert.equal(count(rendered), 149);
  nodes(rendered.find(node => node.props?.className === "exam-shortcuts")).find(node => node.type === "button" && node.children[0] === "Listening").props.onClick();
  rendered = h.render();
  assert.equal(count(rendered), 30);
  assert.equal(h.props.category, "listening");
  rendered.find(node => node.type === "select").props.onChange({ target: { value: "F" } });
  assert.equal(h.props.fullPaper, false, "Choosing the already selected grade also exits full-paper mode");
  assert.equal(count(h.render()), h.props.bank.filter(question => matchesLevel(question, "F") && question.category === "listening").length);
});

test("the app exits full-paper mode on same-grade selection, language changes and home practice routes", () => {
  const c = harness();
  Object.assign(c, { language: "ja", languageLevel: "F", level: "F", view: "practice", fullPaper: true, languageRef: { current: "ja" }, languageLevelRef: { current: "F" }, levelsByLanguageRef: { current: {} }, syncPreference() {}, setMobileNav() {} });
  for (const [setter, field] of [["setFullPaper", "fullPaper"], ["setLanguage", "language"], ["setLanguageLevel", "languageLevel"], ["setCategory", "category"], ["setView", "view"]]) c[setter] = value => { c[field] = value; };
  c.selectLanguageLevel("F");
  assert.equal(c.fullPaper, false);
  assert.equal(c.languageLevel, "F");
  c.fullPaper = true;
  c.selectLanguage("en");
  assert.equal(c.fullPaper, false);
  assert.equal(c.language, "en");
  c.fullPaper = true;
  c.selectLanguage("en");
  assert.equal(c.fullPaper, false);
  c.fullPaper = true;
  c.openPractice("G", "reading");
  assert.equal(c.fullPaper, false);
  assert.equal(c.languageLevel, "G");
  assert.equal(c.category, "reading");
});

test("switching a repeated question between collections resets the rendered answer component", () => {
  const h = practiceHarness();
  const same = { ...mixedPaper[0], occurrences: [
    ...mixedPaper[0].occurrences,
    { collectionId: "jlpt-1993-1", label: "1993", sourceQuestionId: "repeat", originalNumber: "問12", order: 0, options: [...mixedPaper[0].options].reverse(), answer: 3 - mixedPaper[0].answer },
  ] };
  h.props.bank = [same]; h.props.fullPaper = true;
  const first = h.render().find(node => node.type === "QuestionCard");
  h.state[3] = "jlpt-1993-1";
  const second = h.render().find(node => node.type === "QuestionCard");
  assert.equal(first.props.question.id, second.props.question.id);
  assert.notEqual(first.props.key, second.props.key, "React must reset submitted/selected/transcript state when the source changes");
  assert.deepEqual(second.props.question.options, [...mixedPaper[0].options].reverse());
});


test("spoken listening choices are numbered until the answer is submitted", () => {
  const c = harness();
  const question = { id: "audio-only", level: "F", category: "listening", type: "choice", prompt: "Listen.", optionsInAudio: true, shuffleOptions: false, options: ["spoken one", "spoken two", "spoken three", "spoken four"], answer: 2, source: "Sample", tags: [], explanation: "Answer.", transcript: "Hidden dialogue" };
  for (const submitted of [false, true]) {
    const states = [null, submitted, false, "", [0, 1, 2, 3]];
    c.useState = () => [states.shift(), () => {}];
    const rendered = nodes(c.QuestionCard({ question, onResult() {}, onBookmark() {}, bookmarked: false }));
    const radios = rendered.filter(node => node.props?.role === "radio");
    assert.equal(radios.length, 4);
    for (let index = 0; index < 4; index++) {
      assert.equal(JSON.stringify(radios[index]).includes(question.options[index]), submitted);
      assert.equal(radios[index].children[0].children[0], index + 1);
    }
    assert.equal(rendered.some(node => node.props?.className === "question-transcript"), submitted);
  }
});

function questionStateHarness(question) {
  const c = harness(), slots = [], accepted = [], listeners = new Map();
  let cursor = 0, dirty = true, effects = [], tree, locale = "zh-CN", optionOrderCalls = 0;
  c.RotateCcw = "RotateCcw";
  c.window = { addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); } };
  c.questionOptionOrder = () => (++optionOrderCalls === 1 ? [2, 0, 3, 1] : [1, 3, 0, 2]);
  c.useI18n = () => ({ copy: getCopy(locale), locale, language: getLearningLanguage(question.language ?? "la") });
  c.useInterfaceText = () => text => contentText(text, locale);
  c.useState = initial => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
    return [slots[index].value, value => {
      const next = typeof value === "function" ? value(slots[index].value) : value;
      if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
    }];
  };
  c.useMemo = (compute, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) {
      slots[index] = { value: compute(), deps };
    }
    return slots[index].value;
  };
  c.useEffect = (effect, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((value, position) => !Object.is(value, previous.deps[position]))) {
      slots[index] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
    }
  };
  const props = { question, bookmarked: false, onBookmark() {}, onResult: result => accepted.push(result) };
  function render(nextLocale = locale) {
    locale = nextLocale;
    let passes = 0;
    do {
      cursor = 0; dirty = false; effects = [];
      tree = nodes(c.QuestionCard(props)); effects.forEach(effect => effect());
      assert(++passes < 15, "QuestionCard effects must settle");
    } while (dirty);
    return tree;
  }
  render();
  return { accepted, render, tree: () => tree, optionOrderCalls: () => optionOrderCalls,
    click(node) { assert(node && !node.props.disabled); node.props.onClick(); render(); } };
}

test("switching the interface locale preserves the current choice, shuffled order and submitted answer", () => {
  const question = questions.find(item => item.type === "choice" && item.options?.length === 4
    && item.options.some(option => /[\u3400-\u9fff]/.test(option)));
  assert(question, "Use a real question with translated instructional options.");
  const h = questionStateHarness(question);
  const radios = () => h.tree().filter(node => node.props?.role === "radio");
  const order = () => radios().map(node => node.props.key);
  const originalOrder = order();
  h.click(radios().find(node => node.props.key === question.answer));
  h.render("en");
  assert.deepEqual(order(), originalOrder);
  assert.equal(h.optionOrderCalls(), 1, "A locale projection must not rerun option shuffling.");
  assert.equal(radios().find(node => node.props["aria-checked"]).props.key, question.answer);
  assert.equal(h.tree().find(node => node.type === "h2").children[0], localizeQuestion(question, "en").prompt);
  assert.equal(h.accepted.length, 0, "Changing the interface language does not submit an answer.");
  h.click(h.tree().find(node => node.props?.className === "primary-button submit-answer"));
  assert.deepEqual(h.accepted, ["correct"]);
  h.render("zh-CN");
  assert.deepEqual(order(), originalOrder);
  assert.equal(h.optionOrderCalls(), 1);
  assert(radios().every(node => node.props.disabled));
  assert.equal(radios().find(node => node.props["aria-checked"]).props.key, question.answer);
  assert.equal(h.tree().find(node => node.type === "Feedback").props.correct, true);
  assert.equal(h.tree().find(node => node.type === "Feedback").props.explanation, question.explanation);
  assert.deepEqual(h.accepted, ["correct"], "Returning to Chinese must not save a second answer.");
});

test("switching the interface locale keeps a written self-check answer and its revealed state", () => {
  const question = questions.find(item => item.type === "self-check" && item.modelAnswer);
  assert(question);
  const h = questionStateHarness(question), draft = "My unfinished translation and analysis.";
  h.tree().find(node => node.type === "textarea").props.onChange({ target: { value: draft } });
  h.render();
  h.click(h.tree().find(node => node.type === "button" && node.props?.className === "primary-button"));
  h.render("en");
  assert.equal(h.tree().find(node => node.type === "textarea").props.value, draft);
  const answer = h.tree().find(node => node.props?.className === "model-answer");
  assert(answer, "The answer stays revealed across the locale change.");
  assert.equal(nodes(answer).find(node => node.type === "p").children[0], localizeQuestion(question, "en").modelAnswer);
  h.render("zh-CN");
  assert.equal(h.tree().find(node => node.type === "textarea").props.value, draft);
  assert(h.tree().some(node => node.props?.className === "model-answer"));
  assert.deepEqual(h.accepted, [], "Changing language must not rate a self-check answer.");
});
