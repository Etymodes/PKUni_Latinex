/** A small per-language online logistic model; probabilities are estimates, not mastery labels. */
export const VOCABULARY_MODEL_VERSION = "pikku-recall-v1";
export const VOCABULARY_FEATURE_COUNT = 6;
export type VocabularyMode = "word" | "context";
export type VocabularyOutcome = "remembered" | "forgotten";
export type VocabularyBaselineStat = { seen: number; correct: number; asOf?: string };

export type ReviewPrediction = Readonly<{
  language: string;
  lemma: string;
  predictedAt: string;
  targetAt: string;
  probability: number;
  features: readonly number[];
  modelVersion: typeof VOCABULARY_MODEL_VERSION;
  mode: VocabularyMode;
  historyCount: number;
  hasTimedHistory: boolean;
}>;

export type VocabularyReviewEvent = Readonly<Omit<ReviewPrediction, "historyCount" | "hasTimedHistory"> & {
  id: string;
  answeredAt: string;
  outcome: VocabularyOutcome;
}>;

export type VocabularyModel = Readonly<{
  modelVersion: typeof VOCABULARY_MODEL_VERSION;
  language: string;
  cutoffAt: string;
  weights: readonly number[];
  sampleCount: number;
  metrics: Readonly<{
    count: number;
    brier: number | null;
    logLoss: number | null;
    baselineBrier: number | null;
    baselineLogLoss: number | null;
  }>;
}>;

// Schema v1: bias, log elapsed days, log repetitions, smoothed success rate,
// previous outcome, context mode. Counts/time use log(1+x)/(1+log(1+x)); no retention cap.
const INITIAL_WEIGHTS = [0, -2.4, 0.6, 0.9, 0.6, 0];
const WEIGHT_BOUNDS = [[-4, 4], [-8, 0], [0, 4], [0, 4], [0, 4], [-2, 2]];
const LANGUAGES = ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"];
// Candidate selection reuses the fitted model, so validate/sort its history only once per draw.
const modelHistories = new WeakMap<VocabularyModel, readonly VocabularyReviewEvent[]>();
const DAY = 86_400_000;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const compress = (value: number) => Math.log1p(value) / (1 + Math.log1p(value));
function isoTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(parsed) && Number.isFinite(day) && new Date(day).toISOString().startsWith(value.slice(0, 10)) ? parsed : NaN;
}
const cleanText = (value: unknown, maximum: number) => typeof value === "string" &&
  value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
const validLanguage = (value: unknown): value is string => typeof value === "string" &&
  LANGUAGES.includes(value);
const validMode = (value: unknown): value is VocabularyMode => value === "word" || value === "context";

function probability(weights: readonly number[], features: readonly number[]) {
  const score = clamp(weights.reduce((sum, weight, index) => sum + weight * features[index], 0), -12, 12);
  return clamp(1 / (1 + Math.exp(-score)), 0.02, 0.98);
}

/** Trust boundary for local-storage / API records. Unknown schema versions are not trained. */
export function isVocabularyReviewEvent(value: unknown): value is VocabularyReviewEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id) ||
      !validLanguage(item.language) || !cleanText(item.lemma, 160) ||
      item.modelVersion !== VOCABULARY_MODEL_VERSION || !validMode(item.mode) ||
      (item.outcome !== "remembered" && item.outcome !== "forgotten") ||
      typeof item.probability !== "number" || !Number.isFinite(item.probability) ||
      item.probability < 0.02 || item.probability > 0.98 ||
      !Array.isArray(item.features) || item.features.length !== VOCABULARY_FEATURE_COUNT ||
      !item.features.every((feature: unknown) => typeof feature === "number" && Number.isFinite(feature) && feature >= -1 && feature <= 1)) return false;
  const features = item.features as number[];
  if (features[0] !== 1 || features[1] < 0 || features[2] < 0 ||
      ![-1, 0, 1].includes(features[4]) || features[5] !== (item.mode === "context" ? 1 : 0)) return false;
  const predicted = isoTime(item.predictedAt);
  const target = isoTime(item.targetAt);
  const answered = isoTime(item.answeredAt);
  return Number.isFinite(predicted) && Number.isFinite(target) && Number.isFinite(answered) &&
    predicted <= target && target <= answered;
}

/** First valid occurrence of an ID wins; copying prevents imported arrays changing frozen evidence. */
export function normalizeVocabularyReviewEvents(value: unknown): VocabularyReviewEvent[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const events: VocabularyReviewEvent[] = [];
  for (const item of value) {
    if (!isVocabularyReviewEvent(item) || ids.has(item.id)) continue;
    ids.add(item.id);
    events.push(Object.freeze({
      id: item.id, language: item.language, lemma: item.lemma.trim().normalize("NFC"),
      predictedAt: new Date(item.predictedAt).toISOString(),
      targetAt: new Date(item.targetAt).toISOString(), answeredAt: new Date(item.answeredAt).toISOString(),
      outcome: item.outcome, probability: item.probability, features: Object.freeze([...item.features]),
      modelVersion: VOCABULARY_MODEL_VERSION, mode: item.mode,
    }));
  }
  return events.sort((left, right) => Date.parse(left.answeredAt) - Date.parse(right.answeredAt) ||
    Date.parse(left.predictedAt) - Date.parse(right.predictedAt) || left.id.localeCompare(right.id));
}

export const sanitizeVocabularyReviews = normalizeVocabularyReviewEvents;

export function trainVocabularyModel(
  events: unknown, language: string, cutoffISO = new Date().toISOString(),
): VocabularyModel {
  const cutoff = isoTime(cutoffISO);
  if (!validLanguage(language) || !Number.isFinite(cutoff)) throw new RangeError("Invalid model language or cutoff");
  const rows = normalizeVocabularyReviewEvents(events).filter((event) =>
    event.language === language && Date.parse(event.answeredAt) <= cutoff);
  const weights = [...INITIAL_WEIGHTS];
  let brier = 0;
  let logLoss = 0;
  rows.forEach((event, index) => {
    const outcome = event.outcome === "remembered" ? 1 : 0;
    // Prequential scores use the actual saved BEFORE-answer prediction, never a refitted score.
    brier += (event.probability - outcome) ** 2;
    logLoss -= outcome * Math.log(event.probability) + (1 - outcome) * Math.log(1 - event.probability);
    const error = probability(weights, event.features) - outcome;
    const rate = 0.15 / Math.sqrt(1 + index / 50);
    for (let feature = 0; feature < weights.length; feature += 1) {
      weights[feature] = clamp(weights[feature] - rate *
        (error * event.features[feature] + 0.005 * (weights[feature] - INITIAL_WEIGHTS[feature])),
      WEIGHT_BOUNDS[feature][0], WEIGHT_BOUNDS[feature][1]);
    }
  });
  const model = Object.freeze({
    modelVersion: VOCABULARY_MODEL_VERSION, language, cutoffAt: new Date(cutoff).toISOString(),
    weights: Object.freeze(weights), sampleCount: rows.length,
    metrics: Object.freeze({ count: rows.length, brier: rows.length ? brier / rows.length : null,
      logLoss: rows.length ? logLoss / rows.length : null,
      baselineBrier: rows.length ? 0.25 : null, baselineLogLoss: rows.length ? Math.log(2) : null }),
  });
  modelHistories.set(model, rows);
  return model;
}

/** Freeze this when the card is presented, before revealing the answer. Reuse model for a candidate list. */
export function makePrediction(
  events: unknown, language: string, lemma: string, targetAtISO: string, mode: VocabularyMode,
  baselineStat?: VocabularyBaselineStat, predictedAtISO = new Date().toISOString(),
  trainedModel?: VocabularyModel,
): ReviewPrediction {
  const predicted = isoTime(predictedAtISO);
  const target = isoTime(targetAtISO);
  if (!validLanguage(language) || !cleanText(lemma, 160) || !validMode(mode) ||
      !Number.isFinite(predicted) || !Number.isFinite(target) || target < predicted) {
    throw new RangeError("Invalid prediction input; target must not precede prediction time");
  }
  const cutoffAt = new Date(predicted).toISOString();
  const normalizedLemma = lemma.trim().normalize("NFC");
  const model = trainedModel?.language === language && trainedModel.cutoffAt === cutoffAt &&
    trainedModel.modelVersion === VOCABULARY_MODEL_VERSION && trainedModel.weights.length === VOCABULARY_FEATURE_COUNT &&
    trainedModel.weights.every((weight, index) => Number.isFinite(weight) &&
      weight >= WEIGHT_BOUNDS[index][0] && weight <= WEIGHT_BOUNDS[index][1])
    ? trainedModel : trainVocabularyModel(events, language, cutoffAt);
  const rows = (modelHistories.get(model) ?? normalizeVocabularyReviewEvents(events)).filter((event) => event.language === language &&
    event.lemma === normalizedLemma && Date.parse(event.answeredAt) <= predicted);
  const last = rows.at(-1);
  let count = rows.length;
  let correct = rows.filter((event) => event.outcome === "remembered").length;
  // A dated legacy snapshot may inform cold start; undated totals could contain future outcomes.
  const baselineTime = baselineStat?.asOf === undefined ? NaN : isoTime(baselineStat.asOf);
  if (!count && baselineStat && Number.isSafeInteger(baselineStat.seen) &&
      Number.isSafeInteger(baselineStat.correct) && baselineStat.seen >= 0 && baselineStat.correct >= 0 &&
      baselineStat.correct <= baselineStat.seen && Number.isFinite(baselineTime) && baselineTime <= predicted) {
    count = baselineStat.seen;
    correct = baselineStat.correct;
  }
  const features = Object.freeze([
    1, last ? compress(Math.max(0, target - Date.parse(last.answeredAt)) / DAY) : 0,
    compress(count), 2 * ((correct + 2) / (count + 4)) - 1,
    last ? (last.outcome === "remembered" ? 1 : -1) : 0, mode === "context" ? 1 : 0,
  ]);
  return Object.freeze({ language, lemma: normalizedLemma, predictedAt: cutoffAt,
    targetAt: new Date(target).toISOString(), probability: probability(model.weights, features), features,
    modelVersion: VOCABULARY_MODEL_VERSION, mode, historyCount: rows.length, hasTimedHistory: Boolean(last) });
}

/** Append the returned event; do not recompute features or probability after observing the outcome. */
export function completeVocabularyReview(
  prediction: ReviewPrediction, outcome: VocabularyOutcome, answeredAtISO = new Date().toISOString(),
  id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
): VocabularyReviewEvent {
  const event = { id, language: prediction.language, lemma: prediction.lemma, predictedAt: prediction.predictedAt,
    targetAt: prediction.targetAt, answeredAt: answeredAtISO, outcome, probability: prediction.probability,
    features: [...prediction.features], modelVersion: prediction.modelVersion, mode: prediction.mode };
  if (!isVocabularyReviewEvent(event)) throw new RangeError("Invalid completed review; answer must follow its target time");
  return normalizeVocabularyReviewEvents([event])[0];
}
