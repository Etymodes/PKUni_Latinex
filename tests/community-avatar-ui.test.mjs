import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { communityAvatarPresets, communityAvatarText, defaultCommunityAvatar, isCommunityAvatar, normalizeCommunityAvatar } from "../lib/community-avatar.ts";

const source = fs.readFileSync(new URL("../app/community-avatar.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source.replace(/^import .*;\r?$/gm, "").replace(/^export /gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function nodes(tree) { return tree && typeof tree === "object" ? [tree, ...(tree.children || []).flat(Infinity).flatMap(nodes)] : []; }
function content(tree) { return tree == null || tree === false ? "" : typeof tree !== "object" ? String(tree) : (tree.children || []).flat(Infinity).map(content).join(" "); }

// Runs the actual settings and badge functions with persistent hooks and effects.
// Every profile request is a deferred local mock; this test never contacts an account.
function harness(props = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, dirty = true, tree, mounted = true, staleWrites = 0;
  const current = { locale: "en", authenticated: true, ...props };
  const context = {
    communityAvatarPresets, communityAvatarText, defaultCommunityAvatar, isCommunityAvatar, normalizeCommunityAvatar,
    AbortController, console,
    apiFetch(path, options = {}) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : undefined, resolve, reject });
      return promise;
    },
    React: { Fragment: "fragment", createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : ({ type, props: props || {}, children }) },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, value => {
        if (!mounted) staleWrites++;
        const next = typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(slots[index].value, next)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  vm.createContext(context); vm.runInContext(code, context);
  function render(update) {
    if (update) Object.assign(current, update);
    if (!mounted) return tree;
    let passes = 0;
    do {
      dirty = false; cursor = 0; tree = context.CommunityAvatarSettings(current);
      while (effects.length) effects.shift()();
      assert(++passes < 15, "avatar effects settle");
    } while (dirty);
    return tree;
  }
  async function flush() { await new Promise(setImmediate); render(); }
  const find = predicate => nodes(tree).find(predicate);
  const button = label => find(node => node.type === "button" && (node.props["aria-label"] === label || content(node).trim() === label));
  render();
  return {
    context, calls, render, flush, find, button, tree: () => tree, text: () => content(tree),
    badge: () => find(node => node.props.role === "img"),
    save: () => find(node => node.type === "button" && node.props.className === "primary-button"),
    input: () => find(node => node.type === "input"),
    change(value) { find(node => node.type === "input").props.onChange({ target: { value } }); render(); },
    click(label) { const node = button(label); assert(node, label); assert(!node.props.disabled, `${label} is enabled`); node.props.onClick(); render(); },
    async reply(call, body, status = 200) { call.resolve(response(body, status)); await flush(); },
    async reject(call, failure = Error("offline")) { call.reject(failure); await flush(); },
    staleWrites: () => staleWrites,
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); },
  };
}

for (const locale of ["en", "zh-CN"]) {
  test(`${locale}: anonymous avatar settings have a sign-in prompt and never read or save a profile`, () => {
    const h = harness({ locale, authenticated: false });
    assert.equal(h.calls.length, 0);
    assert.equal(h.save(), undefined);
    assert.equal(h.input(), undefined);
    assert.match(h.text(), locale === "en" ? /Sign in to choose/ : /登录后可设置/);
    assert.equal(h.badge().props["aria-label"], locale === "en" ? "Community avatar · Cat" : "社区头像 · 猫");
  });

  test(`${locale}: the profile loads before editing and a preset save uses the shared structured avatar`, async () => {
    const h = harness({ locale });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].path, "/api/community/profile");
    assert(h.save().props.disabled);
    await h.reply(h.calls[0], { avatar: { kind: "preset", value: "fox" } });
    assert(!h.save().props.disabled);
    assert.equal(h.badge().props["aria-label"], locale === "en" ? "Community avatar · Fox" : "社区头像 · 狐狸");
    h.click(locale === "en" ? "Apple" : "苹果");
    const save = h.save().props.onClick;
    save(); save(); h.render();
    assert.equal(h.calls.length, 2, "A double click must perform only one PUT.");
    assert.equal(h.calls[1].options.method, "PUT");
    assert.deepEqual(h.calls[1].body, { avatar: { kind: "preset", value: "apple" } });
    assert(h.save().props.disabled);
    await h.reply(h.calls[1], { avatar: { kind: "preset", value: "apple" } });
    assert.match(h.text(), locale === "en" ? /Avatar saved/ : /头像已保存/);
    assert(!h.save().props.disabled);
    assert.equal(h.badge().children[0], "🍎");
  });
}

test("initials retain case, reject invalid values locally, and submit only a valid draft", async () => {
  const h = harness(); await h.reply(h.calls[0], { avatar: { kind: "preset", value: "cat" } });
  h.click("Letters");
  for (const invalid of ["", "abc", "ABC", "A1", "A B", "ABc", "Abcd", "A\n", "猫"]) {
    h.change(invalid);
    assert(h.save().props.disabled, JSON.stringify(invalid));
    assert(h.find(node => node.props.role === "alert"));
    h.save().props.onClick(); h.render();
    assert.equal(h.calls.length, 1, "Even invoking the disabled callback cannot submit invalid data.");
  }
  for (const valid of ["A", "AB", "Ab", "Abc"]) {
    h.change(valid); assert(!h.save().props.disabled, valid);
    assert.equal(h.badge().children[0], valid);
  }
  h.click("Save avatar");
  assert.deepEqual(h.calls[1].body, { avatar: { kind: "initials", value: "Abc" } });
  await h.reply(h.calls[1], { avatar: { kind: "initials", value: "Abc" } });
  assert.equal(h.input().props.value, "Abc");
  assert.match(h.text(), /Avatar saved/);
});

test("a failed profile read reports failure and settles its loading controls", async () => {
  for (const failure of ["network", "http"]) {
    const h = harness();
    if (failure === "network") await h.reject(h.calls[0]);
    else await h.reply(h.calls[0], { error: "unavailable" }, 503);
    assert.match(h.text(), /could not be synced/);
    assert(!h.save().props.disabled);
    assert.equal(h.badge().children[0], "🐱");
  }
});

test("a malformed profile response is a loading error rather than a silently accepted default", async () => {
  for (const receipt of [{}, { avatar: { kind: "initials", value: "123" } }]) {
    const h = harness(); await h.reply(h.calls[0], receipt);
    assert.match(h.text(), /could not be synced/);
    assert(!h.save().props.disabled);
    assert.equal(h.badge().children[0], "🐱");
    assert.doesNotMatch(h.text(), /Avatar saved/);
  }
});

test("a failed save preserves the draft and supports retry; 401 identifies the expired session", async () => {
  for (const failure of ["network", 401, 400, 503]) {
    const h = harness(); await h.reply(h.calls[0], { avatar: { kind: "initials", value: "A" } });
    h.change("Ab"); h.click("Save avatar");
    if (failure === "network") await h.reject(h.calls[1]);
    else await h.reply(h.calls[1], { error: "failed" }, failure);
    assert.equal(h.input().props.value, "Ab");
    assert(!h.save().props.disabled);
    assert.match(h.text(), failure === 401 ? /session expired/ : /could not be synced/);
    assert.doesNotMatch(h.text(), /Avatar saved/);
    h.click("Save avatar");
    assert.deepEqual(h.calls[2].body, h.calls[1].body);
    await h.reply(h.calls[2], { avatar: { kind: "initials", value: "Ab" } });
    assert.match(h.text(), /Avatar saved/);
  }
});

test("a malformed successful save receipt never claims success or replaces the draft with a default avatar", async () => {
  for (const receipt of [{}, { avatar: { kind: "initials", value: "123" } }, { avatar: { kind: "preset", value: "unknown" } }, { avatar: { kind: "initials", value: "Z" } }]) {
    const h = harness(); await h.reply(h.calls[0], { avatar: { kind: "initials", value: "A" } });
    h.change("Ab"); h.click("Save avatar");
    await h.reply(h.calls[1], receipt);
    assert.equal(h.input()?.props.value, "Ab");
    assert.match(h.text(), /could not be synced/);
    assert.doesNotMatch(h.text(), /Avatar saved/);
    assert(!h.save().props.disabled);
  }
});

test("a locale change translates labels and completion status without refetching or discarding the draft", async () => {
  const h = harness(); await h.reply(h.calls[0], { avatar: { kind: "initials", value: "A" } });
  h.change("Ab"); h.click("Save avatar");
  h.render({ locale: "zh-CN" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.input().props.value, "Ab");
  assert.match(h.text(), /保存中/);
  await h.reply(h.calls[1], { avatar: { kind: "initials", value: "Ab" } });
  assert.match(h.text(), /头像已保存/);
  assert.doesNotMatch(h.text(), /Avatar saved/);
});

test("unmounting aborts pending load and save requests; late success and failure never update state", async () => {
  for (const operation of ["load", "save"]) {
    for (const completion of ["success", "failure"]) {
      const h = harness(); let pending = h.calls[0];
      if (operation === "save") {
        await h.reply(pending, { avatar: { kind: "initials", value: "A" } });
        h.change("Ab"); h.click("Save avatar"); pending = h.calls[1];
      }
      h.unmount(); assert(pending.options.signal.aborted);
      if (completion === "success") await h.reply(pending, { avatar: { kind: "initials", value: "OLD" } });
      else await h.reject(pending);
      assert.equal(h.staleWrites(), 0, `${operation}: ${completion}`);
    }
  }
});

test("account switching remounts personal settings, so a previous profile completion cannot overwrite the new account", async () => {
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let accountKey;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "PersonalSettings") {
      accountKey = node.attributes.properties.find(item => item.name?.text === "key")?.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(accountKey?.includes("session.user") && accountKey.includes("email"), "Settings must remount when account identity changes.");
  for (const operation of ["load", "save"]) {
    const old = harness(); let pending = old.calls[0];
    if (operation === "save") {
      await old.reply(pending, { avatar: { kind: "initials", value: "A" } });
      old.change("Ab"); old.click("Save avatar"); pending = old.calls[1];
    }
    old.unmount();
    const fresh = harness(); await fresh.reply(fresh.calls[0], { avatar: { kind: "initials", value: "B" } });
    await old.reply(pending, { avatar: { kind: "initials", value: "Ab" } });
    assert.equal(old.staleWrites(), 0);
    assert.equal(fresh.input().props.value, "B");
    assert.equal(fresh.calls.length, 1);
    assert.doesNotMatch(fresh.text(), /Avatar saved/);
  }
});

test("badges use the shared validation and localized accessible names without interpreting remote strings as markup", () => {
  const h = harness({ authenticated: false });
  const badge = h.context.CommunityAvatarBadge;
  const initial = badge({ avatar: { kind: "initials", value: "Abc" }, locale: "en", small: true });
  assert.equal(initial.props.className, "community-avatar small");
  assert.equal(initial.props["aria-label"], "Community avatar · Abc");
  assert.equal(initial.children[0], "Abc");
  const fallback = badge({ avatar: { kind: "initials", value: "<img src=x>" }, locale: "zh-CN" });
  assert.equal(fallback.children[0], "🐱");
  assert.equal(fallback.props["aria-label"], "社区头像 · 猫");
  assert.equal(fallback.props.dangerouslySetInnerHTML, undefined);
  assert.deepEqual(plain(defaultCommunityAvatar), { kind: "preset", value: "cat" });
});
