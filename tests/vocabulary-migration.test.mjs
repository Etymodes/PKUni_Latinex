import assert from "node:assert/strict";
import test from "node:test";
import { Miniflare } from "miniflare";

test("an existing account preference table gains the vocabulary mode safely", async () => {
  const miniflare = new Miniflare({
    compatibilityDate: "2026-07-14",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "pikku-vocabulary-migration" },
    modules: true,
    scriptPath: "worker/index.js",
  });

  try {
    const db = await miniflare.getD1Database("DB");
    await db.batch([
      db.prepare(`CREATE TABLE user_preferences (
        user_email TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        level TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE app_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("INSERT INTO app_migrations (version) VALUES ('multilingual-sync-v1')"),
    ]);

    const response = await miniflare.dispatchFetch("http://localhost/api/me");
    assert.equal(response.status, 200);

    const columns = await db.prepare("PRAGMA table_info(user_preferences)").all();
    assert.equal(columns.results.some((column) => column.name === "vocab_mode"), true);
    const migration = await db.prepare("SELECT version FROM app_migrations WHERE version='vocabulary-trainer-v1'").first();
    assert.equal(migration?.version, "vocabulary-trainer-v1");
  } finally {
    await miniflare.dispose();
  }
});
