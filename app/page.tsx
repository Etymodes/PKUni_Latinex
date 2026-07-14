"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
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
  Languages,
  ListOrdered,
  LogIn,
  LogOut,
  Menu,
  RotateCcw,
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
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  categoryLabels,
  levelLabels,
  matchesLevel,
  questions,
  type Category,
  type Level,
  type Question,
} from "@/data/questions";
import { archiveEntries } from "@/data/archive";
import { curriculumDomains, etymologyFacts, textbookCoverage, vocabItems } from "@/data/curriculum";
import { completeBankStats, completeQuestions, completeVocabItems } from "@/data/complete-bank";

type View = "home" | "practice" | "mistakes" | "bookmarks" | "exam" | "vocabulary" | "scope" | "archive" | "admin";
type Progress = Record<string, "correct" | "wrong" | "review">;
type Session = { authenticated: boolean; persistence?: boolean; user: null | { email: string; name: string; role: "student" | "admin" } };
type Override = { id: string; deleted: boolean; question: Question | null };

const STORAGE = {
  progress: "latin-practica-progress-v1",
  bookmarks: "latin-practica-bookmarks-v1",
  streak: "latin-practica-last-study-v1",
};

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

  return [value, setValue] as const;
}

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const staticQuestions = [...questions, ...completeQuestions];
const allVocabItems = [...vocabItems, ...completeVocabItems];
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isStaticPublic = process.env.NEXT_PUBLIC_STATIC_PUBLIC === "true";
const assetPath = (path: string) => `${publicBasePath}${path}`;

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [level, setLevel] = useState<Level>("elementary");
  const [category, setCategory] = useState<Category | "all">("all");
  const [progress, setProgress] = usePersistentState<Progress>(STORAGE.progress, {});
  const [bookmarks, setBookmarks] = usePersistentState<string[]>(STORAGE.bookmarks, []);
  const [mobileNav, setMobileNav] = useState(false);
  const [session, setSession] = useState<Session>({ authenticated: false, user: null });
  const [overrides, setOverrides] = useState<Override[]>([]);

  useEffect(() => {
    if (isStaticPublic) return;
    Promise.all([
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/questions").then((r) => r.ok ? r.json() : { overrides: [] }),
    ]).then(([me, remote]) => {
      if (me) setSession(me);
      setOverrides(remote?.overrides || []);
      if (me?.authenticated) {
        fetch("/api/stats").then((r) => r.ok ? r.json() : null).then((stats) => {
          if (stats?.progress) setProgress((local) => ({ ...local, ...stats.progress }));
        });
      }
    }).catch(() => { /* Static preview and anonymous practice remain usable. */ });
  }, [setProgress]);

  const questionBank = useMemo(() => {
    const map = new Map(staticQuestions.map((question) => [question.id, question]));
    overrides.forEach((override) => override.deleted ? map.delete(override.id) : override.question && map.set(override.id, override.question));
    return [...map.values()];
  }, [overrides]);

  const recordProgress = (question: Question, status: Progress[string]) => {
    setProgress((current) => ({ ...current, [question.id]: status }));
    if (session.authenticated) fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: question.id, status, level: question.level, category: question.category }) }).catch(() => {});
  };

  const answered = Object.keys(progress).length;
  const correct = Object.values(progress).filter((v) => v === "correct").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const openPractice = (nextLevel = level, nextCategory: Category | "all" = "all") => {
    setLevel(nextLevel);
    setCategory(nextCategory);
    setView("practice");
    setMobileNav(false);
  };

  const navItems: { id: View; label: string; icon: typeof Home; count?: number }[] = [
    { id: "home", label: "今日概览", icon: Home },
    { id: "practice", label: "有序选题", icon: ListOrdered },
    { id: "exam", label: "随机组卷", icon: Shuffle },
    { id: "vocabulary", label: "词汇量测量", icon: Languages },
    { id: "mistakes", label: "错题回炉", icon: RotateCcw, count: Object.values(progress).filter((v) => v === "wrong" || v === "review").length },
    { id: "bookmarks", label: "我的收藏", icon: Bookmark, count: bookmarks.length },
    { id: "archive", label: "真题档案", icon: History },
    { id: "scope", label: "考试范围", icon: ScrollText },
    ...(session.user?.role === "admin" ? [{ id: "admin" as View, label: "管理员后台", icon: Settings }] : []),
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="主导航">
        <div className="brand">
          <div className="brand-mark"><img src={assetPath("/pkuni-latinex-logo-final.png")} alt="" /></div>
          <div>
            <strong>比丘拟</strong>
            <span>PKUni_LATINEX</span>
          </div>
          <button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={20} /></button>
        </div>

        <div className="level-switch" aria-label="选择练习级别">
          {(["elementary", "intermediate", "mixed", "advanced"] as Level[]).map((item) => (
            <button key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)} aria-pressed={level === item}>
              {levelLabels[item]}
            </button>
          ))}
        </div>

        <nav className="nav-list">
          <p className="nav-kicker">学习台</p>
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button key={id} className={view === id ? "nav-item active" : "nav-item"} onClick={() => { setView(id); setMobileNav(false); }}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {typeof count === "number" && count > 0 && <b>{count}</b>}
            </button>
          ))}
        </nav>

        <div className="mascot-note">
          <img src={assetPath("/pkuni-latinex-logo-final.png")} alt="哔丘 Pikku 做翅膀赞" />
          <div><strong>哔丘 Pikku</strong><span>你的拉丁文刷题搭子</span></div>
        </div>
        <div className="sidebar-note">
          <GraduationCap size={20} />
          <div><strong>非官方训练工具</strong><span>依据北大公开考试范围编排，题目均为仿真练习。</span></div>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={21} /></button>
          <div className="topbar-title">
            <span className="breadcrumb">拉丁语标准化考试训练</span>
            <strong>{navItems.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-stats" aria-label="学习统计">
            <span><Flame size={17} /> 今日目标 <b>{Math.min(answered, 12)}/12</b></span>
            <span><Target size={17} /> 正确率 <b>{accuracy}%</b></span>
          </div>
          <a className="repo-link" href="https://github.com/Etymodes/PKUni_Latinex" target="_blank" rel="noreferrer" title="查看原始 GitHub 仓库"><GitBranch size={16} /><span>源代码</span></a>
          <Account session={session} />
        </header>

        <main id="main-content">
          {view === "home" && <Dashboard bank={questionBank} level={level} progress={progress} bookmarks={bookmarks} openPractice={openPractice} setView={setView} />}
          {view === "practice" && <Practice bank={questionBank} level={level} setLevel={setLevel} category={category} setCategory={setCategory} progress={progress} onResult={recordProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "mistakes" && <QuestionCollection title="错题回炉" empty="还没有错题。先完成一组练习吧。" questions={questionBank.filter((q) => progress[q.id] === "wrong" || progress[q.id] === "review")} progress={progress} onResult={recordProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "bookmarks" && <QuestionCollection title="我的收藏" empty="尚未收藏题目。练习时点击书签即可加入。" questions={questionBank.filter((q) => bookmarks.includes(q.id))} progress={progress} onResult={recordProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "exam" && <ExamMode bank={questionBank} level={level} setLevel={setLevel} progress={progress} onResult={recordProgress} />}
          {view === "vocabulary" && <VocabularyLab level={level} session={session} />}
          {view === "scope" && <Scope openPractice={openPractice} />}
          {view === "archive" && <Archive />}
          {view === "admin" && session.user?.role === "admin" && <AdminPanel bank={questionBank} onChanged={() => fetch("/api/questions").then((r) => r.json()).then((data) => setOverrides(data.overrides || []))} />}
        </main>
      </div>
    </div>
  );
}

function Account({ session }: { session: Session }) {
  if (isStaticPublic) return <span className="public-badge"><User size={15} /><span>公开版 · 本机记录</span></span>;
  if (!session.authenticated || !session.user) return <a className="account-button" href="/signin-with-chatgpt?return_to=/"><LogIn size={16} /><span>登录 / 注册</span></a>;
  return <div className="account-menu"><User size={16} /><span><strong>{session.user.name}</strong><small>{session.user.role === "admin" ? "管理员" : "学习账号"}</small></span><a href="/signout-with-chatgpt?return_to=/" title="退出后可切换 ChatGPT 账号"><LogOut size={15} />退出 / 换号</a></div>;
}

function Dashboard({ bank, level, progress, bookmarks, openPractice, setView }: { bank: Question[]; level: Level; progress: Progress; bookmarks: string[]; openPractice: (l?: Level, c?: Category | "all") => void; setView: (v: View) => void }) {
  const levelQs = bank.filter((q) => matchesLevel(q, level));
  const done = levelQs.filter((q) => progress[q.id]).length;
  const right = levelQs.filter((q) => progress[q.id] === "correct").length;
  const percent = levelQs.length ? Math.round((done / levelQs.length) * 100) : 0;
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * etymologyFacts.length));
  const fact = etymologyFacts[factIndex];

  const modes = [
    { category: "morphology" as Category, icon: Layers3, title: "形态快练", latin: "Fōrmae", copy: "变格、变位与不规则词形", meta: `${bank.filter((q) => matchesLevel(q, level) && q.category === "morphology").length} 题` },
    { category: "syntax" as Category, icon: ScrollText, title: "句法拆解", latin: "Syntaxis", copy: "从主干定位到从句层级", meta: `${bank.filter((q) => matchesLevel(q, level) && q.category === "syntax").length} 题` },
    { category: "classics" as Category, icon: Landmark, title: "古典阅读", latin: "Auctōrēs", copy: "按作者语体定位句子骨架", meta: `${bank.filter((q) => matchesLevel(q, level) && q.category === "classics").length} 题` },
  ];

  return (
    <div className="page dashboard-page">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="eyebrow"><Sparkles size={14} /> Cotīdiē paulum · 每日精进</span>
          <h1>Salvē，今天从一段<br /><em>拉丁文</em>开始。</h1>
          <p>围绕北京大学公开的{levelLabels[level]}拉丁语考试范围，练习词典回溯、句法识别与原文翻译。</p>
          <div className="welcome-actions">
            <button className="primary-button" onClick={() => openPractice(level, "all")}>继续今日练习 <ArrowRight size={17} /></button>
            <button className="text-button" onClick={() => setView("scope")}>查看考试范围 <ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="progress-seal" aria-label={`${levelLabels[level]}进度 ${percent}%`}>
          <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
            <circle className="track" cx="60" cy="60" r="48" />
            <circle className="meter" cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${percent} 100`} />
          </svg>
          <div><strong>{percent}%</strong><span>{levelLabels[level]}进度</span></div>
        </div>
      </section>

      <section className="etymology-card">
        <div><span className="eyebrow"><Languages size={14} /> RADĪX HODIERNA · 今日词源</span><h2>{fact.latin} <small>{fact.meaning}</small></h2><p>{fact.note}</p></div>
        <div className="word-family"><span>英语</span><strong>{fact.english.join(" · ")}</strong><span>罗曼语族</span><strong>{fact.romance.join(" · ")}</strong></div>
        <button className="secondary-button" onClick={() => setFactIndex((factIndex + 1) % etymologyFacts.length)}>换一条 <Shuffle size={15} /></button>
      </section>

      <section className="stat-grid" aria-label="学习概览">
        <div className="stat-card"><div className="stat-icon"><CheckCircle2 /></div><div><span>已完成</span><strong>{done}<small> / {levelQs.length}</small></strong></div><p>本级题库</p></div>
        <div className="stat-card"><div className="stat-icon"><Target /></div><div><span>答对</span><strong>{right}<small> 题</small></strong></div><p>{done ? Math.round(right / done * 100) : 0}% 命中</p></div>
        <div className="stat-card"><div className="stat-icon"><Bookmark /></div><div><span>已收藏</span><strong>{bookmarks.length}<small> 题</small></strong></div><p>随时复习</p></div>
        <div className="stat-card"><div className="stat-icon"><Clock3 /></div><div><span>正式时长</span><strong>180<small> min</small></strong></div><p>约 180 词英译</p></div>
      </section>

      <div className="section-heading">
        <div><span>STUDIA HODIERNA</span><h2>今日训练</h2></div>
        <button className="text-button" onClick={() => openPractice(level, "all")}>全部题目 <ArrowRight size={16} /></button>
      </div>
      <section className="mode-grid">
        {modes.map(({ category, icon: Icon, title, latin, copy, meta }, index) => (
          <button className="mode-card" key={category} onClick={() => openPractice(level, category)}>
            <div className="mode-number">0{index + 1}</div>
            <div className="mode-icon"><Icon /></div>
            <span className="latin-label">{latin}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
            <div className="mode-footer"><span>{meta}</span><ArrowRight size={17} /></div>
          </button>
        ))}
      </section>

      <section className="exam-banner">
        <div className="banner-icon"><Trophy /></div>
        <div><span>SIMULATIO EXAMINIS</span><h2>准备好做一次完整模拟了吗？</h2><p>180 分钟倒计时，包含客观诊断题与一段完整翻译任务。</p></div>
        <button className="secondary-button" onClick={() => setView("exam")}>进入模拟 <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}

function Practice({ bank, level, setLevel, category, setCategory, progress, onResult, bookmarks, setBookmarks }: { bank: Question[]; level: Level; setLevel: (l: Level) => void; category: Category | "all"; setCategory: (c: Category | "all") => void; progress: Progress; onResult: (q: Question, s: Progress[string]) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const [order, setOrder] = useState<"ordered" | "random">("ordered");
  const [randomSeed, setRandomSeed] = useState(0);
  const pool = useMemo(() => {
    const selected = bank.filter((q) => matchesLevel(q, level) && (category === "all" || q.category === category));
    return order === "random" ? shuffle(selected) : selected;
  }, [bank, level, category, order, randomSeed]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [level, category]);
  const question = pool[index];

  return (
    <div className="page practice-page">
      <div className="practice-header">
        <div><span className="eyebrow">EXERCITĀTIŌ</span><h1>专项练习</h1><p>每题提交后立即查看词形依据与句法解释。</p></div>
        <div className="filter-row">
          <label>难度<select value={level} onChange={(e) => setLevel(e.target.value as Level)}><option value="elementary">初级</option><option value="intermediate">中级</option><option value="mixed">混合难度</option><option value="advanced">进阶</option></select></label>
          <label>模块<select value={category} onChange={(e) => setCategory(e.target.value as Category | "all")}><option value="all">全部模块</option>{Object.entries(categoryLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label>顺序<select value={order} onChange={(e) => { setOrder(e.target.value as "ordered" | "random"); setRandomSeed((s) => s + 1); }}><option value="ordered">教材域有序</option><option value="random">随机洗牌</option></select></label>
        </div>
      </div>

      {question ? (
        <>
          <div className="question-progress"><span>第 {index + 1} / {pool.length} 题</span><div><i style={{ width: `${((index + 1) / pool.length) * 100}%` }} /></div><span>{category === "all" ? "综合" : categoryLabels[category]}</span></div>
          <QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => onResult(question, status)} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} />
          <div className="question-nav">
            <button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> 上一题</button>
            <button className="primary-button" onClick={() => setIndex((i) => Math.min(pool.length - 1, i + 1))} disabled={index === pool.length - 1}>下一题 <ArrowRight size={17} /></button>
          </div>
        </>
      ) : <EmptyState text="这个筛选组合暂时没有题目。" />}
    </div>
  );
}

function QuestionCard({ question, status, onResult, bookmarked, onBookmark, compact = false }: { question: Question; status?: Progress[string]; onResult: (s: "correct" | "wrong" | "review") => void; bookmarked: boolean; onBookmark: () => void; compact?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [translation, setTranslation] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (question.type !== "choice" || submitted) return;
      const number = Number(event.key);
      if (number >= 1 && number <= (question.options?.length || 0)) setSelected(number - 1);
      if (event.key === "Enter" && selected !== null) {
        setSubmitted(true);
        onResult(selected === question.answer ? "correct" : "wrong");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onResult, question, selected, submitted]);

  const submit = () => {
    if (selected === null) return;
    setSubmitted(true);
    onResult(selected === question.answer ? "correct" : "wrong");
  };

  return (
    <article className={`question-card ${compact ? "compact" : ""}`}>
      <div className="question-meta">
        <div><span className="level-pill">{levelLabels[question.level]}</span><span>{categoryLabels[question.category]}</span><span>·</span><span>{question.source}</span></div>
        <button className={`icon-button bookmark-button ${bookmarked ? "bookmarked" : ""}`} onClick={onBookmark} aria-label={bookmarked ? "取消收藏" : "收藏题目"} aria-pressed={bookmarked}><Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} /></button>
      </div>
      <h2>{question.prompt}</h2>
      {question.latin && <blockquote lang="la">{question.latin}</blockquote>}
      {question.context && <p className="context-note">{question.context}</p>}

      {question.type === "choice" ? (
        <>
          <div className="option-list" role="radiogroup" aria-label="选择答案">
            {question.options?.map((option, optionIndex) => {
              const isCorrect = submitted && optionIndex === question.answer;
              const isWrong = submitted && selected === optionIndex && optionIndex !== question.answer;
              return (
                <button key={option} role="radio" aria-checked={selected === optionIndex} className={`option ${selected === optionIndex ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`} onClick={() => !submitted && setSelected(optionIndex)} disabled={submitted}>
                  <span className="option-key">{optionIndex + 1}</span><span>{option}</span>
                  {isCorrect && <Check size={18} />}{isWrong && <X size={18} />}
                </button>
              );
            })}
          </div>
          {!submitted ? <button className="primary-button submit-answer" onClick={submit} disabled={selected === null}>提交答案</button> : (
            <Feedback correct={selected === question.answer} explanation={question.explanation} />
          )}
        </>
      ) : (
        <div className="self-check">
          <label htmlFor={`translation-${question.id}`}>你的译文</label>
          <textarea id={`translation-${question.id}`} value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="先找谓语和主句骨架，再逐层处理从句……" rows={compact ? 4 : 6} />
          {!revealed ? <button className="primary-button" onClick={() => setRevealed(true)} disabled={!translation.trim()}>对照参考译文</button> : (
            <div className="model-answer">
              <span>参考译文</span><p>{question.modelAnswer}</p>
              <div className="analysis-box"><CircleHelp size={19} /><p>{question.explanation}</p></div>
              <div className="self-rating"><span>这句掌握了吗？</span><button className="success-button" onClick={() => onResult("correct")}><CheckCircle2 size={17} /> 基本掌握</button><button className="secondary-button" onClick={() => onResult("review")}><RotateCcw size={17} /> 需要复习</button></div>
            </div>
          )}
        </div>
      )}
      {status && <div className={`saved-status ${status}`}><CheckCircle2 size={15} /> 已记录：{status === "correct" ? "掌握" : status === "wrong" ? "错题" : "待复习"}</div>}
      <div className="tag-row">{question.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function Feedback({ correct, explanation }: { correct: boolean; explanation: string }) {
  return <div className={`feedback ${correct ? "correct" : "wrong"}`}><div>{correct ? <CheckCircle2 /> : <XCircle />}<strong>{correct ? "Recte! 回答正确" : "再看一次形态线索"}</strong></div><p>{explanation}</p></div>;
}

function QuestionCollection({ title, empty, questions: items, progress, onResult, bookmarks, setBookmarks }: { title: string; empty: string; questions: Question[]; progress: Progress; onResult: (q: Question, s: Progress[string]) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items.length]);
  if (!items.length) return <div className="page"><div className="practice-header"><div><span className="eyebrow">REPETĪTIŌ</span><h1>{title}</h1></div></div><EmptyState text={empty} /></div>;
  const question = items[Math.min(index, items.length - 1)];
  return <div className="page"><div className="practice-header"><div><span className="eyebrow">REPETĪTIŌ</span><h1>{title}</h1><p>共 {items.length} 题，按顺序逐一处理。</p></div></div><div className="question-progress"><span>第 {index + 1} / {items.length} 题</span><div><i style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div></div><QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => onResult(question, status)} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} /><div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> 上一题</button><button className="primary-button" onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))} disabled={index === items.length - 1}>下一题 <ArrowRight size={17} /></button></div></div>;
}

function ExamMode({ bank, level, setLevel, progress, onResult }: { bank: Question[]; level: Level; setLevel: (l: Level) => void; progress: Progress; onResult: (q: Question, s: Progress[string]) => void }) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(180 * 60);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [paperType, setPaperType] = useState<"official" | "diagnostic">("official");

  useEffect(() => {
    if (!started || finished || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, finished, seconds]);
  useEffect(() => { if (seconds === 0 && started) setFinished(true); }, [seconds, started]);

  const start = () => {
    if (paperType === "official") {
      const matching = bank.filter((q) => q.id.startsWith("pku-mock-") && (level === "mixed" ? q.level !== "advanced" : q.level === level));
      const fallback = bank.filter((q) => q.id.startsWith("pku-mock-"));
      setExamQuestions(shuffle(matching.length ? matching : fallback).slice(0, 1)); setIndex(0); setSeconds(180 * 60); setFinished(false); setStarted(true); return;
    }
    const objective = shuffle(bank.filter((q) => matchesLevel(q, level) && q.type === "choice")).slice(0, 8);
    const translation = shuffle(bank.filter((q) => matchesLevel(q, level) && q.type === "self-check")).slice(0, 1);
    setExamQuestions([...objective, ...translation]); setIndex(0); setSeconds(180 * 60); setFinished(false); setStarted(true);
  };

  if (!started) return (
    <div className="page exam-start">
      <div className="exam-intro-icon"><TimerReset /></div><span className="eyebrow">SIMULATIO EXAMINIS</span><h1>180 分钟随机组卷</h1><p>{paperType === "official" ? "北大制式只抽取一篇约 180 词的连续原文英译任务，作者语体按初级 Caesar/Nepos、中级 Sallust/Cicero 编排。" : "诊断组卷以 8 道客观题检查词汇、形态和句法，再进入一段短篇翻译自评。"}</p>
      <div className="paper-type"><button className={paperType === "official" ? "active" : ""} onClick={() => setPaperType("official")}><Landmark size={17} />北大正式制式</button><button className={paperType === "diagnostic" ? "active" : ""} onClick={() => setPaperType("diagnostic")}><BarChart3 size={17} />知识诊断组卷</button></div>
      <div className="exam-facts"><div><Clock3 /><strong>180</strong><span>分钟倒计时</span></div><div><FileText /><strong>{paperType === "official" ? 1 : 9}</strong><span>{paperType === "official" ? "篇完整英译" : "道诊断任务"}</span></div><div><BookOpen /><strong>{paperType === "official" ? "≈180" : 1}</strong><span>{paperType === "official" ? "词连续文本" : "段翻译自评"}</span></div></div>
      <div className="exam-level"><span>选择难度</span>{(["elementary", "intermediate", "mixed", "advanced"] as Level[]).map((l) => <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>{levelLabels[l]}</button>)}</div>
      <button className="primary-button large" onClick={start}>开始模拟 <ArrowRight size={18} /></button>
      <p className="fine-print">模拟成绩不等同于北京大学官方考试成绩。</p>
    </div>
  );

  const doneCount = examQuestions.filter((q) => progress[q.id]).length;
  if (finished) return <div className="page exam-start"><div className="exam-intro-icon"><Trophy /></div><span className="eyebrow">EXAMEN PERFECTUM</span><h1>本次模拟结束</h1><p>你处理了 {doneCount} / {examQuestions.length} 项任务。建议把标为“错题”或“待复习”的结构加入下一轮专项训练。</p><button className="primary-button large" onClick={start}>再做一套 <RotateCcw size={18} /></button></div>;

  const current = examQuestions[index];
  return (
    <div className="page exam-live">
      <div className="exam-toolbar"><div><span>{levelLabels[level]}模拟</span><strong>第 {index + 1} / {examQuestions.length} 题</strong></div><div className={`timer ${seconds < 600 ? "urgent" : ""}`}><Clock3 size={18} />{formatTime(seconds)}</div><button className="secondary-button" onClick={() => setFinished(true)}>交卷</button></div>
      <QuestionCard key={current.id} question={current} status={progress[current.id]} onResult={(status) => onResult(current, status)} bookmarked={false} onBookmark={() => {}} />
      <div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> 上一题</button>{index < examQuestions.length - 1 ? <button className="primary-button" onClick={() => setIndex((i) => i + 1)}>下一题 <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => setFinished(true)}>完成并交卷 <Check size={17} /></button>}</div>
    </div>
  );
}

function VocabularyLab({ level, session }: { level: Level; session: Session }) {
  const [test, setTest] = useState(() => shuffle(allVocabItems.filter((item) => level === "mixed" ? item.level !== "advanced" : item.level === level)).slice(0, 20));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const eligible = allVocabItems.filter((item) => level === "mixed" ? item.level !== "advanced" : item.level === level);
  const restart = () => { setTest(shuffle(eligible).slice(0, 20)); setAnswers({}); setFinished(false); };
  useEffect(() => { setTest(shuffle(allVocabItems.filter((item) => level === "mixed" ? item.level !== "advanced" : item.level === level)).slice(0, 20)); setAnswers({}); setFinished(false); }, [level]);
  const score = test.filter((item) => answers[item.lemma] === item.gloss).length;
  const submit = () => {
    setFinished(true);
    if (session.authenticated) fetch("/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: test.map((item) => ({ lemma: item.lemma, correct: answers[item.lemma] === item.gloss })) }) }).catch(() => {});
  };

  return <div className="page vocab-page">
    <div className="practice-header"><div><span className="eyebrow">COPIA VERBŌRUM</span><h1>词汇量测量与统计</h1><p>按当前难度抽取核心词头，测试“见词头辨义”；结果是本站题库覆盖估计，不是标准化总词汇量。</p></div><button className="secondary-button" onClick={restart}><Shuffle size={16} />重新抽样</button></div>
    <div className="official-note"><Languages /><div><strong>{levelLabels[level]}词库 · 本轮 {test.length} 词</strong><p>登录后每个词头的见题次数和正确次数会同步到云端；匿名状态也可完成本轮测试，但不会跨设备统计。</p></div></div>
    <div className="vocab-grid">
      {test.map((item, index) => {
        const options = [item.gloss, ...item.distractors].sort((a, b) => (a + item.lemma).localeCompare(b + item.lemma));
        return <article className="vocab-item" key={item.lemma}><span>{String(index + 1).padStart(2, "0")} · {item.family}</span><h2 lang="la">{item.lemma}</h2><div>{options.map((option) => <button key={option} disabled={finished} className={`${answers[item.lemma] === option ? "selected" : ""} ${finished && option === item.gloss ? "correct" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [item.lemma]: option }))}>{option}</button>)}</div></article>;
      })}
    </div>
    {!finished ? <button className="primary-button vocab-submit" disabled={Object.keys(answers).length !== test.length} onClick={submit}>提交测量</button> : <section className="vocab-result"><Trophy /><div><span>本轮结果</span><h2>{score} / {test.length}</h2><p>按当前抽样估计，你掌握了本难度本站核心词库约 <strong>{Math.round((score / Math.max(test.length, 1)) * eligible.length)}</strong> / {eligible.length} 个词头。扩大题库后估计会随之更新。</p></div><button className="secondary-button" onClick={restart}>再测一次</button></section>}
  </div>;
}

const emptyAdminQuestion: Question = { id: "custom-", level: "elementary", category: "vocabulary", type: "choice", prompt: "", latin: "", options: ["", "", "", ""], answer: 0, explanation: "", tags: [], source: "管理员自建" };

function AdminPanel({ bank, onChanged }: { bank: Question[]; onChanged: () => void }) {
  const [selectedId, setSelectedId] = useState(bank[0]?.id || "new");
  const [draft, setDraft] = useState<Question>(bank[0] || emptyAdminQuestion);
  const [message, setMessage] = useState("");
  const choose = (id: string) => { setSelectedId(id); setDraft(id === "new" ? { ...emptyAdminQuestion, id: `custom-${Date.now()}` } : { ...bank.find((q) => q.id === id)! }); setMessage(""); };
  const save = async () => {
    const response = await fetch(`/api/admin/questions/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json(); setMessage(response.ok ? "已保存并立即写入题库覆盖层。" : data.error || "保存失败"); if (response.ok) onChanged();
  };
  const remove = async () => {
    if (!window.confirm(`停用题目 ${draft.id}？`)) return;
    const response = await fetch(`/api/admin/questions/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    setMessage(response.ok ? "题目已停用。" : "停用失败"); if (response.ok) onChanged();
  };
  return <div className="page admin-page"><div className="practice-header"><div><span className="eyebrow">OFFICĪNA ADMINISTRĀTŌRIS</span><h1>管理员题库后台</h1><p>内置题可用同 ID 覆盖；自建题建议使用 custom- 前缀。所有权限均由服务端再次校验。</p></div></div>
    <div className="admin-layout"><aside><button className="primary-button" onClick={() => choose("new")}>＋ 新建题目</button><select value={selectedId} onChange={(e) => choose(e.target.value)}><option value="new">新建题目</option>{bank.map((q) => <option key={q.id} value={q.id}>{q.id} · {q.prompt.slice(0, 28)}</option>)}</select></aside>
      <section className="admin-form">
        <label>题目 ID<input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>
        <div className="admin-row"><label>难度<select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as Question["level"] })}>{["elementary", "intermediate", "advanced"].map((v) => <option key={v} value={v}>{levelLabels[v as Question["level"]]}</option>)}</select></label><label>模块<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>{Object.entries(categoryLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>题型<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Question["type"] })}><option value="choice">选择题</option><option value="self-check">翻译自评</option></select></label></div>
        <label>题干<textarea rows={2} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></label>
        <label>拉丁文<textarea rows={2} value={draft.latin || ""} onChange={(e) => setDraft({ ...draft, latin: e.target.value })} /></label>
        {draft.type === "choice" ? <><label>选项（每行一个）<textarea rows={5} value={(draft.options || []).join("\n")} onChange={(e) => setDraft({ ...draft, options: e.target.value.split("\n") })} /></label><label>正确选项序号（从 1 开始）<input type="number" min="1" value={(draft.answer ?? 0) + 1} onChange={(e) => setDraft({ ...draft, answer: Math.max(0, Number(e.target.value) - 1) })} /></label></> : <label>参考译文<textarea rows={4} value={draft.modelAnswer || ""} onChange={(e) => setDraft({ ...draft, modelAnswer: e.target.value })} /></label>}
        <label>解析<textarea rows={4} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></label>
        <div className="admin-row"><label>来源<input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label><label>标签（逗号分隔）<input value={draft.tags.join(",")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} /></label></div>
        <div className="admin-actions"><button className="primary-button" onClick={save}><Save size={16} />保存</button><button className="secondary-button danger" onClick={remove}><Trash2 size={16} />停用</button>{message && <span>{message}</span>}</div>
      </section></div>
  </div>;
}

function Scope({ openPractice }: { openPractice: (l?: Level, c?: Category | "all") => void }) {
  return (
    <div className="page scope-page">
      <div className="practice-header"><div><span className="eyebrow">FINĒS EXAMINIS</span><h1>考试范围</h1><p>以下摘要依据北京大学历史学系 2025 年公开考试说明整理。</p></div></div>
      <div className="official-note"><Landmark /><div><strong>正式考试的核心不是选择题</strong><p>初级与中级均为 3 小时，将一段约 180 词的拉丁原文译成正确英文；可使用指定拉英词典，并需能从文中词形回溯词典形。</p></div></div>
      <section className="bank-summary">
        <div><span>完整教材题库</span><strong>{completeBankStats.total + questions.length}</strong><small>道可练任务</small></div>
        <div><span>词汇与回溯</span><strong>{completeBankStats.vocabularyQuestions}</strong><small>{completeBankStats.vocabularyEntries} 个核心词头</small></div>
        <div><span>形态识别</span><strong>{completeBankStats.morphologyQuestions}</strong><small>覆盖全套变格变位</small></div>
        <div><span>句法/句式/古典</span><strong>{completeBankStats.structureQuestions}</strong><small>按北大清单编排</small></div>
        <div><span>翻译自评</span><strong>{completeBankStats.translationQuestions + staticQuestions.filter((q) => q.category === "translation" && !q.id.startsWith("tb-tra")).length}</strong><small>英译为正式方向</small></div>
      </section>
      <div className="scope-grid curriculum-grid">{curriculumDomains.map((domain, index) => <section key={domain.level}><div className="scope-number">{["I", "II", "M", "A"][index]}</div><span>{domain.latin}</span><h2>{domain.title}</h2><p className="authors">{domain.authors}</p><p>{domain.examUse}</p><details><summary>教材映射</summary><p><strong>Wheelock：</strong>{domain.wheelock}</p><p><strong>LLPSI：</strong>{domain.llpsi}</p></details><div className="domain-columns"><div><b>词汇</b><ul>{domain.vocabulary.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>形态</b><ul>{domain.morphology.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>句法</b><ul>{domain.syntax.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>句式</b><ul>{domain.patterns.map((v) => <li key={v}>{v}</li>)}</ul></div><div><b>古典</b><ul>{domain.classics.map((v) => <li key={v}>{v}</li>)}</ul></div></div><button className="secondary-button" onClick={() => openPractice(domain.level, "all")}>练习{domain.title}范围 <ArrowRight size={17} /></button></section>)}</div>
      <section className="coverage-section"><div className="section-heading"><div><span>INDEX DISCIPLINAE</span><h2>75 章教材覆盖矩阵</h2></div></div><p>章节表示学习来源，难度域按北大考试能力要求判定。Wheelock 后半部分仍属于北大初级正式范围；LLPSI 最后两章的诗艺与语法术语进入原典进阶。</p><div className="coverage-books">{(["Wheelock", "LLPSI"] as const).map((book) => <details key={book}><summary><strong>{book}</strong><span>{textbookCoverage.filter((unit) => unit.book === book).length} 章 · 点击展开</span></summary><div>{textbookCoverage.filter((unit) => unit.book === book).map((unit) => <article key={`${book}-${unit.chapter}`}><b>{unit.chapter}</b><span>{unit.title}</span><p>{unit.topics}</p><small>{unit.stage} · {levelLabels[unit.examDomain]}</small></article>)}</div></details>)}</div></section>
      <div className="source-card"><BookOpen /><div><strong>编排说明</strong><p>本站题目用于建立“见词形 → 找主干 → 判结构 → 成句翻译”的阅读链条，均为自拟或仿古典散文练习，并非历年真题，也不代表北京大学官方立场。</p></div></div>
    </div>
  );
}

function Archive() {
  return (
    <div className="page archive-page">
      <div className="practice-header"><div><span className="eyebrow">FONTĒS EXAMINUM</span><h1>历年真题档案</h1><p>公开网络材料核验记录 · 更新于 2026-07-13</p></div></div>
      <div className="archive-verdict">
        <History />
        <div><strong>调查结论：历年完整原卷尚未公开可得</strong><p>已检索北大官方栏目、历年通知 PDF、合作院校转载、拉丁语学术网站、媒体访谈、知乎、Bilibili、微博索引及文档分享站。可确认考试制度与命题范围，但未找到一份能由官方页面或两个独立来源交叉验证的完整历年试卷。</p></div>
      </div>
      <div className="archive-legend"><span><i className="verified-dot" />已核验考试事实</span><span><i className="missing-dot" />原卷未公开</span></div>
      <div className="archive-list">
        {archiveEntries.map((entry) => (
          <article key={entry.year} className="archive-row">
            <div className="archive-year">{entry.year}</div>
            <div className="archive-content"><span>{entry.levels}</span><p>{entry.verified}</p><a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceLabel} <ArrowRight size={13} /></a></div>
            <div className={entry.paperStatus === "未检出举行记录" ? "archive-status neutral" : "archive-status"}>{entry.paperStatus}</div>
          </article>
        ))}
      </div>
      <div className="source-card"><CircleHelp /><div><strong>什么条件下才能标为“历年真题”？</strong><p>至少满足其一：北大或联合考点正式公开；试卷扫描件带有可核验年份与考务信息；或考生回忆能由两个独立来源确认具体作者、篇章与选段边界。在此之前，本站只提供“按真题制式模拟”，不会反推或冒认原题。</p></div></div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><div><BookOpen /></div><h2>Nihil adhūc</h2><p>{text}</p></div>;
}
