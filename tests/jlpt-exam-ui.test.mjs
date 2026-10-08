import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { buildJlptExam, jlptExamProfiles } from "../lib/jlpt-exam.ts";
import { buildRandomExam } from "../lib/study-modes.ts";
import { matchesLevel, normalizePikkuLevel, questionOptionOrder } from "../data/questions.ts";
import { getCopy, getLearningLanguage } from "../app/i18n.ts";
import { shuffle } from "../lib/shuffle.ts";
import { contentText, localizeQuestion } from "../lib/content-locale.ts";

const source = fs.readFileSync(new URL("../app/jlpt-exam-workspace.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source.replace(/^import .*;\r?$/gm, "").replace(/^export /gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
}).outputText;
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = tree => tree && typeof tree === "object" ? [tree, ...(tree.children || []).flat(Infinity).flatMap(nodes)] : [];
const content = tree => tree == null || tree === false ? "" : typeof tree !== "object" ? String(tree) : (tree.children || []).flat(Infinity).map(content).join(" ").replace(/\s+/g, " ").trim();
function question(id, type, level = "C", extra = {}) {
  const category = type.startsWith("listening-") ? "listening" : type.startsWith("reading-") ? "reading" : type === "grammar-selection" ? "sentencePattern" : "vocabulary";
  return { id, language: "ja", level, type: "choice", category, skill: "jlpt:" + type,
    prompt: "Choose the correct answer.", text: "日本語の問題（　）。", options: ["一", "二", "三", "四"],
    answer: 0, explanation: "A synthetic explanation.", tags: [], source: "Synthetic UI test",
    ...(category === "listening" ? { audio: { src: "/synthetic-test.m4a" } } : {}),
    ...(category === "reading" ? { passage: "これは合成した短い文章です。" } : {}), ...extra };
}
const bank = [
  question("source-vocab-1", "kanji-reading"),
  question("source-vocab-2", "orthography"),
  question("source-grammar-1", "grammar-selection"),
  question("source-listening-1", "listening-task"),
];

// Executes the actual TSX, persistent hooks, timer effects, and the actual shared
// mapper. All questions and timers are synthetic; no account, audio or network runs.
function harness(props = {}, component = "JlptExamWorkspace") {
  const slots = [], effects = [], timers = new Map(), draws = [], results = [], levelChanges = [], listeners = new Map();
  let cursor = 0, dirty = true, tree, clock = Date.UTC(2026, 9, 8, 12), timerId = 0, mounted = true;
  const current = {
    bank, language: "ja", level: "C", locale: "en", progress: {}, setLevel: level => levelChanges.push(level), onResult: (question, status) => results.push({ question, status }),
    renderQuestion: (question, status, onAnswer) => ({ type: "question", props: { question, status, onAnswer }, children: [question.id] }),
    ...props,
  };
  const context = {
    jlptExamProfiles,
    buildJlptExam(...args) {
      const plan = buildJlptExam(...args);
      draws.push({ preview: typeof args[2] === "function", plan }); return plan;
    },
    console, HTMLElement: class HTMLElement { closest() { return null; } },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } },
    window: {
      setInterval(callback) { timers.set(++timerId, callback); return timerId; },
      clearInterval(id) { timers.delete(id); },
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    },
    React: { Fragment: "fragment", createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : ({ type, props: props || {}, children }) },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => {
        const next = typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(slots[index].value, next)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(compute, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) slots[index] = { value: compute(), deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  vm.createContext(context); vm.runInContext(code, context);
  if (component === "ExamMode") {
    const exam = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ExamMode");
    Object.assign(context, {
      JlptExamWorkspace: "JlptExamWorkspace", buildRandomExam, matchesLevel, normalizePikkuLevel, shuffle,
      LEVEL_ORDER: ["C", "F", "G", "M"], levelName: (_, level) => level, formatTime: String,
      useI18n: () => ({ copy: getCopy(current.locale), language: getLearningLanguage(current.language), locale: current.locale }),
    });
    for (const name of ["TimerReset", "TargetKicker", "FileText", "Landmark", "BarChart3", "Shuffle", "Clock3", "BookOpen", "ArrowRight", "Trophy", "RotateCcw", "ArrowLeft", "Check", "EmptyState", "QuestionCard"]) context[name] = name;
    vm.runInContext(ts.transpileModule(exam.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText, context);
  }
  if (component === "QuestionCard") {
    const card = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "QuestionCard");
    Object.assign(context, {
      localizeQuestion, questionOptionOrder, levelName: (_, level) => level, categoryName: (_, category) => category,
      useInterfaceText: () => value => contentText(value, current.locale),
      useI18n: () => ({ copy: getCopy(current.locale), language: getLearningLanguage(current.language), locale: current.locale }),
      reviewStatusLabels: {}, assetPath: value => value,
    });
    for (const name of ["Bookmark", "Check", "X", "CheckCircle2", "CircleHelp", "RotateCcw", "Feedback", "DistractorNotes", "QuestionAudio"]) context[name] = name;
    vm.runInContext(ts.transpileModule(card.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText, context);
  }
  function render(update) {
    if (update) Object.assign(current, update);
    if (!mounted) return tree;
    let passes = 0;
    do {
      dirty = false; cursor = 0; tree = context[component](current);
      while (effects.length) effects.shift()();
      assert(++passes < 20, "JLPT effects settle without repeated section advancement");
    } while (dirty);
    return tree;
  }
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === "button" && content(node) === label);
  function click(node) { assert(node, "button exists"); assert(!node.props.disabled, "button is enabled"); node.props.onClick(); render(); }
  render();
  return {
    props: current, draws, results, levelChanges, render, find, button, tree: () => tree, text: () => content(tree),
    question: () => find(node => node.type === "question"),
    timer: () => find(node => /(^| )timer( |$)/.test(node.props.className || "")),
    timers: () => timers.size,
    key(key) { for (const callback of [...(listeners.get("keydown") || [])]) callback({ key, target: null }); render(); },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
    liveDraws: () => draws.filter(draw => !draw.preview),
    click: label => click(typeof label === "string" ? button(label) : label),
    start: () => click(find(node => node.type === "button" && node.props.className === "primary-button large")),
    answer(status) { const item = find(node => node.type === "question"); assert(item); item.props.onAnswer(status); render(); },
    elapse(ms, tick = true) { clock += ms; if (tick) { for (const callback of [...timers.values()]) callback(); render(); } },
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("the real mapper supplies previews and changing templates never changes canonical levels or global level", () => {
  const input = [...bank, question("f-vocab", "kanji-reading", "F"), question("g-vocab", "kanji-reading", "G")];
  const before = JSON.stringify(input), h = harness({ bank: input, level: "F" });
  assert.equal(h.button("N2 structure · F").props["aria-pressed"], true);
  assert.match(h.text(), /Some item types are missing.*without duplicates/);
  assert.match(h.text(), /105 min/);
  h.click("N1 structure · G");
  assert.equal(h.button("N1 structure · G").props["aria-pressed"], true);
  assert.match(h.text(), /110 min/);
  h.start();
  assert.equal(h.props.level, "F");
  assert.equal(h.question().props.question.id, "g-vocab");
  assert.equal(h.liveDraws().length, 1);
  assert.equal(JSON.stringify(input), before, "Template choices cannot alter question levels, IDs or content.");
});

test("both locales show honest empty coverage and cannot start or fabricate a question", () => {
  for (const locale of ["en", "zh-CN"]) {
    const h = harness({ bank: [], locale });
    const start = h.find(node => node.type === "button" && node.props.className === "primary-button large");
    assert.equal(start.props.disabled, true);
    start.props.onClick(); h.render();
    assert.equal(h.question(), undefined); assert.equal(h.timers(), 0); assert.deepEqual(h.results, []);
    assert.match(h.text(), locale === "en" ? /No questions at this level/ : /当前等级还没有/);
    assert.match(h.text(), locale === "en" ? /not a complete current JLPT mock/ : /并非现行 JLPT 完整模拟卷/);
  }
});

test("locale switching preserves the drawn paper, original ID, answers and elapsed deadline", () => {
  const h = harness({ locale: "zh-CN" }); h.start();
  const first = h.question().props.question, plan = h.liveDraws()[0].plan;
  h.answer("wrong"); h.elapse(73000);
  assert.equal(content(h.timer()), "28:47");
  const calls = h.draws.length;
  h.render({ locale: "en" });
  assert.equal(h.question().props.question, first); assert.equal(h.question().props.status, "wrong");
  assert.equal(content(h.timer()), "28:47"); assert.equal(h.draws.length, calls);
  assert.equal(h.liveDraws()[0].plan, plan); assert.equal(h.results.length, 1);
  h.elapse(1000); h.render({ locale: "zh-CN" });
  assert.equal(content(h.timer()), "28:46");
  assert.equal(h.question().props.status, "wrong"); assert.equal(h.draws.length, calls);
  assert.match(h.text(), /本科第/);
});

test("a delayed absolute timer advances only one section and starts its full deadline at current time", () => {
  const h = harness(); h.start();
  assert.equal(content(h.timer()), "30:00");
  h.elapse(4 * 60 * 60 * 1000);
  assert.equal(h.question().props.question.id, "source-grammar-1");
  assert.equal(content(h.timer()), "70:00", "Time spent past the first deadline cannot consume the next section.");
  assert.equal(h.button("Previous").props.disabled, true, "Closed sections are unreachable from previous.");
  h.elapse(70 * 60000 - 1000); assert.equal(content(h.timer()), "0:01");
  h.elapse(1000); assert.equal(h.question().props.question.id, "source-listening-1");
  assert.equal(content(h.timer()), "40:00");
  h.elapse(40 * 60000);
  assert.equal(h.question(), undefined); assert.equal(h.timers(), 0);
  assert.match(h.text(), /Structured practice complete/); assert.deepEqual(h.results, []);
});

test("empty opening and intermediate sections are skipped without changing later section duration", () => {
  const listening = bank.filter(question => question.category === "listening");
  const only = harness({ bank: listening }); only.start();
  assert.equal(only.question().props.question.id, listening[0].id);
  assert.equal(content(only.timer()), "40:00");
  only.click(only.find(node => node.type === "button" && node.props.className === "primary-button"));
  assert.match(only.text(), /Structured practice complete/);
  const middle = harness({ bank: [bank[0], bank[3]] }); middle.start();
  middle.elapse(30 * 60000);
  assert.equal(middle.question().props.question.id, bank[3].id);
  assert.equal(content(middle.timer()), "40:00");
  assert.equal(middle.button("Previous").props.disabled, true);
});

test("answers are recorded once under original question identity, not copied template IDs", () => {
  const original = question("original-exam-id", "kanji-reading", "C", {
    occurrences: [{ collectionId: "synthetic-paper", sourceQuestionId: "original-number-5", originalNumber: "5", order: 5 }],
  });
  const h = harness({ bank: [original, original, question("grammar-next", "grammar-selection")] }); h.start();
  const callback = h.question().props.onAnswer;
  callback("correct"); callback("correct"); h.render();
  assert.equal(h.results.length, 1, "A repeated submit callback must not write duplicate progress.");
  assert.equal(h.results[0].question, original);
  assert.equal(h.results[0].question.id, "original-exam-id");
  assert.equal(h.question().props.status, "correct");
  h.click("Finish section and continue");
  assert.equal(h.question().props.question.id, "grammar-next");
  assert.equal(h.question().props.status, undefined);
  assert.equal(h.button("Previous").props.disabled, true);
  callback("wrong"); h.render();
  assert.equal(h.results.length, 1, "A callback from a closed section cannot change a saved result.");
});

test("a deadline rejects late answers even before the interval updates the displayed clock", () => {
  const h = harness(); h.start();
  const callback = h.question().props.onAnswer;
  h.elapse(30 * 60000, false); callback("correct"); h.render();
  assert.deepEqual(h.results, []);
  h.elapse(0);
  assert.equal(h.question().props.question.id, "source-grammar-1");
  assert.equal(content(h.timer()), "70:00");
});

test("ending and restarting show only raw current-round totals without automatic wrong answers or official scores", () => {
  const h = harness(); h.start(); h.answer("correct");
  h.click("Next");
  const unansweredCallback = h.question().props.onAnswer;
  h.click("Finish practice");
  assert.match(h.text(), /Answered 1 \/ 4 · Correct 1/);
  assert.match(h.text(), /raw practice results, not an official JLPT score or a pass prediction/);
  assert.equal(h.results.length, 1); assert.equal(h.timers(), 0);
  unansweredCallback("wrong"); h.render();
  assert.equal(h.results.length, 1, "A closed paper must reject retained callbacks.");
  h.render({ locale: "zh-CN" });
  assert.match(h.text(), /已答 1 \/ 4 · 答对 1/);
  assert.match(h.text(), /不是官方 JLPT 分数或合格预测/);
  h.click("重新随机组卷");
  assert.equal(h.question().props.status, undefined); assert.equal(content(h.timer()), "30:00");
  assert.equal(h.liveDraws().length, 2); assert.equal(h.results.length, 1);
});

test("unmounting the live structured practice disposes the active timer", () => {
  const h = harness(); h.start(); assert.equal(h.timers(), 1);
  h.unmount(); assert.equal(h.timers(), 0);
});

test("the page mounts JLPT with canonical questions and a locale-independent exam identity", () => {
  let mountKey, structured;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ExamMode")
      mountKey = node.attributes.properties.find(prop => prop.name?.text === "key")?.initializer?.expression;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "JlptExamWorkspace") structured = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert(mountKey); assert(structured);
  const identity = (email, locale) => vm.runInNewContext(mountKey.getText(ast), { language: "ja", locale, session: { user: { email } } });
  assert.equal(identity("learner@example.test", "en"), identity("learner@example.test", "zh-CN"));
  assert.notEqual(identity("learner@example.test", "en"), identity("other@example.test", "en"));
  const attributes = Object.fromEntries(structured.attributes.properties.map(prop => [prop.name?.text, prop.initializer?.expression?.getText(ast)]));
  assert.equal(attributes.bank, "bank"); assert.equal(attributes.level, "level");
  assert.equal(attributes.onResult, "onResult");
  const render = ts.transpileModule("const renderQuestion = " + attributes.renderQuestion + ";", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText;
  const context = { QuestionCard: "QuestionCard", React: { createElement: (type, props) => ({ type, props }) } };
  vm.createContext(context); vm.runInContext(render + "\nthis.renderQuestion = renderQuestion;", context);
  const callback = () => {}, card = context.renderQuestion(bank[0], "correct", callback);
  assert.equal(card.props.question, bank[0]); assert.equal(card.props.key, bank[0].id);
  assert.equal(card.props.status, "correct"); assert.equal(card.props.onResult, callback); assert.equal(card.props.lockAnswer, true);
});


test("the real ExamMode exposes the structured entry only for Japanese and never changes global level on entry or return", () => {
  const h = harness({ level: "F", language: "ja" }, "ExamMode");
  h.click("JLPT N3–N1 structures");
  const structured = h.find(node => node.type === "JlptExamWorkspace");
  assert(structured); assert.equal(structured.props.bank, bank); assert.equal(structured.props.level, "F");
  assert.equal(structured.props.onResult, h.props.onResult);
  assert.deepEqual(h.levelChanges, []);
  h.render({ locale: "zh-CN" });
  assert.equal(h.find(node => node.type === "JlptExamWorkspace").props.locale, "zh-CN");
  h.click("← 返回快速组卷");
  assert.equal(h.find(node => node.type === "JlptExamWorkspace"), undefined);
  assert.equal(h.props.level, "F"); assert.deepEqual(h.levelChanges, []);
  const latin = harness({ level: "G", language: "la" }, "ExamMode");
  assert.equal(latin.button("JLPT N3–N1 structures"), undefined);
});

test("manually closing a section invalidates an unanswered callback from that section", () => {
  const h = harness({ bank: [bank[0], bank[2], bank[3]] }); h.start();
  const oldAnswer = h.question().props.onAnswer;
  h.click("Finish section and continue");
  assert.equal(h.question().props.question.id, bank[2].id);
  oldAnswer("correct"); h.render();
  assert.deepEqual(h.results, [], "A previous section cannot receive a late result before its old deadline.");
  h.answer("wrong"); assert.equal(h.results[0].question, bank[2]);
});

test("returning to a JLPT answer remounts the real QuestionCard with locked controls and the first recorded result", () => {
  const original = question("spoken-options", "listening-task", "C", {
    shuffleOptions: false, optionsInAudio: true, transcript: "これは合成した聴解原文です。",
  });
  for (const status of ["wrong", "correct"]) {
    const calls = [];
    const props = { question: original, lockAnswer: true, bookmarked: false, onBookmark() {}, onResult: value => calls.push(value) };
    const first = harness(props, "QuestionCard");
    const choice = first.find(node => node.props.role === "radio" && node.props.key === (status === "correct" ? 0 : 1));
    first.click(choice);
    first.click(first.find(node => node.props.className === "primary-button submit-answer"));
    assert.deepEqual(calls, [status]);
    first.unmount(); assert.equal(first.listenerCount(), 0);

    // A different question would unmount this keyed card. Coming back creates fresh
    // hooks; only the parent's original recorded status can lock this new instance.
    const returned = harness({ ...props, status }, "QuestionCard");
    const options = nodes(returned.tree()).filter(node => node.props.role === "radio");
    assert.equal(options.length, 4); assert(options.every(node => node.props.disabled));
    assert.equal(returned.find(node => node.props.className === "primary-button submit-answer"), undefined);
    assert.equal(returned.find(node => node.type === "Feedback").props.correct, status === "correct");
    assert.equal(options.filter(node => /(^| )correct( |$)/.test(node.props.className)).length, 1);
    assert.equal(options.find(node => /(^| )correct( |$)/.test(node.props.className)).props.key, 0);
    assert(options.every(node => !node.props["aria-checked"] && !/(^| )wrong( |$)/.test(node.props.className)),
      "The remounted card reveals the actual answer without inventing which wrong option was selected.");
    assert.match(returned.text(), /これは合成した聴解原文です/);
    for (const node of options) node.props.onClick();
    returned.render(); returned.key("1"); returned.key("Enter");
    assert.deepEqual(calls, [status], "Disabled controls and keyboard must not submit again.");
    returned.render({ locale: "zh-CN" });
    assert.equal(returned.find(node => node.type === "Feedback").props.correct, status === "correct");
    assert(nodes(returned.tree()).filter(node => node.props.role === "radio").every(node => node.props.disabled));
    returned.key("2"); returned.key("Enter");
    assert.deepEqual(calls, [status]); assert.match(returned.text(), /听力原文/);
    returned.unmount(); assert.equal(returned.listenerCount(), 0);
  }
});

test("ordinary QuestionCard practice retains default unlocked re-answering through both keyboard and buttons", () => {
  const original = question("ordinary-practice", "kanji-reading", "C", { shuffleOptions: false });
  for (const input of ["keyboard", "button"]) {
    const calls = [];
    const h = harness({
      question: original, status: input === "keyboard" ? "wrong" : "correct",
      bookmarked: false, onBookmark() {}, onResult: status => calls.push(status),
    }, "QuestionCard");
    assert(nodes(h.tree()).filter(node => node.props.role === "radio").every(node => !node.props.disabled));
    assert(h.find(node => node.props.className === "primary-button submit-answer"));
    assert.equal(h.find(node => node.type === "Feedback"), undefined);
    if (input === "keyboard") { h.key("1"); h.key("Enter"); }
    else {
      h.click(h.find(node => node.props.role === "radio" && node.props.key === 1));
      h.click(h.find(node => node.props.className === "primary-button submit-answer"));
    }
    assert.deepEqual(calls, [input === "keyboard" ? "correct" : "wrong"]);
    assert.equal(h.find(node => node.type === "Feedback").props.correct, input === "keyboard");
    h.key("3"); h.key("Enter");
    assert.equal(calls.length, 1, "The current attempt stays submitted after ordinary practice answers.");
    h.unmount();
  }
});
