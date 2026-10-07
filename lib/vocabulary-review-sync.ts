import { sanitizeVocabularyReviews, type VocabularyReviewEvent } from "./vocabulary-model.ts";
import type { VocabularyStats } from "../data/vocabulary";

type ReviewMemory = { owner: string; reviews?: VocabularyReviewEvent[]; pendingReviewIds?: string[] };
type Fetcher = (path: string, options?: RequestInit) => Promise<Response>;

export function reviewCounts(events: VocabularyReviewEvent[]): VocabularyStats {
  const stats: VocabularyStats = {};
  for (const event of sanitizeVocabularyReviews(events)) {
    const key = `${event.language}:${event.lemma}`;
    const previous = stats[key] ?? { seen: 0, correct: 0 };
    // Approximate is one review, but never a fractional or fully correct answer.
    stats[key] = { seen: previous.seen + 1, correct: previous.correct + Number(event.outcome === "remembered") };
  }
  return stats;
}

// Guest aggregate history predates event logging. Do not upload new events twice.
export function subtractReviewCounts(stats: VocabularyStats, events: VocabularyReviewEvent[]): VocabularyStats {
  const counted = reviewCounts(events);
  return Object.fromEntries(Object.entries(stats).map(([key, stat]) => {
    const seen = Math.max(0, stat.seen - (counted[key]?.seen ?? 0));
    return [key, { seen, correct: Math.min(seen, Math.max(0, stat.correct - (counted[key]?.correct ?? 0))) }];
  }).filter(([, stat]) => typeof stat !== "string" && stat.seen > 0));
}

export async function syncVocabularyReviews(memory: ReviewMemory, owner: string, fetcher: Fetcher) {
  const local = memory.owner === owner || memory.owner === "guest" ? sanitizeVocabularyReviews(memory.reviews) : [];
  const pendingIds = new Set(memory.owner === "guest" ? local.map(event => event.id) : memory.pendingReviewIds ?? []);
  const remote: VocabularyReviewEvent[] = [];
  const remoteIds = new Set<string>();
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  do {
    const response = await fetcher(`/api/vocab/reviews?limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!response.ok) throw new Error("Vocabulary review download failed");
    const data = await response.json();
    if (!Array.isArray(data?.events) || data.events.length > 500 || (data.nextCursor !== null && (typeof data.nextCursor !== "string" || !data.nextCursor))) throw new Error("Invalid vocabulary review response");
    const valid = sanitizeVocabularyReviews(data.events);
    if (valid.length !== data.events.length || valid.some(event => remoteIds.has(event.id)) || (!valid.length && data.nextCursor !== null)) throw new Error("Invalid vocabulary review records");
    valid.forEach(event => remoteIds.add(event.id));
    remote.push(...valid);
    cursor = data.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error("Repeated vocabulary review cursor");
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  const pending = local.filter(event => pendingIds.has(event.id) && !remoteIds.has(event.id));
  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    const response = await fetcher("/api/vocab/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events: batch }) });
    if (!response.ok) throw new Error("Vocabulary review upload failed");
    const result = await response.json();
    if (result?.ok !== true || result.count !== batch.length || !Number.isInteger(result.inserted) || result.inserted < 0 || result.inserted > batch.length) throw new Error("Invalid vocabulary review acknowledgment");
  }
  return { reviews: sanitizeVocabularyReviews([...remote, ...local.filter(event => !remoteIds.has(event.id))]), syncedIds: local.filter(event => pendingIds.has(event.id)).map(event => event.id) };
}
