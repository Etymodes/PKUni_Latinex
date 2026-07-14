const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, question_id TEXT NOT NULL,
    status TEXT NOT NULL, level TEXT, category TEXT, answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS attempts_user_question ON attempts(user_email, question_id, answered_at)`,
  `CREATE TABLE IF NOT EXISTS vocab_stats (
    user_email TEXT NOT NULL, lemma TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_email, lemma)
  )`,
  `CREATE TABLE IF NOT EXISTS question_overrides (
    id TEXT PRIMARY KEY, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

let schemaReady;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function identity(request, env) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return null;
  let name = request.headers.get("oai-authenticated-user-full-name") || email.split("@")[0];
  try { name = decodeURIComponent(name); } catch { /* keep the forwarded value */ }
  const admins = String(env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return { email, name, role: admins.includes(email) ? "admin" : "student" };
}

async function ensureSchema(env) {
  if (!env.DB) return false;
  schemaReady ||= env.DB.batch(schema.map((sql) => env.DB.prepare(sql)));
  await schemaReady;
  return true;
}

async function touchUser(env, user) {
  await env.DB.prepare(`INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, last_seen=CURRENT_TIMESTAMP`)
    .bind(user.email, user.name, user.role).run();
}

function validQuestion(value) {
  const levels = ["elementary", "intermediate", "advanced"];
  const categories = ["morphology", "syntax", "sentencePattern", "vocabulary", "classics", "translation"];
  return value && typeof value.id === "string" && value.id.length <= 80 && levels.includes(value.level)
    && categories.includes(value.category) && ["choice", "self-check"].includes(value.type)
    && typeof value.prompt === "string" && typeof value.explanation === "string";
}

async function api(request, env, url) {
  const hasDb = await ensureSchema(env);
  const user = identity(request, env);
  if (hasDb && user) await touchUser(env, user);

  if (url.pathname === "/api/me" && request.method === "GET") {
    return json({ authenticated: Boolean(user), user, persistence: hasDb });
  }

  if (url.pathname === "/api/questions" && request.method === "GET") {
    if (!hasDb) return json({ overrides: [] });
    const result = await env.DB.prepare("SELECT id, payload, deleted, updated_at FROM question_overrides ORDER BY updated_at DESC").all();
    return json({ overrides: result.results.map((row) => ({ id: row.id, deleted: Boolean(row.deleted), question: row.payload ? JSON.parse(row.payload) : null, updatedAt: row.updated_at })) });
  }

  if (url.pathname === "/api/stats" && request.method === "GET") {
    if (!user) return json({ error: "请先登录" }, 401);
    const [attempts, vocab] = await env.DB.batch([
      env.DB.prepare(`SELECT a.question_id, a.status FROM attempts a
        JOIN (SELECT question_id, MAX(id) id FROM attempts WHERE user_email=? GROUP BY question_id) latest ON latest.id=a.id`).bind(user.email),
      env.DB.prepare("SELECT lemma, seen, correct FROM vocab_stats WHERE user_email=?").bind(user.email),
    ]);
    const progress = Object.fromEntries(attempts.results.map((row) => [row.question_id, row.status]));
    return json({ progress, vocab: vocab.results });
  }

  if (url.pathname === "/api/progress" && request.method === "POST") {
    if (!user) return json({ error: "请先登录" }, 401);
    const body = await request.json();
    if (!body.questionId || !["correct", "wrong", "review"].includes(body.status)) return json({ error: "无效记录" }, 400);
    await env.DB.prepare("INSERT INTO attempts (user_email, question_id, status, level, category) VALUES (?, ?, ?, ?, ?)")
      .bind(user.email, body.questionId, body.status, body.level || null, body.category || null).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/vocab" && request.method === "POST") {
    if (!user) return json({ error: "请先登录" }, 401);
    const body = await request.json();
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 100) : [];
    await env.DB.batch(answers.filter((item) => typeof item.lemma === "string").map((item) => env.DB.prepare(`INSERT INTO vocab_stats (user_email, lemma, seen, correct)
      VALUES (?, ?, 1, ?) ON CONFLICT(user_email, lemma) DO UPDATE SET seen=seen+1, correct=correct+excluded.correct, updated_at=CURRENT_TIMESTAMP`)
      .bind(user.email, item.lemma, item.correct ? 1 : 0)));
    return json({ ok: true });
  }

  if (url.pathname === "/api/admin/questions" && request.method === "GET") {
    if (user?.role !== "admin") return json({ error: "需要管理员权限" }, 403);
    const result = await env.DB.prepare("SELECT id, payload, deleted, updated_by, updated_at FROM question_overrides ORDER BY updated_at DESC").all();
    return json({ overrides: result.results });
  }

  const adminMatch = url.pathname.match(/^\/api\/admin\/questions\/([^/]+)$/);
  if (adminMatch && (request.method === "PUT" || request.method === "DELETE")) {
    if (user?.role !== "admin") return json({ error: "需要管理员权限" }, 403);
    const id = decodeURIComponent(adminMatch[1]);
    if (request.method === "DELETE") {
      await env.DB.prepare(`INSERT INTO question_overrides (id, payload, deleted, updated_by) VALUES (?, NULL, 1, ?)
        ON CONFLICT(id) DO UPDATE SET payload=NULL, deleted=1, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, user.email).run();
      return json({ ok: true });
    }
    const question = await request.json();
    if (question.id !== id || !validQuestion(question)) return json({ error: "题目字段不完整或难度/模块无效" }, 400);
    await env.DB.prepare(`INSERT INTO question_overrides (id, payload, deleted, updated_by) VALUES (?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, deleted=0, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
      .bind(id, JSON.stringify(question), user.email).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(request, env, url); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "服务器错误" }, 500); }
    }

    const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    let response = await env.ASSETS.fetch(new Request(new URL(pathname, request.url), request));
    if (response.status === 404 && !url.pathname.split("/").pop()?.includes(".")) {
      response = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    return response;
  },
};
