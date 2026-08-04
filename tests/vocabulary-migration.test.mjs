import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const { __test } = await import("../worker/index.js");

class PreparedStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new PreparedStatement(this.database, this.sql, values);
  }

  async run() {
    return this.database.prepare(this.sql).run(...this.values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) ?? null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }
}

class TestD1 {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new PreparedStatement(this.database, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

test("an existing account preference table gains the vocabulary mode safely", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    database.exec(`CREATE TABLE user_preferences (
        user_email TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        level TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE app_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO app_migrations (version) VALUES ('multilingual-sync-v1');`);

    const db = new TestD1(database);
    assert.equal(await __test.ensureSchema({ DB: db }), true);

    const columns = await db.prepare("PRAGMA table_info(user_preferences)").all();
    assert.equal(columns.results.some((column) => column.name === "vocab_mode"), true);
    const migration = await db.prepare("SELECT version FROM app_migrations WHERE version='vocabulary-trainer-v1'").first();
    assert.equal(migration?.version, "vocabulary-trainer-v1");
  } finally {
    database.close();
  }
});
