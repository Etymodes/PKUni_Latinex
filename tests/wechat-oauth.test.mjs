import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");

const { __test } = await import("../worker/index.js");

test("base64Url removes padding and unsafe URL characters", () => {
  assert.equal(__test.base64Url(Uint8Array.from([251, 255, 239])), "-__v");
});

test("PKCE SHA-256 challenge matches RFC 7636 example", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await __test.sha256Base64Url(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("token hashes are deterministic and comparisons reject mismatches", async () => {
  assert.equal(await __test.sha256Hex("token"), await __test.sha256Hex("token"));
  assert.equal(await __test.safeEqual("secret", "secret"), true);
  assert.equal(await __test.safeEqual("secret", "different"), false);
});

test("WeChat login stays disabled until every production setting exists", () => {
  const complete = {
    WECHAT_LOGIN_ENABLED: "true",
    WECHAT_APP_ID: "app-id",
    WECHAT_APP_SECRET: "app-secret",
    WECHAT_BRIDGE_CLIENT_ID: "bridge-id",
    WECHAT_BRIDGE_CLIENT_SECRET: "bridge-secret",
    WECHAT_PUBLIC_ORIGIN: "https://pikku.qzz.io",
    WECHAT_SUPABASE_CALLBACK_URL: "https://project.supabase.co/auth/v1/callback",
  };
  assert.equal(__test.wechatConfigured(complete, "https://pikku.qzz.io"), true);
  assert.equal(__test.wechatConfigured({ ...complete, WECHAT_APP_SECRET: "" }, "https://pikku.qzz.io"), false);
  assert.equal(__test.wechatConfigured(complete, "https://preview.workers.dev"), false);
});

test("configured origin is normalized and invalid values are rejected", () => {
  assert.equal(__test.configuredOrigin({ WECHAT_PUBLIC_ORIGIN: "https://pikku.qzz.io/path" }), "https://pikku.qzz.io");
  assert.equal(__test.configuredOrigin({ WECHAT_PUBLIC_ORIGIN: "not a URL" }), "");
});

test("multilingual account preferences accept only configured language levels", () => {
  assert.equal(__test.validPreference("la", "advanced"), true);
  assert.equal(__test.validPreference("ja", "n1"), true);
  assert.equal(__test.validPreference("es", "c2"), true);
  assert.equal(__test.validPreference("ja", "a1"), false);
  assert.equal(__test.validPreference("de", "a1"), false);
});

test("progress records retain language while legacy records default to Latin", () => {
  assert.deepEqual(__test.normalizeProgressRecord({ questionId: "ja-n1-001", status: "correct", language: "ja", level: "n1", category: "syntax" }), {
    questionId: "ja-n1-001", status: "correct", language: "ja", level: "n1", category: "syntax",
  });
  assert.equal(__test.normalizeProgressRecord({ questionId: "legacy", status: "wrong", level: "elementary" }).language, "la");
  assert.equal(__test.normalizeProgressRecord({ questionId: "bad", status: "correct", language: "ja", level: "a1" }), null);
  assert.equal(__test.normalizeProgressRecord({ questionId: "bad", status: "correct", language: "de", level: "elementary" }), null);
});

test("bookmark validation rejects malformed or cross-language records before replacement", () => {
  assert.deepEqual(__test.normalizeBookmarkItem({ questionId: "es-a1-001", language: "es" }), { questionId: "es-a1-001", language: "es" });
  assert.deepEqual(__test.normalizeBookmarkItem({ questionId: "legacy" }), { questionId: "legacy", language: "la" });
  assert.equal(__test.normalizeBookmarkItem({ questionId: "bad", language: "de" }), null);
});
