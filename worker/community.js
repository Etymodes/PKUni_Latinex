import { isCommunityAvatar, normalizeCommunityAvatar } from '../lib/community-avatar.ts';
import { isCommunityAiAvailable, classifyCommunityText, translateCommunityText } from './community-ai.js';

// Keep these statements identical to migrations/0007_community.sql and 0008_community_profiles.sql.
export const communitySchema = [
  `CREATE TABLE IF NOT EXISTS community_profiles (
    user_id TEXT PRIMARY KEY, avatar_kind TEXT NOT NULL CHECK(avatar_kind IN ('initials','preset')),
    avatar_value TEXT NOT NULL CHECK(length(avatar_value) BETWEEN 1 AND 32), updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS community_ai_usage (
    day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0 CHECK(count BETWEEN 0 AND 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS community_ai_locks (
    lock_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, token TEXT NOT NULL, expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS community_state (
    user_id TEXT PRIMARY KEY, warnings INTEGER NOT NULL DEFAULT 0 CHECK(warnings BETWEEN 0 AND 4),
    muted_until INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS community_requests (
    user_id TEXT NOT NULL, client_id TEXT NOT NULL, fingerprint TEXT NOT NULL, message_id TEXT NOT NULL,
    outcome TEXT NOT NULL, warnings INTEGER NOT NULL, muted_until INTEGER NOT NULL,
    applied INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, client_id)
  )`,
  `CREATE TABLE IF NOT EXISTS community_messages (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, author_name TEXT NOT NULL,
    language TEXT NOT NULL CHECK(language IN ('la','ja')),
    channel TEXT NOT NULL CHECK(channel IN ('language','study')),
    text TEXT NOT NULL, detected_language TEXT, created_at INTEGER NOT NULL, deleted_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS community_room_time ON community_messages(language, channel, created_at, id)`,
  `CREATE TABLE IF NOT EXISTS community_limits (
    user_id TEXT NOT NULL, operation TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL,
    PRIMARY KEY(user_id, operation)
  )`,
  `CREATE TABLE IF NOT EXISTS community_translations (
    message_id TEXT NOT NULL, locale TEXT NOT NULL CHECK(locale IN ('en','zh-CN')),
    translation TEXT NOT NULL, detected_language TEXT, created_at INTEGER NOT NULL,
    PRIMARY KEY(message_id, locale)
  )`,
  `CREATE TABLE IF NOT EXISTS community_reports (
    message_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY(message_id, user_id)
  )`,
];

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const validRoom = (language, channel) => ['la', 'ja'].includes(language) && ['language', 'study'].includes(channel);
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const iso = value => value ? new Date(value).toISOString() : null;
const messageWithProfile = `SELECT m.*, p.avatar_kind, p.avatar_value FROM community_messages m
  LEFT JOIN community_profiles p ON p.user_id=m.user_id`;
const avatarFromRow = row => normalizeCommunityAvatar(row && { kind: row.avatar_kind, value: row.avatar_value });

export function communityWordCount(text, language) {
  const prose = text.normalize('NFKC').replace(/https?:\/\/\S+/giu, ' ');
  return [...new Intl.Segmenter(language === 'ja' ? 'ja' : 'en', { granularity: 'word' }).segment(prose)]
    .filter(part => part.isWordLike && /\p{L}/u.test(part.segment)).length;
}

function publicState(state, now = Date.now()) {
  const expired = state?.muted_until > 0 && state.muted_until <= now;
  return { warnings: expired ? 0 : Number(state?.warnings || 0), mutedUntil: !expired ? iso(state?.muted_until) : null };
}

function publicMessage(row, user) {
  return { id: row.id, authorName: row.author_name, avatar: avatarFromRow(row), mine: row.user_id === user?.id, text: row.text,
    createdAt: iso(row.created_at), detectedLanguage: row.detected_language || null };
}

async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > 8192) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '', size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch { return null; }
  finally { reader.releaseLock(); }
  try { const value = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
  catch { return null; }
}

function normalizeText(value, limit) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  const text = value.trim().normalize('NFC');
  return text && [...text].length <= limit ? text : null;
}

async function fingerprint(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function rateLimit(db, userId, operation, maximum) {
  const now = Date.now();
  const result = await db.batch([
    db.prepare(`INSERT INTO community_limits(user_id, operation, window_start, count) VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, operation) DO UPDATE SET
      count=CASE WHEN window_start <= ? THEN 1 ELSE count+1 END,
      window_start=CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`)
      .bind(userId, operation, now, now - MINUTE, now - MINUTE),
    db.prepare('SELECT count, window_start FROM community_limits WHERE user_id=? AND operation=?').bind(userId, operation),
  ]);
  const row = result[1].results[0];
  return row.count > maximum ? json({ error: 'rate_limited', retryAfterSeconds: Math.max(1, Math.ceil((row.window_start + MINUTE - now) / 1000)) }, 429) : null;
}

async function acquireAiLock(db, key, hash) {
  const now = Date.now(), token = crypto.randomUUID();
  const result = await db.prepare(`INSERT INTO community_ai_locks(lock_key, fingerprint, token, expires_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(lock_key) DO UPDATE SET fingerprint=excluded.fingerprint, token=excluded.token, expires_at=excluded.expires_at
    WHERE expires_at<=?`).bind(key, hash, token, now + MINUTE, now).run();
  if (result.meta.changes === 1) return { token };
  const lock = await db.prepare('SELECT fingerprint FROM community_ai_locks WHERE lock_key=?').bind(key).first();
  return { response: lock && lock.fingerprint !== hash ? json({ error: 'client_id_conflict' }, 409)
    : json({ error: 'request_pending', retryAfterSeconds: 3 }, 503) };
}

async function releaseAiLock(db, key, token) {
  if (token) await db.prepare('DELETE FROM community_ai_locks WHERE lock_key=? AND token=?').bind(key, token).run();
}

async function requestResponse(db, row, user, inserted = false) {
  const state = { warnings: row.warnings, mutedUntil: iso(row.muted_until) };
  if (row.outcome === 'warning') return json({ error: 'language_warning', ...state }, 422);
  if (row.outcome === 'muting' || row.outcome === 'muted') return json({ error: 'muted', ...state }, 403);
  const message = await db.prepare(`${messageWithProfile} WHERE m.id=? AND m.deleted_at IS NULL`).bind(row.message_id).first();
  return json({ message: message ? publicMessage(message, user) : null, ...state }, inserted ? 201 : 200);
}

async function sendMessage(request, env, user) {
  const body = await readBody(request);
  const text = normalizeText(body?.text, 1000);
  if (!body || !validRoom(body.language, body.channel) || !text || typeof body.clientId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(body.clientId)) return json({ error: 'invalid_message' }, 400);
  const { language, channel, clientId } = body;
  const hash = await fingerprint(JSON.stringify([language, channel, text]));
  const existing = await env.DB.prepare('SELECT * FROM community_requests WHERE user_id=? AND client_id=?').bind(user.id, clientId).first();
  if (existing) return existing.fingerprint === hash ? requestResponse(env.DB, existing, user) : json({ error: 'client_id_conflict' }, 409);
  const limited = await rateLimit(env.DB, user.id, 'send', 20);
  if (limited) return limited;
  const state = await env.DB.prepare('SELECT * FROM community_state WHERE user_id=?').bind(user.id).first();
  if (channel === 'language' && state?.muted_until > Date.now()) return json({ error: 'muted', ...publicState(state) }, 403);
  const requiresAi = channel === 'language' && communityWordCount(text, language) > 5;
  const lockKey = `send:${await fingerprint(JSON.stringify([user.id, clientId]))}`;
  const lock = requiresAi ? await acquireAiLock(env.DB, lockKey, hash) : {};
  if (lock.response) return lock.response;
  try {
  // Recheck after acquiring the lock: a request may have committed while this one waited for D1.
  if (requiresAi) {
    const completed = await env.DB.prepare('SELECT * FROM community_requests WHERE user_id=? AND client_id=?').bind(user.id, clientId).first();
    if (completed) return completed.fingerprint === hash ? requestResponse(env.DB, completed, user) : json({ error: 'client_id_conflict' }, 409);
  }
  let verdict = { status: 'target', detectedLanguage: null };
  if (requiresAi) {
    try { verdict = await classifyCommunityText(env, { text, language }); }
    catch { return json({ error: 'language_check_unavailable', retryAfterSeconds: 15 }, 503); }
    if (!verdict || !['target', 'other'].includes(verdict.status)) return json({ error: 'language_check_unavailable', retryAfterSeconds: 15 }, 503);
  }
  // The client never supplies the verdict. D1 commits the request, warning and publication together.
  // In particular, two devices cannot both observe warning #3 and avoid the fourth-strike mute.
  const now = Date.now();
  const messageId = crypto.randomUUID();
  const violation = verdict.status === 'other' ? 1 : 0;
  const detected = typeof verdict.detectedLanguage === 'string' ? verdict.detectedLanguage.slice(0, 32) : null;
  const result = await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO community_state(user_id) VALUES (?)').bind(user.id),
    env.DB.prepare('UPDATE community_state SET warnings=0, muted_until=0 WHERE user_id=? AND muted_until>0 AND muted_until<=?').bind(user.id, now),
    env.DB.prepare(`INSERT OR IGNORE INTO community_requests(user_id, client_id, fingerprint, message_id, outcome, warnings, muted_until, created_at)
      SELECT ?, ?, ?, ?, CASE WHEN ?='study' THEN 'accepted' WHEN muted_until>? THEN 'muted'
        WHEN ?=1 AND warnings>=3 THEN 'muting' WHEN ?=1 THEN 'warning' ELSE 'accepted' END,
        CASE WHEN ?='language' AND muted_until<=? AND ?=1 THEN MIN(4,warnings+1) ELSE warnings END,
        CASE WHEN ?='language' AND muted_until<=? AND ?=1 AND warnings>=3 THEN ? ELSE muted_until END, ?
      FROM community_state WHERE user_id=?`)
      .bind(user.id, clientId, hash, messageId, channel, now, violation, violation, channel, now, violation, channel, now, violation, now + HOUR, now, user.id),
    env.DB.prepare(`UPDATE community_state SET
      warnings=(SELECT warnings FROM community_requests WHERE user_id=? AND client_id=?),
      muted_until=(SELECT muted_until FROM community_requests WHERE user_id=? AND client_id=?)
      WHERE user_id=? AND EXISTS (SELECT 1 FROM community_requests WHERE user_id=? AND client_id=? AND applied=0 AND outcome IN ('warning','muting'))`)
      .bind(user.id, clientId, user.id, clientId, user.id, user.id, clientId),
    env.DB.prepare(`INSERT OR IGNORE INTO community_messages(id, user_id, author_name, language, channel, text, detected_language, created_at)
      SELECT message_id, ?, ?, ?, ?, ?, ?, created_at FROM community_requests
      WHERE user_id=? AND client_id=? AND fingerprint=? AND outcome='accepted' AND applied=0`)
      .bind(user.id, user.name.slice(0, 80), language, channel, text, detected, user.id, clientId, hash),
    env.DB.prepare('UPDATE community_requests SET applied=1 WHERE user_id=? AND client_id=?').bind(user.id, clientId),
    env.DB.prepare('SELECT * FROM community_requests WHERE user_id=? AND client_id=?').bind(user.id, clientId),
  ]);
  const row = result[6].results[0];
  if (row.fingerprint !== hash) return json({ error: 'client_id_conflict' }, 409);
  return requestResponse(env.DB, row, user, result[2].meta.changes === 1);
  } finally { await releaseAiLock(env.DB, lockKey, lock.token); }
}

async function translateMessage(request, env, user, message) {
  const body = await readBody(request);
  if (!['en', 'zh-CN'].includes(body?.locale)) return json({ error: 'invalid_locale' }, 400);
  const cached = await env.DB.prepare('SELECT translation, detected_language FROM community_translations WHERE message_id=? AND locale=?').bind(message.id, body.locale).first();
  if (cached) return json({ translation: cached.translation, detectedLanguage: cached.detected_language || null });
  const limited = await rateLimit(env.DB, user.id, 'translate', 10);
  if (limited) return limited;
  const lockKey = `translate:${message.id}:${body.locale}`;
  const lock = await acquireAiLock(env.DB, lockKey, body.locale);
  if (lock.response) return lock.response;
  try {
  const completed = await env.DB.prepare('SELECT translation, detected_language FROM community_translations WHERE message_id=? AND locale=?').bind(message.id, body.locale).first();
  if (completed) return json({ translation: completed.translation, detectedLanguage: completed.detected_language || null });
  let translated;
  try { translated = await translateCommunityText(env, { text: message.text, locale: body.locale, detectedLanguage: message.detected_language }); }
  catch { return json({ error: 'translation_unavailable', retryAfterSeconds: 15 }, 503); }
  const translation = normalizeText(translated?.translation, 6000);
  if (!translation) return json({ error: 'translation_unavailable', retryAfterSeconds: 15 }, 503);
  const detected = typeof translated.detectedLanguage === 'string' ? translated.detectedLanguage.slice(0, 32) : null;
  await env.DB.prepare(`INSERT OR IGNORE INTO community_translations(message_id, locale, translation, detected_language, created_at)
    SELECT id, ?, ?, ?, ? FROM community_messages WHERE id=? AND deleted_at IS NULL`)
    .bind(body.locale, translation, detected, Date.now(), message.id).run();
  const live = await env.DB.prepare(`SELECT t.translation, t.detected_language FROM community_translations t
    JOIN community_messages m ON m.id=t.message_id WHERE t.message_id=? AND t.locale=? AND m.deleted_at IS NULL`).bind(message.id, body.locale).first();
  return live ? json({ translation: live.translation, detectedLanguage: live.detected_language || null }) : json({ error: 'message_not_found' }, 404);
  } finally { await releaseAiLock(env.DB, lockKey, lock.token); }
}

export async function communityApi(request, env, url, user) {
  if (!env.DB) return json({ error: 'community_unavailable' }, 503);
  if (url.pathname === '/api/community' && request.method === 'GET') {
    const language = url.searchParams.get('language');
    const channel = url.searchParams.get('channel');
    if (!validRoom(language, channel)) return json({ error: 'invalid_room' }, 400);
    const rows = await env.DB.prepare(`${messageWithProfile} WHERE m.language=? AND m.channel=? AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC, m.id DESC LIMIT 50`).bind(language, channel).all();
    const state = user ? await env.DB.prepare('SELECT * FROM community_state WHERE user_id=?').bind(user.id).first() : null;
    return json({ messages: rows.results.reverse().map(row => publicMessage(row, user)), ...publicState(state), aiAvailable: isCommunityAiAvailable(env) });
  }
  if (!user) return json({ error: 'login_required' }, 401);
  if (url.pathname === '/api/community/profile') {
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT avatar_kind, avatar_value FROM community_profiles WHERE user_id=?').bind(user.id).first();
      return json({ avatar: avatarFromRow(row) });
    }
    if (request.method === 'PUT') {
      const body = await readBody(request);
      if (!isCommunityAvatar(body?.avatar)) return json({ error: 'invalid_avatar' }, 400);
      const limited = await rateLimit(env.DB, user.id, 'profile', 20);
      if (limited) return limited;
      const avatar = normalizeCommunityAvatar(body.avatar);
      await env.DB.prepare(`INSERT INTO community_profiles(user_id, avatar_kind, avatar_value, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET avatar_kind=excluded.avatar_kind, avatar_value=excluded.avatar_value, updated_at=excluded.updated_at`)
        .bind(user.id, avatar.kind, avatar.value, Date.now()).run();
      return json({ avatar });
    }
    return json({ error: 'not_found' }, 404);
  }
  if (url.pathname === '/api/community/messages' && request.method === 'POST') return sendMessage(request, env, user);
  if (url.pathname === '/api/community/reports' && request.method === 'GET') {
    if (user.role !== 'admin') return json({ error: 'forbidden' }, 403);
    const rows = await env.DB.prepare(`SELECT m.*, p.avatar_kind, p.avatar_value, r.reason, r.created_at AS reported_at FROM community_reports r
      JOIN community_messages m ON m.id=r.message_id LEFT JOIN community_profiles p ON p.user_id=m.user_id WHERE m.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT 100`).all();
    return json({ reports: rows.results.map(row => ({ message: publicMessage(row, user), reason: row.reason, reportedAt: iso(row.reported_at) })) });
  }
  const match = url.pathname.match(/^\/api\/community\/messages\/([A-Za-z0-9-]{1,80})(?:\/(translate|report))?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const message = await env.DB.prepare('SELECT * FROM community_messages WHERE id=? AND deleted_at IS NULL').bind(match[1]).first();
  if (!message) return json({ error: 'message_not_found' }, 404);
  if (match[2] === 'translate' && request.method === 'POST') return translateMessage(request, env, user, message);
  if (match[2] === 'report' && request.method === 'POST') {
    const body = await readBody(request);
    const reason = normalizeText(body?.reason, 500);
    if (!reason) return json({ error: 'invalid_report' }, 400);
    const limited = await rateLimit(env.DB, user.id, 'report', 10);
    if (limited) return limited;
    await env.DB.prepare('INSERT OR IGNORE INTO community_reports(message_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)').bind(message.id, user.id, reason, Date.now()).run();
    return json({ ok: true });
  }
  if (!match[2] && request.method === 'DELETE') {
    if (message.user_id !== user.id && user.role !== 'admin') return json({ error: 'forbidden' }, 403);
    await env.DB.prepare('UPDATE community_messages SET deleted_at=? WHERE id=?').bind(Date.now(), message.id).run();
    return json({ ok: true });
  }
  return json({ error: 'not_found' }, 404);
}
