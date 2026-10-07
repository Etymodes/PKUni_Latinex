import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const languages = ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"];
const event = (id, changes = {}) => ({
  id, language: "ja", lemma: "覚える", predictedAt: "2026-10-01T00:00:00.000Z", targetAt: "2026-10-02T00:00:00.000Z", answeredAt: "2026-10-02T12:00:00.000Z",
  outcome: "remembered", probability: 0.7, features: [1, 0.2, 0.3, -0.4, 1, 1], modelVersion: "pikku-recall-v1", mode: "context", ...changes,
});

class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  execute() {
    const prepared = this.database.prepare(this.sql);
    if (/^\s*(SELECT|PRAGMA)\b/i.test(this.sql)) return { results: prepared.all(...this.values) };
    const result = prepared.run(...this.values);
    return { results: [], meta: { changes: Number(result.changes) } };
  }
  async run() { return this.execute(); }
  async all() { return this.execute(); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
}

let instance = 0;
async function setup(t) {
  const { default: worker, __test } = await import(`../worker/index.js?review-test=${++instance}`);
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  let chain = Promise.resolve();
  const db = {
    prepare: sql => new Statement(database, sql),
    batch(statements) {
      assert(statements.length <= 50, "A batch must fit the D1 Free query budget");
      assert(statements.every(statement => statement.values.length <= 100), "D1 permits at most 100 bound parameters per query");
      const operation = chain.then(() => {
        database.exec("BEGIN");
        try {
          const results = statements.map(statement => statement.execute());
          database.exec("COMMIT");
          return results;
        } catch (error) { database.exec("ROLLBACK"); throw error; }
      });
      chain = operation.catch(() => {});
      return operation;
    },
  };
  const env = { DB: db, SUPABASE_URL: "https://auth.example.test", SUPABASE_PUBLISHABLE_KEY: "test-publishable" };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const id = options.headers.authorization.replace("Bearer ", "");
    return ["alice", "bob"].includes(id) ? Response.json({ id, email: `${id}@example.test`, app_metadata: { provider: "email" } }) : new Response("Unauthorized", { status: 401 });
  });
  await __test.ensureSchema(env);
  async function request(path = "vocab/reviews", method = "GET", body, account = "alice", raw = false) {
    const response = await worker.fetch(new Request(`https://pikku.qzz.io/api/${path}`, {
      method, headers: { ...(account ? { authorization: `Bearer ${account}` } : {}), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
    }), env);
    return { status: response.status, body: await response.json() };
  }
  const stats = (account = "alice") => database.prepare("SELECT language, lemma, seen, correct FROM vocab_stats_by_language WHERE user_email=? ORDER BY language, lemma").all(`supabase:${account}`).map(row => ({ ...row }));
  return { database, request, stats, __test };
}

test("review writes are append-only and idempotent, including simultaneous retries and legacy totals", async t => {
  const { request, stats } = await setup(t);
  assert.equal((await request("vocab", "POST", { language: "ja", answers: [{ lemma: "覚える", seen: 3, correctCount: 2 }] })).status, 200);
  const remembered = event("first");
  const forgotten = event("second", { outcome: "forgotten" });
  const responses = await Promise.all(Array.from({ length: 3 }, () => request("vocab/reviews", "POST", { events: [remembered, forgotten, remembered] })));
  assert(responses.every(response => response.status === 200 && response.body.count === 2));
  assert.deepEqual(responses.map(response => response.body.inserted).sort(), [0, 0, 2]);
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 5, correct: 3 }]);
  const conflictingRetry = await request("vocab/reviews", "POST", { events: [event("first", { outcome: "forgotten", language: "la", lemma: "amo" })] });
  assert.equal(conflictingRetry.body.inserted, 0, "An existing ID keeps its original canonical payload");
  assert.deepEqual((await request()).body.events, [remembered, forgotten]);
  assert.equal((await request("vocab", "POST", { language: "ja", answers: [{ lemma: "覚える", correct: true }] })).status, 200);
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 6, correct: 4 }]);
});

test("authenticated identity owns events and every configured language keeps separate statistics", async t => {
  const { request, stats } = await setup(t);
  for (const language of languages) {
    assert.equal((await request("vocab/reviews", "POST", { user: "bob", events: [event(language, { language, lemma: "shared", user_email: "supabase:bob" })] })).status, 200);
  }
  assert.equal((await request("vocab/reviews", "POST", { events: [event("ja", { lemma: "bob-only", outcome: "forgotten" })] }, "bob")).body.inserted, 1);
  assert.deepEqual(stats().map(row => row.language).sort(), [...languages].sort());
  assert(stats().every(row => row.seen === 1 && row.correct === 1));
  assert.deepEqual(stats("bob"), [{ language: "ja", lemma: "bob-only", seen: 1, correct: 0 }]);
  assert.equal((await request()).body.events.length, 7);
  assert.equal((await request("vocab/reviews", "GET", undefined, "bob")).body.events.length, 1);
  assert.equal((await request("vocab/reviews", "GET", undefined, null)).status, 401);
  assert.equal((await request("vocab/reviews", "POST", { events: [event("anonymous")] }, null)).status, 401);
  assert((await request()).body.events.every(item => !("user_email" in item)));
});

test("invalid review batches fail completely without truncation or partial counting", async t => {
  const { request, stats, __test } = await setup(t);
  const invalid = [
    { id: "" }, { id: "a".repeat(129) }, { id: "has space" }, { language: "de" }, { language: ["ja"] }, { lemma: " " }, { lemma: "a".repeat(161) },
    { predictedAt: "invalid" }, { predictedAt: "2026-02-30T00:00:00.000Z" }, { targetAt: "2026-09-30T00:00:00.000Z" }, { answeredAt: "2026-10-01T01:00:00.000Z" },
    { outcome: "correct" }, { probability: -0.1 }, { probability: 1 }, { probability: "0.7" },
    { features: [1] }, { features: [0, 0.2, 0.3, -0.4, 1, 1] }, { features: [1, 2, 0.3, -0.4, 1, 1] }, { features: [1, 0.2, 0.3, -0.4, 0.5, 1] },
    { features: [1, 0.2, 0.3, -0.4, 1, 0] }, { modelVersion: "unknown" }, { mode: "invalid" },
  ];
  for (const changes of invalid) {
    const response = await request("vocab/reviews", "POST", { events: [event("valid-first"), event("invalid-second", changes)] });
    assert.equal(response.status, 400, JSON.stringify(changes));
  }
  for (const body of [null, {}, { events: [] }, { events: [null] }, { events: Array.from({ length: 101 }, (_, index) => event(`large-${index}`)) }, { events: [event("duplicate"), event("duplicate", { outcome: "forgotten" })] }]) {
    assert.equal((await request("vocab/reviews", "POST", body)).status, 400);
  }
  assert.equal((await request("vocab/reviews", "POST", "{bad-json", "alice", true)).status, 400);
  assert.equal(__test.normalizeVocabularyReview(event("nan", { features: [1, NaN, 0, 0, 0, 1] })), null);
  assert.equal(__test.normalizeVocabularyReview(event("infinity", { probability: Infinity })), null);
  assert.deepEqual(stats(), []);
  assert.deepEqual((await request()).body, { events: [], nextCursor: null });
});

test("event and statistics writes roll back together when any event insertion fails", async t => {
  const { request, stats, database } = await setup(t);
  database.exec("CREATE TRIGGER reject_review BEFORE INSERT ON vocabulary_reviews WHEN NEW.event_id='rejected' BEGIN SELECT RAISE(ABORT, 'injected event failure'); END");
  assert.equal((await request("vocab/reviews", "POST", { events: [event("before-failure"), event("rejected")] })).status, 500);
  assert.deepEqual(stats(), []);
  assert.deepEqual((await request()).body.events, []);
  database.exec("DROP TRIGGER reject_review");
  assert.equal((await request("vocab/reviews", "POST", { events: [event("before-failure"), event("rejected")] })).body.inserted, 2);
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 2, correct: 2 }]);
});

test("review pagination handles tied times, user/language filters and the full 500-item page boundary", async t => {
  const { request } = await setup(t);
  const events = Array.from({ length: 503 }, (_, index) => event(`page-${String(index).padStart(4, "0")}`, {
    language: index % 2 ? "la" : "ja", answeredAt: new Date(Date.parse("2026-10-02T12:00:00.000Z") + index % 3).toISOString(),
  }));
  for (let offset = 0; offset < events.length; offset += 100) assert.equal((await request("vocab/reviews", "POST", { events: events.slice(offset, offset + 100) })).body.inserted, Math.min(100, events.length - offset));
  const expected = [...events].sort((left, right) => left.answeredAt.localeCompare(right.answeredAt) || left.id.localeCompare(right.id));
  const first = await request();
  assert.equal(first.body.events.length, 500);
  assert(first.body.nextCursor);
  const second = await request(`vocab/reviews?cursor=${encodeURIComponent(first.body.nextCursor)}`);
  assert.equal(second.body.nextCursor, null);
  assert.deepEqual([...first.body.events, ...second.body.events], expected);
  const filtered = [];
  let cursor = null;
  do {
    const response = await request(`vocab/reviews?language=ja&limit=37${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(response.status, 200);
    filtered.push(...response.body.events); cursor = response.body.nextCursor;
  } while (cursor);
  assert.deepEqual(filtered, expected.filter(item => item.language === "ja"));
  assert.deepEqual((await request("vocab/reviews?language=ja", "GET", undefined, "bob")).body.events, []);
  for (const query of ["limit=0", "limit=501", "limit=-1", "limit=1.5", "limit=", "language=de", "language=", "cursor=bad", "cursor=", `language=ja&cursor=${first.body.nextCursor}`]) {
    assert.equal((await request(`vocab/reviews?${query}`)).status, 400, query);
  }
});

test("the standalone review migration is additive and agrees with automatic schema creation", async t => {
  const { database, request } = await setup(t);
  await request("vocab", "POST", { language: "la", answers: [{ lemma: "amo", correct: true }] });
  const old = database.prepare("SELECT * FROM vocab_stats_by_language").all();
  const migration = await readFile(new URL("../migrations/0006_vocabulary_reviews.sql", import.meta.url), "utf8");
  const columns = database.prepare("PRAGMA table_info(vocabulary_reviews)").all();
  const importColumns = database.prepare("PRAGMA table_info(vocab_imports)").all();
  database.exec(migration);
  database.exec(migration);
  assert.deepEqual(database.prepare("SELECT * FROM vocab_stats_by_language").all(), old);
  assert.deepEqual(database.prepare("PRAGMA table_info(vocabulary_reviews)").all(), columns);
  assert.deepEqual(database.prepare("PRAGMA table_info(vocab_imports)").all(), importColumns);
  const standalone = new DatabaseSync(":memory:");
  try {
    standalone.exec(migration);
    assert.deepEqual(standalone.prepare("PRAGMA table_info(vocabulary_reviews)").all(), columns);
    assert.deepEqual(standalone.prepare("PRAGMA index_list(vocabulary_reviews)").all(), database.prepare("PRAGMA index_list(vocabulary_reviews)").all());
    assert.deepEqual(standalone.prepare("PRAGMA table_info(vocab_imports)").all(), importColumns);
  } finally { standalone.close(); }
});

test("guest aggregate migration retries count once per authenticated user and never create review events", async t => {
  const { request, stats, database } = await setup(t);
  const body = { migrationId: "guest-uuid:ja:0", language: "ja", user: "bob", answers: [{ lemma: "覚える", seen: 3, correctCount: 2 }] };
  const retries = await Promise.all(Array.from({ length: 3 }, () => request("vocab", "POST", body)));
  assert(retries.every(response => response.status === 200 && response.body.count === 1));
  assert.deepEqual(retries.map(response => response.body.inserted).sort(), [0, 0, 1]);
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 3, correct: 2 }]);
  assert.deepEqual((await request()).body.events, []);
  assert.equal((await request("vocab", "POST", body, "bob")).body.inserted, 1);
  assert.deepEqual(stats("bob"), stats());
  assert.equal((await request("vocab", "POST", body, null)).status, 401);
  assert.equal((await request("vocab", "POST", { ...body, language: "la", answers: [{ lemma: "amo", correct: false }] })).body.inserted, 0, "An existing migration ID keeps its first payload even if a retry changes content");
  assert.equal((await request("vocab", "POST", { ...body, migrationId: "guest-uuid:la:0", language: "la", answers: [{ lemma: "amo", correct: false }] })).body.inserted, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM vocab_imports").get().count, 3);
  await request("vocab/reviews", "POST", { events: [event("actual-review")] });
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 4, correct: 3 }, { language: "la", lemma: "amo", seen: 1, correct: 0 }]);
  assert.equal((await request()).body.events.length, 1);
});

test("guest aggregate import markers and statistics roll back together, then retry safely", async t => {
  const { request, stats, database } = await setup(t);
  const body = { migrationId: "rollback:ja:0", language: "ja", answers: Array.from({ length: 100 }, (_, index) => ({ lemma: `word-${index}`, seen: 2, correctCount: 1 })) };
  database.exec("CREATE TRIGGER reject_import BEFORE INSERT ON vocab_imports BEGIN SELECT RAISE(ABORT, 'injected import failure'); END");
  assert.equal((await request("vocab", "POST", body)).status, 500);
  assert.deepEqual(stats(), []);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM vocab_imports").get().count, 0);
  database.exec("DROP TRIGGER reject_import");
  assert.equal((await request("vocab", "POST", body)).body.inserted, 1);
  assert.equal((await request("vocab", "POST", body)).body.inserted, 0);
  assert.equal(stats().length, 100);
  assert(stats().every(row => row.seen === 2 && row.correct === 1));
  assert.deepEqual((await request()).body.events, []);
});

test("guest aggregate migration validates the entire payload without silently truncating", async t => {
  const { request, stats, database } = await setup(t);
  const body = { migrationId: "valid:ja:0", language: "ja", answers: [{ lemma: "覚える", seen: 2, correctCount: 1 }] };
  for (const migrationId of [null, "", "a".repeat(201), "has space", "has/slash", {}, 1]) {
    assert.equal((await request("vocab", "POST", { ...body, migrationId })).status, 400);
  }
  for (const changes of [{ answers: [] }, { answers: null }, { answers: [...body.answers, { lemma: "invalid", seen: 0, correctCount: 0 }] }, { answers: Array.from({ length: 101 }, () => body.answers[0]) }, { language: "de" }, { language: ["ja"] }]) {
    assert.equal((await request("vocab", "POST", { ...body, ...changes })).status, 400);
  }
  assert.equal((await request("vocab", "POST", "{bad-json", "alice", true)).status, 400);
  assert.equal((await request("vocab", "POST", null)).status, 400);
  assert.deepEqual(stats(), []);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM vocab_imports").get().count, 0);
  const duplicateLemmas = { ...body, answers: [body.answers[0], { lemma: "覚える", correct: true }] };
  assert.equal((await request("vocab", "POST", duplicateLemmas)).body.inserted, 1);
  assert.deepEqual(stats(), [{ language: "ja", lemma: "覚える", seen: 3, correct: 2 }]);
});
