/** A small per-language online three-class model; probabilities are estimates, not mastery labels. */
export const VOCABULARY_MODEL_VERSION = "pikku-recall-v2";
const LEGACY_MODEL_VERSION = "pikku-recall-v1";
export const VOCABULARY_FEATURE_COUNT = 6;
export type VocabularyMode = "word" | "context";
export type VocabularyOutcome = "forgotten" | "approximate" | "remembered";
export type VocabularyProbabilities = Readonly<Record<VocabularyOutcome, number>>;
export type VocabularyBaselineStat = { seen: number; correct: number; asOf?: string };

export type ReviewPrediction = Readonly<{
  language: string;
  lemma: string;
  predictedAt: string;
  targetAt: string;
  probability: number;
  probabilities: VocabularyProbabilities;
  features: readonly number[];
  modelVersion: typeof VOCABULARY_MODEL_VERSION;
  mode: VocabularyMode;
  historyCount: number;
  hasTimedHistory: boolean;
}>;

type ReviewEvidence = Omit<ReviewPrediction, "historyCount" | "hasTimedHistory" | "modelVersion" | "probabilities"> & {
  id: string;
  answeredAt: string;
};
export type VocabularyReviewEvent = Readonly<ReviewEvidence & (
  { modelVersion: typeof LEGACY_MODEL_VERSION; outcome: "forgotten" | "remembered"; probabilities?: never }
  | { modelVersion: typeof VOCABULARY_MODEL_VERSION; outcome: VocabularyOutcome; probabilities: VocabularyProbabilities }
)>;

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

// Both versions retain six features: bias, log elapsed days, log repetitions,
// smoothed success rate, previous outcome (-1/0/1), context mode. Approximate
// contributes 0.5 to success and 0 as the previous outcome. No retention cap.
const OUTCOMES: readonly VocabularyOutcome[] = ["forgotten", "approximate", "remembered"];
// Flat rows follow OUTCOMES order. Elapsed-time constraints keep full recall
// non-increasing with delay while allowing the middle class its own learned bias.
const INITIAL_WEIGHTS = [0, 1.2, -0.3, -0.45, -0.3, 0, 0, 0, 0, 0, 0, 0, 0, -1.2, 0.3, 0.45, 0.3, 0];
const WEIGHT_BOUNDS = INITIAL_WEIGHTS.map((_, index) => index === 1 ? [0, 8] : index === 7 ? [0, 0] : index === 13 ? [-8, 0] : [-4, 4]);
const PROBABILITY_TOLERANCE = 1e-9;
const success = (outcome: VocabularyOutcome) => outcome === "remembered" ? 1 : outcome === "approximate" ? 0.5 : 0;
const LANGUAGES = ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru", "fr", "ar"];
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

function softmax(weights: readonly number[], features: readonly number[]) {
  const logits = OUTCOMES.map((_, row) => features.reduce((sum, feature, column) => sum + weights[row * VOCABULARY_FEATURE_COUNT + column] * feature, 0));
  const maximum = Math.max(...logits);
  const scores = logits.map(logit => Math.exp(logit - maximum));
  const total = scores.reduce((sum, score) => sum + score, 0);
  return scores.map(score => score / total);
}

function probabilities(weights: readonly number[], features: readonly number[]): VocabularyProbabilities {
  // A 2% floor for each class bounds log loss without breaking the sum-to-one invariant.
  const [forgotten, approximate, remembered] = softmax(weights, features).map(value => 0.02 + 0.94 * value);
  return Object.freeze({ forgotten, approximate, remembered });
}

function validProbabilities(value: unknown, remembered: number): value is VocabularyProbabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const values = value as Record<string, unknown>;
  if (!OUTCOMES.every(outcome => typeof values[outcome] === "number" && Number.isFinite(values[outcome]) && (values[outcome] as number) >= 0.02 && (values[outcome] as number) <= 0.96)) return false;
  const distribution = value as VocabularyProbabilities;
  return Math.abs(OUTCOMES.reduce((sum, outcome) => sum + distribution[outcome], 0) - 1) <= PROBABILITY_TOLERANCE
    && Math.abs(distribution.remembered - remembered) <= PROBABILITY_TOLERANCE;
}

/** Trust boundary for local-storage / API records. Unknown schema versions are not trained. */
export function isVocabularyReviewEvent(value: unknown): value is VocabularyReviewEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id) ||
      !validLanguage(item.language) || !cleanText(item.lemma, 160) ||
      (item.modelVersion !== VOCABULARY_MODEL_VERSION && item.modelVersion !== LEGACY_MODEL_VERSION) || !validMode(item.mode) ||
      !OUTCOMES.includes(item.outcome as VocabularyOutcome) ||
      typeof item.probability !== "number" || !Number.isFinite(item.probability) ||
      item.probability < 0.02 || item.probability > (item.modelVersion === LEGACY_MODEL_VERSION ? 0.98 : 0.96) ||
      !Array.isArray(item.features) || item.features.length !== VOCABULARY_FEATURE_COUNT ||
      !item.features.every((feature: unknown) => typeof feature === "number" && Number.isFinite(feature) && feature >= -1 && feature <= 1)) return false;
  if (item.modelVersion === LEGACY_MODEL_VERSION ? item.outcome === "approximate"
    : !validProbabilities(item.probabilities, item.probability as number)) return false;
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
      probability: item.probability, features: Object.freeze([...item.features]),
      mode: item.mode,
      ...(item.modelVersion === LEGACY_MODEL_VERSION
        ? { modelVersion: LEGACY_MODEL_VERSION, outcome: item.outcome }
        : { modelVersion: VOCABULARY_MODEL_VERSION, outcome: item.outcome, probabilities: Object.freeze({ forgotten: item.probabilities.forgotten, approximate: item.probabilities.approximate, remembered: item.probabilities.remembered }) }),
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
  let evaluatedCount = 0;
  rows.forEach((event, index) => {
    // Only v2 has a saved three-class forecast. Never invent v1 probabilities or
    // compare its binary Brier score with a three-class baseline.
    if (event.modelVersion === VOCABULARY_MODEL_VERSION) {
      evaluatedCount += 1;
      brier += OUTCOMES.reduce((sum, outcome) => sum + (event.probabilities[outcome] - Number(event.outcome === outcome)) ** 2, 0);
      logLoss -= Math.log(event.probabilities[event.outcome]);
    }
    const fitted = softmax(weights, event.features);
    const rate = 0.15 / Math.sqrt(1 + index / 50);
    OUTCOMES.forEach((outcome, row) => {
      const error = fitted[row] - Number(event.outcome === outcome);
      for (let feature = 0; feature < VOCABULARY_FEATURE_COUNT; feature += 1) {
        const weight = row * VOCABULARY_FEATURE_COUNT + feature;
        weights[weight] = clamp(weights[weight] - rate *
          (error * event.features[feature] + 0.005 * (weights[weight] - INITIAL_WEIGHTS[weight])),
        WEIGHT_BOUNDS[weight][0], WEIGHT_BOUNDS[weight][1]);
      }
    });
  });
  const model = Object.freeze({
    modelVersion: VOCABULARY_MODEL_VERSION, language, cutoffAt: new Date(cutoff).toISOString(),
    weights: Object.freeze(weights), sampleCount: rows.length,
    metrics: Object.freeze({ count: evaluatedCount, brier: evaluatedCount ? brier / evaluatedCount : null,
      logLoss: evaluatedCount ? logLoss / evaluatedCount : null,
      baselineBrier: evaluatedCount ? 2 / 3 : null, baselineLogLoss: evaluatedCount ? Math.log(3) : null }),
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
    trainedModel.modelVersion === VOCABULARY_MODEL_VERSION && trainedModel.weights.length === INITIAL_WEIGHTS.length &&
    trainedModel.weights.every((weight, index) => Number.isFinite(weight) &&
      weight >= WEIGHT_BOUNDS[index][0] && weight <= WEIGHT_BOUNDS[index][1])
    ? trainedModel : trainVocabularyModel(events, language, cutoffAt);
  const rows = (modelHistories.get(model) ?? normalizeVocabularyReviewEvents(events)).filter((event) => event.language === language &&
    event.lemma === normalizedLemma && Date.parse(event.answeredAt) <= predicted);
  const last = rows.at(-1);
  let count = rows.length;
  let correct = rows.reduce((total, event) => total + success(event.outcome), 0);
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
    last ? 2 * success(last.outcome) - 1 : 0, mode === "context" ? 1 : 0,
  ]);
  const distribution = probabilities(model.weights, features);
  return Object.freeze({ language, lemma: normalizedLemma, predictedAt: cutoffAt,
    targetAt: new Date(target).toISOString(), probability: distribution.remembered, probabilities: distribution, features,
    modelVersion: VOCABULARY_MODEL_VERSION, mode, historyCount: rows.length, hasTimedHistory: Boolean(last) });
}

/** Append the returned event; do not recompute features or probability after observing the outcome. */
export function completeVocabularyReview(
  prediction: ReviewPrediction, outcome: VocabularyOutcome, answeredAtISO = new Date().toISOString(),
  id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
): VocabularyReviewEvent {
  const event = { id, language: prediction.language, lemma: prediction.lemma, predictedAt: prediction.predictedAt,
    targetAt: prediction.targetAt, answeredAt: answeredAtISO, outcome, probability: prediction.probability,
    features: [...prediction.features], modelVersion: prediction.modelVersion, probabilities: { ...prediction.probabilities }, mode: prediction.mode };
  if (!isVocabularyReviewEvent(event)) throw new RangeError("Invalid completed review; answer must follow its target time");
  return normalizeVocabularyReviewEvents([event])[0];
}
