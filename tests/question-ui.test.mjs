import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getCopy, getLearningLanguage } from "../app/i18n.ts";
import { matchesLevel, questionOptionOrder } from "../data/questions.ts";
import { languageConfigs } from "../data/languages.ts";
import importedQuestions from "../data/jlpt-1992.json" with { type: "json" };

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
  ...["assetPath", "QuestionAudio", "QuestionCard", "Practice"].map(name => functions.get(name).getText(ast)),
  `globalThis.handleQuestionKey = ${declarationWithin("QuestionCard", "handler")};`,
  `globalThis.dashboardModes = () => (${declarationWithin("Dashboard", "modes")});`,
].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;

class Element {
  constructor(tagName) { this.tagName = tagName; }
  closest(selector) { return selector.split(", ").includes(this.tagName) ? this : null; }
}
function harness() {
  const context = {
    publicBasePath: "/PKUni_Latinex", HTMLElement: Element, questionOptionOrder, matchesLevel, languageConfigs,
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
  const modes = plain(c.dashboardModes());
  assert.equal(modes.find(mode => mode.category === "sentencePattern").meta, "31 题");
  assert.equal(modes.find(mode => mode.category === "reading").meta, "23 题");
  assert.equal(modes.find(mode => mode.category === "listening").meta, "30 题");
  c.language = getLearningLanguage("la"); c.bank = [];
  assert.deepEqual(plain(c.dashboardModes()).map(mode => mode.category), ["vocabulary", "syntax", "translation"]);
});

test("original-question jump selects the requested item and the new controls follow the interface language", () => {
  const c = harness();
  c.useI18n = () => ({ copy: getCopy("en"), locale: "en", language: getLearningLanguage("ja") });
  const state = ["ordered", 0, "1992", 0];
  let cursor = 0;
  c.useState = () => { const position = cursor++; return [state[position], value => { state[position] = value; }]; };
  const rendered = nodes(c.Practice({ bank: importedQuestions, level: "M", levels: ["C", "F", "G", "M"], category: "all", progress: {}, bookmarks: [], setLevel() {}, setCategory() {}, onResult() {}, setBookmarks() {} }));
  const shortcut = rendered.find(node => node.props?.className === "exam-shortcuts");
  assert.deepEqual(plain(nodes(shortcut).filter(node => node.type === "button").map(node => node.children[0])), ["Full paper", "Vocabulary", "Listening", "Reading", "Grammar"]);
  const selector = rendered.find(node => node.type === "select" && node.props["aria-label"] === "Original question");
  assert.equal(nodes(selector).filter(node => node.type === "option").length, 149);
  selector.props.onChange({ target: { value: importedQuestions[148].id } });
  assert.equal(state[3], 148);
});
