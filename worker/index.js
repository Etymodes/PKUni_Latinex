const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const OAUTH_TTL = { transaction: 10 * 60, code: 5 * 60, token: 10 * 60 };

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
  `CREATE TABLE IF NOT EXISTS bookmarks (
    user_email TEXT NOT NULL, question_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_email, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS question_overrides (
    id TEXT PRIMARY KEY, payload TEXT, deleted INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS wechat_oauth_transactions (
    transaction_hash TEXT PRIMARY KEY, upstream_state TEXT NOT NULL, redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wechat_oauth_codes (
    code_hash TEXT PRIMARY KEY, redirect_uri TEXT NOT NULL, code_challenge TEXT NOT NULL,
    profile TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wechat_oauth_tokens (
    token_hash TEXT PRIMARY KEY, profile TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
];

let schemaReady;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function oauthError(error, description, status = 400) {
  return json({ error, error_description: description }, status);
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

function base64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value) {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safeEqual(left, right) {
  const [a, b] = await Promise.all([sha256Hex(String(left)), sha256Hex(String(right))]);
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function configuredOrigin(env) {
  try { return new URL(String(env.WECHAT_PUBLIC_ORIGIN || "")).origin; }
  catch { return ""; }
}

function wechatConfigured(env, requestOrigin) {
  return String(env.WECHAT_LOGIN_ENABLED || "").toLowerCase() === "true"
    && Boolean(env.WECHAT_APP_ID && env.WECHAT_APP_SECRET && env.WECHAT_BRIDGE_CLIENT_ID && env.WECHAT_BRIDGE_CLIENT_SECRET)
    && Boolean(env.WECHAT_SUPABASE_CALLBACK_URL && configuredOrigin(env))
    && requestOrigin === configuredOrigin(env);
}

async function cleanupOauth(env, now) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM wechat_oauth_transactions WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM wechat_oauth_codes WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM wechat_oauth_tokens WHERE expires_at < ?").bind(now),
  ]);
}

function basicCredentials(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Basic ")) return null;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { clientId: decoded.slice(0, separator), clientSecret: decoded.slice(separator + 1) };
  } catch { return null; }
}

async function readForm(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 8192) throw new Error("请求体过大");
  return new URLSearchParams(await request.text());
}

async function wechatAuthorize(request, env, url) {
  if (!wechatConfigured(env, url.origin)) return oauthError("temporarily_unavailable", "微信登录尚未启用", 503);
  const expectedCallback = String(env.WECHAT_SUPABASE_CALLBACK_URL);
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const responseType = url.searchParams.get("response_type") || "";
  const state = url.searchParams.get("state") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "";
  if (!await safeEqual(clientId, env.WECHAT_BRIDGE_CLIENT_ID) || redirectUri !== expectedCallback) return oauthError("invalid_request", "客户端或回调地址无效");
  if (responseType !== "code" || !state || codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    return oauthError("invalid_request", "必须使用带 S256 PKCE 的授权码流程");
  }

  const transaction = randomToken();
  const transactionHash = await sha256Hex(transaction);
  const now = Math.floor(Date.now() / 1000);
  await cleanupOauth(env, now);
  await env.DB.prepare(`INSERT INTO wechat_oauth_transactions
    (transaction_hash, upstream_state, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(transactionHash, state.slice(0, 1024), redirectUri, codeChallenge, now + OAUTH_TTL.transaction).run();

  const callback = `${configuredOrigin(env)}/api/oauth/wechat/callback`;
  const wechat = new URL("https://open.weixin.qq.com/connect/qrconnect");
  wechat.searchParams.set("appid", String(env.WECHAT_APP_ID));
  wechat.searchParams.set("redirect_uri", callback);
  wechat.searchParams.set("response_type", "code");
  wechat.searchParams.set("scope", "snsapi_login");
  wechat.searchParams.set("state", transaction);
  return Response.redirect(`${wechat.toString()}#wechat_redirect`, 302);
}

async function wechatCallback(env, url) {
  if (!wechatConfigured(env, configuredOrigin(env))) return oauthError("temporarily_unavailable", "微信登录尚未启用", 503);
  const transaction = url.searchParams.get("state") || "";
  const transactionHash = await sha256Hex(transaction);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`SELECT upstream_state, redirect_uri, code_challenge
    FROM wechat_oauth_transactions WHERE transaction_hash=? AND expires_at>=?`).bind(transactionHash, now).first();
  if (!row) return oauthError("invalid_request", "微信登录请求已过期，请返回网站重试");
  await env.DB.prepare("DELETE FROM wechat_oauth_transactions WHERE transaction_hash=?").bind(transactionHash).run();

  const redirect = new URL(row.redirect_uri);
  redirect.searchParams.set("state", row.upstream_state);
  const wechatCode = url.searchParams.get("code");
  if (!wechatCode) {
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "用户取消了微信授权");
    return Response.redirect(redirect.toString(), 302);
  }

  const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  tokenUrl.searchParams.set("appid", String(env.WECHAT_APP_ID));
  tokenUrl.searchParams.set("secret", String(env.WECHAT_APP_SECRET));
  tokenUrl.searchParams.set("code", wechatCode);
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  const tokenResponse = await fetch(tokenUrl, { headers: { accept: "application/json" }, cache: "no-store" });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token?.access_token || !token?.openid) return oauthError("upstream_error", "微信授权码交换失败", 502);

  const profileUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
  profileUrl.searchParams.set("access_token", token.access_token);
  profileUrl.searchParams.set("openid", token.openid);
  profileUrl.searchParams.set("lang", "zh_CN");
  const profileResponse = await fetch(profileUrl, { headers: { accept: "application/json" }, cache: "no-store" });
  const wechatProfile = await profileResponse.json();
  if (!profileResponse.ok || wechatProfile?.errcode || !wechatProfile?.openid) return oauthError("upstream_error", "微信用户资料读取失败", 502);

  const profile = {
    sub: `wechat:${String(wechatProfile.unionid || wechatProfile.openid)}`,
    name: String(wechatProfile.nickname || "微信用户").slice(0, 80),
    picture: String(wechatProfile.headimgurl || "").slice(0, 2048),
    preferred_username: String(wechatProfile.nickname || "微信用户").slice(0, 80),
  };
  const bridgeCode = randomToken();
  await env.DB.prepare(`INSERT INTO wechat_oauth_codes
    (code_hash, redirect_uri, code_challenge, profile, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(await sha256Hex(bridgeCode), row.redirect_uri, row.code_challenge, JSON.stringify(profile), now + OAUTH_TTL.code).run();
  redirect.searchParams.set("code", bridgeCode);
  return Response.redirect(redirect.toString(), 302);
}

async function wechatToken(request, env) {
  if (!wechatConfigured(env, configuredOrigin(env))) return oauthError("temporarily_unavailable", "微信登录尚未启用", 503);
  let form;
  try { form = await readForm(request); }
  catch { return oauthError("invalid_request", "令牌请求无效"); }
  const basic = basicCredentials(request);
  const clientId = basic?.clientId || form.get("client_id") || "";
  const clientSecret = basic?.clientSecret || form.get("client_secret") || "";
  if (!await safeEqual(clientId, env.WECHAT_BRIDGE_CLIENT_ID) || !await safeEqual(clientSecret, env.WECHAT_BRIDGE_CLIENT_SECRET)) {
    return oauthError("invalid_client", "客户端认证失败", 401);
  }
  const code = form.get("code") || "";
  const verifier = form.get("code_verifier") || "";
  const redirectUri = form.get("redirect_uri") || "";
  if (form.get("grant_type") !== "authorization_code" || !code || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    return oauthError("invalid_grant", "授权码或 PKCE verifier 无效");
  }
  const now = Math.floor(Date.now() / 1000);
  const codeHash = await sha256Hex(code);
  const row = await env.DB.prepare(`SELECT redirect_uri, code_challenge, profile FROM wechat_oauth_codes
    WHERE code_hash=? AND expires_at>=?`).bind(codeHash, now).first();
  if (!row || redirectUri !== row.redirect_uri || !await safeEqual(await sha256Base64Url(verifier), row.code_challenge)) {
    return oauthError("invalid_grant", "授权码已过期、已使用或 PKCE 校验失败");
  }
  await env.DB.prepare("DELETE FROM wechat_oauth_codes WHERE code_hash=?").bind(codeHash).run();
  const accessToken = randomToken();
  await env.DB.prepare("INSERT INTO wechat_oauth_tokens (token_hash, profile, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(accessToken), row.profile, now + OAUTH_TTL.token).run();
  return json({ access_token: accessToken, token_type: "Bearer", expires_in: OAUTH_TTL.token, scope: "profile" });
}

async function wechatUserinfo(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return oauthError("invalid_token", "缺少访问令牌", 401);
  const token = authorization.slice(7);
  const row = await env.DB.prepare("SELECT profile FROM wechat_oauth_tokens WHERE token_hash=? AND expires_at>=?")
    .bind(await sha256Hex(token), Math.floor(Date.now() / 1000)).first();
  if (!row) return oauthError("invalid_token", "访问令牌无效或已过期", 401);
  return json(JSON.parse(row.profile));
}

async function wechatOauth(request, env, url) {
  await ensureSchema(env);
  if (url.pathname === "/api/oauth/wechat/authorize" && request.method === "GET") return wechatAuthorize(request, env, url);
  if (url.pathname === "/api/oauth/wechat/callback" && request.method === "GET") return wechatCallback(env, url);
  if (url.pathname === "/api/oauth/wechat/token" && request.method === "POST") return wechatToken(request, env);
  if (url.pathname === "/api/oauth/wechat/userinfo" && (request.method === "GET" || request.method === "POST")) return wechatUserinfo(request, env);
  return oauthError("not_found", "OAuth endpoint not found", 404);
}

function openAiIdentity(request, env) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return null;
  let name = request.headers.get("oai-authenticated-user-full-name") || email.split("@")[0];
  try { name = decodeURIComponent(name); } catch { /* keep the forwarded value */ }
  const admins = String(env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return { id: email, email, name, role: admins.includes(email) ? "admin" : "student" };
}

async function supabaseIdentity(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8192) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;

  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: String(env.SUPABASE_PUBLISHABLE_KEY),
      authorization,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.body) await response.body.cancel();
    return null;
  }

  const account = await response.json();
  if (!account?.id) return null;
  const provider = String(account.app_metadata?.provider || "").toLowerCase();
  let role = "student";
  let githubLogin = "";

  if (provider === "github") {
    const githubIdentity = Array.isArray(account.identities)
      ? account.identities.find((item) => item?.provider === "github")
      : null;
    const identityData = githubIdentity?.identity_data || {};
    githubLogin = String(identityData.user_name || identityData.preferred_username || identityData.login || "").trim();
    const admins = String(env.GITHUB_ADMIN_LOGINS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!githubLogin || !admins.includes(githubLogin.toLowerCase())) {
      return { rejected: "该 GitHub 账号不在开发者/管理员白名单中。" };
    }
    role = "admin";
  }

  const email = String(account.email || `${account.id}@supabase.local`).trim().toLowerCase();
  const metadata = account.user_metadata || {};
  const name = String(metadata.display_name || metadata.full_name || metadata.name || githubLogin || email.split("@")[0]).slice(0, 80);
  return { id: `supabase:${account.id}`, email, name, role };
}

async function identity(request, env) {
  return openAiIdentity(request, env) || await supabaseIdentity(request, env);
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
    .bind(user.id, user.name, user.role).run();
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
  const auth = await identity(request, env);
  const user = auth?.rejected ? null : auth;
  if (hasDb && user) await touchUser(env, user);

  if (url.pathname === "/api/me" && request.method === "GET") {
    const publicUser = user ? { email: user.email, name: user.name, role: user.role } : null;
    return json({ authenticated: Boolean(user), user: publicUser, persistence: hasDb, authError: auth?.rejected || undefined });
  }

  if (url.pathname === "/api/auth-config" && request.method === "GET") {
    return json({ wechat: wechatConfigured(env, url.origin) });
  }

  if (url.pathname === "/api/questions" && request.method === "GET") {
    if (!hasDb) return json({ overrides: [] });
    const result = await env.DB.prepare("SELECT id, payload, deleted, updated_at FROM question_overrides ORDER BY updated_at DESC").all();
    return json({ overrides: result.results.map((row) => ({ id: row.id, deleted: Boolean(row.deleted), question: row.payload ? JSON.parse(row.payload) : null, updatedAt: row.updated_at })) });
  }

  if (url.pathname === "/api/stats" && request.method === "GET") {
    if (!user) return json({ error: "请先登录" }, 401);
    const [attempts, vocab, bookmarks] = await env.DB.batch([
      env.DB.prepare(`SELECT a.question_id, a.status FROM attempts a
        JOIN (SELECT question_id, MAX(id) id FROM attempts WHERE user_email=? GROUP BY question_id) latest ON latest.id=a.id`).bind(user.id),
      env.DB.prepare("SELECT lemma, seen, correct FROM vocab_stats WHERE user_email=?").bind(user.id),
      env.DB.prepare("SELECT question_id FROM bookmarks WHERE user_email=? ORDER BY created_at").bind(user.id),
    ]);
    const progress = Object.fromEntries(attempts.results.map((row) => [row.question_id, row.status]));
    return json({ progress, vocab: vocab.results, bookmarks: bookmarks.results.map((row) => row.question_id) });
  }

  if (url.pathname === "/api/progress" && request.method === "POST") {
    if (!user) return json({ error: "请先登录" }, 401);
    const body = await request.json();
    if (!body.questionId || !["correct", "wrong", "review"].includes(body.status)) return json({ error: "无效记录" }, 400);
    await env.DB.prepare("INSERT INTO attempts (user_email, question_id, status, level, category) VALUES (?, ?, ?, ?, ?)")
      .bind(user.id, body.questionId, body.status, body.level || null, body.category || null).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/bookmarks" && request.method === "PUT") {
    if (!user) return json({ error: "请先登录" }, 401);
    const body = await request.json();
    const questionIds = [...new Set(Array.isArray(body.questionIds) ? body.questionIds : [])]
      .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 80)
      .slice(0, 500);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM bookmarks WHERE user_email=?").bind(user.id),
      ...questionIds.map((id) => env.DB.prepare("INSERT INTO bookmarks (user_email, question_id) VALUES (?, ?)").bind(user.id, id)),
    ]);
    return json({ ok: true, bookmarks: questionIds });
  }

  if (url.pathname === "/api/vocab" && request.method === "POST") {
    if (!user) return json({ error: "请先登录" }, 401);
    const body = await request.json();
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 100) : [];
    await env.DB.batch(answers.filter((item) => typeof item.lemma === "string").map((item) => env.DB.prepare(`INSERT INTO vocab_stats (user_email, lemma, seen, correct)
      VALUES (?, ?, 1, ?) ON CONFLICT(user_email, lemma) DO UPDATE SET seen=seen+1, correct=correct+excluded.correct, updated_at=CURRENT_TIMESTAMP`)
      .bind(user.id, item.lemma, item.correct ? 1 : 0)));
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
        .bind(id, user.id).run();
      return json({ ok: true });
    }
    const question = await request.json();
    if (question.id !== id || !validQuestion(question)) return json({ error: "题目字段不完整或难度/模块无效" }, 400);
    await env.DB.prepare(`INSERT INTO question_overrides (id, payload, deleted, updated_by) VALUES (?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, deleted=0, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`)
      .bind(id, JSON.stringify(question), user.id).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname.startsWith("/api/oauth/wechat/")) {
      try { return await wechatOauth(request, env, url); }
      catch { return oauthError("server_error", "微信登录服务暂时不可用", 500); }
    }
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

export const __test = { base64Url, sha256Base64Url, sha256Hex, safeEqual, configuredOrigin, wechatConfigured };
