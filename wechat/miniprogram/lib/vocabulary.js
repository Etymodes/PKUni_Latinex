const api = require('./api');
const bank = require('../data/bank');
const shared = require('../data/shared');
const recall = require('../data/vocabulary-model');
const { reviewCounts, syncVocabularyReviews } = require('../data/vocabulary-review-sync');
const STORAGE_PREFIX = 'pikku-mini-vocabulary-v2:';
const syncing = new Map();
let sequence = 0;

const ownerKey = owner => owner || 'guest';
const nowISO = () => new Date().toISOString();
const eventId = () => `mini-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const keyFor = card => shared.vocabularyKey(card.language, card.term);
function assertOwner(owner) {
  const session = api.getSession();
  if (ownerKey(session && session.user.id) !== ownerKey(owner)) {
    throw Object.assign(new Error('The signed-in account has changed.'), { status: 409, code: 'SESSION_CHANGED' });
  }
}
function cleanStats(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([key, stat]) => {
    const split = key.indexOf(':');
    return bank.languageOrder.includes(key.slice(0, split)) && split > 0 && key.length > split + 1 && stat &&
      Number.isSafeInteger(stat.seen) && Number.isSafeInteger(stat.correct) && stat.seen >= 0 && stat.correct >= 0 && stat.correct <= stat.seen;
  }).map(([key, stat]) => [key, { seen: stat.seen, correct: stat.correct }]));
}
function load(owner, legacyStats) {
  owner = ownerKey(owner);
  const saved = wx.getStorageSync(STORAGE_PREFIX + encodeURIComponent(owner));
  const value = saved && saved.owner === owner ? saved : {};
  const reviews = recall.sanitizeVocabularyReviews(value.reviews);
  const ids = new Set(Array.isArray(value.pendingReviewIds) ? value.pendingReviewIds : []);
  return { owner, stats: cleanStats(value.stats || legacyStats), reviews,
    pendingReviewIds: reviews.filter(event => ids.has(event.id)).map(event => event.id) };
}
function save(memory) {
  // Storage failure must stop advancement: a feedback event may not be silently lost.
  wx.setStorageSync(STORAGE_PREFIX + encodeURIComponent(memory.owner), memory);
  return memory;
}
function entries({ language, level, scope = 'all', query = '' }) {
  const search = String(query).trim().toLowerCase();
  return bank.vocabularyCards.filter(card => card.language === language &&
    (scope === 'level' ? shared.vocabularyMatchesLevel(card, level) :
      scope === 'n1-2000' ? Boolean(card.sourcePages && card.sourcePages.length) :
        scope === 'jlpt-1992' ? Boolean(card.sourceQuestionIds && card.sourceQuestionIds.length) : true) &&
    (!search || [card.term, card.reading, card.meaning, card.sourceReading, card.sourceMeaning,
      ...(card.spellingVariants || []), ...(card.readingVariants || []),
      ...(card.senses || []).map(sense => `${sense.reading} ${sense.gloss}`),
      ...(card.dictionary ? card.dictionary.derivatives : [])].filter(Boolean).join(' ').toLowerCase().includes(search)));
}
function details(card) {
  return {
    otherSpellings: (card.spellingVariants || []).filter(value => value !== card.term),
    otherReadings: (card.readingVariants || []).filter(value => value !== card.reading && value !== card.sourceReading),
    additionalReading: card.sourceReading !== card.reading ? card.sourceReading || '' : '',
    additionalMeaning: card.sourceMeaning !== card.meaning ? card.sourceMeaning || '' : '',
    usageNotes: card.usageNotes || '',
    senses: (card.senses || []).map(sense => ({ reading: sense.reading, gloss: sense.gloss })),
    dictionaryReferences: card.dictionaryReferences || [],
    etymology: card.dictionary ? card.dictionary.pie : '',
    derivatives: card.dictionary ? card.dictionary.derivatives : [],
    reviewStatus: card.dictionary ? card.dictionary.reviewStatus : 'draft',
  };
}
const effectiveMode = (card, mode) => mode === 'context' && card.context.trim() ? 'context' : 'word';
function model(memory, language) { return recall.trainVocabularyModel(memory.reviews, language); }
function forecast(memory, card, targetAt, mode = 'word', now = nowISO(), fitted) {
  const stat = memory.stats[keyFor(card)];
  return recall.makePrediction(memory.reviews, card.language, card.term, targetAt, effectiveMode(card, mode),
    stat ? { ...stat, asOf: now } : undefined, now, fitted);
}
function select(memory, options) {
  const { language, mode = 'word', recentIds = [], focusId, now = nowISO(), random = Math.random } = options;
  const fitted = recall.trainVocabularyModel(memory.reviews, language, now);
  const candidates = entries(options).map(card => {
    const prediction = forecast(memory, card, now, mode, now, fitted);
    const stat = memory.stats[keyFor(card)];
    const weight = (stat && stat.seen ? 1 + 5 * (1 - prediction.probabilities.remembered - 0.5 * prediction.probabilities.approximate) : 3) * (recentIds.includes(card.id) ? 0.15 : 1);
    return { card, prediction, weight };
  });
  let chosen = candidates.find(candidate => candidate.card.id === focusId);
  if (!chosen && candidates.length) {
    let point = Math.min(0.999999999999, Math.max(0, random())) * candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    chosen = candidates.find(candidate => (point -= candidate.weight) < 0) || candidates[candidates.length - 1];
  }
  return chosen ? { owner: memory.owner, card: chosen.card, prediction: chosen.prediction, eventId: eventId() } : null;
}
function review(memory, selection, outcome, answeredAt = nowISO()) {
  assertOwner(memory.owner);
  if (!selection || selection.owner !== memory.owner) throw new Error('The displayed prediction belongs to another account.');
  const current = load(memory.owner, memory.stats);
  if (current.reviews.some(event => event.id === selection.eventId)) return current;
  const event = recall.completeVocabularyReview(selection.prediction, outcome, answeredAt, selection.eventId);
  const key = `${event.language}:${event.lemma}`;
  const stat = current.stats[key] || { seen: 0, correct: 0 };
  return save({ owner: memory.owner,
    stats: { ...current.stats, [key]: { seen: stat.seen + 1, correct: stat.correct + Number(outcome === 'remembered') } },
    reviews: recall.sanitizeVocabularyReviews([...current.reviews, event]),
    pendingReviewIds: [...current.pendingReviewIds, event.id] });
}
function wordStats(memory, card) {
  const events = memory.reviews.filter(event => event.language === card.language && event.lemma === card.term);
  const last = events[events.length - 1];
  return { ...(memory.stats[keyFor(card)] || { seen: 0, correct: 0 }),
    approximate: events.filter(event => event.outcome === 'approximate').length,
    lastOutcome: last ? last.outcome : '', lastAnsweredAt: last ? last.answeredAt : '' };
}
async function sync(owner) {
  owner = ownerKey(owner);
  assertOwner(owner);
  if (owner === 'guest') return { memory: load(owner), cloud: null };
  if (syncing.has(owner)) return syncing.get(owner);
  const pending = (async () => {
    const before = load(owner);
    const result = await syncVocabularyReviews(before, owner, async (path, options = {}) => {
      assertOwner(owner);
      const body = await api.request(path, options.method || 'GET', options.body ? JSON.parse(options.body) : undefined);
      assertOwner(owner);
      return { ok: true, json: async () => body };
    });
    assertOwner(owner);
    const cloud = await api.getStats();
    assertOwner(owner);
    if (!Array.isArray(cloud && cloud.vocab)) throw new Error('Invalid vocabulary statistics response.');
    const stats = cleanStats(Object.fromEntries(cloud.vocab.map(row => [`${row && row.language}:${row && row.lemma}`, { seen: row && row.seen, correct: row && row.correct }])));
    if (Object.keys(stats).length !== cloud.vocab.length) throw new Error('Invalid vocabulary statistics records.');
    const current = load(owner);
    const acknowledged = new Set(result.syncedIds);
    const remoteIds = new Set(result.reviews.map(event => event.id));
    const pendingReviewIds = current.pendingReviewIds.filter(id => !acknowledged.has(id) && !remoteIds.has(id));
    const uncounted = reviewCounts(current.reviews.filter(event => pendingReviewIds.includes(event.id)));
    for (const [key, stat] of Object.entries(uncounted)) {
      const previous = stats[key] || { seen: 0, correct: 0 };
      stats[key] = { seen: previous.seen + stat.seen, correct: previous.correct + stat.correct };
    }
    const memory = save({ owner, stats, reviews: recall.sanitizeVocabularyReviews([...result.reviews, ...current.reviews]), pendingReviewIds });
    return { memory, cloud };
  })();
  syncing.set(owner, pending);
  try { return await pending; } finally { if (syncing.get(owner) === pending) syncing.delete(owner); }
}

module.exports = { load, entries, details, select, review, sync, wordStats, forecast, model };
