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
  categoryLabels,
  normalizePikkuLevel,
  type StudyLevel,
  type PikkuLevel,
  matchesLevel,
  questions,
  type Category,
  type LanguageCode,
  type Level,
  type Question,
  type ReviewStatus,
} from "@/data/questions";
import { languageConfigs, languageLevelLabels, languageOrder, type LanguageConfig, type LanguageLevel } from "@/data/languages";
import { languageFacts } from "@/data/language-facts";
import { multilingualQuestions } from "@/data/multilingual-questions";
import { multilingualSeedQuestions, multilingualVocabItems } from "@/data/multilingual-seeds";
import { availableLearningLanguages, getCopy, getLearningLanguage, normalizeLearningLanguage, type MicroLabelKey, type LearningLanguage, type LearningLanguageId, type UiCopy, type UiLocale } from "./i18n";
import { archiveEntries } from "@/data/archive";
import { curriculumDomains, etymologyFacts, textbookCoverage, vocabItems, type VocabItem } from "@/data/curriculum";
import { completeBankStats, completeQuestions, completeVocabItems } from "@/data/complete-bank";
import { classicalAuthors, dictionarySources, lexiconSeed, resourceChapterMappings, textbookCatalog } from "@/data/resources";
import {
  chooseNextVocabularyCard,
  vocabularyCards,
  vocabularyKey,
  vocabularyLevelsFor,
  vocabularyMatchesLevel,
  type VocabularyMode,
  type VocabularyStats,
} from "@/data/vocabulary";
import {
  storyNodesForPace,
  storyPaces,
  storyScore,
  storyStageLabels,
  xiangshanLatinStory,
  type StoryPace,
  type StorySupport,
} from "@/data/story";
import { extraEnglish } from "./extra-copy";
import { shuffle } from "@/lib/shuffle";
import { apiFetch, supabase } from "@/lib/supabase";

type View = "home" | "practice" | "story" | "vocab-trainer" | "mistakes" | "bookmarks" | "exam" | "vocabulary" | "scope" | "archive" | "resources" | "community" | "settings" | "admin";
type Progress = Record<string, "correct" | "wrong" | "review">;
type Session = { authenticated: boolean; persistence?: boolean; authError?: string; user: null | { email: string; name: string; role: "student" | "admin" } };
type Override = { id: string; deleted: boolean; question: Question | null };
type AccountPreference = { language: LanguageCode; level: LanguageLevel; vocabMode: VocabularyMode };
type VocabularyMemory = { owner: string; stats: VocabularyStats };

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
const VIEW_MICRO_LABEL: Record<View, MicroLabelKey> = { home: "overview", story: "story", practice: "practice", mistakes: "review", bookmarks: "review", exam: "exam", vocabulary: "vocabulary", "vocab-trainer": "vocabulary", scope: "scope", archive: "archive", resources: "archive", community: "courses", settings: "progress", admin: "admin" };

function useI18n() {
  return useContext(I18nContext);
}

function useInterfaceText() {
  const { locale } = useI18n();
  return (text: string) => locale === "en" ? extraEnglish[text] ?? text : text;
}

function levelName(copy: UiCopy, level: StudyLevel, language: LanguageCode = "la") {
  const stage = normalizePikkuLevel(language, level);
  const name = stage === "M" && (language === "la" || language === "grc")
    ? (copy.elementary === "Core" ? "Mastery" : "专家级")
    : { C: copy.elementary, F: copy.intermediate, G: copy.advanced, M: copy.mixed }[stage];
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

const staticQuestions = [...questions, ...completeQuestions, ...multilingualQuestions, ...multilingualSeedQuestions];
const staticQuestionIndex = new Map(staticQuestions.map((question) => [question.id, question]));
const allVocabItems: VocabItem[] = [...vocabItems, ...completeVocabItems, ...multilingualVocabItems];
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isStaticPublic = process.env.NEXT_PUBLIC_STATIC_PUBLIC === "true";
const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "chatgpt";
const assetPath = (path: string) => `${publicBasePath}${path}`;

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
  const [category, setCategory] = useState<Category | "all">("all");
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
  const languageRef = useRef(language);
  const languageLevelRef = useRef(languageLevel);
  const levelsByLanguageRef = useRef<Partial<Record<LanguageCode, LanguageLevel>>>({});
  const vocabularyModeRef = useRef(vocabularyMode);
  const vocabularyMemoryRef = useRef(vocabularyMemory);
  const languageConfig = languageConfigs[language] ?? languageConfigs.la;
  const level = normalizePikkuLevel(language, languageLevel);
  const copy = getCopy(locale);
  const t = (text: string) => locale === "en" ? extraEnglish[text] ?? text : text;
  const currentLanguage = getLearningLanguage(language);
  const accountStorageReady = languageReady && languageLevelReady && vocabularyModeReady && vocabularyMemoryReady && progressReady && bookmarksReady;

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
  }, []);

  const refreshAccount = useCallback(async (providedSession?: Session) => {
    const nextSession = providedSession ?? await apiFetch("/api/me").then((response) => response.ok ? response.json() : null);
    if (!nextSession) return;
    setSession(nextSession);
    if (!nextSession.authenticated || !nextSession.user) {
      setSyncStatus("idle");
      return;
    }

    setSyncStatus("syncing");
    const response = await apiFetch("/api/stats");
    if (!response.ok) {
      setSyncStatus("error");
      return;
    }
    const stats = await response.json();
    const remoteProgress = stats?.progress && typeof stats.progress === "object" ? stats.progress as Progress : {};
    const localProgress = progressRef.current;
    const mergedProgress = { ...localProgress, ...remoteProgress };
    progressRef.current = mergedProgress;
    setProgress(mergedProgress);
    const remoteBookmarks = Array.isArray(stats?.bookmarks) ? stats.bookmarks.filter((id: unknown) => typeof id === "string") : [];
    const mergedBookmarks = [...new Set([...remoteBookmarks, ...bookmarksRef.current])];
    bookmarksRef.current = mergedBookmarks;
    setBookmarks(mergedBookmarks);
    const remoteVocab = remoteVocabularyStats(stats?.vocab);
    const localVocab = vocabularyMemoryRef.current;
    const addGuestStats = localVocab.owner === GUEST_VOCABULARY_OWNER;
    const mergedVocab = localVocab.owner === nextSession.user.email
      ? mergeVocabularyStats(remoteVocab, localVocab.stats)
      : mergeVocabularyStats(remoteVocab, addGuestStats ? localVocab.stats : {}, addGuestStats);
    if (addGuestStats && Object.keys(localVocab.stats).length) {
      const guestByLanguage: Partial<Record<LanguageCode, { lemma: string; seen: number; correctCount: number }[]>> = {};
      for (const [key, stat] of Object.entries(localVocab.stats)) {
        const separator = key.indexOf(":");
        const nextLanguage = key.slice(0, separator) as LanguageCode;
        if (separator < 1 || !languageConfigs[nextLanguage]) continue;
        (guestByLanguage[nextLanguage] ??= []).push({ lemma: key.slice(separator + 1), seen: stat.seen, correctCount: stat.correct });
      }
      for (const [nextLanguage, answers] of Object.entries(guestByLanguage) as [LanguageCode, { lemma: string; seen: number; correctCount: number }[]][]) {
        const migrated = await apiFetch("/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, answers }) });
        if (!migrated.ok) {
          setSyncStatus("error");
          return;
        }
      }
    }
    const nextVocabularyMemory = { owner: nextSession.user.email, stats: mergedVocab };
    vocabularyMemoryRef.current = nextVocabularyMemory;
    setVocabularyMemory(nextVocabularyMemory);
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
    if (mergedBookmarks.length !== remoteBookmarks.length) {
      const items = mergedBookmarks.map((questionId) => ({ questionId, language: syncQuestion(questionId).language ?? "la" }));
      const migrated = await apiFetch("/api/bookmarks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
      if (!migrated.ok) {
        setSyncStatus("error");
        return;
      }
    }
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
    setSyncStatus("idle");
  }, [setBookmarks, setLanguage, setLanguageLevel, setProgress, setVocabularyMemory, setVocabularyMode]);

  const waitForAccountSync = useCallback(async () => {
    await Promise.allSettled([...pendingAccountSyncs.current]);
  }, []);

  const clearAccountData = useCallback(() => {
    setSession({ authenticated: false, persistence: true, user: null });
    progressRef.current = {};
    setProgress({});
    bookmarksRef.current = [];
    setBookmarks([]);
    vocabularyModeRef.current = "context";
    setVocabularyMode("context");
    const guestVocabularyMemory = { owner: GUEST_VOCABULARY_OWNER, stats: {} };
    vocabularyMemoryRef.current = guestVocabularyMemory;
    setVocabularyMemory(guestVocabularyMemory);
    setSyncStatus("idle");
  }, [setBookmarks, setProgress, setVocabularyMemory, setVocabularyMode]);

  useEffect(() => {
    if (isStaticPublic || !accountStorageReady) return;
    Promise.all([
      apiFetch("/api/me").then((r) => r.ok ? r.json() : null),
      apiFetch("/api/questions").then((r) => r.ok ? r.json() : { overrides: [] }),
      apiFetch("/api/auth-config").then((r) => r.ok ? r.json() : { wechat: false }),
    ]).then(([me, remote, authConfig]) => {
      setOverrides(remote?.overrides || []);
      setWechatEnabled(Boolean(authConfig?.wechat));
      if (me) void refreshAccount(me);
    }).catch(() => { /* Static preview and anonymous practice remain usable. */ });

    if (authMode !== "supabase") return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAccountData();
        return;
      }
      window.setTimeout(() => {
        void refreshAccount();
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [accountStorageReady, clearAccountData, refreshAccount]);

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
    if (!session.authenticated) return;
    queueAccountSync(async () => {
      const response = await apiFetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: question.id, status, language: question.language ?? "la", level: question.level, category: question.category }) });
      if (!response.ok) throw new Error(t("进度同步失败"));
    });
  };

  const recordVocabulary = (nextLanguage: LanguageCode, answers: { lemma: string; correct: boolean }[]) => {
    const currentMemory = vocabularyMemoryRef.current;
    const nextStats = { ...currentMemory.stats };
    for (const answer of answers) {
      const key = vocabularyKey(nextLanguage, answer.lemma);
      const current = nextStats[key] ?? { seen: 0, correct: 0 };
      nextStats[key] = { seen: current.seen + 1, correct: current.correct + (answer.correct ? 1 : 0) };
    }
    const nextMemory = { ...currentMemory, stats: nextStats };
    vocabularyMemoryRef.current = nextMemory;
    setVocabularyMemory(nextMemory);
    if (!session.authenticated || !session.user || currentMemory.owner !== session.user.email) return;
    queueAccountSync(async () => {
      const response = await apiFetch("/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: nextLanguage, answers }) });
      if (!response.ok) throw new Error(t("词汇统计同步失败"));
    });
  };

  const updateBookmarks = useCallback((next: string[] | ((current: string[]) => string[])) => {
    const resolved = typeof next === "function" ? next(bookmarksRef.current) : next;
    const unique = [...new Set(resolved)];
    bookmarksRef.current = unique;
    setBookmarks(unique);
    if (!session.authenticated) return;
    queueAccountSync(async () => {
      const items = unique.map((questionId) => ({ questionId, language: syncQuestion(questionId).language ?? "la" }));
      const response = await apiFetch("/api/bookmarks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
      if (!response.ok) throw new Error(t("收藏同步失败"));
    });
  }, [queueAccountSync, session.authenticated, setBookmarks]);
  const updateLanguageBookmarks = useCallback((next: string[] | ((current: string[]) => string[])) => {
    const current = bookmarksRef.current;
    const currentLanguage = current.filter((id) => languageQuestionIds.has(id));
    const resolved = typeof next === "function" ? next(currentLanguage) : next;
    const otherLanguages = current.filter((id) => !languageQuestionIds.has(id));
    updateBookmarks([...otherLanguages, ...resolved]);
  }, [languageQuestionIds, updateBookmarks]);

  const answered = Object.keys(progress).filter((id) => languageQuestionIds.has(id)).length;
  const correct = Object.entries(progress).filter(([id, value]) => languageQuestionIds.has(id) && value === "correct").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const syncPreference = (nextLanguage: LanguageCode, nextLevel: LanguageLevel, nextVocabularyMode: VocabularyMode = vocabularyModeRef.current) => {
    if (!session.authenticated) return;
    queueAccountSync(async () => {
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
    const nextLevel = normalizePikkuLevel(language, value);
    languageLevelRef.current = nextLevel;
    setLanguageLevel(nextLevel);
    syncPreference(language, nextLevel);
  };

  const openPractice = (nextLevel: LanguageLevel = languageLevel, nextCategory: Category | "all" = "all") => {
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
  const activeSection: View = (["exam", "vocabulary", "vocab-trainer"] as View[]).includes(view) ? "practice" : view === "bookmarks" ? "mistakes" : (["archive", "resources"] as View[]).includes(view) ? "scope" : view;
  const viewTitles: Partial<Record<View, string>> = { exam: copy.randomExam, story: copy.storyMode, "vocab-trainer": copy.vocabulary, vocabulary: copy.vocabularyMeasure, bookmarks: copy.bookmarks, archive: copy.archive, resources: copy.archive };

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

        <div className="level-switch" aria-label={copy.chooseLevel}>
          {languageConfig.levels.map((item) => (
            <button key={item} className={level === item ? "active" : ""} onClick={() => selectLanguageLevel(item)} aria-pressed={level === item}>
              {levelName(copy, item, language)}
            </button>
          ))}
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
              {language === "la" && (["practice", "story", "exam", "vocab-trainer", "vocabulary"] as View[]).includes(view) && <HubTabs items={[["practice", t("有序选题")], ["story", t("剧情任务")], ["exam", t("随机组卷")], ["vocab-trainer", t("背单词")], ["vocabulary", t("词汇量测量")]]} view={view} setView={setView} />}
              {language !== "la" && (["practice", "vocab-trainer"] as View[]).includes(view) && <HubTabs items={[["practice", t("有序选题")], ["vocab-trainer", t("背单词")]]} view={view} setView={setView} />}
              {(["mistakes", "bookmarks"] as View[]).includes(view) && <HubTabs items={[["mistakes", t("错题回炉")], ["bookmarks", t("我的收藏")]]} view={view} setView={setView} />}
              {(["scope", "archive", "resources"] as View[]).includes(view) && <HubTabs items={language === "la" ? [["scope", t("考试范围")], ["archive", t("真题档案")], ["resources", t("教材·作者·辞典")]] : [["scope", t("考试与资源")], ["resources", `${currentLanguage.labels[locale]} · ${t("资源")}`]]} view={view} setView={setView} />}
              {view === "home" && <Dashboard bank={languageBank} level={level} progress={progress} bookmarks={languageBookmarks} openPractice={openPractice} setView={setView} />}
              {view === "practice" && <Practice key={language} bank={languageBank} level={level} levels={languageConfig.levels} setLevel={selectLanguageLevel} category={category} setCategory={setCategory} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "story" && (language === "la" ? <StoryMode setView={setView} /> : <StoryOutline level={level} setView={setView} />)}
              {view === "mistakes" && <QuestionCollection title={copy.mistakes} empty={copy.noMistakes} questions={languageBank.filter((q) => progress[q.id] === "wrong" || progress[q.id] === "review")} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "bookmarks" && <QuestionCollection title={copy.bookmarks} empty={copy.noBookmarks} questions={languageBank.filter((q) => languageBookmarks.includes(q.id))} progress={progress} onResult={recordProgress} bookmarks={languageBookmarks} setBookmarks={updateLanguageBookmarks} />}
              {view === "exam" && <ExamMode bank={languageBank} level={level} setLevel={selectLanguageLevel} progress={progress} onResult={recordProgress} />}
              {view === "vocab-trainer" && <VocabularyTrainer language={language} level={languageLevel} mode={vocabularyMode} stats={vocabularyMemory.stats} onAnswer={recordVocabulary} setView={setView} />}
              {view === "vocabulary" && <VocabularyLab level={level} onSubmit={(answers) => recordVocabulary(language, answers)} />}
              {view === "scope" && <Scope level={level} openPractice={openPractice} />}
              {view === "archive" && <Archive />}
              {view === "resources" && <ResourceLibrary language={language} config={languageConfig} />}
              {view === "community" && <CommunityPreview config={languageConfig} />}
              {view === "settings" && <PersonalSettings config={languageConfig} mode={vocabularyMode} setMode={selectVocabularyMode} setView={setView} authenticated={session.authenticated} />}
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
  const { copy } = useI18n();
  return (
    <div className="locale-switch" role="group" aria-label={copy.displayLanguage}>
      <button type="button" className={locale === "zh-CN" ? "active" : ""} aria-pressed={locale === "zh-CN"} onClick={() => onChange("zh-CN")}>
        <span className="locale-full">{copy.simplifiedChinese}</span><span className="locale-compact">简中</span>
      </button>
      <button type="button" className={locale === "en" ? "active" : ""} aria-pressed={locale === "en"} onClick={() => onChange("en")}>
        <span className="locale-full">{copy.english}</span><span className="locale-compact">EN</span>
      </button>
    </div>
  );
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
      <h2>{fact.title} <small>{fact.kind}</small></h2>
      <p>{fact.summary}</p>
    </div>
    <div className="word-family">
      <span>{t("例子")}</span><strong>{fact.example}</strong>
      <span>{t("来源")}</span><strong>{fact.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{index > 0 && " · "}{source.label}</a>)}</strong>
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

  const modes = [
    { category: "vocabulary" as Category, icon: Languages, title: copy.wordCourse, native: language.microLabels.vocabulary, detail: copy.wordCourseCopy, meta: copy.questionCount(bank.filter((q) => matchesLevel(q, level) && q.category === "vocabulary").length) },
    { category: "syntax" as Category, icon: Layers3, title: copy.grammarCourse, native: language.microLabels.grammar, detail: copy.grammarCourseCopy, meta: copy.questionCount(bank.filter((q) => matchesLevel(q, level) && q.category === "syntax").length) },
    { category: "translation" as Category, icon: BookOpen, title: copy.readingCourse, native: language.microLabels.reading, detail: copy.readingCourseCopy, meta: copy.questionCount(bank.filter((q) => matchesLevel(q, level) && q.category === "translation").length) },
  ];

  return (
    <div className="page dashboard-page">
      <section className="home-feature-grid">
        <article className="story-entry-card">
          <TargetKicker kind="story"><Sparkles size={14} /></TargetKicker>
          <h1>{copy.storyRoute(language.labels[locale])}</h1>
          <p>{copy.storyEntryCopy}</p>
          <div className="story-cast-row"><span>{copy.mainCast}</span><ChevronRight size={14} /><span>{copy.targetLanguagePair(language.labels[locale])}</span></div>
          <button className="primary-button" onClick={() => setView("story")}>{copy.enterStory} <ArrowRight size={17} /></button>
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
      <section className="mode-grid">
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

      {language.id === "la" && <section className="story-banner">
        <div className="story-banner-mark"><Landmark /></div>
        <div><span>{t("FABULA INVESTIGANDA · P3.3 原型")}</span><h2>{t("香山碑文与版本线索")}</h2><p>{t("和“五方言路”完成一条 8–12 分钟的拉丁语文献侦探任务；另有 3 分钟复习和 20 分钟深读。")}</p></div>
        <button className="secondary-button" onClick={() => setView("story")}>{t("进入剧情")}<ArrowRight size={17} /></button>
      </section>}

      <section className="exam-banner">
        <div className="banner-icon"><Trophy /></div>
        <div><TargetKicker kind="exam" /><h2>{copy.examReady}</h2><p>{copy.examReadyCopy}</p></div>
        <button className="secondary-button" onClick={() => setView("exam")}>{copy.enterExam} <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function StoryOutline({ level, setView }: { level: StudyLevel; setView: (view: View) => void }) {
  const { copy, locale, language } = useI18n();
  return (
    <div className="page story-page">
      <div className="practice-header">
        <div><TargetKicker kind="story"><Sparkles size={14} /></TargetKicker><h1>{copy.storyRoute(language.labels[locale])}</h1><p>{copy.storyFrameworkCopy}</p></div>
        <button className="secondary-button" onClick={() => setView("home")}><ArrowLeft size={16} />{copy.backToOverview}</button>
      </div>
      <section className="story-stage" aria-label={copy.storyFrameworkTitle}>
        <div className="story-scene-copy"><span>{copy.storyFrameworkTitle}</span><h2 lang={language.htmlLang}>{language.greeting}</h2><p>{copy.learningPath(language.labels[locale], levelName(copy, level, language.id))}</p></div>
        <div className="story-role-card"><strong>{copy.mainCast}</strong><span>×</span><strong>{copy.targetLanguagePair(language.labels[locale])}</strong></div>
        <div className="story-dialogue"><LanguageWordmark language={language} /><p>{copy.storyCharactersPending}</p></div>
      </section>
    </div>
  );
}


function StoryMode({ setView }: { setView: (view: View) => void }) {
  const t = useInterfaceText();
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [pace, setPace] = useState<StoryPace>("standard");
  const [support, setSupport] = useState<StorySupport>("guided");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [choiceOrders, setChoiceOrders] = useState<Record<string, string[]>>({});
  const paceOrder: StoryPace[] = ["quick", "standard", "deep"];
  const nodes = storyNodesForPace(pace);
  const node = nodes[step];
  const selectedChoice = node?.choices?.find((choice) => choice.id === answers[node.id]);
  const visibleChoices = node?.choices
    ? (choiceOrders[node.id] ?? node.choices.map((choice) => choice.id)).flatMap((id) => {
        const choice = node.choices?.find((item) => item.id === id);
        return choice ? [choice] : [];
      })
    : [];
  const score = storyScore(answers, nodes);

  const start = (nextPace = pace) => {
    const nextNodes = storyNodesForPace(nextPace);
    setPace(nextPace);
    setStep(0);
    setAnswers({});
    setChoiceOrders(Object.fromEntries(nextNodes.map((item) => [item.id, shuffle(item.choices ?? []).map((choice) => choice.id)])));
    setPhase("play");
  };

  const advance = () => {
    if (step >= nodes.length - 1) setPhase("done");
    else setStep((current) => current + 1);
  };

  if (phase === "intro") return <div className="page story-page">
    <section className="story-intro">
      <span className="eyebrow"><Landmark size={14} />{t("FABULA INVESTIGANDA · 剧情任务")}</span>
      <div className="story-intro-heading">
        <div><h1>{xiangshanLatinStory.title}</h1><p>{xiangshanLatinStory.subtitle}</p></div>
        <span>{t("建议中级 · 所有等级可试")}</span>
      </div>
      <p className="story-lead">{xiangshanLatinStory.setting}{t("。你会先理解线索、向同伴缩小问题、提交转写判断，再把同一策略迁移到新句。")}</p>
      <div className="story-objectives">
        {xiangshanLatinStory.objectives.map((objective) => <span key={objective}><Check size={15} />{objective}</span>)}
      </div>
      <p className="story-source-note">{t("原创训练场景 · 非史料原文 · 不设性别、国籍或身份预设")}</p>
    </section>

    <section className="story-setup" aria-label={t("剧情任务设置")}>
      <div><span className="eyebrow">{t("TEMPO · 任务长度")}</span><h2>{t("这次走哪条路线？")}</h2></div>
      <div className="story-pace-grid">
        {paceOrder.map((item) => <button key={item} className={pace === item ? "active" : ""} onClick={() => setPace(item)} aria-pressed={pace === item}>
          <strong>{t(storyPaces[item].label)}</strong><span>{t(storyPaces[item].duration)}</span><small>{t(storyPaces[item].description)}</small>
        </button>)}
      </div>
      <div className="story-support-row">
        <div><strong>{t("引导强度")}</strong><span>{t("只影响提示多少，不改变题目结果。")}</span></div>
        <div>
          <button className={support === "guided" ? "active" : ""} onClick={() => setSupport("guided")} aria-pressed={support === "guided"}>{t("更多讲解")}</button>
          <button className={support === "immersive" ? "active" : ""} onClick={() => setSupport("immersive")} aria-pressed={support === "immersive"}>{t("更沉浸")}</button>
        </div>
      </div>
      <div className="story-actions"><button className="primary-button" onClick={() => start()}>{t("开始")}{t(storyPaces[pace].label)} <ArrowRight size={17} /></button><button className="text-button" onClick={() => setView("practice")}>{t("返回训练中心")}</button></div>
    </section>
  </div>;

  if (phase === "done") return <div className="page story-page">
    <section className="story-complete">
      <div className="story-complete-seal"><CheckCircle2 /></div>
      <span className="eyebrow">{t("ECHO COMPLETUM · 闭环完成")}</span>
      <h1>{t("线索已经串起来了。")}</h1>
      <p>{t("本轮完成")}{nodes.length}{t("个情境节点，")}{score.total}{t("次判断中命中")}<strong>{score.correct}</strong>{t("次。错选不会阻断剧情；反馈已把注意力带回有限动词、名词与分词的一致关系。")}</p>
      <div className="story-summary-grid">
        <div><span>{t("核心策略")}</span><strong>{t("先主干，后分词一致")}</strong></div>
        <div><span>{t("目标词目")}</span><strong>{xiangshanLatinStory.targetItems.join(" · ")}</strong></div>
        <div><span>{t("本轮路线")}</span><strong>{t(storyPaces[pace].label)} · {t(storyPaces[pace].duration)}</strong></div>
      </div>
      <div className="story-complete-actions">
        {pace !== "quick" && <button className="secondary-button" onClick={() => start("quick")}>{t("3 分钟回声复习")}</button>}
        {pace !== "deep" && <button className="secondary-button" onClick={() => start("deep")}>{t("打开 20 分钟深读")}</button>}
        <button className="secondary-button" onClick={() => setView("resources")}>{t("打开资源库")}</button>
        <button className="primary-button" onClick={() => setView("practice")}>{t("回到训练中心")}</button>
      </div>
      <small>{t("本阶段为静态原型，只在本次章节中计算判断结果；账号级剧情进度和错因权重将在下一迭代接入。")}</small>
    </section>
  </div>;

  return <div className="page story-page">
    <div className="story-toolbar">
      <button className="text-button" onClick={() => setPhase("intro")}><ArrowLeft size={16} />{t("退出任务")}</button>
      <span>{t(storyPaces[pace].label)} · {support === "guided" ? t("更多讲解") : t("更沉浸")}</span>
      <strong>{step + 1} / {nodes.length}</strong>
    </div>
    <div className="story-progress" aria-label={`${t("剧情进度")} ${step + 1} / ${nodes.length}`}><i style={{ width: `${((step + 1) / nodes.length) * 100}%` }} /></div>
    <ol className="story-stage-list" aria-label={t("学习闭环阶段")}>
      {nodes.map((item, index) => <li key={item.id} className={index === step ? "active" : index < step ? "done" : ""}><span>{index < step ? "✓" : index + 1}</span>{t(storyStageLabels[item.stage])}</li>)}
    </ol>

    <article className="story-scene">
      <header><span>{t(storyStageLabels[node.stage])}</span><small>{node.place}</small><h1>{node.title}</h1></header>
      <p className="story-copy">{node.body}</p>
      {node.targetText && <blockquote lang="la">{node.targetText}</blockquote>}
      {support === "guided" && node.guidedNote && <aside className="story-guidance"><CircleHelp size={17} /><div><strong>{t("观察提示")}</strong><p>{node.guidedNote}</p></div></aside>}
      {pace === "deep" && node.deepNote && <details className="story-deep-note" open><summary>{t("文献深读注")}</summary><p>{node.deepNote}</p></details>}
      {node.prompt && <h2>{node.prompt}</h2>}
      {node.choices && <div className="story-choices">
        {visibleChoices.map((choice, choiceIndex) => <button key={choice.id} className={selectedChoice?.id === choice.id ? `selected ${choice.correct ? "correct" : "wrong"}` : ""} onClick={() => setAnswers((current) => ({ ...current, [node.id]: choice.id }))} disabled={Boolean(selectedChoice)} aria-pressed={selectedChoice?.id === choice.id}>
          <span>{String.fromCharCode(65 + choiceIndex)}</span>{choice.label}
        </button>)}
      </div>}
      {selectedChoice && <div className={`story-feedback ${selectedChoice.correct ? "correct" : "wrong"}`} role="status">
        {selectedChoice.correct ? <CheckCircle2 size={18} /> : <CircleHelp size={18} />}
        <div><strong>{selectedChoice.correct ? t("线索成立") : t("先保留这个误差")}</strong><p>{selectedChoice.feedback}</p>{!selectedChoice.correct && node.repairPrompt && <small>{t("修复提示：")}{node.repairPrompt}</small>}</div>
      </div>}
      <footer>
        <button className="secondary-button" onClick={() => step > 0 ? setStep((current) => current - 1) : setPhase("intro")}><ArrowLeft size={16} />{step > 0 ? t("上一幕") : t("返回设置")}</button>
        <button className="primary-button" onClick={advance} disabled={Boolean(node.choices?.length) && !selectedChoice}>{step === nodes.length - 1 ? t("完成任务") : t("继续")}<ArrowRight size={16} /></button>
      </footer>
    </article>
  </div>;
}

function Practice({ bank, level, levels, setLevel, category, setCategory, progress, onResult, bookmarks, setBookmarks }: { bank: Question[]; level: LanguageLevel; levels: readonly LanguageLevel[]; setLevel: (l: LanguageLevel) => void; category: Category | "all"; setCategory: (c: Category | "all") => void; progress: Progress; onResult: (q: Question, s: Progress[string]) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const t = useInterfaceText();
  const { copy, language } = useI18n();
  const [order, setOrder] = useState<"ordered" | "random">("ordered");
  const [randomSeed, setRandomSeed] = useState(0);
  const [query, setQuery] = useState("");
  const pool = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const selected = bank.filter((q) => matchesLevel(q, level) && (category === "all" || q.category === category) && (!normalized || [q.id, q.prompt, q.text, q.latin, q.context, q.source, ...q.tags].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized)));
    return order === "random" ? shuffle(selected) : selected;
  }, [bank, level, category, order, randomSeed, query]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [level, category, query]);
  const question = pool[index];

  return (
    <div className="page practice-page">
      <div className="practice-header">
        <div><TargetKicker kind="practice" /><h1>{copy.focusedPractice}</h1><p>{copy.focusedPracticeCopy}</p></div>
        <div className="filter-row">
          <label>{t("难度")}<select value={level} onChange={(e) => setLevel(e.target.value as LanguageLevel)}>{levels.map((item) => <option key={item} value={item}>{levelName(copy, item, language.id)}</option>)}</select></label>
          <label>{t("模块")}<select value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}><option value="all">{t("全部模块")}</option>{Object.keys(categoryLabels).map((key) => <option key={key} value={key}>{categoryName(copy, key as Category)}</option>)}</select></label>
          <label>{t("顺序")}<select value={order} onChange={(e) => { setOrder(e.target.value as "ordered" | "random"); setRandomSeed((s) => s + 1); }}><option value="ordered">{t("教材域有序")}</option><option value="random">{t("随机洗牌")}</option></select></label>
        </div>
      </div>
      <label className="question-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索题号、题干、标签、作者或来源（如 Livy）")} /><span>{pool.length}{t("题")}</span></label>

      {question ? (
        <>
          <div className="question-progress"><span>{copy.questionPosition(index + 1, pool.length)}</span><div><i style={{ width: `${((index + 1) / pool.length) * 100}%` }} /></div><span>{category === "all" ? copy.comprehensive : categoryName(copy, category)}</span></div>
          <QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => onResult(question, status)} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} />
          <div className="question-nav">
            <button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> {copy.previous}</button>
            <button className="primary-button" onClick={() => setIndex((i) => Math.min(pool.length - 1, i + 1))} disabled={index === pool.length - 1}>{copy.next} <ArrowRight size={17} /></button>
          </div>
        </>
      ) : <EmptyState kind="practice" text={copy.noQuestionsForFilter} />}
    </div>
  );
}

function QuestionCard({ question, status, onResult, bookmarked, onBookmark, compact = false }: { question: Question; status?: Progress[string]; onResult: (s: "correct" | "wrong" | "review") => void; bookmarked: boolean; onBookmark: () => void; compact?: boolean }) {
  const t = useInterfaceText();
  const { copy, language } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [translation, setTranslation] = useState("");
  const [optionOrder, setOptionOrder] = useState<number[]>([]);
  const sourceStatusLabel = question.sourceStatus === "original" ? t("原创复核题") : question.sourceStatus === "public-domain" ? t("公版原文") : question.sourceStatus === "official-framework" ? t("官方框架") : null;
  const reviewStatusLabel = question.reviewStatus ? reviewStatusLabels[question.reviewStatus] : null;
  const isMorphologyCheck = question.type === "self-check" && question.category === "morphology";

  useEffect(() => {
    setOptionOrder(shuffle((question.options ?? []).map((_, index) => index)));
  }, [question.id]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (question.type !== "choice" || submitted) return;
      const number = Number(event.key);
      if (number >= 1 && number <= optionOrder.length) setSelected(optionOrder[number - 1]);
      if (event.key === "Enter" && selected !== null) {
        setSubmitted(true);
        onResult(selected === question.answer ? "correct" : "wrong");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onResult, optionOrder, question, selected, submitted]);

  const submit = () => {
    if (selected === null) return;
    setSubmitted(true);
    onResult(selected === question.answer ? "correct" : "wrong");
  };

  return (
    <article className={`question-card ${compact ? "compact" : ""}`}>
      <div className="question-meta">
        <div><span className="level-pill">{levelName(copy, question.level, question.language ?? "la") }</span><span>{categoryName(copy, question.category)}</span>{question.skill && <span className="skill-pill">{question.skill}</span>}{sourceStatusLabel && <span className={`source-status ${question.sourceStatus}`}>{sourceStatusLabel}</span>}{reviewStatusLabel && <span className={`review-status ${question.reviewStatus}`}>{t(reviewStatusLabel)}</span>}<span>·</span>{question.sourceUrl ? <a href={question.sourceUrl} target="_blank" rel="noreferrer">{question.source}</a> : <span>{question.source}</span>}</div>
        <button className={`icon-button bookmark-button ${bookmarked ? "bookmarked" : ""}`} onClick={onBookmark} aria-label={bookmarked ? copy.removeBookmark : copy.bookmarkQuestion} aria-pressed={bookmarked}><Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} /></button>
      </div>
      <h2>{question.prompt}</h2>
      {(question.targetText || question.text || question.latin) && <blockquote lang={question.targetLang ?? language.htmlLang}>{question.targetText ?? question.text ?? question.latin}</blockquote>}
      {question.context && <p className="context-note">{question.context}</p>}

      {question.type === "choice" ? (
        <>
          <div className="option-list" role="radiogroup" aria-label={copy.chooseAnswer}>
            {optionOrder.map((optionIndex, visibleIndex) => {
              const option = question.options?.[optionIndex];
              if (option === undefined) return null;
              const isCorrect = submitted && optionIndex === question.answer;
              const isWrong = submitted && selected === optionIndex && optionIndex !== question.answer;
              return (
                <button key={option} role="radio" aria-checked={selected === optionIndex} className={`option ${selected === optionIndex ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} onClick={() => !submitted && setSelected(optionIndex)} disabled={submitted}>
                  <span className="option-key">{visibleIndex + 1}</span><span>{option}</span>
                  {isCorrect && <Check size={18} />}{isWrong && <X size={18} />}
                </button>
              );
            })}
          </div>
          {!submitted ? <button className="primary-button submit-answer" onClick={submit} disabled={selected === null}>{copy.submitAnswer}</button> : (
            <Feedback correct={selected === question.answer} explanation={question.explanation} distractorExplanations={question.distractorExplanations} />
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
      {status && <div className={`saved-status ${status}`}><CheckCircle2 size={15} /> {copy.recorded} {status === "correct" ? copy.mastered : status === "wrong" ? copy.wrongQuestion : copy.reviewLater}</div>}
      <div className="tag-row">{question.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
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
  const { copy, language } = useI18n();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(180 * 60);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [paperType, setPaperType] = useState<"official" | "diagnostic" | "mixed">("diagnostic");

  useEffect(() => {
    if (language.id !== "la") setPaperType("diagnostic");
    setStarted(false);
    setFinished(false);
    setExamQuestions([]);
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
    if (paperType === "official" && language.id === "la") {
      const matching = bank.filter((q) => q.id.startsWith("pku-mock-") && matchesLevel(q, level));
      const nextQuestions = shuffle(matching).slice(0, 1);
      if (!nextQuestions.length) return;
      setExamQuestions(nextQuestions); setIndex(0); setSeconds(180 * 60); setFinished(false); setStarted(true); return;
    }
    const objective = shuffle(bank.filter((q) => (paperType === "mixed" || matchesLevel(q, level)) && q.type === "choice")).slice(0, 8);
    const translation = shuffle(bank.filter((q) => (paperType === "mixed" || matchesLevel(q, level)) && q.type === "self-check")).slice(0, 1);
    const nextQuestions = [...objective, ...translation];
    if (!nextQuestions.length) return;
    setExamQuestions(nextQuestions); setIndex(0); setSeconds(20 * 60); setFinished(false); setStarted(true);
  };

  const selectableLevels = paperType === "official" ? LEVEL_ORDER.slice(0, 2) : LEVEL_ORDER;
  const plannedQuestions = paperType === "official"
    ? Math.min(1, bank.filter((question) => question.id.startsWith("pku-mock-") && matchesLevel(question, level)).length)
    : Math.min(9, bank.filter((question) => paperType === "mixed" || matchesLevel(question, level)).length);

  if (!started) return (
    <div className="page exam-start">
      <div className="exam-intro-icon"><TimerReset /></div><TargetKicker kind="exam" /><h1>{copy.examTitle}</h1><p>{paperType === "official" ? copy.officialPaperCopy : copy.diagnosticPaperCopy}</p>
      <div className="paper-type">{language.id === "la" && <button className={paperType === "official" ? "active" : ""} onClick={() => { setPaperType("official"); if (normalizePikkuLevel(language.id, level) === "G" || normalizePikkuLevel(language.id, level) === "M") setLevel("C"); }}><Landmark size={17} />{copy.officialPaper}</button>}<button className={paperType === "diagnostic" ? "active" : ""} onClick={() => setPaperType("diagnostic")}><BarChart3 size={17} />{copy.diagnosticPaper}</button><button className={paperType === "mixed" ? "active" : ""} onClick={() => setPaperType("mixed")}><Shuffle size={17} />{copy.elementary === "Core" ? "Mixed-stage practice" : "混合等级组题"}</button></div>
      <div className="exam-facts"><div><Clock3 /><strong>{paperType === "official" ? 180 : 20}</strong><span>{copy.countdownMinutes}</span></div><div><FileText /><strong>{paperType === "official" ? 1 : plannedQuestions}</strong><span>{paperType === "official" ? copy.fullTranslation : copy.diagnosticTasks}</span></div><div><BookOpen /><strong>{paperType === "official" ? "≈180" : normalizePikkuLevel(language.id, level)}</strong><span>{paperType === "official" ? copy.continuousWords : copy.learningStage}</span></div></div>
      <div className="exam-level"><span>{copy.selectDifficulty}</span>{selectableLevels.map((l) => <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>{levelName(copy, l, language.id)}</button>)}</div>
      <button className="primary-button large" onClick={start} disabled={plannedQuestions === 0}>{copy.startExam} <ArrowRight size={18} /></button>
      <p className="fine-print">{copy.unofficialScore}</p>
    </div>
  );

  const doneCount = examQuestions.filter((q) => progress[q.id]).length;
  if (finished) return <div className="page exam-start"><div className="exam-intro-icon"><Trophy /></div><TargetKicker kind="exam" /><h1>{copy.examFinished}</h1><p>{copy.examSummary(doneCount, examQuestions.length)}</p><button className="primary-button large" onClick={start}>{copy.anotherExam} <RotateCcw size={18} /></button></div>;

  const current = examQuestions[index];
  if (!current) return <div className="page exam-start"><TargetKicker kind="exam" /><EmptyState kind="exam" text={copy.noQuestionsForFilter} /><button className="secondary-button" onClick={() => setStarted(false)}>{copy.previous}</button></div>;
  return (
    <div className="page exam-live">
      <div className="exam-toolbar"><div><span>{copy.examLevel(levelName(copy, level, language.id))}</span><strong>{copy.questionPosition(index + 1, examQuestions.length)}</strong></div><div className={`timer ${seconds < 600 ? "urgent" : ""}`}><Clock3 size={18} />{formatTime(seconds)}</div><button className="secondary-button" onClick={() => setFinished(true)}>{copy.submitExam}</button></div>
      <QuestionCard key={current.id} question={current} status={progress[current.id]} onResult={(status) => onResult(current, status)} bookmarked={false} onBookmark={() => {}} />
      <div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> {copy.previous}</button>{index < examQuestions.length - 1 ? <button className="primary-button" onClick={() => setIndex((i) => i + 1)}>{copy.next} <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => setFinished(true)}>{copy.finishExam} <Check size={17} /></button>}</div>
    </div>
  );
}

function VocabularyTrainer({ language, level, mode, stats, onAnswer, setView }: {
  language: LanguageCode;
  level: LanguageLevel;
  mode: VocabularyMode;
  stats: VocabularyStats;
  onAnswer: (language: LanguageCode, answers: { lemma: string; correct: boolean }[]) => void;
  setView: (view: View) => void;
}) {
  const t = useInterfaceText();
  const eligible = useMemo(() => vocabularyCards.filter((card) => card.language === language && vocabularyMatchesLevel(card, level)), [language, level]);
  const coveredLevels = vocabularyLevelsFor(language, level);
  const coverageLabel = coveredLevels.length > 1
    ? `${languageLevelLabels[coveredLevels[0]]}–${languageLevelLabels[coveredLevels.at(-1)!]}`
    : languageLevelLabels[coveredLevels[0]];
  const [cardId, setCardId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [recentlyShown, setRecentlyShown] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  useEffect(() => {
    setCardId(chooseNextVocabularyCard(eligible, stats, [])?.id ?? "");
    setRevealed(false);
    setRecentlyShown([]);
    setSessionTotal(0);
    setSessionCorrect(0);
  }, [eligible]);

  const card = eligible.find((item) => item.id === cardId) ?? eligible[0];
  const totalSeen = eligible.reduce((total, item) => total + (stats[vocabularyKey(item.language, item.term)]?.seen ?? 0), 0);
  const totalCorrect = eligible.reduce((total, item) => total + (stats[vocabularyKey(item.language, item.term)]?.correct ?? 0), 0);

  if (!card) return <div className="page empty-state"><div><BookOpen /></div><h2>{t("本级词库正在整理")}</h2><p>{t("切换等级后再试，或稍后等待词卡扩充。")}</p></div>;

  const remember = (correct: boolean) => {
    const key = vocabularyKey(language, card.term);
    const current = stats[key] ?? { seen: 0, correct: 0 };
    const nextStats = { ...stats, [key]: { seen: current.seen + 1, correct: current.correct + (correct ? 1 : 0) } };
    const nextRecent = [...recentlyShown, card.id].slice(-4);
    const nextCard = chooseNextVocabularyCard(eligible, nextStats, nextRecent);
    onAnswer(language, [{ lemma: card.term, correct }]);
    setRecentlyShown(nextRecent);
    setSessionTotal((total) => total + 1);
    if (correct) setSessionCorrect((total) => total + 1);
    setCardId(nextCard?.id ?? card.id);
    setRevealed(false);
  };

  return <div className="page vocabulary-trainer">
    <div className="practice-header vocab-trainer-header">
      <div><span className="eyebrow">{t("PIKKU ADAPTĪVUM · 连续训练")}</span><h1>{languageLevelLabels[level]}{t("自适应背单词")}</h1><p>{t("当前涵盖")}{coverageLabel}{t("词库。没有每日上限；没记住的词会提高权重，熟词仍会低频复现，最近出现的词会暂时降权。")}</p></div>
      <button className="secondary-button" onClick={() => setView("settings")}><Settings size={16} />{t("显示设置")}</button>
    </div>
    <section className="vocab-session-stats" aria-label={t("背词统计")}>
      <div><span>{t("本轮")}</span><strong>{sessionTotal}</strong><small>{t("次判断")}</small></div>
      <div><span>{t("本轮记得")}</span><strong>{sessionCorrect}</strong><small>{sessionTotal ? `${Math.round(sessionCorrect / sessionTotal * 100)}%` : t("尚未作答")}</small></div>
      <div><span>{t("范围历史")}</span><strong>{totalSeen}</strong><small>{totalSeen ? `${Math.round(totalCorrect / totalSeen * 100)}% ${t("记得")}` : `${eligible.length} ${t("新词卡")}`}</small></div>
    </section>
    <article className="adaptive-vocab-card">
      <span>{languageConfigs[language].nativeName} · {mode === "context" ? t("单词＋语境") : t("纯单词")}</span>
      <h2 lang={language}>{card.term}</h2>
      {mode === "context" && <p className="vocab-context" lang={language}>{card.context}</p>}
      {revealed ? <div className="vocab-reveal"><span>{t("释义")}</span><strong>{card.meaning}</strong></div> : <button className="primary-button vocab-reveal-button" onClick={() => setRevealed(true)}>{t("显示释义")}</button>}
    </article>
    {revealed && <div className="vocab-feedback" aria-label={t("记忆反馈")}>
      <button onClick={() => remember(false)}><XCircle size={19} /><span><strong>{t("忘了")}</strong><small>{t("提高后续出现权重")}</small></span></button>
      <button className="remembered" onClick={() => remember(true)}><CheckCircle2 size={19} /><span><strong>{t("记得")}</strong><small>{t("降低但不永久移除")}</small></span></button>
    </div>}
    <p className="fine-print">{t("Pikku 依据本账号累计的见词次数与记得次数计算透明权重；首版不声称复现任何第三方未公开算法。")}</p>
  </div>;
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
  return <div className="page settings-page">
    <div className="practice-header"><div><span className="eyebrow">RATIO PERSONĀLIS · PERSONAL</span><h1>{t("个人设置")}</h1><p>{t("设置适用于所有学习语言的背词训练；切换语言时无需重复调整。")}</p></div></div>
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
  </div>;
}

function VocabularyLab({ level, onSubmit }: { level: StudyLevel; onSubmit: (answers: { lemma: string; correct: boolean }[]) => void }) {
  const { copy, language } = useI18n();
  const items = useMemo(() => {
    const seen = new Set<string>();
    return allVocabItems.filter((item) => {
      if ((item.language ?? "la") !== language.id || seen.has(item.lemma)) return false;
      seen.add(item.lemma);
      return true;
    });
  }, [language.id]);
  const [test, setTest] = useState<VocabItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const eligible = items.filter((item) => normalizePikkuLevel(language.id, item.level) === normalizePikkuLevel(language.id, level));
  const restart = () => { setTest(shuffle(eligible).slice(0, 20)); setAnswers({}); setFinished(false); };
  useEffect(() => { setTest(shuffle(items.filter((item) => normalizePikkuLevel(language.id, item.level) === normalizePikkuLevel(language.id, level))).slice(0, 20)); setAnswers({}); setFinished(false); }, [items, level]);
  const score = test.filter((item) => answers[item.lemma] === item.gloss).length;
  const submit = () => {
    setFinished(true);
    onSubmit(test.map((item) => ({ lemma: item.lemma, correct: answers[item.lemma] === item.gloss })));
  };

  return <div className="page vocab-page">
    <div className="practice-header"><div><TargetKicker kind="vocabulary" /><h1>{copy.vocabularyTitle}</h1><p>{copy.vocabularyIntro}</p></div><button className="secondary-button" onClick={restart} disabled={!eligible.length}><Shuffle size={16} />{copy.resample}</button></div>
    {!eligible.length ? <EmptyState kind="vocabulary" text={copy.noQuestionsForFilter} /> : <>
    <div className="official-note"><Languages /><div><strong>{copy.vocabularyRound(levelName(copy, level, language.id), test.length)}</strong><p>{copy.vocabularySyncNote}</p></div></div>
    <div className="vocab-grid">
      {test.map((item, index) => {
        const options = [item.gloss, ...item.distractors].sort((a, b) => (a + item.lemma).localeCompare(b + item.lemma));
        return <article className="vocab-item" key={item.lemma}><span>{String(index + 1).padStart(2, "0")} · {item.family}</span><h2 lang={item.htmlLang || language.htmlLang}>{item.lemma}</h2><div>{options.map((option) => <button key={option} disabled={finished} className={`${answers[item.lemma] === option ? "selected" : ""} ${finished && option === item.gloss ? "correct" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [item.lemma]: option }))}>{option}</button>)}</div></article>;
      })}
    </div>
    {!finished ? <button className="primary-button vocab-submit" disabled={Object.keys(answers).length !== test.length} onClick={submit}>{copy.submitMeasure}</button> : <section className="vocab-result"><Trophy /><div><span>{copy.currentResult}</span><h2>{score} / {test.length}</h2><p>{copy.vocabularyEstimate(Math.round((score / Math.max(test.length, 1)) * eligible.length), eligible.length)}</p></div><button className="secondary-button" onClick={restart}>{copy.retest}</button></section>}
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
        <div className="admin-row"><label>{copy.difficulty}<select value={normalizePikkuLevel(language.id, draft.level)} onChange={(e) => setDraft({ ...draft, level: e.target.value as Question["level"] })}>{LEVEL_ORDER.map((v) => <option key={v} value={v}>{levelName(copy, v, language.id)}</option>)}</select></label><label>{copy.module}<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>{Object.keys(categoryLabels).map((v) => <option key={v} value={v}>{categoryName(copy, v as Category)}</option>)}</select></label><label>{copy.questionType}<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Question["type"] })}><option value="choice">{copy.multipleChoice}</option><option value="self-check">{copy.translationSelfCheck}</option></select></label></div>
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
      <div className="scope-grid curriculum-grid">{[...curriculumDomains].filter((domain) => domain.level !== "mixed").sort((a, b) => LEVEL_ORDER.indexOf(normalizePikkuLevel("la", a.level)) - LEVEL_ORDER.indexOf(normalizePikkuLevel("la", b.level))).map((domain) => { const localizedLevel = levelName(copy, domain.level); return <section key={domain.level}><div className="scope-number">{normalizePikkuLevel("la", domain.level)}</div><span>{domain.latin}</span><h2>{localizedLevel}</h2><p className="authors">{domain.authors}</p><p>{domain.examUse}</p><details><summary>{copy.textbookMapping}</summary><p><strong>Wheelock:</strong> {domain.wheelock}</p><p><strong>LLPSI:</strong> {domain.llpsi}</p></details><div className="domain-columns"><div><b>{copy.vocabulary}</b><ul>{domain.vocabulary.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>{copy.morphology}</b><ul>{domain.morphology.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>{copy.syntax}</b><ul>{domain.syntax.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>{copy.sentencePatterns}</b><ul>{domain.patterns.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>{copy.classics}</b><ul>{domain.classics.map((v) => <li key={v}>{v}</li>)}</ul></div></div><button className="secondary-button" onClick={() => openPractice(domain.level, "all")}>{copy.practiceScope(localizedLevel)} <ArrowRight size={17} /></button></section>; })}</div>
      <div className="source-card"><GraduationCap /><div><strong>{levelName(copy, "M", language.id)}</strong><p>{copy.languageContentInProgress(language.labels[locale])}</p><button className="secondary-button" onClick={() => openPractice("M", "all")}>{copy.practiceScope(levelName(copy, "M", language.id))}<ArrowRight size={17} /></button></div></div>
      <section className="coverage-section"><div className="section-heading"><div><TargetKicker kind="courses" /><h2>{copy.coverageMatrix}</h2></div></div><p>{copy.coverageIntro}</p><div className="coverage-books">{(["Wheelock", "LLPSI"] as const).map((book) => <details key={book}><summary><strong>{book}</strong><span>{textbookCoverage.filter((unit) => unit.book === book).length} {copy.chaptersClick}</span></summary><div>{textbookCoverage.filter((unit) => unit.book === book).map((unit) => <article key={`${book}-${unit.chapter}`}><b>{unit.chapter}</b><span>{unit.title}</span><p>{unit.topics}</p><small>{stageName(copy, unit.stage)} · {levelName(copy, unit.examDomain)}</small></article>)}</div></details>)}</div></section>
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
            <div className="archive-content"><span>{archiveLevelName(copy, entry.levels)}</span><p>{entry.verified}</p><a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceLabel} <ArrowRight size={13} /></a></div>
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

function ResourceLibrary({ language, config }: { language: LanguageCode; config: LanguageConfig }) {
  const { copy, locale } = useI18n();
  const languageName = getLearningLanguage(language).labels[locale];
  const t = useInterfaceText();
  const [tab, setTab] = useState<"textbooks" | "authors" | "dictionary" | "etymology">("textbooks");
  const [query, setQuery] = useState("");
  const [lexiconBatch, setLexiconBatch] = useState("all");
  const [lexiconReviewStatus, setLexiconReviewStatus] = useState<"all" | ReviewStatus>("all");
  const textbooks = textbookCatalog.filter((book) => book.targetLanguage === language);
  const chapterMappings = resourceChapterMappings.filter((mapping) => mapping.targetLanguage === language);
  const periods = language === "la" ? [...new Set(classicalAuthors.map((author) => author.period))] : [];
  const languageLexicon = lexiconSeed.filter((entry) => entry.language === language);
  const lexiconBatches = [...new Set(languageLexicon.map((entry) => entry.batch))];
  const lexicon = languageLexicon.filter((entry) =>
    (lexiconBatch === "all" || entry.batch === lexiconBatch)
    && (lexiconReviewStatus === "all" || entry.reviewStatus === lexiconReviewStatus)
    && `${entry.lemma} ${entry.principalParts} ${entry.gloss} ${entry.derivatives.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const latestLexiconBatch = languageLexicon.reduce((latest, entry) => entry.addedOn && entry.addedOn > latest ? entry.addedOn : latest, "");
  const weeklyLexiconCount = languageLexicon.filter((entry) => entry.addedOn === latestLexiconBatch).length;
  const currentFacts = languageFacts[language] ?? [];

  useEffect(() => {
    setQuery("");
    setLexiconBatch("all");
    setLexiconReviewStatus("all");
  }, [language]);

  return <div className="page resource-page">
    <div className="practice-header"><div><span className="eyebrow">PIKKU RESOURCES · {config.nativeName}</span><h1>{languageName}{t("教材、作者与辞典")}</h1><p>{t("当前页面只显示")}{languageName}{t("资源；切换学习语言后，教材、作者、词条和语言知识会同步切换。")}</p></div></div>
    <div className="resource-tabs" role="tablist">
      {([['textbooks', t("教材对齐")], ['authors', t("作者图谱")], ['dictionary', `${languageName} · ${t("词典")}`], ['etymology', t("语言知识")]] as const).map(([id, label]) => <button role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === "textbooks" && <>
      <div className="source-card"><BookOpen /><div><strong>{t("版权与改编原则")}</strong><p>{t("只索引官方页面、公版文献和合法预览。版权教材用于知识点与考纲映射，公开题库发布原创题目，不上传来源不明的 PDF，也不复刻整章练习。")}</p></div></div>
      <div className="textbook-grid">{textbooks.map((book) => <article key={book.id}><div className="resource-card-head"><span>{book.access}</span><small>{book.edition}</small></div><h2>{book.title}</h2><p className="resource-byline">{book.authors}</p><p>{book.accessNote}</p><details><summary>{t("难度域映射")}</summary><dl><dt>{levelName(copy, "C", language)}</dt><dd>{book.alignment.elementary}</dd><dt>{levelName(copy, "F", language)}</dt><dd>{book.alignment.intermediate}</dd><dt>{levelName(copy, "G", language)}</dt><dd>{book.alignment.advanced}</dd><dt>{levelName(copy, "M", language)}</dt><dd>{copy.languageContentInProgress(languageName)}</dd></dl></details><div className="tag-row">{book.strengths.map((item) => <span key={item}>{item}</span>)}</div></article>)}</div>
      {!textbooks.length && <div className="empty-state"><div><BookOpen /></div><h2>{languageName}{t("教材待建")}</h2><p>{t("当前模式不会借用拉丁语教材；核验书目与课程映射后再加入。")}</p></div>}
      <div className="section-heading resource-map-heading"><div><span>INDEX CAPITULŌRUM</span><h2>{t("章节与原创练习映射")}</h2></div><small>{t("只含元数据，不包含教材正文、答案或音频")}</small></div>
      <div className="chapter-map-grid">{chapterMappings.map((mapping) => <article key={mapping.id}><div><span>{mapping.publicDomainStatus}</span><small>{mapping.chapter}</small></div><h3>{mapping.title}</h3><p><strong>{t("语法域")}</strong>{mapping.grammarTargets.join(" · ")}</p><p><strong>{t("词汇域")}</strong>{mapping.vocabularyTargets.join(" · ")}</p><p><strong>{t("原创化逻辑")}</strong>{mapping.exerciseLogic}</p><small>{mapping.licenseNote}</small></article>)}</div>
      {!chapterMappings.length && <div className="empty-state"><div><Library /></div><h2>{t("尚无章节映射")}</h2><p>{languageName}{t("章节元数据仍在核验，不显示其他语言的占位内容。")}</p></div>}
    </>}
    {tab === "authors" && language === "la" && <>
      <div className="resource-metrics"><div><strong>{classicalAuthors.length}</strong><span>{t("位首批作者")}</span></div><div><strong>{classicalAuthors.reduce((total, author) => total + author.works.length, 0)}</strong><span>{t("条作者—作品关系")}</span></div><div><strong>{periods.length}</strong><span>{t("个历史分期")}</span></div></div>
      <div className="author-timeline">{periods.map((period) => <section key={period}><h2>{period}</h2><div>{classicalAuthors.filter((author) => author.period === period).map((author) => <article key={author.id}><span>{author.dates}</span><h3>{author.name}</h3><p>{author.chinese} · {author.genres.join("／")}</p><ul>{author.works.map((work) => <li key={work}>{work}</li>)}</ul><small>{t("建议域：")}{levelName(copy, author.examLevel, language)}</small></article>)}</div></section>)}</div>
    </>}
    {tab === "authors" && language !== "la" && <div className="empty-state"><div><Users /></div><h2>{languageName}{t("作者图谱待建")}</h2><p>{t("当前模式不会借用拉丁语作者数据；按语言与时代核验后再加入。")}</p></div>}
    {tab === "dictionary" && <>
      <div className="resource-metrics"><div><strong>{lexicon.length}<small> / {languageLexicon.length}</small></strong><span>{t("当前筛选／")}{languageName}{t("词条")}</span></div><div><strong>{weeklyLexiconCount}</strong><span>{t("最近一批新增")}{latestLexiconBatch ? ` · ${latestLexiconBatch}` : ""}</span></div><div><strong>{languageLexicon.length}</strong><span>{config.nativeName}{t("已建词条")}</span></div></div>
      <div className="lexicon-filters">
        <label>{t("批次")}<select value={lexiconBatch} onChange={(event) => setLexiconBatch(event.target.value)}><option value="all">{t("全部批次")}</option>{lexiconBatches.map((batch) => <option key={batch} value={batch}>{batch === "foundation" ? t("基础词库") : batch}</option>)}</select></label>
        <label>{t("内容状态")}<select value={lexiconReviewStatus} onChange={(event) => setLexiconReviewStatus(event.target.value as "all" | ReviewStatus)}><option value="all">{t("全部状态")}</option>{(Object.keys(reviewStatusLabels) as ReviewStatus[]).map((status) => <option key={status} value={status}>{t(reviewStatusLabels[status])}</option>)}</select></label>
      </div>
      <div className="source-card"><CircleHelp /><div><strong>{t("词条核验规则")}</strong><p>{language === "la" ? t("每周复盘先收录本周实际接触但尚未入库的词汇，再逐条核对词典形、语义、词源与例句；下列五种拉丁语辞典分别记录核验状态。") : (locale === "en" ? `Only ${languageName} entries are shown. Language-specific dictionary sources are being checked.` : `这里只显示${languageName}词条；专项词典来源仍在核验。`)}</p></div></div>
      {language === "la" && <div className="dictionary-sources">{dictionarySources.map((source) => <article key={source.id}><strong>{source.name}</strong><p>{source.scope}</p><small>{source.access}</small></article>)}</div>}
      <label className="resource-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索词头、读音、中文义或派生词")} /></label>
      <div className="lexicon-list">{lexicon.map((entry) => <article id={`lexicon-${entry.language}-${entry.lemma}`} key={`${entry.language}-${entry.lemma}`}><div><small className="lexicon-language">{entry.language.toUpperCase()}</small><h2>{entry.lemma}</h2><span>{entry.principalParts}</span><b>{entry.gloss}</b></div><p><strong>{t("词源线索")}</strong>{entry.pie}</p><p><strong>{t("派生／用法提示")}</strong>{entry.derivatives.length ? entry.derivatives.join(" · ") : t("待补充")}</p><div className="dictionary-checks lexicon-workflow"><span className={`review-status ${entry.reviewStatus}`}>{t(reviewStatusLabels[entry.reviewStatus])}</span><span>{t("批次 ·")}{entry.batch === "foundation" ? t("基础词库") : entry.batch}</span></div>{entry.language === "la" ? <div className="dictionary-checks">{dictionarySources.map((source) => <span key={source.id}>{source.id.toUpperCase()} · {entry.dictionaryStatus[source.id]}</span>)}</div> : <div className="dictionary-checks"><span>{t("专项词典 · 待核")}</span>{entry.addedOn && <span>{t("周复盘新增 ·")}{entry.addedOn}</span>}</div>}</article>)}</div>
      {!lexicon.length && <div className="empty-state"><div><Search /></div><h2>{t("没有匹配词条")}</h2><p>{t("换一个关键词、批次或内容状态；当前页面只查询")}{languageName}{t("词库。")}</p></div>}
    </>}
    {tab === "etymology" && <>
      <div className="etymology-progress"><Sparkles /><div><strong>{language === "la" ? etymologyFacts.length : currentFacts.length} / 365</strong><p>{language === "la" ? t("现有词源知识已接入首页随机栏目；后续按拉丁词、后裔词、语义变化与来源逐条扩充。") : (locale === "en" ? `Only ${languageName} language notes are shown, with source links.` : `当前只显示${languageName}语言知识，并保留可点击来源。`)}</p></div></div>
      {language === "la" ? <div className="fact-library">{etymologyFacts.map((fact, index) => <article key={`${fact.latin}-${index}`}><span>DIES {String(index + 1).padStart(3, "0")}</span><h2>{fact.latin} · {fact.meaning}</h2><p>{fact.note}</p><small>{t("英语：")}{fact.english.join(" · ")}{t("罗曼语：")}{fact.romance.join(" · ")}</small></article>)}</div> : <div className="fact-library">{currentFacts.map((fact, index) => <article key={fact.id}><span>{fact.kind} · {String(index + 1).padStart(3, "0")}</span><h2>{fact.title}</h2><p>{fact.summary}</p><small>{fact.example}　{fact.sources.map((source, sourceIndex) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{sourceIndex > 0 && " · "}{source.label}</a>)}</small></article>)}</div>}
      {language !== "la" && !currentFacts.length && <div className="empty-state"><div><Sparkles /></div><h2>{languageName}{t("语言知识待建")}</h2><p>{t("核验来源后再加入，不显示拉丁语占位内容。")}</p></div>}
    </>}
  </div>;
}

function CommunityPreview({ config }: { config: LanguageConfig }) {
  const { locale } = useI18n();
  const languageName = getLearningLanguage(config.code).labels[locale];
  const t = useInterfaceText();
  const channel = {
    la: ["CANĀLIS LATĪNUS", t("公共拉丁语频道"), t("正文只使用拉丁语。可交流日常、阅读原典、主动拉丁语写作与翻译；引用其他语言时需附拉丁语说明。")],
    ja: ["日本語チャンネル", t("日语限定频道"), t("正文只使用日语。可交流日常、阅读、写作和翻译；引用其他语言时需附日语说明。")],
    es: ["CANAL EN ESPAÑOL", t("西班牙语限定频道"), t("正文只使用西班牙语。可交流日常、阅读、写作和翻译；引用其他语言时需附西班牙语说明。")],
  }[config.code as "la" | "ja" | "es"] ?? [config.nativeName, `${languageName} · ${t("频道")}`, t("在这里分享学习方法与目标语言练习。")] ;

  return <div className="page community-page"><div className="practice-header"><div><span className="eyebrow">FORUM PIKKU · {config.nativeName}</span><h1>{languageName}{t("交流社区")}</h1><p>{t("频道结构已预留；账号、举报、限流与审核规则完成后再开放发帖。")}</p></div></div><div className="community-grid"><article><Languages /><span>{channel[0]}</span><h2>{channel[1]}</h2><p>{channel[2]}</p><button disabled>{t("即将开放")}</button></article><article><Users /><span>PIKKU · SITE &amp; STUDY</span><h2>{t("网站与学习频道")}</h2><p>{t("可使用界面语言，只讨论网站设计、功能优化、报错、学习方法和使用心得。")}</p><button disabled>{t("即将开放")}</button></article></div><div className="source-card"><CircleHelp /><div><strong>{t("为什么暂不直接开放？")}</strong><p>{t("公共社区需要先具备内容举报、管理员审核、频率限制、隐私说明和数据保留规则，避免测试功能变成安全缺口。")}</p></div></div></div>;
}

function EmptyState({ text }: { text: string; kind?: string }) {
  const t = useInterfaceText();
  return <div className="empty-state"><div><BookOpen /></div><h2>{t("暂无内容")}</h2><p>{text}</p></div>;
}
