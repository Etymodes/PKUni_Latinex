import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker, { __test } from "../worker/index.js";

const languages = ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"];
const stages = ["C", "F", "G", "M"];
const question = { id: "stable-question-id", level: "C", category: "vocabulary", type: "choice", prompt: "Choose.", options: ["yes", "no"], answer: 0, explanation: "Example." };

test("seven-language CFGM validation preserves the original three-language contract", () => {
  for (const language of languages) {
    for (const level of stages) {
      assert.equal(__test.validPreference(language, level), true);
      assert.equal(__test.validQuestion({ ...question, language, level }), true);
      const progress = { questionId: question.id, language, level, status: "correct", category: "vocabulary" };
      assert.deepEqual(__test.normalizeProgressRecord(progress), progress);
    }
  }
  const legacy = { la: ["elementary", "intermediate", "advanced", "mixed"], ja: ["n4", "n3", "n2", "n1"], es: ["a1", "a2", "b1", "b2", "c1", "c2"] };
  for (const [language, levels] of Object.entries(legacy)) {
    for (const level of levels) {
      assert.equal(__test.validPreference(language, level), true);
      assert.equal(__test.normalizeProgressRecord({ questionId: "existing-id", language, level, status: "wrong" }).level, level);
      assert.equal(__test.validQuestion({ ...question, language, level }), level !== "mixed");
    }
  }
  assert.equal(__test.validQuestion({ ...question, level: "intermediate" }), true);
  for (const [language, level] of [["ja", "a1"], ["es", "n1"], ["ru", "elementary"], ["de", "C"], ["la", "c"], [null, "C"]]) {
    assert.equal(__test.validPreference(language, level), false);
    assert.equal(__test.validQuestion({ ...question, language, level }), false);
    assert.equal(__test.normalizeProgressRecord({ questionId: question.id, language, level, status: "correct" }), null);
  }
});

class Statement {
  constructor(database, sql, values = []) { Object.assign(this, { database, sql, values }); }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  async run() { return this.database.prepare(this.sql).run(...this.values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
}

test("production API round-trips seven languages while retaining legacy records and account isolation", async (t) => {
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  const db = {
    prepare: (sql) => new Statement(database, sql),
    batch: async (statements) => Promise.all(statements.map((statement) => /^\s*(SELECT|PRAGMA)\b/i.test(statement.sql) ? statement.all() : statement.run())),
  };
  const env = { DB: db, SUPABASE_URL: "https://auth.example.test", SUPABASE_PUBLISHABLE_KEY: "test-publishable", GITHUB_ADMIN_LOGINS: "maintainer" };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const id = options.headers.authorization.replace("Bearer ", "");
    if (!["alice", "bob", "admin"].includes(id)) return new Response("Unauthorized", { status: 401 });
    return Response.json({ id, email: `${id}@example.test`, app_metadata: { provider: id === "admin" ? "github" : "email" }, identities: id === "admin" ? [{ provider: "github", identity_data: { user_name: "maintainer" } }] : [] });
  });
  const request = async (path, method = "GET", body, account = "alice") => {
    const response = await worker.fetch(new Request(`https://pikku.qzz.io/api/${path}`, {
      method,
      headers: { ...(account ? { authorization: `Bearer ${account}` } : {}), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), env);
    return { status: response.status, body: await response.json() };
  };

  await __test.ensureSchema(env);
  database.exec(`INSERT INTO attempts_by_language (user_email, language, question_id, status, level, category)
    VALUES ('supabase:alice', 'la', 'i-syn-existing', 'correct', 'intermediate', 'syntax');
    INSERT INTO question_overrides (id, payload, updated_by)
    VALUES ('existing-override', '{"id":"existing-override","level":"intermediate"}', 'supabase:admin');`);
  const schemaBefore = database.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all();
  const legacyAttempt = database.prepare("SELECT * FROM attempts_by_language WHERE question_id='i-syn-existing'").get();
  const legacyOverride = database.prepare("SELECT * FROM question_overrides WHERE id='existing-override'").get();

  for (const [language, level] of [["la", "mixed"], ["ja", "n1"], ["es", "c2"]]) {
    assert.equal((await request("preferences", "PUT", { language, level, vocabMode: "word" })).status, 200);
    assert.deepEqual((await request("stats")).body.preference, { language, level, vocabMode: "word" });
  }
  for (const language of languages) {
    assert.equal((await request("preferences", "PUT", { language, level: "M", vocabMode: "context" })).status, 200);
    assert.deepEqual((await request("stats")).body.preference, { language, level: "M", vocabMode: "context" });
    assert.equal((await request("progress", "POST", { questionId: "shared-id", language, level: "C", category: "vocabulary", status: "correct" })).status, 200);
    assert.equal((await request("vocab", "POST", { language, answers: [{ lemma: "shared-word", correct: true }] })).status, 200);
    assert.equal((await request("bookmarks", "PUT", { language, questionIds: ["shared-id"] })).status, 200);
    const candidate = { ...question, id: `${language}-seed`, language, level: "G" };
    assert.equal((await request(`admin/questions/${candidate.id}`, "PUT", candidate, "admin")).status, 200);
  }
  const alice = (await request("stats")).body;
  assert.deepEqual(Object.keys(alice.byLanguage), languages);
  for (const language of languages) {
    assert.equal(alice.byLanguage[language].progress["shared-id"], "correct");
    assert.deepEqual(alice.byLanguage[language].vocab, [{ lemma: "shared-word", seen: 1, correct: 1 }]);
    assert.deepEqual(alice.byLanguage[language].bookmarks, ["shared-id"]);
  }
  assert.equal(alice.byLanguage.la.progress["i-syn-existing"], "correct");

  assert.equal((await request("progress", "POST", { questionId: "shared-id", language: "ru", level: "F", status: "wrong" }, "bob")).status, 200);
  const bob = (await request("stats", "GET", undefined, "bob")).body;
  assert.deepEqual(bob.byLanguage.ru.progress, { "shared-id": "wrong" });
  assert.deepEqual(bob.byLanguage.la.progress, {});
  assert.equal(bob.preference, null);
  assert.equal((await request("stats")).body.byLanguage.ru.progress["shared-id"], "correct");
  assert.equal((await request("bookmarks", "PUT", { language: "la", questionIds: ["bob-saved"] }, "bob")).status, 200);
  assert.equal((await request("bookmarks", "PUT", { language: "la", questionIds: [] })).status, 200);
  for (let refresh = 0; refresh < 2; refresh += 1) {
    const afterRemoval = (await request("stats")).body;
    assert.deepEqual(afterRemoval.byLanguage.la.bookmarks, []);
    assert.deepEqual(afterRemoval.byLanguage.ja.bookmarks, ["shared-id"]);
  }
  assert.deepEqual((await request("stats", "GET", undefined, "bob")).body.byLanguage.la.bookmarks, ["bob-saved"]);
  assert.equal((await request("stats", "GET", undefined, null)).status, 401);
  assert.equal((await request("preferences", "PUT", { language: "ru", level: "C" }, null)).status, 401);
  assert.equal((await request(`admin/questions/${question.id}`, "PUT", question)).status, 403);
  assert.equal((await request("preferences", "PUT", { language: "ru", level: "n1" })).status, 400);
  assert.equal((await request("progress", "POST", { questionId: "invalid", language: "es", level: "n1", status: "correct" })).status, 400);
  assert.equal((await request(`admin/questions/${question.id}`, "PUT", { ...question, language: "ja", level: "a1" }, "admin")).status, 400);
  assert.equal((await request(`admin/questions/${question.id}`, "PUT", { ...question, level: "intermediate" }, "admin")).status, 200);
  assert.deepEqual(database.prepare("SELECT * FROM attempts_by_language WHERE question_id='i-syn-existing'").get(), legacyAttempt);
  assert.deepEqual(database.prepare("SELECT * FROM question_overrides WHERE id='existing-override'").get(), legacyOverride);
  assert.deepEqual(database.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all(), schemaBefore);
});
