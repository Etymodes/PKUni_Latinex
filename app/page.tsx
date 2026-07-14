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
  History,
  Home,
  Landmark,
  Layers3,
  Menu,
  RotateCcw,
  ScrollText,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
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

type View = "home" | "practice" | "mistakes" | "bookmarks" | "exam" | "scope" | "archive";
type Progress = Record<string, "correct" | "wrong" | "review">;

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
    { id: "practice", label: "专项练习", icon: Layers3 },
    { id: "exam", label: "考试模拟", icon: Clock3 },
    { id: "mistakes", label: "错题回炉", icon: RotateCcw, count: Object.values(progress).filter((v) => v === "wrong" || v === "review").length },
    { id: "bookmarks", label: "我的收藏", icon: Bookmark, count: bookmarks.length },
    { id: "archive", label: "真题档案", icon: History },
    { id: "scope", label: "考试范围", icon: ScrollText },
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="主导航">
        <div className="brand">
          <div className="brand-mark"><img src="/pkuni-latinex-logo-final.png" alt="" /></div>
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
          <img src="/pkuni-latinex-logo-final.png" alt="哔丘 Pikku 做翅膀赞" />
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
        </header>

        <main id="main-content">
          {view === "home" && <Dashboard level={level} progress={progress} bookmarks={bookmarks} openPractice={openPractice} setView={setView} />}
          {view === "practice" && <Practice level={level} setLevel={setLevel} category={category} setCategory={setCategory} progress={progress} setProgress={setProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "mistakes" && <QuestionCollection title="错题回炉" empty="还没有错题。先完成一组练习吧。" questions={questions.filter((q) => progress[q.id] === "wrong" || progress[q.id] === "review")} progress={progress} setProgress={setProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "bookmarks" && <QuestionCollection title="我的收藏" empty="尚未收藏题目。练习时点击书签即可加入。" questions={questions.filter((q) => bookmarks.includes(q.id))} progress={progress} setProgress={setProgress} bookmarks={bookmarks} setBookmarks={setBookmarks} />}
          {view === "exam" && <ExamMode level={level} setLevel={setLevel} progress={progress} setProgress={setProgress} />}
          {view === "scope" && <Scope openPractice={openPractice} />}
          {view === "archive" && <Archive />}
        </main>
      </div>
    </div>
  );
}

function Dashboard({ level, progress, bookmarks, openPractice, setView }: { level: Level; progress: Progress; bookmarks: string[]; openPractice: (l?: Level, c?: Category | "all") => void; setView: (v: View) => void }) {
  const levelQs = questions.filter((q) => matchesLevel(q, level));
  const done = levelQs.filter((q) => progress[q.id]).length;
  const right = levelQs.filter((q) => progress[q.id] === "correct").length;
  const percent = Math.round((done / levelQs.length) * 100);

  const modes = [
    { category: "morphology" as Category, icon: Layers3, title: "形态快练", latin: "Fōrmae", copy: "变格、变位与不规则词形", meta: `${questions.filter((q) => matchesLevel(q, level) && q.category === "morphology").length} 题` },
    { category: "syntax" as Category, icon: ScrollText, title: "句法拆解", latin: "Syntaxis", copy: "从主干定位到从句层级", meta: `${questions.filter((q) => matchesLevel(q, level) && q.category === "syntax").length} 题` },
    { category: "translation" as Category, icon: FileText, title: "分句翻译", latin: "Interpretātiō", copy: "对照参考译文进行自评", meta: `${questions.filter((q) => matchesLevel(q, level) && q.category === "translation").length} 篇` },
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

function Practice({ level, setLevel, category, setCategory, progress, setProgress, bookmarks, setBookmarks }: { level: Level; setLevel: (l: Level) => void; category: Category | "all"; setCategory: (c: Category | "all") => void; progress: Progress; setProgress: (p: Progress | ((p: Progress) => Progress)) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const pool = useMemo(() => questions.filter((q) => matchesLevel(q, level) && (category === "all" || q.category === category)), [level, category]);
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
        </div>
      </div>

      {question ? (
        <>
          <div className="question-progress"><span>第 {index + 1} / {pool.length} 题</span><div><i style={{ width: `${((index + 1) / pool.length) * 100}%` }} /></div><span>{category === "all" ? "综合" : categoryLabels[category]}</span></div>
          <QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => setProgress((p) => ({ ...p, [question.id]: status }))} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} />
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

function QuestionCollection({ title, empty, questions: items, progress, setProgress, bookmarks, setBookmarks }: { title: string; empty: string; questions: Question[]; progress: Progress; setProgress: (p: Progress | ((p: Progress) => Progress)) => void; bookmarks: string[]; setBookmarks: (b: string[] | ((b: string[]) => string[])) => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items.length]);
  if (!items.length) return <div className="page"><div className="practice-header"><div><span className="eyebrow">REPETĪTIŌ</span><h1>{title}</h1></div></div><EmptyState text={empty} /></div>;
  const question = items[Math.min(index, items.length - 1)];
  return <div className="page"><div className="practice-header"><div><span className="eyebrow">REPETĪTIŌ</span><h1>{title}</h1><p>共 {items.length} 题，按顺序逐一处理。</p></div></div><div className="question-progress"><span>第 {index + 1} / {items.length} 题</span><div><i style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div></div><QuestionCard key={question.id} question={question} status={progress[question.id]} onResult={(status) => setProgress((p) => ({ ...p, [question.id]: status }))} bookmarked={bookmarks.includes(question.id)} onBookmark={() => setBookmarks((b) => b.includes(question.id) ? b.filter((id) => id !== question.id) : [...b, question.id])} /><div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> 上一题</button><button className="primary-button" onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))} disabled={index === items.length - 1}>下一题 <ArrowRight size={17} /></button></div></div>;
}

function ExamMode({ level, setLevel, progress, setProgress }: { level: Level; setLevel: (l: Level) => void; progress: Progress; setProgress: (p: Progress | ((p: Progress) => Progress)) => void }) {
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(180 * 60);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!started || finished || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, finished, seconds]);
  useEffect(() => { if (seconds === 0 && started) setFinished(true); }, [seconds, started]);

  const start = () => {
    const objective = shuffle(questions.filter((q) => matchesLevel(q, level) && q.type === "choice")).slice(0, 8);
    const translation = shuffle(questions.filter((q) => matchesLevel(q, level) && q.type === "self-check")).slice(0, 1);
    setExamQuestions([...objective, ...translation]); setIndex(0); setSeconds(180 * 60); setFinished(false); setStarted(true);
  };

  if (!started) return (
    <div className="page exam-start">
      <div className="exam-intro-icon"><TimerReset /></div><span className="eyebrow">SIMULATIO EXAMINIS</span><h1>180 分钟模拟</h1><p>正式考试核心任务是完成约 180 词原文英译。本站模拟先以 8 道诊断题热身，再进入一段翻译自评，帮助暴露形态与句法薄弱点。</p>
      <div className="exam-facts"><div><Clock3 /><strong>180</strong><span>分钟倒计时</span></div><div><FileText /><strong>9</strong><span>道诊断任务</span></div><div><BookOpen /><strong>1</strong><span>段翻译自评</span></div></div>
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
      <QuestionCard key={current.id} question={current} status={progress[current.id]} onResult={(status) => setProgress((p) => ({ ...p, [current.id]: status }))} bookmarked={false} onBookmark={() => {}} />
      <div className="question-nav"><button className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={17} /> 上一题</button>{index < examQuestions.length - 1 ? <button className="primary-button" onClick={() => setIndex((i) => i + 1)}>下一题 <ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => setFinished(true)}>完成并交卷 <Check size={17} /></button>}</div>
    </div>
  );
}

function Scope({ openPractice }: { openPractice: (l?: Level, c?: Category | "all") => void }) {
  return (
    <div className="page scope-page">
      <div className="practice-header"><div><span className="eyebrow">FINĒS EXAMINIS</span><h1>考试范围</h1><p>以下摘要依据北京大学历史学系 2025 年公开考试说明整理。</p></div></div>
      <div className="official-note"><Landmark /><div><strong>正式考试的核心不是选择题</strong><p>初级与中级均为 3 小时，将一段约 180 词的拉丁原文译成正确英文；可使用指定拉英词典，并需能从文中词形回溯词典形。</p></div></div>
      <div className="scope-grid">
        <section><div className="scope-number">I</div><span>ELEMENTARY LATIN</span><h2>初级拉丁语</h2><p className="authors">Caesar · Cornelius Nepos</p><ul><li>所有名词、形容词变格及比较级</li><li>主要时态、语气、语态与异相动词</li><li>不定式、分词、动名词与动形容词</li><li>独立夺格、宾格不定式、时态呼应</li><li>目的、结果、cum、条件、恐惧等从句</li></ul><button className="secondary-button" onClick={() => openPractice("elementary", "all")}>练习初级范围 <ArrowRight size={17} /></button></section>
        <section><div className="scope-number">II</div><span>INTERMEDIATE LATIN</span><h2>中级拉丁语</h2><p className="authors">Sallust · Cicero</p><ul><li>包含全部初级要求</li><li>希腊式名词、目的分词及特殊词形</li><li>主句虚拟式与复合主语一致</li><li>间接命令、疑问、愿望和间接引语</li><li>限制、时间、主观原因与关系从句</li></ul><button className="secondary-button" onClick={() => openPractice("intermediate", "all")}>练习中级范围 <ArrowRight size={17} /></button></section>
        <section><div className="scope-number">M</div><span>GRADUS MIXTUS</span><h2>混合难度</h2><p className="authors">Elementary ↔ Intermediate</p><ul><li>从初级与中级题库交错抽题</li><li>训练在未知文本中快速判断难度</li><li>避免只熟悉单一作者或单一结构</li><li>适合考前综合诊断与错题回炉</li><li>不额外引入官方范围以外语法</li></ul><button className="secondary-button" onClick={() => openPractice("mixed", "all")}>开始混合练习 <ArrowRight size={17} /></button></section>
        <section><div className="scope-number">A</div><span>ULTRĀ FINĒS</span><h2>进阶</h2><p className="authors">Long syntax · textual nuance</p><ul><li>古式与罕见词形的词典回溯</li><li>多层间接引语与信息来源判断</li><li>语气选择、歧义消解与长距离一致</li><li>反事实、迂说结构和限时长句</li><li>明确超出官方中级最低要求</li></ul><button className="secondary-button" onClick={() => openPractice("advanced", "all")}>挑战进阶训练 <ArrowRight size={17} /></button></section>
      </div>
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
