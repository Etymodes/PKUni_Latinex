import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the callbacks wired into the React page, including its real sync queue.
const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["queueAccountSync", "refreshAccount", "updateBookmarks", "updateLanguageBookmarks", "clearAccountData"];
const callbacks = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) {
    callbacks.set(node.name.getText(ast), node.initializer.arguments[0].getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(names.map((name) => {
  assert.ok(callbacks.has(name), `${name} must remain connected to the page`);
  return `globalThis.${name} = ${callbacks.get(name)};`;
}).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

const plain = (value) => JSON.parse(JSON.stringify(value));
const account = { authenticated: true, user: { email: "learner@example.test" } };
const questionLanguage = (id) => id.startsWith("ja-") ? "ja" : "la";
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness({ local = [], remote = {}, owner = account.user.email, authenticated = true } = {}) {
  const cloud = plain({ la: [], ja: [], ...remote });
  const calls = [];
  const renders = [];
  const state = { status: "idle", statsGate: null, failWrite: false };
  const c = {
    session: authenticated ? account : { authenticated: false, user: null },
    language: "la",
    languageQuestionIds: { has: (id) => questionLanguage(id) === "la" },
    GUEST_VOCABULARY_OWNER: "guest",
    languageConfigs: { la: {}, ja: {} },
    pendingAccountSyncs: { current: new Set() },
    accountSyncChain: { current: Promise.resolve() },
    bookmarkRevisionRef: { current: 0 },
    bookmarksRef: { current: [...local] },
    progressRef: { current: {} },
    vocabularyMemoryRef: { current: { owner, stats: {} } },
    languageRef: { current: "la" },
    languageLevelRef: { current: "C" },
    vocabularyModeRef: { current: "context" },
    setSession(value) { c.session = value; },
    setSyncStatus(value) { state.status = typeof value === "function" ? value(state.status) : value; },
    setBookmarks(value) { renders.push(plain(value)); },
    setProgress() {}, setVocabularyMemory() {}, setLanguage() {}, setLanguageLevel() {}, setVocabularyMode() {},
    remoteVocabularyStats: () => ({}),
    mergeVocabularyStats: () => ({}),
    validAccountPreference: () => true,
    normalizePikkuLevel: (language, level) => level,
    syncQuestion: (id) => ({ language: questionLanguage(id), level: "C", category: "vocabulary" }),
    t: (text) => text,
    async apiFetch(path, options = {}) {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ path, method: options.method ?? "GET", body });
      if (path === "/api/me") return { ok: true, json: async () => account };
      if (path === "/api/vocab") return { ok: true };
      if (path === "/api/stats") {
        const stats = { progress: {}, bookmarks: Object.values(cloud).flat(), vocab: [],
          byLanguage: Object.fromEntries(Object.entries(cloud).map(([language, bookmarks]) => [language, { bookmarks: [...bookmarks] }])),
          preference: { language: "la", level: "C", vocabMode: "context" } };
        const gate = state.statsGate;
        state.statsGate = null;
        if (gate) { gate.started.resolve(); await gate.release.promise; }
        return { ok: true, json: async () => stats };
      }
      assert.equal(path, "/api/bookmarks");
      assert.equal(options.method, "PUT");
      assert.equal("items" in body, false, "a web bookmark change must not replace every language");
      if (state.failWrite) return { ok: false };
      cloud[body.language] = [...body.questionIds];
      return { ok: true };
    },
  };
  vm.createContext(c);
  vm.runInContext(code, c);
  return { c, cloud, calls, renders, state,
    async drain() { await c.accountSyncChain.current.catch(() => {}); await Promise.resolve(); },
    writes: () => calls.filter((call) => call.method === "PUT"),
    pauseNextStats() {
      const gate = { started: deferred(), release: deferred() };
      state.statsGate = gate;
      return gate;
    },
  };
}

test("account refresh accepts an empty cloud list without resurrecting a mini-program deletion", async () => {
  const h = harness({ local: ["la-deleted"] });
  await h.c.refreshAccount(account);
  await h.c.refreshAccount(account);
  assert.deepEqual(plain(h.c.bookmarksRef.current), []);
  assert.deepEqual(h.writes(), []);
});

test("another account's cached bookmarks are never imported", async () => {
  const h = harness({ local: ["la-other-account"], remote: { ja: ["ja-current-account"] }, owner: "someone@example.test" });
  await h.c.refreshAccount(account);
  assert.deepEqual(plain(h.c.bookmarksRef.current), ["ja-current-account"]);
  assert.deepEqual(h.writes(), []);
});

test("concurrent startup refreshes import guest bookmarks once and later respect remote deletion", async () => {
  const h = harness({ local: ["la-guest"], remote: { la: ["la-existing"], ja: ["ja-existing"] }, owner: "guest" });
  await Promise.all([h.c.refreshAccount(account), h.c.refreshAccount(account)]);
  assert.deepEqual(h.cloud, { la: ["la-existing", "la-guest"], ja: ["ja-existing"] });
  assert.equal(h.writes().length, 1);
  assert.equal(h.c.vocabularyMemoryRef.current.owner, account.user.email);
  h.cloud.la = [];
  await h.c.refreshAccount(account);
  assert.deepEqual(plain(h.c.bookmarksRef.current), ["ja-existing"]);
  assert.equal(h.writes().length, 1);
});

test("a failed guest bookmark import keeps its owner marker and can be retried", async () => {
  const h = harness({ local: ["la-guest"], owner: "guest" });
  h.c.vocabularyMemoryRef.current.stats = { "la:casa": { seen: 2, correct: 1 } };
  h.state.failWrite = true;
  await h.c.refreshAccount(account);
  assert.equal(h.state.status, "error");
  assert.equal(h.c.vocabularyMemoryRef.current.owner, "guest");
  assert.equal(h.calls.filter((call) => call.path === "/api/vocab").length, 0);
  h.state.failWrite = false;
  await h.c.refreshAccount(account);
  await h.c.refreshAccount(account);
  assert.deepEqual(h.cloud.la, ["la-guest"]);
  assert.equal(h.c.vocabularyMemoryRef.current.owner, account.user.email);
  assert.equal(h.calls.filter((call) => call.path === "/api/vocab").length, 1);
});

test("signing out during a queued refresh cannot turn an old account snapshot into guest bookmarks", async () => {
  const h = harness({ local: ["la-old-account"] });
  const gate = h.pauseNextStats();
  const refresh = h.c.refreshAccount(account);
  await gate.started.promise;
  h.c.clearAccountData();
  gate.release.resolve();
  await refresh;
  assert.deepEqual(h.writes(), []);
  assert.deepEqual(plain(h.c.bookmarksRef.current), []);
});

test("an unrelated web addition keeps remote additions and cannot restore stale local bookmarks", async () => {
  const h = harness({ local: ["la-deleted", "ja-stale"], remote: { la: ["la-remote"], ja: ["ja-remote"] } });
  h.c.updateLanguageBookmarks((current) => [...current, "la-new"]);
  await h.drain();
  assert.deepEqual(h.cloud, { la: ["la-remote", "la-new"], ja: ["ja-remote"] });
  assert.deepEqual(h.writes().map((call) => call.body), [{ language: "la", questionIds: ["la-remote", "la-new"] }]);
  assert.deepEqual(new Set(h.c.bookmarksRef.current), new Set(["la-remote", "la-new", "ja-remote"]));
});

test("removing the last bookmark writes an empty language list and preserves other languages", async () => {
  const h = harness({ local: ["la-last"], remote: { la: ["la-last"], ja: ["ja-remote"] } });
  h.c.updateLanguageBookmarks([]);
  await h.drain();
  await h.c.refreshAccount(account);
  assert.deepEqual(h.cloud, { la: [], ja: ["ja-remote"] });
  assert.deepEqual(h.writes().map((call) => call.body), [{ language: "la", questionIds: [] }]);
  assert.deepEqual(plain(h.c.bookmarksRef.current), ["ja-remote"]);
});

test("a refresh waits for a pending removal before reading account bookmarks", async () => {
  const h = harness({ local: ["la-last"], remote: { la: ["la-last"] } });
  const gate = h.pauseNextStats();
  h.c.updateLanguageBookmarks([]);
  await gate.started.promise;
  const refresh = h.c.refreshAccount(account);
  assert.equal(h.calls.filter((call) => call.path === "/api/stats").length, 1);
  gate.release.resolve();
  await refresh;
  assert.deepEqual(h.cloud.la, []);
  assert.deepEqual(plain(h.c.bookmarksRef.current), []);
  assert.equal(h.writes().length, 1);
});

test("a slow refresh cannot overwrite a newer local removal while its write waits", async () => {
  const h = harness({ local: ["la-last"], remote: { la: ["la-last"] } });
  const gate = h.pauseNextStats();
  const refresh = h.c.refreshAccount(account);
  await gate.started.promise;
  h.c.updateLanguageBookmarks([]);
  gate.release.resolve();
  await refresh;
  await h.drain();
  assert.deepEqual(h.cloud.la, []);
  assert.ok(h.renders.every((bookmarks) => !bookmarks.includes("la-last")));
});

test("rapid add then remove stays removed after both queued operations", async () => {
  const h = harness();
  const gate = h.pauseNextStats();
  h.c.updateLanguageBookmarks(["la-new"]);
  await gate.started.promise;
  h.c.updateLanguageBookmarks([]);
  const removalRender = h.renders.length - 1;
  gate.release.resolve();
  await h.drain();
  assert.deepEqual(h.cloud.la, []);
  assert.deepEqual(h.writes().map((call) => call.body.questionIds), [["la-new"], []]);
  assert.ok(h.renders.slice(removalRender).every((bookmarks) => !bookmarks.includes("la-new")));
});
