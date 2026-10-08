"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  GitBranch,
  History,
  Home,
  Landmark,
  Layers3,
  Library,
  Languages,
  ListOrdered,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  RotateCcw,
  Search,
  ScrollText,
  Sparkles,
  Save,
  Settings,
  Shuffle,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  normalizePikkuLevel,
  type StudyLevel,
  type PikkuLevel,
  matchesLevel,
  questions,
  questionOptionOrder,
  type Category,
  type LanguageCode,
  type Level,
  type Question,
  type ReviewStatus,
} from "@/data/questions";
import { languageConfigs, languageLevelLabels, languageOrder, type LanguageConfig, type LanguageLevel } from "@/data/languages";
import { languageFacts } from "@/data/language-facts";
import { multilingualQuestions } from "@/data/multilingual-questions";
import { studyQuestions } from "@/data/study-questions";
import { questionCollections, questionInCollection, questionForCollection, collectionOrder } from "@/data/question-collections";
import { multilingualSeedQuestions, multilingualVocabItems } from "@/data/multilingual-seeds";
import { availableLearningLanguages, getCopy, getLearningLanguage, normalizeLearningLanguage, type MicroLabelKey, type LearningLanguage, type LearningLanguageId, type UiCopy, type UiLocale } from "./i18n";
import { archiveEntries } from "@/data/archive";
import { curriculumDomains, etymologyFacts, textbookCoverage, vocabItems, type VocabItem } from "@/data/curriculum";
import { completeBankStats, completeQuestions, completeVocabItems } from "@/data/complete-bank";
import { classicalAuthors, resourceChapterMappings, textbookCatalog } from "@/data/resources";
import { vocabularyCards, vocabularyLevelsFor, vocabularyKey, type VocabularyMode, type VocabularyStats } from "@/data/vocabulary";
import { VocabularyTrainer, VocabularyDictionary } from "./vocabulary-workspace";
import { sanitizeVocabularyReviews, type VocabularyReviewEvent } from "@/lib/vocabulary-model";
import { syncVocabularyReviews, reviewCounts, subtractReviewCounts } from "@/lib/vocabulary-review-sync";
import { JlptExamWorkspace } from "./jlpt-exam-workspace";
import { CommunityAvatarSettings } from "./community-avatar";
import { CommunityWorkspace } from "./community-workspace";
import { buildRandomExam, buildVocabularyMeasurement, type VocabularyMeasurementItem } from "@/lib/study-modes";
import { extraEnglish } from "./extra-copy";
import { contentText, localizeQuestion } from "../lib/content-locale";
import { shuffle } from "@/lib/shuffle";
import { apiFetch, supabase } from "@/lib/supabase";

type View = "home" | "practice" | "story" | "vocab-trainer" | "mistakes" | "bookmarks" | "exam" | "vocabulary" | "scope" | "archive" | "resources" | "dictionary" | "community" | "settings" | "admin";
type Progress = Record<string, "correct" | "wrong" | "review">;
type Session = { authenticated: boolean; persistence?: boolean; authError?: string; user: null | { email: string; name: string; role: "student" | "admin" } };
type Override = { id: string; deleted: boolean; question: Question | null };
type AccountPreference = { language: LanguageCode; level: LanguageLevel; vocabMode: VocabularyMode };
type LegacyVocabularyBatch = { id: string; language: LanguageCode; answers: { lemma: string; seen: number; correctCount: number }[] };
type VocabularyMemory = { pendingLegacyBatches?: LegacyVocabularyBatch[]; owner: string; stats: VocabularyStats; reviews?: VocabularyReviewEvent[]; pendingReviewIds?: string[]; guestImport?: { id: string; stats: VocabularyStats } };

const GUEST_VOCABULARY_OWNER = "guest";
const reviewStatusLabels: Record<ReviewStatus, string> = { draft: "内容草稿", reviewed: "已复核", published: "已发布", archived: "已归档" };

const STORAGE = {
  progress: "latin-practica-progress-v1",
  bookmarks: "latin-practica-bookmarks-v1",
  streak: "latin-practica-last-study-v1",
  locale: "pikku-ui-locale-v1",
  language: "pikku-language-v1",
  languageLevel: "pikku-language-level-v1",
  vocabularyMode: "pikku-vocabulary-mode-v1",
  vocabularyMemory: "pikku-vocabulary-memory-v1",
};

const I18nContext = createContext<{ locale: UiLocale; copy: UiCopy; language: LearningLanguage }>({ locale: "zh-CN", copy: getCopy("zh-CN"), language: getLearningLanguage("la") });

const LEVEL_ORDER: PikkuLevel[] = ["C", "F", "G", "M"];
const VIEW_MICRO_LABEL: Record<View, MicroLabelKey> = { home: "overview", story: "story", practice: "practice", mistakes: "review", bookmarks: "review", exam: "exam", vocabulary: "vocabulary", "vocab-trainer": "vocabulary", scope: "scope", archive: "archive", resources: "archive", dictionary: "vocabulary", community: "courses", settings: "progress", admin: "admin" };

function useI18n() {
  return useContext(I18nContext);
}

function useInterfaceText() {
  const { locale } = useI18n();
  return (text: string) => locale === "en" ? extraEnglish[text] ?? text : text;
}

function levelName(copy: UiCopy, level: StudyLevel, language: LanguageCode = "la") {
  const stage = normalizePikkuLevel(language, level);
  const name = { C: copy.elementary, F: copy.intermediate, G: copy.advanced, M: copy.mixed }[stage];
  return `${stage} · ${name}`;
}

function categoryName(copy: UiCopy, category: Category) {
  return ({
    morphology: copy.categoryMorphology,
    syntax: copy.categorySyntax,
    sentencePattern: copy.categorySentencePattern,
    vocabulary: copy.categoryVocabulary,
    classics: copy.categoryClassics,
    translation: copy.categoryTranslation,
    reading: copy.categoryReading,
    listening: copy.categoryListening,
  })[category];
}

function stageName(copy: UiCopy, stage: string) {
  return ({
    奠基: copy.stageFoundation,
    核心: copy.stageCore,
    全范围: copy.stageFull,
    原典进阶: copy.stageAdvanced,
  } as Record<string, string>)[stage] || stage;
}

function archiveStatusName(copy: UiCopy, status: string) {
  return status === "未检出举行记录" ? copy.archiveStatusNoRecord : copy.archiveStatusMissingPaper;
}

function archiveLevelName(copy: UiCopy, levels: string) {
  if (levels === "初级拉丁语") return copy.archiveElementaryLatin;
  if (levels === "初级／中级") return copy.archiveElementaryIntermediate;
  return levels;
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved));
    } catch {
      // A blocked localStorage should never block practice.
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Progress remains available for this session.
    }
  }, [key, ready, value]);

  return [value, setValue, ready] as const;
}

const staticQuestions = [...studyQuestions];
const staticQuestionIndex = new Map(staticQuestions.map((question) => [question.id, question]));
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isStaticPublic = process.env.NEXT_PUBLIC_STATIC_PUBLIC === "true";
const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "chatgpt";
function assetPath(path: string) {
  if (!publicBasePath || !path.startsWith("/") || path.startsWith("//") || path === publicBasePath || path.startsWith(`${publicBasePath}/`)) return path;
  return `${publicBasePath}${path}`;
}

function syncQuestion(questionId: string) {
  const question = staticQuestionIndex.get(questionId);
  if (question) return question;
  // ponytail: legacy custom IDs default to Latin until P4 adds multilingual override migration.
  return { id: questionId, language: "la" as LanguageCode, level: "elementary" as LanguageLevel, category: "vocabulary" as Category };
}

function validAccountPreference(value: unknown): value is AccountPreference {
  if (!value || typeof value !== "object") return false;
  const preference = value as AccountPreference;
  return Boolean(languageConfigs[preference.language]) && typeof preference.level === "string"
    && (preference.vocabMode === "word" || preference.vocabMode === "context");
}

function remoteVocabularyStats(value: unknown): VocabularyStats {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { language?: unknown; lemma?: unknown; seen?: unknown; correct?: unknown };
    if (!languageConfigs[item.language as LanguageCode] || typeof item.lemma !== "string") return [];
    const seen = Math.max(0, Number(item.seen) || 0);
    const correct = Math.min(seen, Math.max(0, Number(item.correct) || 0));
    return [[vocabularyKey(item.language as LanguageCode, item.lemma), { seen, correct }]];
  }));
}

function mergeVocabularyStats(remote: VocabularyStats, local: VocabularyStats, addLocal = false) {
  const merged = { ...remote };
  for (const [key, stat] of Object.entries(local)) {
    const current = merged[key] ?? { seen: 0, correct: 0 };
    merged[key] = addLocal
      ? { seen: current.seen + stat.seen, correct: current.correct + stat.correct }
      : { seen: Math.max(current.seen, stat.seen), correct: Math.max(current.correct, stat.correct) };
  }
  return merged;
}

function sanitizeLegacyVocabularyBatches(value: unknown): LegacyVocabularyBatch[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((batch): batch is LegacyVocabularyBatch => {
    if (!batch || typeof batch !== "object" || typeof batch.id !== "string" || !/^[A-Za-z0-9_:-]{1,200}$/.test(batch.id) || seen.has(batch.id)
      || typeof batch.language !== "string" || !Object.hasOwn(languageConfigs, batch.language) || !Array.isArray(batch.answers) || batch.answers.length < 1 || batch.answers.length > 100
      || !batch.answers.every((answer: LegacyVocabularyBatch["answers"][number]) => answer && typeof answer.lemma === "string" && answer.lemma.trim().length > 0 && answer.lemma.length <= 160
        && Number.isInteger(answer.seen) && answer.seen >= 1 && answer.seen <= 1000 && Number.isInteger(answer.correctCount) && answer.correctCount >= 0 && answer.correctCount <= answer.seen)) return false;
    seen.add(batch.id);
    return true;
  });
}

function legacyVocabularyCounts(batches: LegacyVocabularyBatch[]): VocabularyStats {
  const counts: VocabularyStats = {};
  for (const batch of sanitizeLegacyVocabularyBatches(batches)) for (const answer of batch.answers) {
    const key = vocabularyKey(batch.language, answer.lemma);
    const previous = counts[key] ?? { seen: 0, correct: 0 };
    counts[key] = { seen: previous.seen + answer.seen, correct: previous.correct + answer.correctCount };
  }
  return counts;
}

function cacheVocabularyMemory(memory: VocabularyMemory) {
  if (memory.owner === GUEST_VOCABULARY_OWNER) return;
  try { localStorage.setItem(`${STORAGE.vocabularyMemory}:${memory.owner}`, JSON.stringify(memory)); } catch { /* Session memory remains available. */ }
}

function readCachedVocabularyMemory(owner: string): VocabularyMemory | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${STORAGE.vocabularyMemory}:${owner}`) ?? "null");
    if (value?.owner !== owner || !value.stats || typeof value.stats !== "object") return null;
    return { owner, stats: value.stats, pendingLegacyBatches: sanitizeLegacyVocabularyBatches(value.pendingLegacyBatches), reviews: sanitizeVocabularyReviews(value.reviews), pendingReviewIds: Array.isArray(value.pendingReviewIds) ? value.pendingReviewIds.filter((id: unknown) => typeof id === "string") : [] };
  } catch { return null; }
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function viewForLanguage(language: LanguageCode, view: View): View {
  if (language === "la") return view;

  if (view === "archive") return "resources";
  return view;
}

function equivalentLevel(current: LanguageConfig, level: LanguageLevel, next: LanguageConfig): LanguageLevel {
  const index = current.levels.indexOf(level);
  if (index < 0 || current.levels.length < 2) return next.defaultLevel;
  const nextIndex = Math.round((index / (current.levels.length - 1)) * (next.levels.length - 1));
  return next.levels[nextIndex] ?? next.defaultLevel;
}

export default function App() {
  const [locale, setLocale, localeReady] = usePersistentState<UiLocale>(STORAGE.locale, "zh-CN");
  const [view, setView] = useState<View>("home");
  const [language, setLanguage, languageReady] = usePersistentState<LanguageCode>(STORAGE.language, "la");
  const [languageLevel, setLanguageLevel, languageLevelReady] = usePersistentState<LanguageLevel>(STORAGE.languageLevel, "elementary");
  const [vocabularyMode, setVocabularyMode, vocabularyModeReady] = usePersistentState<VocabularyMode>(STORAGE.vocabularyMode, "context");
  const [vocabularyMemory, setVocabularyMemory, vocabularyMemoryReady] = usePersistentState<VocabularyMemory>(STORAGE.vocabularyMemory, { owner: GUEST_VOCABULARY_OWNER, stats: {} });
  const [vocabularyFocus, setVocabularyFocus] = useState<string | undefined>();
  const [category, setCategory] = useState<Category | "all">("all");
  const [fullPaper, setFullPaper] = useState(false);
  const [progress, setProgress, progressReady] = usePersistentState<Progress>(STORAGE.progress, {});
  const [bookmarks, setBookmarks, bookmarksReady] = usePersistentState<string[]>(STORAGE.bookmarks, []);
  const [mobileNav, setMobileNav] = useState(false);
  const [session, setSession] = useState<Session>({ authenticated: false, user: null });
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [wechatEnabled, setWechatEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const pendingAccountSyncs = useRef<Set<Promise<void>>>(new Set());
  const accountSyncChain = useRef<Promise<void>>(Promise.resolve());
  const progressRef = useRef(progress);
  const bookmarksRef = useRef(bookmarks);
  const bookmarkRevisionRef = useRef(0);
  const languageRef = useRef(language);
  const languageLevelRef = useRef(languageLevel);
  const levelsByLanguageRef = useRef<Partial<Record<LanguageCode, LanguageLevel>>>({});
  const vocabularyModeRef = useRef(vocabularyMode);
  const vocabularyMemoryRef = useRef(vocabularyMemory);
  const accountOwnerRef = useRef<string | null>(null);
  const accountRevisionRef = useRef(0);
  const languageConfig = languageConfigs[language] ?? languageConfigs.la;
  const level = normalizePikkuLevel(language, languageLevel);
  const copy = getCopy(locale);
  const t = (text: string) => locale === "en" ? extraEnglish[text] ?? text : text;
  const currentLanguage = getLearningLanguage(language);
  const accountStorageReady = languageReady && languageLevelReady && vocabularyModeReady && vocabularyMemoryReady && progressReady && bookmarksReady;
  const vocabularyOwnerReady = vocabularyMemoryReady && vocabularyMemory.owner === (session.authenticated && session.user ? session.user.email : GUEST_VOCABULARY_OWNER);
  const activeVocabularyStats = vocabularyOwnerReady ? vocabularyMemory.stats : {};
  const activeVocabularyReviews = useMemo(() => vocabularyOwnerReady ? sanitizeVocabularyReviews(vocabularyMemory.reviews) : [], [vocabularyOwnerReady, vocabularyMemory.reviews]);

  useEffect(() => { if (vocabularyMemoryReady) cacheVocabularyMemory(vocabularyMemory); }, [vocabularyMemoryReady, vocabularyMemory]);

  useEffect(() => {
    if (!languageReady || !languageLevelReady) return;
    const normalized = normalizePikkuLevel(language, languageLevel);
    if (normalized !== languageLevel) setLanguageLevel(normalized);
  }, [language, languageLevel, languageReady, languageLevelReady, setLanguageLevel]);

  useEffect(() => {
    if (!localeReady || !languageReady) return;
    const normalized = normalizeLearningLanguage(locale, language);
    if (normalized !== language) setLanguage(normalized);
  }, [locale, localeReady, language, languageReady, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.siteTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy.siteDescription);
  }, [locale, copy.siteTitle, copy.siteDescription]);

  useEffect(() => {
    progressRef.current = progress;
    bookmarksRef.current = bookmarks;
    languageRef.current = language;
    languageLevelRef.current = languageLevel;
    levelsByLanguageRef.current[language] = languageLevel;
    vocabularyModeRef.current = vocabularyMode;
    vocabularyMemoryRef.current = vocabularyMemory;
  }, [bookmarks, language, languageLevel, progress, vocabularyMemory, vocabularyMode]);

  const queueAccountSync = useCallback((operation: () => Promise<void>) => {
    setSyncStatus("syncing");
    const sync = accountSyncChain.current.catch(() => {}).then(operation);
    accountSyncChain.current = sync;
    pendingAccountSyncs.current.add(sync);
    void sync.then(
      () => {},
      () => setSyncStatus("error"),
    ).finally(() => {
      pendingAccountSyncs.current.delete(sync);
      if (pendingAccountSyncs.current.size === 0) setSyncStatus((current) => current === "error" ? "error" : "idle");
    });
    return sync;
  }, []);

  const clearAccountData = useCallback(() => {
    accountRevisionRef.current += 1;
    cacheVocabularyMemory(vocabularyMemoryRef.current);
    accountOwnerRef.current = null;
    setSession({ authenticated: false, persistence: true, user: null });
    if (vocabularyMemoryRef.current.owner === GUEST_VOCABULARY_OWNER) { setSyncStatus("idle"); return; }
    progressRef.current = {};
    setProgress({});
    bookmarkRevisionRef.current += 1;
    bookmarksRef.current = [];
    setBookmarks([]);
    vocabularyModeRef.current = "context";
    setVocabularyMode("context");
    const guestVocabularyMemory = { owner: GUEST_VOCABULARY_OWNER, stats: {} };
    vocabularyMemoryRef.current = guestVocabularyMemory;
    setVocabularyMemory(guestVocabularyMemory);
    setSyncStatus("idle");
  }, [setBookmarks, setProgress, setVocabularyMemory, setVocabularyMode]);

  const refreshAccount = useCallback(async (providedSession?: Session) => {
    const revision = ++accountRevisionRef.current;
    const nextSession = providedSession ?? await apiFetch("/api/me").then((response) => response.ok ? response.json() : null);
    if (!nextSession || accountRevisionRef.current !== revision) return;
    cacheVocabularyMemory(vocabularyMemoryRef.current);
    accountOwnerRef.current = nextSession.authenticated ? nextSession.user?.email ?? null : null;
    setSession(nextSession);
    if (!nextSession.authenticated || !nextSession.user) {
      clearAccountData();
      return;
    }

    const bookmarkRevision = bookmarkRevisionRef.current;
    await queueAccountSync(async () => {
      const owner = nextSession.user!.email;
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      const response = await apiFetch("/api/stats");
      if (!response.ok) {
        setSyncStatus("error");
        return;
      }
      const stats = await response.json();
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      const remoteProgress = stats?.progress && typeof stats.progress === "object" ? stats.progress as Progress : {};
      const currentVocab = vocabularyMemoryRef.current;
      const localProgress = currentVocab.owner === owner || currentVocab.owner === GUEST_VOCABULARY_OWNER ? progressRef.current : {};
      const mergedProgress = { ...localProgress, ...remoteProgress };
      const savedVocab = readCachedVocabularyMemory(owner);
      const localVocab: VocabularyMemory = currentVocab.owner === owner || currentVocab.owner === GUEST_VOCABULARY_OWNER ? currentVocab : savedVocab ?? { owner, stats: {} };
      const addGuestStats = localVocab.owner === GUEST_VOCABULARY_OWNER;
      const pendingLegacyBatches = sanitizeLegacyVocabularyBatches([...(localVocab.pendingLegacyBatches ?? []), ...(savedVocab?.pendingLegacyBatches ?? [])]);
      const localBookmarks = bookmarksRef.current;
      if (!Array.isArray(stats?.bookmarks)) throw new Error("Invalid account bookmarks");
      const remoteBookmarks: string[] = stats.bookmarks.filter((id: unknown) => typeof id === "string");
      // Only import actual guest records. An account cache must not restore remote deletions.
      const mergedBookmarks = [...new Set([...remoteBookmarks, ...(addGuestStats ? localBookmarks : [])])];
      if (mergedBookmarks.length !== remoteBookmarks.length) {
        const guestBookmarks = localBookmarks.filter((id) => !remoteBookmarks.includes(id));
        const guestLanguages = new Set(guestBookmarks.map((id) => syncQuestion(id).language ?? "la"));
        for (const nextLanguage of guestLanguages) {
          if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
          const remoteLanguageBookmarks: string[] = stats.byLanguage?.[nextLanguage]?.bookmarks
            ?? remoteBookmarks.filter((id) => (syncQuestion(id).language ?? "la") === nextLanguage);
          const questionIds = [...new Set([...remoteLanguageBookmarks, ...guestBookmarks.filter((id) => (syncQuestion(id).language ?? "la") === nextLanguage)])];
          const migrated = await apiFetch("/api/bookmarks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, questionIds }) });
          if (!migrated.ok) {
            setSyncStatus("error");
            return;
          }
        }
      }
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      if (addGuestStats && Object.keys(localVocab.stats).length) {
        const legacyPendingCounts = legacyVocabularyCounts(pendingLegacyBatches);
        const unlogged = subtractReviewCounts(localVocab.stats, sanitizeVocabularyReviews(localVocab.reviews));
        const legacyHistory = Object.fromEntries(Object.entries(unlogged).map(([key, stat]): [string, { seen: number; correct: number }] => {
          const seen = Math.max(0, stat.seen - (legacyPendingCounts[key]?.seen ?? 0));
          return [key, { seen, correct: Math.min(seen, Math.max(0, stat.correct - (legacyPendingCounts[key]?.correct ?? 0))) }];
        }).filter(([, stat]) => stat.seen > 0));
        const guestImport = localVocab.guestImport ?? { id: crypto.randomUUID(), stats: legacyHistory };
        if (!localVocab.guestImport) {
          localVocab.guestImport = guestImport;
          const saved = { ...vocabularyMemoryRef.current, guestImport };
          vocabularyMemoryRef.current = saved;
          setVocabularyMemory(saved);
        }
        const guestByLanguage: Partial<Record<LanguageCode, { lemma: string; seen: number; correctCount: number }[]>> = {};
        for (const [key, stat] of Object.entries(guestImport.stats)) {
          const separator = key.indexOf(":");
          const nextLanguage = key.slice(0, separator) as LanguageCode;
          if (separator < 1 || !languageConfigs[nextLanguage]) continue;
          (guestByLanguage[nextLanguage] ??= []).push({ lemma: key.slice(separator + 1), seen: stat.seen, correctCount: stat.correct });
        }
        for (const [nextLanguage, answers] of Object.entries(guestByLanguage) as [LanguageCode, { lemma: string; seen: number; correctCount: number }[]][]) {
          for (let offset = 0; offset < answers.length; offset += 100) {
            if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
            const migrated = await apiFetch("/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, answers: answers.slice(offset, offset + 100), migrationId: `${guestImport.id}:${nextLanguage}:${offset}` }) });
            if (!migrated.ok) {
              setSyncStatus("error");
              return;
            }
            const result = await migrated.json();
            if (result?.ok !== true || result.count !== Math.min(100, answers.length - offset) || ![0, 1].includes(result.inserted)) throw new Error("Invalid vocabulary history acknowledgment");
          }
        }
      }
      for (const batch of pendingLegacyBatches) {
        if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
        const response = await apiFetch("/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: batch.language, answers: batch.answers, migrationId: batch.id }) });
        if (!response.ok) throw new Error("Vocabulary measurement upload failed");
        const result = await response.json();
        if (result?.ok !== true || result.count !== batch.answers.length || ![0, 1].includes(result.inserted)) throw new Error("Invalid vocabulary measurement acknowledgment");
      }
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      if (bookmarkRevisionRef.current === bookmarkRevision) {
        bookmarksRef.current = mergedBookmarks;
        setBookmarks(mergedBookmarks);
      }
      const localReviews = sanitizeVocabularyReviews(localVocab.reviews);
      const syncMemory = { owner, reviews: sanitizeVocabularyReviews([...localReviews, ...sanitizeVocabularyReviews(savedVocab?.reviews)]),
        pendingReviewIds: [...new Set([...(savedVocab?.pendingReviewIds ?? []), ...(addGuestStats ? localReviews.map(event => event.id) : localVocab.pendingReviewIds ?? [])])] };
      const syncedReviews = await syncVocabularyReviews(syncMemory, owner, async (path, options) => {
        if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) throw new Error("Account changed during vocabulary sync");
        return apiFetch(path, options);
      });
      const refreshedStats = await apiFetch("/api/stats");
      if (!refreshedStats.ok) throw new Error("Vocabulary statistics refresh failed");
      const cloudVocabulary = remoteVocabularyStats((await refreshedStats.json()).vocab);
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      const latestMemory = vocabularyMemoryRef.current;
      const sameOwner = latestMemory.owner === localVocab.owner;
      const initialIds = new Set(sanitizeVocabularyReviews(localVocab.reviews).map(event => event.id));
      const concurrentReviews = sameOwner ? sanitizeVocabularyReviews(latestMemory.reviews).filter(event => !initialIds.has(event.id)) : [];
      const combinedReviews = sanitizeVocabularyReviews([...syncedReviews.reviews, ...concurrentReviews]);
      const syncedIds = new Set(syncedReviews.syncedIds);
      const pendingReviewIds = sameOwner ? [...new Set([...(latestMemory.pendingReviewIds ?? []), ...concurrentReviews.map(event => event.id)])].filter(id => !syncedIds.has(id)) : [];
      const initialLegacyIds = new Set(pendingLegacyBatches.map(batch => batch.id));
      const concurrentLegacy = sameOwner ? sanitizeLegacyVocabularyBatches(latestMemory.pendingLegacyBatches).filter(batch => !initialLegacyIds.has(batch.id)) : [];
      const localCounts = mergeVocabularyStats(reviewCounts(concurrentReviews), legacyVocabularyCounts(concurrentLegacy), true);
      const nextVocabularyMemory: VocabularyMemory = { owner, stats: mergeVocabularyStats(cloudVocabulary, localCounts, true), reviews: combinedReviews, pendingReviewIds, pendingLegacyBatches: concurrentLegacy };
      vocabularyMemoryRef.current = nextVocabularyMemory;
      setVocabularyMemory(nextVocabularyMemory);
      const concurrentProgress = Object.fromEntries((sameOwner ? Object.entries(progressRef.current) : []).filter(([id, value]) => value !== localProgress[id]));
      progressRef.current = { ...mergedProgress, ...concurrentProgress };
      setProgress(progressRef.current);
      const unsyncedProgress = Object.entries(localProgress).filter(([id]) => !(id in remoteProgress)).map(([questionId, status]) => {
        const question = syncQuestion(questionId);
        return { questionId, status, language: question.language ?? "la", level: question.level, category: question.category };
      });
      if (unsyncedProgress.length) {
        const migrated = await apiFetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ records: unsyncedProgress }) });
        if (!migrated.ok) {
          setSyncStatus("error");
          return;
        }
      }
      if (accountOwnerRef.current !== owner || accountRevisionRef.current !== revision) return;
      if (validAccountPreference(stats?.preference)) {
        languageRef.current = stats.preference.language;
        languageLevelRef.current = stats.preference.level;
        vocabularyModeRef.current = stats.preference.vocabMode;
        setLanguage(stats.preference.language);
        setLanguageLevel(normalizePikkuLevel(stats.preference.language, stats.preference.level));
        setVocabularyMode(stats.preference.vocabMode);
      } else {
        const migrated = await apiFetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: languageRef.current, level: languageLevelRef.current, vocabMode: vocabularyModeRef.current }) });
        if (!migrated.ok) {
          setSyncStatus("error");
          return;
        }
      }
    }).catch(() => { /* The queue displays the sync error and keeps refresh callers safe. */ });
  }, [clearAccountData, queueAccountSync, setBookmarks, setLanguage, setLanguageLevel, setProgress, setVocabularyMemory, setVocabularyMode]);

  const waitForAccountSync = useCallback(async () => {
    await Promise.allSettled([...pendingAccountSyncs.current]);
  }, []);


  useEffect(() => {
    if (isStaticPublic || !accountStorageReady) return;
    const revision = accountRevisionRef.current;
    let cancelled = false;
    Promise.all([
      apiFetch("/api/me").then((r) => r.ok ? r.json() : null),
      apiFetch("/api/questions").then((r) => r.ok ? r.json() : { overrides: [] }),
      apiFetch("/api/auth-config").then((r) => r.ok ? r.json() : { wechat: false }),
    ]).then(([me, remote, authConfig]) => {
      setOverrides(remote?.overrides || []);
      setWechatEnabled(Boolean(authConfig?.wechat));
      if (cancelled || accountRevisionRef.current !== revision) return;
      if (me) void refreshAccount(me);
    }).catch(() => { /* Static preview and anonymous practice remain usable. */ });

    if (authMode !== "supabase") return () => { cancelled = true; };
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAccountData();
        return;
      }
      window.setTimeout(() => {
        void refreshAccount();
      }, 0);
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [accountStorageReady, clearAccountData, refreshAccount]);

  useEffect(() => {
    if (isStaticPublic) return;
    const reconnect = () => { if (accountOwnerRef.current) void refreshAccount(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [refreshAccount]);

  const questionBank = useMemo(() => {
    const map = new Map(staticQuestions.map((question) => [question.id, question]));
    overrides.forEach((override) => override.deleted ? map.delete(override.id) : override.question && map.set(override.id, override.question));
    return [...map.values()];
  }, [overrides]);
  const languageBank = useMemo(() => questionBank.filter((question) => (question.language ?? "la") === language), [language, questionBank]);
  const languageQuestionIds = useMemo(() => new Set(languageBank.map((question) => question.id)), [languageBank]);
  const languageBookmarks = bookmarks.filter((id) => languageQuestionIds.has(id));

  const recordProgress = (question: Question, status: Progress[string]) => {
    setProgress((current) => {
      const next = { ...current, [question.id]: status };
      progressRef.current = next;
      return next;
    });
    const owner = session.user?.email;
    if (!session.authenticated || !owner) return;
    queueAccountSync(async () => {
      if (accountOwnerRef.current !== owner) return;
      const response = await apiFetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: question.id, status, language: question.language ?? "la", level: question.level, category: question.category }) });
      if (!response.ok) throw new Error(t("进度同步失败"));
    });
  };

  const recordVocabulary = (nextLanguage: LanguageCode, answers: { lemma: string; correct: boolean }[]) => {
    const current = vocabularyMemoryRef.current;
    const owner = session.authenticated && session.user ? session.user.email : GUEST_VOCABULARY_OWNER;
    if (current.owner !== owner || (accountOwnerRef.current ?? GUEST_VOCABULARY_OWNER) !== owner || !answers.length) return false;
    const batches: LegacyVocabularyBatch[] = [];
    for (let offset = 0; offset < answers.length; offset += 100) batches.push({ id: crypto.randomUUID(), language: nextLanguage,
      answers: answers.slice(offset, offset + 100).map(answer => ({ lemma: answer.lemma, seen: 1, correctCount: Number(answer.correct) })) });
    if (sanitizeLegacyVocabularyBatches(batches).length !== batches.length) return false;
    const next: VocabularyMemory = { ...current, pendingLegacyBatches: [...sanitizeLegacyVocabularyBatches(current.pendingLegacyBatches), ...batches],
      stats: mergeVocabularyStats(current.stats, legacyVocabularyCounts(batches), true) };
    vocabularyMemoryRef.current = next;
    setVocabularyMemory(next);
    if (session.authenticated) void refreshAccount(session);
    return true;
  };

  const recordVocabularyReview = (event: VocabularyReviewEvent) => {
    const current = vocabularyMemoryRef.current;
    const reviews = sanitizeVocabularyReviews(current.reviews);
    if (!sanitizeVocabularyReviews([event]).length || reviews.some(item => item.id === event.id)) return false;
    const owner = session.authenticated && session.user ? session.user.email : GUEST_VOCABULARY_OWNER;
    if (current.owner !== owner || (accountOwnerRef.current ?? GUEST_VOCABULARY_OWNER) !== owner) return false;
    const next: VocabularyMemory = { ...current, reviews: [...reviews, event],
      pendingReviewIds: [...new Set([...(current.pendingReviewIds ?? []), event.id])],
      stats: mergeVocabularyStats(current.stats, reviewCounts([event]), true) };
    vocabularyMemoryRef.current = next;
    setVocabularyMemory(next);
    if (!session.authenticated) return true;
    void queueAccountSync(async () => {
      if (accountOwnerRef.current !== owner) return;
      const snapshot = vocabularyMemoryRef.current;
      const pending = new Set(snapshot.pendingReviewIds ?? []);
      const events = sanitizeVocabularyReviews(snapshot.reviews).filter(item => pending.has(item.id));
      for (let offset = 0; offset < events.length; offset += 100) {
        if (accountOwnerRef.current !== owner) return;
        const batch = events.slice(offset, offset + 100);
        const response = await apiFetch("/api/vocab/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events: batch }) });
        if (!response.ok) throw new Error(t("词汇统计同步失败"));
        const result = await response.json();
        if (result?.ok !== true || result.count !== batch.length || !Number.isInteger(result.inserted) || result.inserted < 0 || result.inserted > batch.length) throw new Error("Invalid vocabulary review acknowledgment");
        if (accountOwnerRef.current !== owner || vocabularyMemoryRef.current.owner !== owner) return;
        const sent = new Set(batch.map(item => item.id));
        const saved = { ...vocabularyMemoryRef.current, pendingReviewIds: (vocabularyMemoryRef.current.pendingReviewIds ?? []).filter(id => !sent.has(id)) };
        vocabularyMemoryRef.current = saved;
        setVocabularyMemory(saved);
      }
    }).catch(() => { /* The saved event stays pending and is retried on account refresh. */ });
    return true;
  };

  const updateBookmarks = useCallback((next: string[] | ((current: string[]) => string[]), nextLanguage: LanguageCode) => {
    const owner = session.user?.email;
    if (session.authenticated && accountOwnerRef.current !== owner) return;
    const current = bookmarksRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    const unique = [...new Set(resolved)];
    const added = unique.filter((id) => !current.includes(id));
    const removed = current.filter((id) => !unique.includes(id));
    const bookmarkRevision = ++bookmarkRevisionRef.current;
    bookmarksRef.current = unique;
    setBookmarks(unique);
    if (!session.authenticated || !owner || (!added.length && !removed.length)) return;
    queueAccountSync(async () => {
      if (accountOwnerRef.current !== owner) return;
      const latest = await apiFetch("/api/stats");
      if (!latest.ok) throw new Error(t("收藏同步失败"));
      const stats = await latest.json();
      if (accountOwnerRef.current !== owner) return;
      if (!Array.isArray(stats?.bookmarks)) throw new Error(t("收藏同步失败"));
      const remoteBookmarks: string[] = stats.bookmarks.filter((id: unknown) => typeof id === "string");
      const remoteLanguageBookmarks: string[] = stats.byLanguage?.[nextLanguage]?.bookmarks
        ?? remoteBookmarks.filter((id) => (syncQuestion(id).language ?? "la") === nextLanguage);
      const questionIds = [...new Set([...remoteLanguageBookmarks.filter((id) => !removed.includes(id)), ...added])];
      const response = await apiFetch("/api/bookmarks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, questionIds }) });
      if (!response.ok) throw new Error(t("收藏同步失败"));
      if (accountOwnerRef.current !== owner) return;
      if (bookmarkRevisionRef.current === bookmarkRevision) {
        const refreshed = [...new Set([...remoteBookmarks.filter((id) => !remoteLanguageBookmarks.includes(id)), ...questionIds])];
        bookmarksRef.current = refreshed;
        setBookmarks(refreshed);
      }
    });
  }, [queueAccountSync, session.authenticated, session.user, setBookmarks]);
  const updateLanguageBookmarks = useCallback((next: string[] | ((current: string[]) => string[])) => {
    const current = bookmarksRef.current;
    const currentLanguage = current.filter((id) => languageQuestionIds.has(id));
    const resolved = typeof next === "function" ? next(currentLanguage) : next;
    const otherLanguages = current.filter((id) => !languageQuestionIds.has(id));
    updateBookmarks([...otherLanguages, ...resolved], language);
  }, [language, languageQuestionIds, updateBookmarks]);

  const answered = Object.keys(progress).filter((id) => languageQuestionIds.has(id)).length;
  const correct = Object.entries(progress).filter(([id, value]) => languageQuestionIds.has(id) && value === "correct").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const syncPreference = (nextLanguage: LanguageCode, nextLevel: LanguageLevel, nextVocabularyMode: VocabularyMode = vocabularyModeRef.current) => {
    const owner = session.user?.email;
    if (!session.authenticated || !owner) return;
    queueAccountSync(async () => {
      if (accountOwnerRef.current !== owner) return;
      const response = await apiFetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, level: nextLevel, vocabMode: nextVocabularyMode }) });
      if (!response.ok) throw new Error(t("语言偏好同步失败"));
    });
  };

  const selectVocabularyMode = (nextMode: VocabularyMode) => {
    vocabularyModeRef.current = nextMode;
    setVocabularyMode(nextMode);
    syncPreference(language, languageLevel, nextMode);
  };

  const selectLanguage = (nextLanguage: LanguageCode) => {
    setFullPaper(false);
    if (nextLanguage === language) {
      setMobileNav(false);
      return;
    }
    const nextConfig = languageConfigs[nextLanguage];
    const rememberedLevel = levelsByLanguageRef.current[nextLanguage];
    const nextLevel = normalizePikkuLevel(nextLanguage, rememberedLevel ?? level);
    levelsByLanguageRef.current[language] = languageLevel;
    levelsByLanguageRef.current[nextLanguage] = nextLevel;
    languageRef.current = nextLanguage;
    languageLevelRef.current = nextLevel;
    setLanguage(nextLanguage);
    setLanguageLevel(nextLevel);
    setCategory("all");
    setView(viewForLanguage(nextLanguage, view));
    setMobileNav(false);
    syncPreference(nextLanguage, nextLevel);
  };

  const selectLanguageLevel = (value: LanguageLevel) => {
    setFullPaper(false);
    const nextLevel = normalizePikkuLevel(language, value);
    languageLevelRef.current = nextLevel;
    setLanguageLevel(nextLevel);
    syncPreference(language, nextLevel);
  };

  const openPractice = (nextLevel: LanguageLevel = languageLevel, nextCategory: Category | "all" = "all") => {
    setFullPaper(false);
    nextLevel = normalizePikkuLevel(language, nextLevel);
    languageLevelRef.current = nextLevel;
    setLanguageLevel(nextLevel);
    setCategory(nextCategory);
    setView("practice");
    setMobileNav(false);
    syncPreference(language, nextLevel);
  };

  const navItems: { id: View; label: string; icon: typeof Home; count?: number }[] = [
    { id: "home", label: copy.todayOverview, icon: Home },
    { id: "story", label: copy.storyMode, icon: BookOpen },
    { id: "practice", label: copy.orderedPractice, icon: ListOrdered },
    { id: "mistakes", label: locale === "en" ? "Review" : t("复习中心"), icon: RotateCcw, count: Object.entries(progress).filter(([id, value]) => languageQuestionIds.has(id) && (value === "wrong" || value === "review")).length + languageBookmarks.length },
    { id: "scope", label: copy.archive, icon: Library },
    { id: "community", label: locale === "en" ? "Community" : t("交流社区"), icon: Users },
    { id: "settings", label: locale === "en" ? "Settings" : t("个人设置"), icon: User },
    ...(session.user?.role === "admin" ? [{ id: "admin" as View, label: copy.admin, icon: Settings }] : []),
  ];
  const activeSection: View = (["exam", "vocabulary", "vocab-trainer"] as View[]).includes(view) ? "practice" : view === "bookmarks" ? "mistakes" : (["archive", "resources", "dictionary"] as View[]).includes(view) ? "scope" : view;
  const viewTitles: Partial<Record<View, string>> = { exam: copy.randomExam, story: copy.storyMode, "vocab-trainer": copy.vocabulary, vocabulary: copy.vocabularyMeasure, bookmarks: copy.bookmarks, archive: copy.archive, resources: copy.archive, dictionary: locale === "en" ? "Dictionary" : "词典" };

  return (
    <I18nContext.Provider value={{ locale, copy, language: currentLanguage }}>
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{copy.skipToContent}</a>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label={copy.mainNavigation}>
        <div className="brand">
          <div className="brand-mark"><img src={assetPath("/pkuni-latinex-logo-final.png")} alt="" /></div>
          <div>
            <strong>{t("哔丘 Pikku")}</strong>
            <span>{languageConfig.nativeName} · LEARNING</span>
          </div>
          <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label={copy.closeNavigation}><X size={20} /></button>
        </div>

        <div className="level-switch" role="group" aria-label={copy.chooseLevel}>
          {LEVEL_ORDER.map((item) => {
            const name = { C: copy.elementary, F: copy.intermediate, G: copy.advanced, M: copy.mixed }[item];
            const accentIndex = locale === "zh-CN" && item === "M" ? 1 : 0;
            return (
              <button key={item} type="button" className={`level-card${level === item ? " active" : ""}`} data-level={item} onClick={() => selectLanguageLevel(item)} aria-label={`${item} · ${name}`} aria-pressed={level === item}>
                <img className="level-card-mark" src={assetPath(`/level-icons/${item.toLowerCase()}.svg`)} width={100} height={100} alt="" aria-hidden="true" draggable={false} />
                <span className="level-card-name" lang={locale}>{name.slice(0, accentIndex)}<strong>{name[accentIndex]}</strong>{name.slice(accentIndex + 1)}</span>
              </button>
            );
          })}
        </div>

        <nav className="nav-list">
          <p className="nav-kicker">{copy.studyDesk}</p>
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button key={id} className={activeSection === id ? "nav-item active" : "nav-item"} onClick={() => { setView(id); setMobileNav(false); }}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {typeof count === "number" && count > 0 && <b>{count}</b>}
            </button>
          ))}
        </nav>

        <div className="mascot-note">
          <img src={assetPath("/pkuni-latinex-logo-final.png")} alt={copy.mascotAlt} />
          <div><strong>{t("哔丘 Pikku")}</strong><span>{copy.mascotTagline}</span></div>
        </div>
        <div className="sidebar-note">
          <GraduationCap size={20} />
          <div><strong>{currentLanguage.labels[locale]}</strong><span>{copy.currentModuleNote}</span></div>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label={copy.closeNavigation} onClick={() => setMobileNav(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label={copy.openNavigation}><Menu size={21} /></button>
          <div className="topbar-title">
            <span className="breadcrumb" lang={currentLanguage.htmlLang}>{currentLanguage.microLabels[VIEW_MICRO_LABEL[view]]}</span>
            <strong>{viewTitles[view] ?? navItems.find((item) => item.id === activeSection)?.label}</strong>
          </div>
          <div className="preference-controls">
            <LearningLanguagePicker locale={locale} value={language} onChange={selectLanguage} />
            <UiLocaleSwitch locale={locale} onChange={(nextLocale) => { setLocale(nextLocale); const nextLanguage = normalizeLearningLanguage(nextLocale, language); if (nextLanguage !== language) selectLanguage(nextLanguage); }} />
          </div>
          <div className="topbar-stats" aria-label={copy.learningStats}>
            <span><Flame size={17} /> {copy.todayGoal} <b>{Math.min(answered, 12)}/12</b></span>
            <span><Target size={17} /> {copy.accuracy} <b>{accuracy}%</b></span>
          </div>
          <a className="repo-link" href="https://github.com/Etymodes/PKUni_Latinex" target="_blank" rel="noreferrer" title={locale === "en" ? "View source repository" : t("查看源代码")}><GitBranch size={16} /><span>{locale === "en" ? "Source" : t("源代码")}</span></a>
          {syncStatus !== "idle" && <span className={`sync-indicator ${syncStatus}`} role={syncStatus === "error" ? "alert" : "status"}>{syncStatus === "syncing" ? (locale === "en" ? "Syncing…" : t("账户记录同步中…")) : (locale === "en" ? "Sync failed. Stay signed in and retry." : t("记录同步失败，请保持登录并重试"))}</span>}
          <Account session={session} onSession={refreshAccount} beforeLogout={waitForAccountSync} onLogout={clearAccountData} wechatEnabled={wechatEnabled} />
        </header>

        <main id="main-content">
          <>
              {(["practice", "story", "exam", "vocab-trainer", "vocabulary"] as View[]).includes(view) && <HubTabs items={[["practice", t("有序选题")], ["story", t("剧情任务")], ["exam", t("随机组卷")], ["vocab-trainer", t("背单词")], ["vocabulary", t("词汇量测量")]]} view={view} setView={setView} />}
              {(["mistakes", "bookmarks"] as View[]).includes(view) && <HubTabs items={[["mistakes", t("错题回炉")], ["bookmarks", t("我的收藏")]]} view={view} setView={setView} />}
              {(["scope", "archive", "resources", "dictionary"] as View[]).includes(view) && <HubTabs items={language === "la" ? [["scope", t("考试范围")], ["archive", t("真题档案")], ["resources", t("教材·作者·辞典")], ["dictionary", locale === "en" ? "Dictionary" : "词典"]] : [["scope", t("考试与资源")], ["resources", `${currentLanguage.labels[locale]} · ${t("资源")}`], ["dictionary", locale === "en" ? "Dictionary" : "词典"]]} view={view} setView={setView} />}
              {view === "home" && <Dashboard bank={languageBank} level={level} progress={progress} bookmarks={languageBookmarks} openPractice={openPractice} setView={setView} />}
              {view === "practice" && <Practice key={language} bank={languageBank} level={level} levels={languageConfig.levels} setLevel={selectLanguageLevel} category={category} setCategory={setCategory} fullPaper={language === "ja" && fullPaper} setFullPaper={setFullPaper} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "story" && <StoryOutline setView={setView} />}
              {view === "mistakes" && <QuestionCollection title={copy.mistakes} empty={copy.noMistakes} questions={languageBank.filter((q) => progress[q.id] === "wrong" || progress[q.id] === "review")} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "bookmarks" && <QuestionCollection title={copy.bookmarks} empty={copy.noBookmarks} questions={languageBank.filter((q) => languageBookmarks.includes(q.id))} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "exam" && <ExamMode key={`${language}:${session.user?.email ?? "guest"}`} bank={languageBank} level={level} setLevel={selectLanguageLevel} progress={progress} onResult={recordProgress} />}
              {view === "vocab-trainer" && <VocabularyTrainer key={`${language}:${vocabularyMemory.owner}`} language={language} locale={locale} level={languageLevel} mode={vocabularyMode} stats={activeVocabularyStats} reviews={activeVocabularyReviews} owner={vocabularyMemory.owner} ready={vocabularyOwnerReady} focusId={vocabularyFocus} onReview={recordVocabularyReview} onDictionary={(id) => { setVocabularyFocus(id); setView("dictionary"); }} onSettings={() => setView("settings")} />}
              {view === "vocabulary" && <VocabularyLab key={`${language}:${vocabularyMemory.owner}`} level={level} ready={vocabularyOwnerReady} onSubmit={(answers) => recordVocabulary(language, answers)} />}
              {view === "scope" && <Scope level={level} openPractice={openPractice} />}
              {view === "archive" && <Archive />}
              {view === "resources" && <ResourceLibrary language={language} config={languageConfig} onDictionary={() => { setVocabularyFocus(undefined); setView("dictionary"); }} />}
              {view === "dictionary" && <VocabularyDictionary key={language} language={language} locale={locale} stats={activeVocabularyStats} reviews={activeVocabularyReviews} focusId={vocabularyFocus} onPractice={(id) => { setVocabularyFocus(id); setView("vocab-trainer"); }} />}
              {view === "community" && <CommunityWorkspace key={`${language}:${locale}:${session.user?.email ?? "guest"}`} language={language} languageName={currentLanguage.labels[locale]} locale={locale} authenticated={session.authenticated} isAdmin={session.user?.role === "admin"} />}
              {view === "settings" && <PersonalSettings key={session.user?.email ?? "guest"} config={languageConfig} mode={vocabularyMode} setMode={selectVocabularyMode} setView={setView} authenticated={session.authenticated} />}
              {view === "admin" && session.user?.role === "admin" && <AdminPanel bank={languageBank} onChanged={() => apiFetch("/api/questions").then((r) => r.json()).then((data) => setOverrides(data.overrides || []))} />}
            </>
        </main>
      </div>
    </div>
    </I18nContext.Provider>
  );
}

function LanguageWordmark({ language }: { language: LearningLanguage }) {
  return <em className="language-native-wordmark" data-palette={language.palette} lang={language.htmlLang}>{language.nativeName}</em>;
}

function TargetKicker({ kind, children }: { kind: MicroLabelKey; children?: ReactNode }) {
  const { language } = useI18n();
  return <span className="eyebrow target-kicker">{children}<span lang={language.htmlLang}>{language.microLabels[kind]}</span></span>;
}

function LearningLanguagePicker({ locale, value, onChange }: { locale: UiLocale; value: LearningLanguageId; onChange: (language: LearningLanguageId) => void }) {
  const { copy } = useI18n();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const current = getLearningLanguage(value);
  const options = availableLearningLanguages(locale);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="language-picker" ref={pickerRef}>
      <button className="language-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={copy.chooseLearningLanguage} onClick={() => setOpen((value) => !value)}>
        <span className="language-trigger-copy">
          <small>{copy.learningLanguage}</small>
          <span><strong>{current.labels[locale]}</strong><LanguageWordmark language={current} /></span>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="language-menu" role="listbox" aria-label={copy.chooseLearningLanguage}>
          {options.map((language) => (
            <button
              type="button"
              role="option"
              aria-selected={language.id === value}
              className={language.id === value ? "selected" : ""}
              key={language.id}
              onClick={() => { onChange(language.id); setOpen(false); }}
            >
              <span><strong>{language.labels[locale]}</strong><LanguageWordmark language={language} /></span>
              {language.id === value && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UiLocaleSwitch({ locale, onChange }: { locale: UiLocale; onChange: (locale: UiLocale) => void }) {
  const action = locale === "en" ? "Display language: English. Switch to Simplified Chinese" : "显示语言：简体中文。切换到 English";
  return <button type="button" className={`locale-toggle${locale === "en" ? " locale-en" : ""}`} aria-label={action} title={action} onClick={() => onChange(locale === "en" ? "zh-CN" : "en")}>
    <span aria-hidden="true">{locale === "en" ? "⇋语" : "语⇌"}</span><small aria-hidden="true">Language</small>
  </button>;
}

function LanguagePlaceholder({ config, level, view, setView, questionCount = 0 }: { config: LanguageConfig; level: LanguageLevel; view: View; setView: (view: View) => void; questionCount?: number }) {
  const { locale } = useI18n();
  const languageName = getLearningLanguage(config.code).labels[locale];
  const t = useInterfaceText();
  const sectionTitles: Partial<Record<View, string>> = {
    home: t("语言学习首页"),
    practice: t("训练中心"),
    story: t("剧情任务"),
    mistakes: t("复习中心"),
    bookmarks: t("我的收藏"),
    exam: t("考试模拟"),
    "vocab-trainer": t("自适应背单词"),
    vocabulary: t("词汇量测量"),
    scope: t("考试与资源"),
    archive: t("考试档案"),
    resources: t("教材与辞典"),
    community: t("交流社区"),
    settings: t("个人设置"),
    admin: t("管理员后台"),
  };

  return <div className="page language-placeholder">
    <section className="language-hero">
      <span className="eyebrow"><Languages size={14} /> PIKKU MULTILINGUAL · P2</span>
      <h1>{config.nativeName} <small>{languageName}</small></h1>
      <p>{sectionTitles[view] ?? t("学习中心")}{t("已接入共享训练闭环；当前等级为")}<strong>{languageLevelLabels[level]}</strong>{t("，已有")}<strong>{questionCount}</strong>{t("道种子题。")}</p>
      <div><span>{t("语言选择")}</span><b>{t("已完成")}</b><span>{t("等级映射")}</span><b>{t("已完成")}</b><span>{t("首批题库")}</span><b>{questionCount}{t("题")}</b></div>
    </section>
    <LanguageFactCard config={config} />
    <section className="language-roadmap">
      <article><span>01</span><h2>{t("训练与复习")}</h2><p>{t("有序、随机、错题和收藏复用同一稳定交互，题目按语言隔离。")}</p><button onClick={() => setView("practice")}>{t("开始")}{languageLevelLabels[level]}{t("练习")}</button></article>
      <article><span>02</span><h2>{t("自适应背词")}</h2><p>{t("根据本账号的记得／忘了记录持续调整出词，当前等级可无限连续训练。")}</p><button onClick={() => setView("vocab-trainer")}>{t("开始")}{languageLevelLabels[level]}{t("背词")}</button></article>
      <article><span>03</span><h2>{t("资源与社区")}</h2><p>{t("教材、辞典和目标语言频道保留独立入口，审核能力完成后再开放发帖。")}</p><button onClick={() => setView("resources")}>{t("打开")}{languageName}{t("资源")}</button></article>
    </section>
  </div>;
}

function LanguageFactCard({ config }: { config: LanguageConfig }) {
  const t = useInterfaceText();
  const { locale } = useI18n();
  const facts = languageFacts[config.code] ?? [];
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    if (facts.length) setFactIndex(Math.floor(Math.random() * facts.length));
  }, [config.code, facts.length]);

  if (!facts.length) return null;
  const fact = facts[factIndex % facts.length];

  return <section className="etymology-card">
    <div>
      <span className="eyebrow"><Sparkles size={14} />{t("PIKKU LANGUAGES · 随机语言知识")}</span>
      <h2>{contentText(fact.title, locale)} <small>{contentText(fact.kind, locale)}</small></h2>
      <p>{contentText(fact.summary, locale)}</p>
    </div>
    <div className="word-family">
      <span>{t("例子")}</span><strong>{contentText(fact.example, locale)}</strong>
      <span>{t("来源")}</span><strong>{fact.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{index > 0 && " · "}{contentText(source.label, locale)}</a>)}</strong>
    </div>
    <button className="secondary-button" onClick={() => setFactIndex((factIndex + 1) % facts.length)}>{t("换一条")}<Shuffle size={15} /></button>
  </section>;
}

function Account({ session, onSession, beforeLogout, onLogout, wechatEnabled }: { session: Session; onSession: (session: Session) => Promise<void>; beforeLogout: () => Promise<void>; onLogout: () => void; wechatEnabled: boolean }) {
  const t = useInterfaceText();
  if (isStaticPublic) return <span className="public-badge"><User size={15} /><span>{t("公开版 · 本机记录")}</span></span>;
  if (authMode === "supabase") return <SupabaseAccount session={session} onSession={onSession} beforeLogout={beforeLogout} onLogout={onLogout} wechatEnabled={wechatEnabled} />;
  if (!session.authenticated || !session.user) return <a className="account-button" href="/signin-with-chatgpt?return_to=/"><LogIn size={16} /><span>{t("登录 / 注册")}</span></a>;
  return <div className="account-menu"><User size={16} /><span><strong>{session.user.name}</strong><small>{session.user.role === "admin" ? t("管理员") : t("学习账号")}</small></span><a href="/signout-with-chatgpt?return_to=/" title={t("退出后可切换 ChatGPT 账号")}><LogOut size={15} />{t("退出 / 换号")}</a></div>;
}

function SupabaseAccount({ session, onSession, beforeLogout, onLogout, wechatEnabled }: { session: Session; onSession: (session: Session) => Promise<void>; beforeLogout: () => Promise<void>; onLogout: () => void; wechatEnabled: boolean }) {
  const t = useInterfaceText();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(session.authError || "");

  useEffect(() => {
    if (!session.authError) return;
    setError(session.authError);
    setOpen(true);
    void supabase.auth.signOut();
  }, [session.authError]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const refresh = async () => {
    const response = await apiFetch("/api/me");
    if (response.ok) await onSession(await response.json());
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || password.length < 10 || (mode === "register" && name.trim().length < 2)) {
      setError(mode === "register" ? t("请填写姓名、有效邮箱和至少 10 位密码。") : t("请输入邮箱和至少 10 位密码。"));
      return;
    }
    setBusy(true);
    const result = mode === "register"
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "register" && !result.data.session) {
      setNotice(t("注册成功。请打开验证邮件完成确认，然后返回登录。测试邮件每小时有发送上限。"));
      return;
    }
    await refresh();
    setOpen(false);
    setPassword("");
  };

  const githubLogin = async () => {
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
  };

  const wechatLogin = async () => {
    if (!wechatEnabled) return;
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "custom:wechat",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
  };

  const logout = async () => {
    setBusy(true);
    await beforeLogout();
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(logoutError.message);
      setBusy(false);
      return;
    }
    onLogout();
    setBusy(false);
  };

  if (session.authenticated && session.user) {
    return <div className="account-menu"><User size={16} /><span><strong>{session.user.name}</strong><small>{session.user.role === "admin" ? t("GitHub 管理员") : t("学习账号")}</small></span><button onClick={logout} disabled={busy} title={t("退出前会等待当前进度同步完成")}><LogOut size={15} />{busy ? t("同步中…") : t("退出 / 换号")}</button></div>;
  }

  return <>
    <button className="account-button" onClick={() => setOpen(true)}><LogIn size={16} /><span>{t("登录 / 注册")}</span></button>
    {open && typeof document !== "undefined" && createPortal(<div className="auth-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button auth-close" onClick={() => setOpen(false)} aria-label={t("关闭登录窗口")}><X size={19} /></button>
        <span className="eyebrow">{t("Ratio studiorum · 学习账户")}</span>
        <h2 id="auth-title">{mode === "login" ? t("登录比丘拟") : t("创建学习账号")}</h2>
        <p>{t("学习者使用邮箱账号；GitHub 入口仅供已列入白名单的开发者和管理员。")}</p>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>{t("登录")}</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setNotice(""); }}>{t("注册")}</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label>{t("显示姓名")}<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={60} /></label>}
          <label>{t("邮箱")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label>{t("密码")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="primary-button" disabled={busy}>{busy ? t("处理中…") : mode === "login" ? t("登录并同步进度") : t("注册账号")}</button>
        </form>
        <div className="auth-divider"><span>{t("其他登录方式")}</span></div>
        <button className="wechat-auth-button" onClick={wechatLogin} disabled={!wechatEnabled} title={wechatEnabled ? t("打开微信二维码完成登录") : t("配置正式域名和微信开放平台后启用")}><QrCode size={17} />{wechatEnabled ? t("使用微信扫码登录") : t("微信扫码登录 · 配置中")}</button>
        <div className="auth-divider"><span>{t("开发者 / 管理员")}</span></div>
        <button className="github-auth-button" onClick={githubLogin}><GitBranch size={17} />{t("使用 GitHub 登录")}</button>
      </section>
    </div>, document.body)}
  </>;
}

function Dashboard({ bank, level, progress, bookmarks, openPractice, setView }: { bank: Question[]; level: StudyLevel; progress: Progress; bookmarks: string[]; openPractice: (l?: StudyLevel, c?: Category | "all") => void; setView: (v: View) => void }) {
  const t = useInterfaceText();
  const { copy, locale, language } = useI18n();
  const localizedLevel = levelName(copy, level, language.id);
  const levelQs = bank.filter((q) => matchesLevel(q, level));
  const done = levelQs.filter((q) => progress[q.id]).length;
  const right = levelQs.filter((q) => progress[q.id] === "correct").length;
  const percent = levelQs.length ? Math.round((done / levelQs.length) * 100) : 0;
  const grammarCategory: Category = language.id === "ja" && levelQs.some(q => q.category === "sentencePattern") ? "sentencePattern" : "syntax";
  const readingCategory: Category = language.id === "ja" && levelQs.some(q => q.category === "reading") ? "reading" : "translation";
  const extraCategories = language.id === "ja" ? languageConfigs.ja.categories.filter(category => !["vocabulary", grammarCategory, readingCategory, "listening"].includes(category) && levelQs.some(q => q.category === category)) : [];

  const modes = [
    { category: "vocabulary" as Category, icon: Languages, title: copy.wordCourse, native: language.microLabels.vocabulary, detail: copy.wordCourseCopy, meta: copy.questionCount(bank.filter((q) => matchesLevel(q, level) && q.category === "vocabulary").length) },
    { category: grammarCategory, icon: Layers3, title: copy.grammarCourse, native: language.microLabels.grammar, detail: copy.grammarCourseCopy, meta: copy.questionCount(levelQs.filter(q => q.category === grammarCategory).length) },
    { category: readingCategory, icon: BookOpen, title: copy.readingCourse, native: language.microLabels.reading, detail: copy.readingCourseCopy, meta: copy.questionCount(levelQs.filter(q => q.category === readingCategory).length) },
    ...(language.id === "ja" ? [{ category: "listening" as Category, icon: Headphones, title: copy.categoryListening, native: "聴解", detail: copy.listeningCourseCopy, meta: copy.questionCount(bank.filter((q) => matchesLevel(q, level) && q.category === "listening").length) }] : []),
    ...extraCategories.map(category => ({
      category, icon: ["morphology", "syntax", "sentencePattern"].includes(category) ? Layers3 : BookOpen,
      title: categoryName(copy, category), native: language.microLabels.practice,
      detail: ["morphology", "syntax", "sentencePattern"].includes(category) ? copy.grammarCourseCopy : copy.readingCourseCopy,
      meta: copy.questionCount(levelQs.filter(q => q.category === category).length),
    })),
  ];

  return (
    <div className="page dashboard-page">
      <section className="home-feature-grid">
        <article className="story-entry-card">
          <TargetKicker kind="story"><Sparkles size={14} /></TargetKicker>
          <h1>{copy.storyRoute(language.labels[locale])}</h1>
          <p>{locale === "en" ? "Story mode is being redesigned. Keep learning through courses, practice and vocabulary." : "剧情模式正在重新设计。你可以先通过课程、练习和背单词继续学习。"}</p>
          <button className="primary-button" onClick={() => setView("story")}>{locale === "en" ? "Coming soon" : "即将推出"} <ArrowRight size={17} /></button>
          <strong className="story-greeting" lang={language.htmlLang}>{language.greeting}</strong>
        </article>

        <article className="language-knowledge-card">
          <TargetKicker kind="knowledge"><Languages size={14} /></TargetKicker>
          <div className="knowledge-language"><span>{language.labels[locale]}</span><LanguageWordmark language={language} /></div>
          <h2 lang={language.htmlLang}>{language.fact.statement}</h2>
          <p>{language.fact.meaning[locale]}</p>
          <button className="text-button" onClick={() => setView("scope")}>{copy.viewScope} <ChevronRight size={16} /></button>
        </article>
      </section>

      <section className="stat-grid" aria-label={copy.learningOverview}>
        <div className="stat-card"><div className="stat-icon"><CheckCircle2 /></div><div><span>{copy.completed}</span><strong>{done}<small> / {levelQs.length}</small></strong></div><p>{copy.levelQuestionBank}</p></div>
        <div className="stat-card"><div className="stat-icon"><Target /></div><div><span>{copy.correct}</span><strong>{right}<small> {copy.questionsUnit}</small></strong></div><p>{done ? Math.round(right / done * 100) : 0}% {copy.hitRate}</p></div>
        <div className="stat-card"><div className="stat-icon"><Bookmark /></div><div><span>{copy.saved}</span><strong>{bookmarks.length}<small> {copy.questionsUnit}</small></strong></div><p>{copy.reviewAnytime}</p></div>
        <div className="stat-card"><div className="stat-icon"><GraduationCap /></div><div><span>{copy.learningStage}</span><strong>{normalizePikkuLevel(language.id, level)}</strong></div><p>{localizedLevel}</p></div>
      </section>

      <div className="section-heading">
        <div><TargetKicker kind="courses" /><h2>{copy.todayTraining}</h2></div>
        <button className="text-button" onClick={() => openPractice(level, "all")}>{copy.allQuestions} <ArrowRight size={16} /></button>
      </div>
      <section className={`mode-grid ${language.id === "ja" ? "with-listening" : ""}`}>
        {modes.map(({ category, icon: Icon, title, native, detail, meta }, index) => (
          <button className="mode-card" key={category} onClick={() => openPractice(level, category)}>
            <div className="mode-number">0{index + 1}</div>
            <div className="mode-icon"><Icon /></div>
            <span className="latin-label" lang={language.htmlLang}>{native}</span>
            <h3>{title}</h3>
            <p>{detail}</p>
            <div className="mode-footer"><span>{meta}</span><ArrowRight size={17} /></div>
          </button>
        ))}
      </section>

      <section className="exam-banner">
        <div className="banner-icon"><Trophy /></div>
        <div><TargetKicker kind="exam" /><h2>{copy.examReady}</h2><p>{copy.examReadyCopy}</p></div>
        <button className="secondary-button" onClick={() => setView("exam")}>{copy.enterExam} <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function StoryOutline({ setView }: { setView: (view: View) => void }) {
  const { copy, locale, language } = useI18n();
  return <div className="page story-page">
    <div className="practice-header"><div><TargetKicker kind="story"><Sparkles size={14} /></TargetKicker><h1>{copy.storyRoute(language.labels[locale])}</h1></div></div>
    <section className="story-pending"><Sparkles size={36} /><h2>{locale === "en" ? "Coming soon" : "即将推出"}</h2><p>{locale === "en" ? "Story mode is being redesigned. Courses, practice and vocabulary are available now." : "剧情模式正在重新设计。课程、练习和背单词功能现已可用。"}</p><button className="primary-button" onClick={() => setView("practice")}>{locale === "en" ? "Go to courses & practice" : "前往课程与练习"}<ArrowRight size={17} /></button></section>
  </div>;
}

function Practice({ bank, level, levels, setLevel, category, setCategory, fullPaper, setFullPaper, progress, onResult, bookmarks, setBookmarks }: { bank: Question[]; level: LanguageLevel; levels: readonly LanguageLevel[]; setLevel: (l: LanguageLevel) => void; category: Category | "all"; setCategory: (c: Category | "all") => void; fullPaper: boolean; setFullPaper: (value: boolean) => void; progress: Progress; onResult: (q: Question, s: Progress[string]) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const t = useInterfaceText();
  const { copy, locale, language } = useI18n();
  const [order, setOrder] = useState<"ordered" | "random">("ordered");
  const [randomSeed, setRandomSeed] = useState(0);
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("jlpt-1992-1");
  const collection = questionCollections.find(item => item.id === collectionId)!;
  const pool = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const selected = bank.filter((q) => (fullPaper ? questionInCollection(q, collectionId) : matchesLevel(q, level)) && (category === "all" || q.category === category) && (!normalized || [q.id, q.prompt, q.text, q.targetText, q.latin, q.context, q.source, ...q.tags, localizeQuestion(q, "en").prompt, localizeQuestion(q, "en").context, localizeQuestion(q, "en").source, ...localizeQuestion(q, "en").tags].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized)));
    const ordered = fullPaper ? selected.sort((a, b) => collectionOrder(a, collectionId) - collectionOrder(b, collectionId))
      .map(question => questionForCollection(question, collectionId)) : selected;
    return order === "random" ? shuffle(ordered) : ordered;
  }, [bank, level, category, order, randomSeed, query, fullPaper, collectionId]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [level, category, query, fullPaper, collectionId]);
  const question = pool[index];

  return (
    <div className="page practice-page">
      <div className="practice-header">
        <div><TargetKicker kind="practice" /><h1>{copy.focusedPractice}</h1><p>{copy.focusedPracticeCopy}</p></div>
        <div className="filter-row">
          <label>{t("难度")}<select value={fullPaper ? "paper" : level} onChange={(e) => { setFullPaper(false); setLevel(e.target.value as LanguageLevel); }}>{fullPaper && <option value="paper" disabled>{locale === "en" ? "Full paper · All levels" : "原卷跨级 · 全部等级"}</option>}{levels.map((item) => <option key={item} value={item}>{levelName(copy, item, language.id)}</option>)}</select></label>
          <label>{t("模块")}<select value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}><option value="all">{t("全部模块")}</option>{languageConfigs[language.id].categories.map((key) => <option key={key} value={key}>{categoryName(copy, key)}</option>)}</select></label>
          <label>{t("顺序")}<select value={order} onChange={(e) => { setOrder(e.target.value as "ordered" | "random"); setRandomSeed((s) => s + 1); }}><option value="ordered">{t("教材域有序")}</option><option value="random">{t("随机洗牌")}</option></select></label>
        </div>
      </div>
      <label className="question-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索题号、题干、标签、作者或来源（如 Livy）")} /><span>{pool.length}{t("题")}</span></label>
      {language.id === "ja" && <div className="exam-shortcuts" aria-label={locale === "en" ? "Question collections" : "真题与教材题集"}>
        <label>{locale === "en" ? "Collection" : "题集"}<select aria-label={locale === "en" ? "Collection" : "题集"} value={collectionId} onChange={event => { setCollectionId(event.target.value); setFullPaper(true); setCategory("all"); setQuery(""); setOrder("ordered"); setIndex(0); }}>
          {questionCollections.map(item => <option key={item.id} value={item.id}>{locale === "en" ? item.en : item.zh}</option>)}
        </select></label>
        {([ ["all", "整卷", "Full paper"], ["vocabulary", "文字词汇", "Vocabulary"], ["listening", "听力", "Listening"], ["reading", "阅读", "Reading"], ["sentencePattern", "语法", "Grammar"] ] as const).filter(([section]) => section === "all" || collection.categories.includes(section)).map(([section, chinese, english]) =>
          <button key={section} className="secondary-button" onClick={() => { setFullPaper(true); setCategory(section); setQuery(""); setOrder("ordered"); setIndex(0); }}>{locale === "en" ? english : chinese}</button>
        )}
      </div>}
      {question && Boolean(question.occurrences?.length) && <label className="exam-question-jump">{locale === "en" ? "Original question" : "选择原题号"}
        <select aria-label={locale === "en" ? "Original question" : "选择原题号"} value={question.id} onChange={(event) => setIndex(pool.findIndex(q => q.id === event.target.value))}>
          {pool.map(q => <option key={q.id} value={q.id}>{q.originalNumber ?? q.id} · {normalizePikkuLevel(q.language ?? "la", q.level)}</option>)}
        </select>
      </label>}

      {question ? (
        <>
          <div className="question-progress"><span>{copy.questionPosition(index + 1, pool.length)}</span><div><i style={{ width: `${((index + 1) / pool.length) * 100}%` }} /></div><span>{category === "all" ? copy.comprehensive : categoryName(copy, category)}</span></div>
          <QuestionCard key={`${fullPaper ? collectionId : "level"}:${question.id}`} question={question} status={progress[question.id]} onResult={(status) => onResult(question, status)} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} />
          <div className="question-nav">
            <button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> {copy.previous}</button>
            <button className="primary-button" onClick={() => setIndex((i) => Math.min(pool.length - 1, i + 1))} disabled={index === pool.length - 1}>{copy.next} <ArrowRight size={17} /></button>
          </div>
        </>
      ) : <EmptyState kind="practice" text={copy.noQuestionsForFilter} />}
    </div>
  );
}

function QuestionCard({ question: originalQuestion, status, onResult, bookmarked, onBookmark, compact = false, lockAnswer = false }: { question: Question; status?: Progress[string]; onResult: (s: "correct" | "wrong" | "review") => void; bookmarked: boolean; onBookmark: () => void; compact?: boolean; lockAnswer?: boolean }) {
  const t = useInterfaceText();
  const { copy, language, locale } = useI18n();
  const question = useMemo(() => localizeQuestion(originalQuestion, locale), [originalQuestion, locale]);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [translation, setTranslation] = useState("");
  const [optionOrder, setOptionOrder] = useState<number[]>([]);
  const answered = submitted || (lockAnswer && Boolean(status));
  const sourceStatusLabel = question.sourceStatus === "original" ? t("原创复核题") : question.sourceStatus === "public-domain" ? t("公版原文") : question.sourceStatus === "official-framework" ? t("官方框架") : null;
  const reviewStatusLabel = question.reviewStatus ? reviewStatusLabels[question.reviewStatus] : null;
  const isMorphologyCheck = question.type === "self-check" && question.category === "morphology";

  useEffect(() => {
    setOptionOrder(questionOptionOrder(originalQuestion));
  }, [originalQuestion.id, originalQuestion.options, originalQuestion.shuffleOptions]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (question.type !== "choice" || answered) return;
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, audio, video, [contenteditable]")) return;
      if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.closest("button, a, summary")) return;
      const number = Number(event.key);
      if (number >= 1 && number <= optionOrder.length) setSelected(optionOrder[number - 1]);
      if (event.key === "Enter" && selected !== null) {
        setSubmitted(true);
        onResult(selected === question.answer ? "correct" : "wrong");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onResult, optionOrder, question, selected, answered]);

  const submit = () => {
    if (selected === null || answered) return;
    setSubmitted(true);
    onResult(selected === question.answer ? "correct" : "wrong");
  };

  return (
    <article className={`question-card ${compact ? "compact" : ""}`}>
      <div className="question-meta">
        <div><span className="level-pill">{levelName(copy, question.level, question.language ?? "la") }</span><span>{categoryName(copy, question.category)}</span>{question.skill && <span className="skill-pill">{question.skill}</span>}{sourceStatusLabel && <span className={`source-status ${question.sourceStatus}`}>{sourceStatusLabel}</span>}{reviewStatusLabel && <span className={`review-status ${question.reviewStatus}`}>{t(reviewStatusLabel)}</span>}<span>·</span>{question.sourceUrl ? <a href={question.sourceUrl} target="_blank" rel="noreferrer">{question.source}</a> : <span>{question.source}</span>}</div>
        <button className={`icon-button bookmark-button ${bookmarked ? "bookmarked" : ""}`} onClick={onBookmark} aria-label={bookmarked ? copy.removeBookmark : copy.bookmarkQuestion} aria-pressed={bookmarked}><Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} /></button>
      </div>
      <h2 dir="auto">{question.prompt}</h2>
      {question.originalNumber && <p className="question-original-number">{copy.elementary === "Core" ? "Original question: " : "原题号："}{question.originalNumber}</p>}
      {question.passage && <div className="question-passage" dir="auto" lang={question.targetLang ?? language.htmlLang}>{question.passage}</div>}
      {(question.targetText || question.text || question.latin) && <blockquote dir="auto" lang={question.targetLang ?? language.htmlLang}>{question.targetText ?? question.text ?? question.latin}</blockquote>}
      {question.context && <p className="context-note">{question.context}</p>}
      {question.images?.map((item) => <figure className="question-image" key={item.src}><a href={assetPath(item.src)} target="_blank" rel="noreferrer" aria-label={item.alt}><img src={assetPath(item.src)} alt={item.alt} loading="lazy" /></a></figure>)}
      {question.audio && <QuestionAudio key={question.id} audio={question.audio} label={copy.elementary === "Core" ? "Question audio" : "本题听力"} />}

      {question.type === "choice" ? (
        <>
          {question.optionsInAudio && <p className="context-note">{copy.elementary === "Core" ? "Listen to the four spoken options and choose a number." : "请听录音中的四个选项，选择编号。"}</p>}
          <div className="option-list" role="radiogroup" aria-label={copy.chooseAnswer}>
            {optionOrder.map((optionIndex, visibleIndex) => {
              const option = question.options?.[optionIndex];
              if (option === undefined) return null;
              const isCorrect = answered && optionIndex === question.answer;
              const isWrong = answered && selected === optionIndex && optionIndex !== question.answer;
              return (
                <button key={optionIndex} role="radio" aria-checked={selected === optionIndex} className={`option ${selected === optionIndex ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} onClick={() => !answered && setSelected(optionIndex)} disabled={answered}>
                  <span className="option-key">{visibleIndex + 1}</span>{(!question.optionsInAudio || answered) && <span dir="auto">{option}</span>}
                  {isCorrect && <Check size={18} />}{isWrong && <X size={18} />}
                </button>
              );
            })}
          </div>
          {!answered ? <button className="primary-button submit-answer" onClick={submit} disabled={selected === null}>{copy.submitAnswer}</button> : (
            <Feedback correct={lockAnswer && status ? status === "correct" : selected === question.answer} explanation={question.explanation} distractorExplanations={question.distractorExplanations} />
          )}
        </>
      ) : (
        <div className="self-check">
          <label htmlFor={`translation-${question.id}`}>{isMorphologyCheck ? t("你的分析") : t("你的译文")}</label>
          <textarea id={`translation-${question.id}`} value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder={isMorphologyCheck ? t("写出词典形、时态、语气、人称数、语态意义和分词一致……") : t("先找谓语和主句骨架，再逐层处理从句……")} rows={compact ? 4 : 6} />
          {!revealed ? <button className="primary-button" onClick={() => setRevealed(true)} disabled={!translation.trim()}>{isMorphologyCheck ? t("对照参考分析") : t("对照参考译文")}</button> : (
            <div className="model-answer">
              <span>{isMorphologyCheck ? t("参考分析") : t("参考译文")}</span><p>{question.modelAnswer}</p>
              <div className="analysis-box"><CircleHelp size={19} /><p>{question.explanation}</p></div>
              <DistractorNotes items={question.distractorExplanations} />
              <div className="self-rating"><span>{t("这句掌握了吗？")}</span><button className="success-button" onClick={() => onResult("correct")}><CheckCircle2 size={17} />{t("基本掌握")}</button><button className="secondary-button" onClick={() => onResult("review")}><RotateCcw size={17} />{t("需要复习")}</button></div>
            </div>
          )}
        </div>
      )}
      {(answered || revealed) && question.transcript && <details className="question-transcript"><summary>{copy.elementary === "Core" ? "Listening transcript" : "听力原文"}</summary><div dir="auto" lang={question.targetLang ?? language.htmlLang}>{question.transcript}</div></details>}
      {status && <div className={`saved-status ${status}`}><CheckCircle2 size={15} /> {copy.recorded} {status === "correct" ? copy.mastered : status === "wrong" ? copy.wrongQuestion : copy.reviewLater}</div>}
      <div className="tag-row">{question.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function QuestionAudio({ audio, label }: { audio: NonNullable<Question["audio"]>; label: string }) {
  return <audio className="question-audio" src={assetPath(audio.src)} controls preload="metadata" aria-label={label}>{label}</audio>;
}

function DistractorNotes({ items }: { items?: string[] }) {
  const t = useInterfaceText();
  if (!items?.length) return null;
  return <details className="mistake-notes"><summary>{t("错因对照")}</summary><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></details>;
}

function Feedback({ correct, explanation, distractorExplanations }: { correct: boolean; explanation: string; distractorExplanations?: string[] }) {
  const { copy } = useI18n();
  return <div className={`feedback ${correct ? "correct" : "wrong"}`}><div>{correct ? <CheckCircle2 /> : <XCircle />}<strong>{correct ? copy.correctFeedback : copy.retryFeedback}</strong></div><p>{explanation}</p><DistractorNotes items={distractorExplanations} /></div>;
}

function QuestionCollection({ title, empty, questions: items, progress, onResult, bookmarks, setBookmarks }: { title: string; empty: string; questions: Question[]; progress: Progress; onResult: (q: Question, s: Progress[string]) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const { copy } = useI18n();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items.length]);
  if (!items.length) return <div className="page"><div className="practice-header"><div><TargetKicker kind="review" /><h1>{title}</h1></div></div><EmptyState text={empty} /></div>;
  const question = items[Math.min(index, items.length - 1)];
  return <div className="page"><div className="practice-header"><div><TargetKicker kind="review" /><h1>{title}</h1><p>{copy.collectionSummary(items.length)}</p></div></div><div className="question-progress"><span>{copy.questionPosition(index + 1, items.length)}</span><div><i style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div></div><QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => onResult(question, status)} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} /><div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> {copy.previous}</button><button className="primary-button" onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))} disabled={index === items.length - 1}>{copy.next} <ArrowRight size={17} /></button></div></div>;
}

function ExamMode({ bank, level, setLevel, progress, onResult }: { bank: Question[]; level: StudyLevel; setLevel: (l: StudyLevel) => void; progress: Progress; onResult: (q: Question, s: Progress[string]) => void }) {
  const { copy, language, locale } = useI18n();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(180 * 60);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [roundAnswers, setRoundAnswers] = useState<Progress>({});
  const [paperType, setPaperType] = useState<"official" | "diagnostic" | "mixed" | "jlpt">("diagnostic");

  useEffect(() => {
    if (language.id !== "la") setPaperType("diagnostic");
    setStarted(false);
    setFinished(false);
    setExamQuestions([]); setRoundAnswers({});
  }, [language.id]);

  useEffect(() => {
    if (language.id === "la" && paperType === "official" && (level === "G" || level === "M")) setLevel("C");
  }, [language.id, level, paperType, setLevel]);

  useEffect(() => {
    if (!started || finished || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, finished, seconds]);
  useEffect(() => { if (seconds === 0 && started) setFinished(true); }, [seconds, started]);

  const start = () => {
    setRoundAnswers({});
    if (paperType === "official" && language.id === "la") {
      const matching = bank.filter((q) => q.id.startsWith("pku-mock-") && matchesLevel(q, level));
      const nextQuestions = shuffle(matching).slice(0, 1);
      if (!nextQuestions.length) return;
      setExamQuestions(nextQuestions); setIndex(0); setSeconds(180 * 60); setFinished(false); setStarted(true); return;
    }
    const nextQuestions = buildRandomExam(bank, level, paperType === "mixed");
    if (!nextQuestions.length) return;
    setExamQuestions(nextQuestions); setIndex(0); setSeconds(20 * 60); setFinished(false); setStarted(true);
  };

  const selectableLevels = paperType === "official" ? LEVEL_ORDER.slice(0, 2) : LEVEL_ORDER;
  const plannedQuestions = paperType === "official"
    ? Math.min(1, bank.filter((question) => question.id.startsWith("pku-mock-") && matchesLevel(question, level)).length)
    : buildRandomExam(bank, level, paperType === "mixed", () => 0).length;

  if (paperType === "jlpt" && language.id === "ja") return <><div className="jlpt-mode-back"><button className="text-button" onClick={() => setPaperType("diagnostic")}>{locale === "en" ? "← Quick practice modes" : "← 返回快速组卷"}</button></div><JlptExamWorkspace bank={bank} level={level} locale={locale} onResult={onResult} renderQuestion={(question, status, answer) => <QuestionCard key={question.id} question={question} status={status} lockAnswer onResult={answer} bookmarked={false} onBookmark={() => {}} />} /></>;

  if (!started) return (
    <div className="page exam-start">
      <div className="exam-intro-icon"><TimerReset /></div><TargetKicker kind="exam" /><h1>{copy.examTitle}</h1><p>{paperType === "official" ? copy.officialPaperCopy : copy.diagnosticPaperCopy}</p>
      <div className="paper-type">{language.id === "ja" && <button onClick={() => setPaperType("jlpt")}><FileText size={17} />{locale === "en" ? "JLPT N3–N1 structures" : "JLPT N3–N1 结构组卷"}</button>}{language.id === "la" && <button className={paperType === "official" ? "active" : ""} onClick={() => { setPaperType("official"); if (normalizePikkuLevel(language.id, level) === "G" || normalizePikkuLevel(language.id, level) === "M") setLevel("C"); }}><Landmark size={17} />{copy.officialPaper}</button>}<button className={paperType === "diagnostic" ? "active" : ""} onClick={() => setPaperType("diagnostic")}><BarChart3 size={17} />{copy.diagnosticPaper}</button><button className={paperType === "mixed" ? "active" : ""} onClick={() => setPaperType("mixed")}><Shuffle size={17} />{copy.elementary === "Core" ? "Mixed-stage practice" : "混合等级组题"}</button></div>
      <div className="exam-facts"><div><Clock3 /><strong>{paperType === "official" ? 180 : 20}</strong><span>{copy.countdownMinutes}</span></div><div><FileText /><strong>{paperType === "official" ? 1 : plannedQuestions}</strong><span>{paperType === "official" ? copy.fullTranslation : copy.diagnosticTasks}</span></div><div><BookOpen /><strong>{paperType === "official" ? "≈180" : normalizePikkuLevel(language.id, level)}</strong><span>{paperType === "official" ? copy.continuousWords : copy.learningStage}</span></div></div>
      <div className="exam-level"><span>{copy.selectDifficulty}</span>{selectableLevels.map((l) => <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>{levelName(copy, l, language.id)}</button>)}</div>
      <button className="primary-button large" onClick={start} disabled={plannedQuestions === 0}>{copy.startExam} <ArrowRight size={18} /></button>
      <p className="fine-print">{copy.unofficialScore}</p>
    </div>
  );

  const doneCount = examQuestions.filter((q) => roundAnswers[q.id]).length;
  if (finished) return <div className="page exam-start"><div className="exam-intro-icon"><Trophy /></div><TargetKicker kind="exam" /><h1>{copy.examFinished}</h1><p>{copy.examSummary(doneCount, examQuestions.length)}</p><button className="primary-button large" onClick={start}>{copy.anotherExam} <RotateCcw size={18} /></button></div>;

  const current = examQuestions[index];
  if (!current) return <div className="page exam-start"><TargetKicker kind="exam" /><EmptyState kind="exam" text={copy.noQuestionsForFilter} /><button className="secondary-button" onClick={() => setStarted(false)}>{copy.previous}</button></div>;
  return (
    <div className="page exam-live">
      <div className="exam-toolbar"><div><span>{copy.examLevel(levelName(copy, level, language.id))}</span><strong>{copy.questionPosition(index + 1, examQuestions.length)}</strong></div><div className={`timer ${seconds < 600 ? "urgent" : ""}`}><Clock3 size={18} />{formatTime(seconds)}</div><button className="secondary-button" onClick={() => setFinished(true)}>{copy.submitExam}</button></div>
      <QuestionCard key={current.id} question={current} status={roundAnswers[current.id]} onResult={(status) => { setRoundAnswers(previous => ({ ...previous, [current.id]: status })); onResult(current, status); }} bookmarked={false} onBookmark={() => {}} />
      <div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> {copy.previous}</button>{index < examQuestions.length - 1 ? <button className="primary-button" onClick={() => setIndex((i) => i + 1)}>{copy.next} <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => setFinished(true)}>{copy.finishExam} <Check size={17} /></button>}</div>
    </div>
  );
}

function PersonalSettings({ config, mode, setMode, setView, authenticated }: {
  config: LanguageConfig;
  mode: VocabularyMode;
  setMode: (mode: VocabularyMode) => void;
  setView: (view: View) => void;
  authenticated: boolean;
}) {
  const { locale } = useI18n();
  const languageName = getLearningLanguage(config.code).labels[locale];
  const t = useInterfaceText();
  const [showSupport, setShowSupport] = useState(false);
  return <div className="page settings-page">
    <div className="practice-header"><div><TargetKicker kind="progress" /><h1>{t("个人设置")}</h1><p>{t("设置适用于所有学习语言的背词训练；切换语言时无需重复调整。")}</p></div></div>
    <section className="settings-panel">
      <div className="settings-copy"><BookOpen /><div><h2>{t("背单词显示模式")}</h2><p>{authenticated ? t("当前设置会随学习账号同步。") : t("当前为游客状态，设置和记忆记录保存在本机；登录后可写入账号。")}</p></div></div>
      <div className="vocab-mode-options" role="radiogroup" aria-label={t("背单词显示模式")}>
        <button role="radio" aria-checked={mode === "word"} className={mode === "word" ? "active" : ""} onClick={() => setMode("word")}>
          <span><strong>{t("纯单词记忆")}</strong><small>{t("只显示词目，减少提示干扰。")}</small></span><Check size={18} />
        </button>
        <button role="radio" aria-checked={mode === "context"} className={mode === "context" ? "active" : ""} onClick={() => setMode("context")}>
          <span><strong>{t("纯单词＋语境")}</strong><small>{t("词目下方用小字显示一条短例句。")}</small></span><Check size={18} />
        </button>
      </div>
      <div className="settings-action"><span>{t("当前语言：")}{config.nativeName} · {languageName}</span><button className="primary-button" onClick={() => setView("vocab-trainer")}>{t("开始背单词")}<ArrowRight size={17} /></button></div>
    </section>
    <CommunityAvatarSettings locale={locale} authenticated={authenticated} />
    <section className="settings-panel"><div className="settings-copy"><Languages /><div><h2>{locale === "en" ? "Vocabulary check" : "词汇量测量"}</h2><p>{locale === "en" ? "Check recognition of words at your level and below." : "测量当前等级及以下词汇的识别情况。"}</p></div></div><button className="secondary-button" onClick={() => setView("vocabulary")}>{locale === "en" ? "Start a vocabulary check" : "开始测词"}<ArrowRight size={17} /></button></section>
    <section className="settings-panel support-settings">
      <div className="settings-copy"><div><h2>Pikku <small>1.3.2</small></h2><p>{locale === "en" ? "Share feedback or support continued development." : "欢迎反馈使用体验，或支持作者持续开发。"}</p></div></div>
      <div className="support-actions">
        <button aria-expanded={showSupport} aria-controls="author-support" onClick={() => setShowSupport(value => !value)}>{locale === "en" ? "Support the author" : "支持作者"}<span aria-hidden="true">♡</span></button>
        <a href="https://docs.qq.com/sheet/DQ3h3YWt0cE5IS1pG" target="_blank" rel="noopener noreferrer">{locale === "en" ? "Feedback" : "意见反馈"}<ArrowRight size={17} /></a>
      </div>
      {showSupport && <div id="author-support" className="author-support"><p>{locale === "en" ? "Optional support via WeChat Pay. All learning features remain available without a donation." : "可通过微信支付自愿支持作者；不捐款也能正常使用全部学习功能。"}</p><img src={assetPath("/support-author.png")} alt={locale === "en" ? "Author support QR code for WeChat Pay" : "微信支付支持作者二维码"} /></div>}
    </section>
  </div>;
}

function VocabularyLab({ level, ready, onSubmit }: { level: StudyLevel; ready: boolean; onSubmit: (answers: { lemma: string; correct: boolean }[]) => boolean }) {
  const { copy, language, locale } = useI18n();
  const items = useMemo(() => vocabularyCards.filter(card => card.language === language.id), [language.id]);
  const [test, setTest] = useState<VocabularyMeasurementItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const submittedTest = useRef<VocabularyMeasurementItem[] | null>(null);
  const eligible = items.filter(item => item.level && vocabularyLevelsFor(language.id, level).includes(normalizePikkuLevel(language.id, item.level)));
  const restart = () => { setTest(buildVocabularyMeasurement(items, level)); setAnswers({}); setFinished(false); };
  useEffect(() => { setTest(buildVocabularyMeasurement(items, level)); setAnswers({}); setFinished(false); }, [items, level]);
  const score = test.filter((item) => answers[item.lemma] === item.gloss).length;
  const submit = () => {
    if (!ready || submittedTest.current === test) return;
    submittedTest.current = test;
    if (!onSubmit(test.map((item) => ({ lemma: item.lemma, correct: answers[item.lemma] === item.gloss })))) { submittedTest.current = null; return; }
    setFinished(true);
  };

  return <div className="page vocab-page">
    <div className="practice-header"><div><TargetKicker kind="vocabulary" /><h1>{copy.vocabularyTitle}</h1><p>{copy.vocabularyIntro}</p></div><button className="secondary-button" onClick={restart} disabled={!eligible.length}><Shuffle size={16} />{copy.resample}</button></div>
    {!eligible.length ? <EmptyState kind="vocabulary" text={copy.noQuestionsForFilter} /> : <>
    <div className="official-note"><Languages /><div><strong>{copy.vocabularyRound(levelName(copy, level, language.id), test.length)}</strong><p>{copy.vocabularySyncNote}</p></div></div>
    <div className="vocab-grid">
      {test.map((item, index) => {
        const options = item.options;
        return <article className="vocab-item" key={item.lemma}><span>{String(index + 1).padStart(2, "0")} · {item.level}</span><h2 lang={language.htmlLang}>{item.lemma}</h2><div>{options.map((option) => <button key={option} disabled={finished} className={`${answers[item.lemma] === option ? "selected" : ""} ${finished && option === item.gloss ? "correct" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [item.lemma]: option }))}>{contentText(option, locale)}</button>)}</div></article>;
      })}
    </div>
    {!finished ? <button className="primary-button vocab-submit" disabled={!ready || !test.length || Object.keys(answers).length !== test.length} onClick={submit}>{copy.submitMeasure}</button> : <section className="vocab-result"><Trophy /><div><span>{copy.currentResult}</span><h2>{score} / {test.length}</h2><p>{locale === "en" ? `Recognition in this sample only · ${eligible.length} words in the selected stages. This is not a total vocabulary-size estimate.` : `本次仅测量抽样识别率 · 当前等级范围共 ${eligible.length} 词，不代表语言总词汇量。`}</p></div><button className="secondary-button" onClick={restart}>{copy.retest}</button></section>}
    </>}
  </div>;
}

const emptyAdminQuestion: Question = { id: "custom-", language: "la", level: "C", category: "vocabulary", type: "choice", prompt: "", latin: "", options: ["", "", "", ""], answer: 0, explanation: "", tags: [], source: "管理员自建" };

function AdminPanel({ bank, onChanged }: { bank: Question[]; onChanged: () => void }) {
  const t = useInterfaceText();
  const { copy, language } = useI18n();
  const [selectedId, setSelectedId] = useState(bank[0]?.id || "new");
  const [draft, setDraft] = useState<Question>(bank[0] || emptyAdminQuestion);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSelectedId(bank[0]?.id || "new");
    setDraft(bank[0] || { ...emptyAdminQuestion, id: `custom-${language.id}-${Date.now()}`, language: language.id, targetLang: language.htmlLang });
    setMessage("");
  }, [bank, language.htmlLang, language.id]);
  const choose = (id: string) => { setSelectedId(id); setDraft(id === "new" ? { ...emptyAdminQuestion, level: "C", id: `custom-${language.id}-${Date.now()}`, language: language.id, targetLang: language.htmlLang, source: copy.adminSource } : { ...bank.find((q) => q.id === id)! }); setMessage(""); };
  const save = async () => {
    const response = await apiFetch(`/api/admin/questions/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json(); setMessage(response.ok ? t("已保存并立即写入题库覆盖层。") : data.error || t("保存失败")); if (response.ok) onChanged();
  };
  const remove = async () => {
    if (!window.confirm(copy.disableConfirm(draft.id))) return;
    const response = await apiFetch(`/api/admin/questions/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    setMessage(response.ok ? t("题目已停用。") : t("停用失败")); if (response.ok) onChanged();
  };
  return <div className="page admin-page"><div className="practice-header"><div><TargetKicker kind="admin" /><h1>{copy.adminTitle}</h1><p>{copy.adminIntro}</p></div></div>
    <div className="admin-layout"><aside><button className="primary-button" onClick={() => choose("new")}>{copy.newQuestion}</button><select value={selectedId} onChange={(e) => choose(e.target.value)}><option value="new">{copy.newQuestion.replace(/^＋|^\+/, "").trim()}</option>{bank.map((q) => <option key={q.id} value={q.id}>{q.id} · {q.prompt.slice(0, 28)}</option>)}</select></aside>
      <section className="admin-form">
        <label>{copy.questionId}<input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
        <div className="admin-row"><label>{copy.difficulty}<select value={normalizePikkuLevel(language.id, draft.level)} onChange={(e) => setDraft({ ...draft, level: e.target.value as Question["level"] })}>{LEVEL_ORDER.map((v) => <option key={v} value={v}>{levelName(copy, v, language.id)}</option>)}</select></label><label>{copy.module}<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>{languageConfigs[language.id].categories.map((v) => <option key={v} value={v}>{categoryName(copy, v)}</option>)}</select></label><label>{copy.questionType}<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Question["type"] })}><option value="choice">{copy.multipleChoice}</option><option value="self-check">{copy.translationSelfCheck}</option></select></label></div>
        <label>{copy.prompt}<textarea rows={2} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></label>
        <label>{copy.latinText}<textarea rows={2} value={draft.targetText || draft.latin || ""} onChange={(e) => setDraft(language.id === "la" ? { ...draft, latin: e.target.value } : { ...draft, targetText: e.target.value, targetLang: language.htmlLang })} /></label>
        {draft.type === "choice" ? <><label>{copy.optionsPerLine}<textarea rows={5} value={(draft.options || []).join("\n")} onChange={(e) => setDraft({ ...draft, options: e.target.value.split("\n") })} /></label><label>{copy.correctOptionNumber}<input type="number" min="1" value={(draft.answer ?? 0) + 1} onChange={(e) => setDraft({ ...draft, answer: Math.max(0, Number(e.target.value) - 1) })} /></label></> : <label>{copy.modelTranslation}<textarea rows={4} value={draft.modelAnswer || ""} onChange={(e) => setDraft({ ...draft, modelAnswer: e.target.value })} /></label>}
        <label>{copy.explanation}<textarea rows={4} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></label>
        <div className="admin-row"><label>{copy.source}<input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label><label>{copy.commaSeparatedTags}<input value={draft.tags.join(",")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} /></label></div>
        <div className="admin-actions"><button className="primary-button" onClick={save}><Save size={16} />{copy.save}</button><button className="secondary-button danger" onClick={remove}><Trash2 size={16} />{copy.disable}</button>{message && <span>{message}</span>}</div>
      </section></div>
  </div>;
}

function Scope({ level, openPractice }: { level: StudyLevel; openPractice: (l?: StudyLevel, c?: Category | "all") => void }) {
  const { copy, locale, language } = useI18n();
  if (language.id !== "la") {
    return (
      <div className="page scope-page">
        <div className="practice-header"><div><TargetKicker kind="scope" /><h1>{copy.pikkuFrameworkTitle}</h1><p>{copy.learningPath(language.labels[locale], levelName(copy, level, language.id))}</p></div></div>
        <div className="scope-grid curriculum-grid generic-level-grid">
          {LEVEL_ORDER.map((item) => (
            <section key={item}>
              <div className="scope-number">{item}</div>
              <TargetKicker kind="courses" />
              <h2>{levelName(copy, item, language.id)}</h2>
              <p>{copy.languageContentInProgress(language.labels[locale])}</p>
              <button className="secondary-button" onClick={() => openPractice(item, "all")}>{copy.practiceScope(levelName(copy, item, language.id))} <ArrowRight size={17} /></button>
            </section>
          ))}
        </div>
        <div className="source-card"><BookOpen /><div><strong>{copy.contentRoadmap}</strong><p>{copy.pikkuFrameworkCopy} {copy.externalAssessmentsNote}</p></div></div>
      </div>
    );
  }
  return (
    <div className="page scope-page">
      <div className="practice-header"><div><TargetKicker kind="scope" /><h1>{copy.pikkuFrameworkTitle}</h1><p>{copy.pikkuFrameworkCopy}</p></div></div>
      <div className="official-note"><Landmark /><div><strong>{copy.officialExamNotChoice}</strong><p>{copy.officialExamNote}</p></div></div>
      <section className="bank-summary">
        <div><span>{copy.completeBank}</span><strong>{completeBankStats.total + questions.length}</strong><small>{copy.practiceTasks}</small></div>
        <div><span>{copy.vocabularyLookup}</span><strong>{completeBankStats.vocabularyQuestions}</strong><small>{completeBankStats.vocabularyEntries} {copy.coreLemmas}</small></div>
        <div><span>{copy.morphologyRecognition}</span><strong>{completeBankStats.morphologyQuestions}</strong><small>{copy.allDeclensionsConjugations}</small></div>
        <div><span>{copy.structureClassics}</span><strong>{completeBankStats.structureQuestions}</strong><small>{copy.arrangedByScope}</small></div>
        <div><span>{copy.translationSelfCheck}</span><strong>{completeBankStats.translationQuestions + staticQuestions.filter((q) => q.category === "translation" && !q.id.startsWith("tb-tra")).length}</strong><small>{copy.translationDirection}</small></div>
      </section>
      <div className="scope-grid curriculum-grid">{[...curriculumDomains].filter((domain) => domain.level !== "mixed").sort((a, b) => LEVEL_ORDER.indexOf(normalizePikkuLevel("la", a.level)) - LEVEL_ORDER.indexOf(normalizePikkuLevel("la", b.level))).map((domain) => { const localizedLevel = levelName(copy, domain.level); return <section key={domain.level}><div className="scope-number">{normalizePikkuLevel("la", domain.level)}</div><span>{domain.latin}</span><h2>{localizedLevel}</h2><p className="authors">{contentText(domain.authors, locale)}</p><p>{contentText(domain.examUse, locale)}</p><details><summary>{copy.textbookMapping}</summary><p><strong>Wheelock:</strong> {contentText(domain.wheelock, locale)}</p><p><strong>LLPSI:</strong> {contentText(domain.llpsi, locale)}</p></details><div className="domain-columns"><div><b>{copy.vocabulary}</b><ul>{domain.vocabulary.map((v) => <li key={v}>{contentText(v, locale)}</li>)}</ul></div><div><b>{copy.morphology}</b><ul>{domain.morphology.map((v) => <li key={v}>{contentText(v, locale)}</li>)}</ul></div><div><b>{copy.syntax}</b><ul>{domain.syntax.map((v) => <li key={v}>{contentText(v, locale)}</li>)}</ul></div><div><b>{copy.sentencePatterns}</b><ul>{domain.patterns.map((v) => <li key={v}>{contentText(v, locale)}</li>)}</ul></div><div><b>{copy.classics}</b><ul>{domain.classics.map((v) => <li key={v}>{contentText(v, locale)}</li>)}</ul></div></div><button className="secondary-button" onClick={() => openPractice(domain.level, "all")}>{copy.practiceScope(localizedLevel)} <ArrowRight size={17} /></button></section>; })}</div>
      <div className="source-card"><GraduationCap /><div><strong>{levelName(copy, "M", language.id)}</strong><p>{copy.languageContentInProgress(language.labels[locale])}</p><button className="secondary-button" onClick={() => openPractice("M", "all")}>{copy.practiceScope(levelName(copy, "M", language.id))}<ArrowRight size={17} /></button></div></div>
      <section className="coverage-section"><div className="section-heading"><div><TargetKicker kind="courses" /><h2>{copy.coverageMatrix}</h2></div></div><p>{copy.coverageIntro}</p><div className="coverage-books">{(["Wheelock", "LLPSI"] as const).map((book) => <details key={book}><summary><strong>{book}</strong><span>{textbookCoverage.filter((unit) => unit.book === book).length} {copy.chaptersClick}</span></summary><div>{textbookCoverage.filter((unit) => unit.book === book).map((unit) => <article key={`${book}-${unit.chapter}`}><b>{unit.chapter}</b><span>{contentText(unit.title, locale)}</span><p>{contentText(unit.topics, locale)}</p><small>{stageName(copy, unit.stage)} · {levelName(copy, unit.examDomain)}</small></article>)}</div></details>)}</div></section>
      <div className="source-card"><BookOpen /><div><strong>{copy.editorialNote}</strong><p>{copy.editorialCopy}</p></div></div>
    </div>
  );
}

function Archive() {
  const { copy, locale, language } = useI18n();
  if (language.id !== "la") {
    return <div className="page archive-page"><div className="practice-header"><div><TargetKicker kind="archive" /><h1>{copy.contentRoadmap}</h1><p>{copy.languageContentInProgress(language.labels[locale])}</p></div></div><div className="source-card"><CircleHelp /><div><strong>{copy.pikkuFrameworkTitle}</strong><p>{copy.externalAssessmentsNote}</p></div></div></div>;
  }
  return (
    <div className="page archive-page">
      <div className="practice-header"><div><TargetKicker kind="archive" /><h1>{copy.archiveTitle}</h1><p>{copy.archiveUpdate}</p></div></div>
      <div className="archive-verdict">
        <History />
        <div><strong>{copy.archiveVerdict}</strong><p>{copy.archiveVerdictCopy}</p></div>
      </div>
      <div className="archive-legend"><span><i className="verified-dot" />{copy.verifiedExamFacts}</span><span><i className="missing-dot" />{copy.paperNotPublic}</span></div>
      <div className="archive-list">
        {archiveEntries.map((entry) => (
          <article key={entry.year} className="archive-row">
            <div className="archive-year">{entry.year}</div>
            <div className="archive-content"><span>{archiveLevelName(copy, entry.levels)}</span><p>{contentText(entry.verified, locale)}</p><a href={entry.sourceUrl} target="_blank" rel="noreferrer">{contentText(entry.sourceLabel, locale)} <ArrowRight size={13} /></a></div>
            <div className={entry.paperStatus === "未检出举行记录" ? "archive-status neutral" : "archive-status"}>{archiveStatusName(copy, entry.paperStatus)}</div>
          </article>
        ))}
      </div>
      <div className="source-card"><CircleHelp /><div><strong>{copy.archiveCriteria}</strong><p>{copy.archiveCriteriaCopy}</p></div></div>
    </div>
  );
}

function HubTabs({ items, view, setView }: { items: [View, string][]; view: View; setView: (view: View) => void }) {
  const t = useInterfaceText();
  return <div className="hub-tabs" aria-label={t("栏目分页")}>{items.map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>;
}

function ResourceLibrary({ language, config, onDictionary }: { language: LanguageCode; config: LanguageConfig; onDictionary: () => void }) {
  const { copy, locale } = useI18n();
  const languageName = getLearningLanguage(language).labels[locale];
  const t = useInterfaceText();
  const [tab, setTab] = useState<"textbooks" | "authors" | "etymology">("textbooks");
  const textbooks = textbookCatalog.filter((book) => book.targetLanguage === language);
  const chapterMappings = resourceChapterMappings.filter((mapping) => mapping.targetLanguage === language);
  const periods = language === "la" ? [...new Set(classicalAuthors.map((author) => author.period))] : [];
  const currentFacts = languageFacts[language] ?? [];


  return <div className="page resource-page">
    <div className="practice-header"><div><span className="eyebrow">PIKKU RESOURCES · {config.nativeName}</span><h1>{languageName}{t("教材、作者与辞典")}</h1><p>{t("当前页面只显示")}{languageName}{t("资源；切换学习语言后，教材、作者、词条和语言知识会同步切换。")}</p></div></div>
    <button className="dictionary-resource-entry secondary-button" onClick={onDictionary}><BookOpen size={19} />{locale === "en" ? "Open dictionary" : "打开独立词典"}<ArrowRight size={17} /></button>
    <div className="resource-tabs" role="tablist">
      {([['textbooks', t("教材对齐")], ['authors', t("作者图谱")], ['etymology', t("语言知识")]] as const).map(([id, label]) => <button role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === "textbooks" && <>
      <div className="source-card"><BookOpen /><div><strong>{t("版权与改编原则")}</strong><p>{t("只索引官方页面、公版文献和合法预览。版权教材用于知识点与考纲映射，公开题库发布原创题目，不上传来源不明的 PDF，也不复刻整章练习。")}</p></div></div>
      <div className="textbook-grid">{textbooks.map((book) => <article key={book.id}><div className="resource-card-head"><span>{book.access}</span><small>{contentText(book.edition, locale)}</small></div><h2>{book.title}</h2><p className="resource-byline">{contentText(book.authors, locale)}</p><p>{contentText(book.accessNote, locale)}</p><details><summary>{t("难度域映射")}</summary><dl><dt>{levelName(copy, "C", language)}</dt><dd>{contentText(book.alignment.elementary, locale)}</dd><dt>{levelName(copy, "F", language)}</dt><dd>{contentText(book.alignment.intermediate, locale)}</dd><dt>{levelName(copy, "G", language)}</dt><dd>{contentText(book.alignment.advanced, locale)}</dd><dt>{levelName(copy, "M", language)}</dt><dd>{copy.languageContentInProgress(languageName)}</dd></dl></details><div className="tag-row">{book.strengths.map((item) => <span key={item}>{contentText(item, locale)}</span>)}</div></article>)}</div>
      {!textbooks.length && <div className="empty-state"><div><BookOpen /></div><h2>{languageName}{t("教材待建")}</h2><p>{t("当前模式不会借用拉丁语教材；核验书目与课程映射后再加入。")}</p></div>}
      <div className="section-heading resource-map-heading"><div><span>INDEX CAPITULŌRUM</span><h2>{t("章节与原创练习映射")}</h2></div><small>{t("只含元数据，不包含教材正文、答案或音频")}</small></div>
      <div className="chapter-map-grid">{chapterMappings.map((mapping) => <article key={mapping.id}><div><span>{contentText(mapping.publicDomainStatus, locale)}</span><small>{contentText(mapping.chapter, locale)}</small></div><h3>{contentText(mapping.title, locale)}</h3><p><strong>{t("语法域")}</strong>{mapping.grammarTargets.map(text => contentText(text, locale)).join(" · ")}</p><p><strong>{t("词汇域")}</strong>{mapping.vocabularyTargets.map(text => contentText(text, locale)).join(" · ")}</p><p><strong>{t("原创化逻辑")}</strong>{contentText(mapping.exerciseLogic, locale)}</p><small>{contentText(mapping.licenseNote, locale)}</small></article>)}</div>
      {!chapterMappings.length && <div className="empty-state"><div><Library /></div><h2>{t("尚无章节映射")}</h2><p>{languageName}{t("章节元数据仍在核验，不显示其他语言的占位内容。")}</p></div>}
    </>}
    {tab === "authors" && language === "la" && <>
      <div className="resource-metrics"><div><strong>{classicalAuthors.length}</strong><span>{t("位首批作者")}</span></div><div><strong>{classicalAuthors.reduce((total, author) => total + author.works.length, 0)}</strong><span>{t("条作者—作品关系")}</span></div><div><strong>{periods.length}</strong><span>{t("个历史分期")}</span></div></div>
      <div className="author-timeline">{periods.map((period) => <section key={period}><h2>{contentText(period, locale)}</h2><div>{classicalAuthors.filter((author) => author.period === period).map((author) => <article key={author.id}><span>{author.dates}</span><h3>{author.name}</h3><p>{locale === "en" ? "" : `${author.chinese} · `}{author.genres.map(text => contentText(text, locale)).join(" / ")}</p><ul>{author.works.map((work) => <li key={work}>{work}</li>)}</ul><small>{t("建议域：")}{levelName(copy, author.examLevel, language)}</small></article>)}</div></section>)}</div>
    </>}
    {tab === "authors" && language !== "la" && <div className="empty-state"><div><Users /></div><h2>{languageName}{t("作者图谱待建")}</h2><p>{t("当前模式不会借用拉丁语作者数据；按语言与时代核验后再加入。")}</p></div>}

    {tab === "etymology" && <>
      <div className="etymology-progress"><Sparkles /><div><strong>{language === "la" ? etymologyFacts.length : currentFacts.length} / 365</strong><p>{language === "la" ? t("现有词源知识已接入首页随机栏目；后续按拉丁词、后裔词、语义变化与来源逐条扩充。") : (locale === "en" ? `Only ${languageName} language notes are shown, with source links.` : `当前只显示${languageName}语言知识，并保留可点击来源。`)}</p></div></div>
      {language === "la" ? <div className="fact-library">{etymologyFacts.map((fact, index) => <article key={`${fact.latin}-${index}`}><span>DIES {String(index + 1).padStart(3, "0")}</span><h2>{fact.latin} · {contentText(fact.meaning, locale)}</h2><p>{contentText(fact.note, locale)}</p><small>{t("英语：")}{fact.english.join(" · ")}{t("罗曼语：")}{fact.romance.map(text => contentText(text, locale)).join(" · ")}</small></article>)}</div> : <div className="fact-library">{currentFacts.map((fact, index) => <article key={fact.id}><span>{contentText(fact.kind, locale)} · {String(index + 1).padStart(3, "0")}</span><h2>{contentText(fact.title, locale)}</h2><p>{contentText(fact.summary, locale)}</p><small>{contentText(fact.example, locale)}　{fact.sources.map((source, sourceIndex) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{sourceIndex > 0 && " · "}{contentText(source.label, locale)}</a>)}</small></article>)}</div>}
      {language !== "la" && !currentFacts.length && <div className="empty-state"><div><Sparkles /></div><h2>{languageName}{t("语言知识待建")}</h2><p>{t("核验来源后再加入，不显示拉丁语占位内容。")}</p></div>}
    </>}
  </div>;
}

function EmptyState({ text }: { text: string; kind?: string }) {
  const t = useInterfaceText();
  return <div className="empty-state"><div><BookOpen /></div><h2>{t("暂无内容")}</h2><p>{text}</p></div>;
}
