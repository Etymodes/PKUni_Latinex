import assert from "node:assert/strict";
import test from "node:test";
import { reviewCounts, subtractReviewCounts, syncVocabularyReviews } from "../lib/vocabulary-review-sync.ts";

const event = (id, changes = {}) => ({
  id, language: "ja", lemma: "覚える", predictedAt: "2026-10-01T00:00:00.000Z", targetAt: "2026-10-01T00:00:00.000Z", answeredAt: "2026-10-01T00:00:01.000Z",
  outcome: "remembered", probability: 0.5, features: [1, 0, 0, 0, 0, 0], modelVersion: "pikku-recall-v1", mode: "word", ...changes,
});
const makeEvents = count => Array.from({ length: count }, (_, index) => event(`review-${String(index).padStart(5, "0")}`));

function mockApi(initial = []) {
  const state = { rows: new Map(initial.map(item => [item.id, item])), gets: [], posts: [], failPostAt: 0, commitBeforeFailure: false };
  state.fetcher = async (path, options) => {
    if (options?.method === "POST") {
      const { events } = JSON.parse(options.body);
      assert(events.length > 0 && events.length <= 100);
      state.posts.push(events);
      const fail = state.posts.length === state.failPostAt;
      if (fail && !state.commitBeforeFailure) return Response.json({ error: "Unavailable" }, { status: 503 });
      let inserted = 0;
      for (const item of events) if (!state.rows.has(item.id)) { state.rows.set(item.id, item); inserted++; }
      return fail ? Response.json({ error: "Lost acknowledgment" }, { status: 503 }) : Response.json({ ok: true, count: events.length, inserted });
    }
    const url = new URL(path, "https://example.test");
    assert.equal(url.searchParams.get("limit"), "500");
    state.gets.push(path);
    const offset = Number(url.searchParams.get("cursor")?.replace("page:", "") ?? 0);
    const rows = [...state.rows.values()].sort((left, right) => left.answeredAt.localeCompare(right.answeredAt) || left.id.localeCompare(right.id));
    return Response.json({ events: rows.slice(offset, offset + 500), nextCursor: rows.length > offset + 500 ? `page:${offset + 500}` : null });
  };
  return state;
}

test("review sync retries partial and committed-but-unacknowledged uploads without inflating event totals", async () => {
  for (const commitBeforeFailure of [false, true]) {
    const reviews = makeEvents(250);
    const memory = { owner: "guest", reviews, pendingReviewIds: [] };
    const before = structuredClone(memory);
    const api = mockApi(); api.failPostAt = 2; api.commitBeforeFailure = commitBeforeFailure;
    await assert.rejects(syncVocabularyReviews(memory, "alice", api.fetcher), /upload failed/);
    assert.equal(api.rows.size, commitBeforeFailure ? 200 : 100);
    assert.deepEqual(memory, before, "A failed sync must not consume local pending events");
    const result = await syncVocabularyReviews(memory, "alice", api.fetcher);
    assert.equal(api.rows.size, 250);
    assert.equal(result.reviews.length, 250);
    assert.deepEqual(new Set(result.syncedIds), new Set(reviews.map(item => item.id)));
    assert.deepEqual(reviewCounts([...api.rows.values()]), { "ja:覚える": { seen: 250, correct: 250 } });
    const postCount = api.posts.length;
    await syncVocabularyReviews({ owner: "alice", reviews: result.reviews, pendingReviewIds: [] }, "alice", api.fetcher);
    assert.equal(api.posts.length, postCount);
  }
});

test("guest legacy aggregates exclude unique new review contributions before event upload", async () => {
  const remembered = event("remembered");
  const forgotten = event("forgotten", { outcome: "forgotten" });
  const spanish = event("spanish", { language: "es", lemma: "casa" });
  const reviews = [remembered, forgotten, remembered, spanish, { malformed: true }];
  const stats = { "ja:覚える": { seen: 7, correct: 5 }, "es:casa": { seen: 1, correct: 1 }, "la:amo": { seen: 4, correct: 1 } };
  const snapshot = structuredClone(stats);
  const legacy = subtractReviewCounts(stats, reviews);
  assert.deepEqual(legacy, { "ja:覚える": { seen: 5, correct: 4 }, "la:amo": { seen: 4, correct: 1 } });
  assert.deepEqual(stats, snapshot);
  const api = mockApi();
  await syncVocabularyReviews({ owner: "guest", reviews }, "alice", api.fetcher);
  const eventStats = reviewCounts([...api.rows.values()]);
  for (const [key, original] of Object.entries(stats)) {
    assert.equal((legacy[key]?.seen ?? 0) + (eventStats[key]?.seen ?? 0), original.seen);
    assert.equal((legacy[key]?.correct ?? 0) + (eventStats[key]?.correct ?? 0), original.correct);
  }
  assert.deepEqual(subtractReviewCounts({ "ja:覚える": { seen: 1, correct: 0 } }, [remembered, forgotten]), {}, "Inconsistent historical totals cannot become negative");
});

test("sync downloads every 500-record page and prefers the server's canonical event payload", async () => {
  const remote = makeEvents(1001);
  const api = mockApi(remote);
  const result = await syncVocabularyReviews({ owner: "alice", reviews: [event(remote[0].id, { outcome: "forgotten" })], pendingReviewIds: [remote[0].id] }, "alice", api.fetcher);
  assert.equal(api.gets.length, 3);
  assert(api.gets[1].includes("cursor=page%3A500"));
  assert(api.gets[2].includes("cursor=page%3A1000"));
  assert.equal(api.posts.length, 0);
  assert.equal(result.reviews.length, 1001);
  assert.equal(result.reviews.find(item => item.id === remote[0].id).outcome, "remembered");
  assert.deepEqual(result.syncedIds, [remote[0].id]);
});

test("switching account cannot upload or retain another account's events", async () => {
  const api = mockApi([event("alice-cloud")]);
  const result = await syncVocabularyReviews({ owner: "bob", reviews: [event("bob-private")], pendingReviewIds: ["bob-private"] }, "alice", api.fetcher);
  assert.deepEqual(result.reviews.map(item => item.id), ["alice-cloud"]);
  assert.deepEqual(result.syncedIds, []);
  assert.equal(api.posts.length, 0);
});

test("a stale cloud snapshot retains same-owner local history without re-uploading already acknowledged events", async () => {
  const api = mockApi();
  const result = await syncVocabularyReviews({ owner: "alice", reviews: [event("acknowledged"), event("pending")], pendingReviewIds: ["pending"] }, "alice", api.fetcher);
  assert.deepEqual(result.reviews.map(item => item.id), ["acknowledged", "pending"]);
  assert.deepEqual(result.syncedIds, ["pending"]);
  assert.deepEqual(api.posts.flat().map(item => item.id), ["pending"]);
});

test("malformed or overlapping cloud pages stop the sync before any pending upload", async () => {
  const malformedPages = [
    [null], [{ events: [], nextCursor: "" }], [{ events: [], nextCursor: "more" }], [{ events: [] }],
    [{ events: [{ bad: true }], nextCursor: null }], [{ events: makeEvents(501), nextCursor: null }],
    [{ events: [event("duplicate"), event("duplicate")], nextCursor: null }],
    [{ events: [event("first")], nextCursor: "one" }, { events: [event("first")], nextCursor: "two" }],
    [{ events: [event("first")], nextCursor: "same" }, { events: [event("second")], nextCursor: "same" }],
    [{ events: [event("schema", { modelVersion: "future-version" })], nextCursor: null }],
  ];
  for (const pages of malformedPages) {
    let offset = 0;
    const fetcher = async (_path, options) => {
      assert.notEqual(options?.method, "POST");
      return Response.json(pages[offset++]);
    };
    await assert.rejects(syncVocabularyReviews({ owner: "alice", reviews: [event("pending")], pendingReviewIds: ["pending"] }, "alice", fetcher));
  }
});

test("failed downloads and invalid upload acknowledgments never mark local events as synced", async () => {
  const memory = { owner: "alice", reviews: [event("pending")], pendingReviewIds: ["pending"] };
  const snapshot = structuredClone(memory);
  await assert.rejects(syncVocabularyReviews(memory, "alice", async () => Response.json({}, { status: 503 })), /download failed/);
  for (const acknowledgment of [{ ok: false }, { ok: true }, { ok: true, count: 0, inserted: 0 }, { ok: true, count: 1, inserted: 2 }]) {
    await assert.rejects(syncVocabularyReviews(memory, "alice", async (_path, options) => Response.json(options?.method === "POST" ? acknowledgment : { events: [], nextCursor: null })), /acknowledgment/);
  }
  assert.deepEqual(memory, snapshot);
});
