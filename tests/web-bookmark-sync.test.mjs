import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { sanitizeVocabularyReviews } from "../lib/vocabulary-model.ts";
import { reviewCounts, subtractReviewCounts, syncVocabularyReviews } from "../lib/vocabulary-review-sync.ts";

// Exercise the callbacks wired into the React page, including its real sync queue.
const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["queueAccountSync", "refreshAccount", "updateBookmarks", "updateLanguageBookmarks", "clearAccountData", "recordVocabularyReview", "recordVocabulary"];
const helpers = ["remoteVocabularyStats", "mergeVocabularyStats", "cacheVocabularyMemory", "readCachedVocabularyMemory", "sanitizeLegacyVocabularyBatches", "legacyVocabularyCounts"];
const callbacks = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) {
    const initializer = node.initializer;
    callbacks.set(node.name.getText(ast), (ts.isCallExpression(initializer) ? initializer.arguments[0] : initializer).getText(ast));
  }
  if (ts.isFunctionDeclaration(node) && helpers.includes(node.name?.text)) callbacks.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule([...helpers.map(name => {
  assert.ok(callbacks.has(name), `${name} must remain connected to the page`);
  return callbacks.get(name);
}), ...names.map((name) => {
  assert.ok(callbacks.has(name), `${name} must remain connected to the page`);
  return `globalThis.${name} = ${callbacks.get(name)};`;
})].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

const plain = (value) => JSON.parse(JSON.stringify(value));
const account = { authenticated: true, user: { email: "learner@example.test" } };
const questionLanguage = (id) => id.startsWith("ja-") ? "ja" : "la";
const review = (id) => ({ id, language: "la", lemma: "casa", predictedAt: "2026-10-01T00:00:00.000Z", targetAt: "2026-10-01T00:00:00.000Z", answeredAt: "2026-10-01T00:00:01.000Z", outcome: "remembered", probability: 0.5, features: [1, 0, 0, 0, 0, 0], modelVersion: "pikku-recall-v1", mode: "word" });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness({ local = [], remote = {}, owner = account.user.email, authenticated = true } = {}) {
  const cloud = plain({ la: [], ja: [], ...remote });
  const calls = [];
  const renders = [];
  const storage = new Map();
  const remoteReviews = new Map();
  const imports = new Set();
  const vocabularyStats = {};
  function addVocabulary(language, lemma, seen, correct) {
    const key = `${language}:${lemma}`;
    const previous = vocabularyStats[key] ?? { language, lemma, seen: 0, correct: 0 };
    vocabularyStats[key] = { ...previous, seen: previous.seen + seen, correct: previous.correct + correct };
  }
  const state = { status: "idle", statsGate: null, failWrite: false, failReviews: false, commitReviewBeforeFailure: false, invalidReviewAck: false, failLegacy: false, commitLegacyBeforeFailure: false };
  const c = {
    crypto: globalThis.crypto,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    STORAGE: { vocabularyMemory: "vocabulary-memory" },
    session: authenticated ? account : { authenticated: false, user: null },
    language: "la",
    languageQuestionIds: { has: (id) => questionLanguage(id) === "la" },
    GUEST_VOCABULARY_OWNER: "guest",
    accountOwnerRef: { current: authenticated ? account.user.email : null },
    accountRevisionRef: { current: 0 },
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
    vocabularyKey: (language, term) => `${language}:${term}`,
    sanitizeVocabularyReviews, subtractReviewCounts, reviewCounts, syncVocabularyReviews,
    validAccountPreference: () => true,
    normalizePikkuLevel: (language, level) => level,
    syncQuestion: (id) => ({ language: questionLanguage(id), level: "C", category: "vocabulary" }),
    t: (text) => text,
    async apiFetch(path, options = {}) {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ path, method: options.method ?? "GET", body });
      if (path === "/api/me") return { ok: true, json: async () => account };
      if (path === "/api/vocab") {
        if (state.failLegacy && !state.commitLegacyBeforeFailure) return { ok: false };
        const inserted = Number(!body.migrationId || !imports.has(body.migrationId));
        if (!body.migrationId || !imports.has(body.migrationId)) {
          for (const item of body.answers) addVocabulary(body.language, item.lemma, item.seen ?? 1, item.correctCount ?? Number(item.correct));
          if (body.migrationId) imports.add(body.migrationId);
        }
        return { ok: !state.failLegacy, json: async () => ({ ok: true, count: body.answers.length, inserted }) };
      }
      if (path.startsWith("/api/vocab/reviews")) {
        if (state.failReviews && !state.commitReviewBeforeFailure) return { ok: false };
        if (options.method !== "POST") return { ok: true, json: async () => ({ events: [...remoteReviews.values()], nextCursor: null }) };
        let inserted = 0;
        for (const event of body.events) if (!remoteReviews.has(event.id)) {
          remoteReviews.set(event.id, event); inserted++;
          addVocabulary(event.language, event.lemma, 1, Number(event.outcome === "remembered"));
        }
        return { ok: !state.failReviews, json: async () => ({ ok: true, count: body.events.length + Number(state.invalidReviewAck), inserted }) };
      }
      if (path === "/api/stats") {
        const stats = { progress: {}, bookmarks: Object.values(cloud).flat(), vocab: plain(Object.values(vocabularyStats)),
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
  return { c, cloud, calls, renders, state, remoteReviews, vocabularyStats,
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

test("a review sync failure retries the same frozen guest import without counting reviews twice", async () => {
  const h = harness({ owner: "guest" });
  h.c.vocabularyMemoryRef.current = { owner: "guest", stats: { "la:casa": { seen: 3, correct: 2 } }, reviews: [review("guest-review")] };
  h.state.failReviews = true;
  await h.c.refreshAccount(account);
  assert.equal(h.state.status, "error");
  assert.equal(h.c.vocabularyMemoryRef.current.owner, "guest");
  assert.deepEqual(h.vocabularyStats["la:casa"], { language: "la", lemma: "casa", seen: 2, correct: 1 });
  const firstImport = h.calls.find(call => call.path === "/api/vocab").body;
  assert.match(firstImport.migrationId, /^[A-Za-z0-9_-]+:la:0$/);
  assert.deepEqual(firstImport.answers, [{ lemma: "casa", seen: 2, correctCount: 1 }]);
  h.state.failReviews = false;
  await h.c.refreshAccount(account);
  await h.c.refreshAccount(account);
  const imports = h.calls.filter(call => call.path === "/api/vocab");
  assert.equal(imports.length, 2);
  assert.deepEqual(imports[1].body, firstImport);
  assert.equal(h.remoteReviews.size, 1);
  assert.deepEqual(h.vocabularyStats["la:casa"], { language: "la", lemma: "casa", seen: 3, correct: 2 });
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.stats), { "la:casa": { seen: 3, correct: 2 } });
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingReviewIds), []);
});

test("a committed review with a lost response stays pending until refresh confirms it, without an aggregate upload", async () => {
  const h = harness();
  h.state.failReviews = true;
  h.state.commitReviewBeforeFailure = true;
  assert.equal(h.c.recordVocabularyReview(review("lost-response")), true);
  assert.equal(h.c.recordVocabularyReview(review("lost-response")), false);
  assert.equal(h.c.recordVocabularyReview({ invalid: true }), false);
  await h.drain();
  assert.equal(h.state.status, "error");
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingReviewIds), ["lost-response"]);
  assert.equal(h.remoteReviews.size, 1);
  h.state.failReviews = false;
  await h.c.refreshAccount(account);
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingReviewIds), []);
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.stats), { "la:casa": { seen: 1, correct: 1 } });
  assert.equal(h.calls.filter(call => call.path === "/api/vocab").length, 0);
  assert.equal(h.calls.filter(call => call.path === "/api/vocab/reviews" && call.method === "POST").length, 1);
});

test("legacy measurements keep their batch IDs after a lost response and retry every 100-item chunk once", async () => {
  const h = harness();
  h.state.failLegacy = true;
  h.state.commitLegacyBeforeFailure = true;
  const answers = Array.from({ length: 101 }, (_, index) => ({ lemma: `word-${index}`, correct: index % 2 === 0 }));
  assert.equal(h.c.recordVocabulary("la", answers), true);
  await h.drain();
  assert.equal(h.state.status, "error");
  assert.equal(h.c.vocabularyMemoryRef.current.pendingLegacyBatches.length, 2);
  assert.equal(Object.keys(h.vocabularyStats).length, 100);
  const ids = plain(h.c.vocabularyMemoryRef.current.pendingLegacyBatches.map(batch => batch.id));
  h.state.failLegacy = false;
  await h.c.refreshAccount(account);
  const uploads = h.calls.filter(call => call.path === "/api/vocab");
  assert.deepEqual(uploads.map(call => call.body.migrationId), [ids[0], ...ids]);
  assert.deepEqual(uploads.map(call => call.body.answers.length), [100, 100, 1]);
  assert.equal(Object.keys(h.vocabularyStats).length, 101);
  assert(Object.values(h.vocabularyStats).every(item => item.seen === 1));
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingLegacyBatches), []);
  assert.equal(h.remoteReviews.size, 0, "A legacy measurement must not invent calibrated review events");
});

test("anonymous refresh preserves guest reviews and measurements, then imports both without double counting", async () => {
  const h = harness({ owner: "guest", authenticated: false });
  assert.equal(h.c.recordVocabulary("la", [{ lemma: "casa", correct: false }]), true);
  assert.equal(h.c.recordVocabularyReview(review("offline")), true);
  await h.c.refreshAccount({ authenticated: false, user: null });
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.stats), { "la:casa": { seen: 2, correct: 1 } });
  assert.equal(h.c.vocabularyMemoryRef.current.pendingLegacyBatches.length, 1);
  assert.equal(h.c.vocabularyMemoryRef.current.reviews.length, 1);
  await h.c.refreshAccount(account);
  assert.equal(h.calls.filter(call => call.path === "/api/vocab").length, 1, "Only the pending legacy batch should be uploaded, without a duplicate guest aggregate");
  assert.equal(h.remoteReviews.size, 1);
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.stats), { "la:casa": { seen: 2, correct: 1 } });
});

test("account expiration keeps pending reviews in that account's cache and restores them only on its return", async () => {
  const h = harness();
  h.state.failReviews = true;
  h.c.recordVocabularyReview(review("account-pending"));
  await h.drain();
  await h.c.refreshAccount({ authenticated: false, user: null });
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current), { owner: "guest", stats: {} });
  const saved = h.c.readCachedVocabularyMemory(account.user.email);
  assert.deepEqual(plain(saved.pendingReviewIds), ["account-pending"]);
  assert.equal(h.c.readCachedVocabularyMemory("other@example.test"), null);
  h.state.failReviews = false;
  await h.c.refreshAccount(account);
  assert.equal(h.remoteReviews.size, 1);
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingReviewIds), []);
});

test("malformed successful review acknowledgments retain pending work and stale account callbacks cannot record", async () => {
  const h = harness();
  h.state.invalidReviewAck = true;
  assert.equal(h.c.recordVocabularyReview(review("bad-ack")), true);
  await h.drain();
  assert.equal(h.state.status, "error");
  assert.deepEqual(plain(h.c.vocabularyMemoryRef.current.pendingReviewIds), ["bad-ack"]);
  h.c.accountOwnerRef.current = "other@example.test";
  assert.equal(h.c.recordVocabularyReview(review("stale-account")), false);
  assert.equal(h.c.recordVocabulary("la", [{ lemma: "stale", correct: true }]), false);
  assert.equal(h.c.vocabularyMemoryRef.current.reviews.length, 1);
});

test("an in-flight bookmark operation cannot write its old account's changes after an account switch", async () => {
  const h = harness({ remote: { la: ["la-existing"] } });
  const gate = h.pauseNextStats();
  h.c.updateLanguageBookmarks(["la-old-account-new"]);
  await gate.started.promise;
  h.c.accountOwnerRef.current = "other@example.test";
  h.c.session = { authenticated: true, user: { email: "other@example.test" } };
  gate.release.resolve();
  await h.drain();
  assert.deepEqual(h.writes(), []);
  assert.deepEqual(h.cloud.la, ["la-existing"]);
});
