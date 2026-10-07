"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Search, Settings, XCircle } from "lucide-react";
import { dictionaryEntries, vocabularyCards, vocabularyKey, vocabularyMatchesLevel, type VocabularyCard, type VocabularyMode, type VocabularyStats } from "../data/vocabulary";
import { dictionarySources } from "../data/resources";
import type { LanguageCode } from "../data/questions";
import type { LanguageLevel } from "../data/languages";
import { completeVocabularyReview, makePrediction, trainVocabularyModel, type ReviewPrediction, type VocabularyReviewEvent } from "../lib/vocabulary-model";

type SharedProps = { language: LanguageCode; locale: "zh-CN" | "en"; stats: VocabularyStats; reviews: VocabularyReviewEvent[] };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const reviewLabels: Record<string, [string, string]> = { draft: ["内容草稿", "Draft"], reviewed: ["已复核", "Reviewed"], published: ["已发布", "Published"], archived: ["已归档", "Archived"] };
const label = (locale: string, zh: string, en: string) => locale === "en" ? en : zh;
const effectiveMode = (card: VocabularyCard, mode: VocabularyMode): VocabularyMode => mode === "context" && card.context.trim() ? "context" : "word";
const matchesSource = (card: VocabularyCard, source: string) => source === "1992" ? Boolean(card.sourceQuestionIds?.length) : source === "2000" ? Boolean(card.sourcePages?.length) : true;
const searchText = (card: VocabularyCard) => `${card.term} ${card.spellingVariants?.join(" ") ?? ""} ${card.reading ?? ""} ${card.readingVariants?.join(" ") ?? ""} ${card.meaning} ${card.sourceReading ?? ""} ${card.sourceMeaning ?? ""} ${card.senses?.map(sense => `${sense.reading} ${sense.gloss}`).join(" ") ?? ""} ${card.dictionary?.derivatives.join(" ") ?? ""}`.toLowerCase();

function VocabularySources({ card, locale, expanded = false }: { card: VocabularyCard; locale: string; expanded?: boolean }) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const otherSpellings = card.spellingVariants?.filter(value => value !== card.term) ?? [];
  return <>
    {card.sourceQuestionIds?.length ? <details><summary>{t("1992 真题出处", "1992 question references")} · {card.sourceQuestionIds.length}</summary><p className="vocabulary-source-ids">{card.sourceQuestionIds.join(" · ")}</p></details> : null}
    {card.sourcePages?.length ? <details open={expanded || undefined}><summary>{t("2000词 PDF 释义", "2000-word PDF source")} · {t("页", "pages")} {card.sourcePages.join(", ")}</summary>{otherSpellings.length > 0 && <p>{t("其他写法", "Other spellings")}: <span lang="ja">{otherSpellings.join(" · ")}</span></p>}{card.sourceReading && <p lang="ja">{card.sourceReading}</p>}{card.sourceMeaning && <p>{card.sourceMeaning}</p>}{card.senses?.map((sense, index) => <p key={index}><span lang="ja">{sense.reading}</span> · {sense.gloss} <small>({t("页", "pages")} {sense.sourcePages.join(", ")})</small></p>)}{card.sourceNotes && <p>{card.sourceNotes}</p>}</details> : null}
  </>;
}

export function VocabularyTrainer({ language, locale, level, mode, stats, reviews, owner, ready, focusId, onReview, onDictionary, onSettings }: SharedProps & {
  level: LanguageLevel; mode: VocabularyMode; owner: string; ready: boolean; focusId?: string;
  onReview: (event: VocabularyReviewEvent) => boolean; onDictionary: (id?: string) => void; onSettings: () => void;
}) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const [scope, setScope] = useState(focusId ? "all" : "level");
  const [query, setQuery] = useState("");
  const eligible = useMemo(() => vocabularyCards.filter(card => card.language === language
    && (scope === "level" ? vocabularyMatchesLevel(card, level) : matchesSource(card, scope))
    && searchText(card).includes(query.trim().toLowerCase())), [language, level, scope, query]);
  const [cardId, setCardId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [prediction, setPrediction] = useState<ReviewPrediction | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [round, setRound] = useState({ total: 0, remembered: 0 });
  const [forecastDate, setForecastDate] = useState(() => localDate(new Date(Date.now() + 86400000)));
  const answered = useRef<ReviewPrediction | null>(null);
  const card = eligible.find(item => item.id === cardId);

  function advance(events: VocabularyReviewEvent[], memory: VocabularyStats, recentIds: string[], preferred?: string) {
    const now = new Date().toISOString();
    const model = trainVocabularyModel(events, language, now);
    // One fitted model per draw; cards retain exploration and recent-card suppression.
    const candidates = eligible.map(item => {
      const stat = memory[vocabularyKey(language, item.term)];
      const forecast = makePrediction(events, language, item.term, now, effectiveMode(item, mode), stat ? { ...stat, asOf: now } : undefined, now, model);
      return { item, forecast, weight: (stat?.seen ? 1 + 5 * (1 - forecast.probability) : 3) * (recentIds.includes(item.id) ? 0.15 : 1) };
    });
    let chosen = candidates.find(candidate => candidate.item.id === preferred);
    if (!chosen && candidates.length) {
      let point = Math.random() * candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
      chosen = candidates.find(candidate => (point -= candidate.weight) < 0) ?? candidates[candidates.length - 1];
    }
    setCardId(chosen?.item.id ?? "");
    setPrediction(chosen?.forecast ?? null);
    setRevealed(false);
  }

  useEffect(() => {
    advance(reviews, stats, [], focusId);
    setRecent([]);
    setRound({ total: 0, remembered: 0 });
    // A prediction is intentionally frozen until feedback, not recomputed from its own result.
  }, [eligible, owner, ready, mode, focusId]);

  const personalModel = useMemo(() => trainVocabularyModel(reviews, language), [reviews, language]);
  const future = useMemo(() => {
    if (!card || !forecastDate) return null;
    const target = new Date(`${forecastDate}T23:59:59`);
    const now = new Date().toISOString();
    if (!Number.isFinite(target.getTime()) || target.toISOString() < now) return null;
    const stat = stats[vocabularyKey(language, card.term)];
    return makePrediction(reviews, language, card.term, target.toISOString(), effectiveMode(card, mode), stat ? { ...stat, asOf: now } : undefined, now);
  }, [reviews, language, card, forecastDate, mode, stats]);

  function remember(outcome: "remembered" | "forgotten") {
    if (!ready || !card || !prediction || answered.current === prediction) return;
    answered.current = prediction;
    const event = completeVocabularyReview(prediction, outcome);
    const key = vocabularyKey(language, card.term);
    const previous = stats[key] ?? { seen: 0, correct: 0 };
    const memory = { ...stats, [key]: { seen: previous.seen + 1, correct: previous.correct + Number(outcome === "remembered") } };
    const nextRecent = [...recent, card.id].slice(-4);
    if (!onReview(event)) { answered.current = null; return; }
    setRound(current => ({ total: current.total + 1, remembered: current.remembered + Number(outcome === "remembered") }));
    setRecent(nextRecent);
    advance([...reviews, event], memory, nextRecent);
  }

  function exportReviews() {
    const blob = new Blob([JSON.stringify({ version: 1, language, exportedAt: new Date().toISOString(), reviews: reviews.filter(event => event.language === language) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `pikku-${language}-learning-${localDate()}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="page vocabulary-trainer">
    <div className="practice-header vocab-trainer-header"><div><span>VOCABULARY</span><h1>{t("自适应背单词", "Adaptive vocabulary")}</h1><p>{t("根据你的实际反馈学习，优先复习容易忘记的词，同时保留新词探索。", "Learns from your feedback, revisits words you may forget, and keeps introducing new words.")}</p></div><div className="vocabulary-actions"><button className="secondary-button" onClick={() => onDictionary(card?.id)}><BookOpen size={16} />{t("词典", "Dictionary")}</button><button className="secondary-button" onClick={onSettings}><Settings size={16} />{t("显示设置", "Display settings")}</button></div></div>
    <div className="lexicon-filters"><label>{t("词汇范围", "Vocabulary scope")}<select value={scope} onChange={event => setScope(event.target.value)}><option value="level">{t("当前等级及以下", "Current level and below")}</option>{language === "ja" && <><option value="1992">{t("1992 真题词汇", "1992 exam vocabulary")}</option><option value="2000">{t("2000词 PDF", "2000-word PDF")}</option></>}<option value="all">{t("全部词库（含待分级）", "All entries, including ungraded")}</option></select></label><label className="resource-search"><Search size={16} /><input aria-label={t("筛选词卡", "Filter cards")} placeholder={t("词头、读音或中文义", "Word, reading or meaning")} value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <section className="vocab-session-stats" aria-label={t("背词统计", "Vocabulary statistics")}><div><span>{t("当前词卡", "Available cards")}</span><strong>{eligible.length}</strong></div><div><span>{t("本轮反馈", "This session")}</span><strong>{round.total}</strong><small>{round.remembered} {t("次记得", "remembered")}</small></div><div><span>{t("用于个人预测的反馈", "Feedback for personal predictions")}</span><strong>{personalModel.sampleCount}</strong><small>{t("按语言独立学习", "Separate for each language")}</small></div></section>
    {!card ? <div className="empty-state"><BookOpen /><h2>{t("没有匹配词卡", "No matching cards")}</h2><p>{t("可切换词汇范围或清空搜索。", "Change the scope or clear the search.")}</p></div> : <>
      <article className="adaptive-vocab-card"><span>{card.level ?? t("待分级", "Ungraded")} · {effectiveMode(card, mode) === "context" ? t("单词＋语境", "Word and context") : t("纯单词", "Word only")}</span><h2 lang={language}>{card.term}</h2>{effectiveMode(card, mode) === "context" && <p className="vocab-context" lang={language}>{card.context}</p>}
        {revealed ? <div className="vocab-reveal">{card.reading && <span lang={language}>{card.reading}</span>}<strong>{card.meaning}</strong>{card.partOfSpeech && <small>{card.partOfSpeech}</small>}<VocabularySources card={card} locale={locale} expanded /></div> : <button className="primary-button vocab-reveal-button" onClick={() => setRevealed(true)}>{t("显示释义", "Reveal meaning")}</button>}
      </article>
      {!ready && <p role="status">{t("正在切换学习记录，请稍候。", "Switching learning records. Please wait.")}</p>}
      {revealed && <div className="vocab-feedback" aria-label={t("记忆反馈", "Memory feedback")}><button disabled={!ready || !prediction} onClick={() => remember("forgotten")}><XCircle size={19} /><span><strong>{t("忘了", "Forgotten")}</strong><small>{t("记录实际状态并调整复习", "Record and adapt review")}</small></span></button><button className="remembered" disabled={!ready || !prediction} onClick={() => remember("remembered")}><CheckCircle2 size={19} /><span><strong>{t("记得", "Remembered")}</strong><small>{t("记录实际状态并校准预测", "Record and calibrate prediction")}</small></span></button></div>}
      {revealed && <details className="vocabulary-predictions"><summary>{t("查看未来记忆预测", "Explore a future prediction")}</summary><label>{t("预测日期", "Prediction date")}<input type="date" min={localDate()} value={forecastDate} onChange={event => setForecastDate(event.target.value)} /></label>{future && <p>{t("预计选择", "Predicted choice")}: <strong>{future.probability >= 0.5 ? t("记得", "Remembered") : t("忘了", "Forgotten")}</strong> · {t("记得的概率", "Chance of remembering")} {Math.round(future.probability * 100)}%</p>}{future && !future.hasTimedHistory && <p role="status">{t("这个词还没有带日期的反馈，暂时无法估计随时间遗忘的变化；不同日期会显示相同的初始估计。", "This word has no dated feedback yet, so forgetting over time cannot be estimated. Different dates show the same initial estimate.")}</p>}<p>{t("日期预测以之后不再复习此词为前提；反馈不足时使用初始估计，不代表已经验证准确。", "Assumes no further reviews before that date. Sparse history uses an initial estimate, not proven accuracy.")}</p></details>}
    </>}
    <details className="vocabulary-predictions"><summary>{t("个人学习模型与记录", "Personal learning model and records")}</summary><p>{t("先保存答题前的预测，再用实际反馈更新模型。每条记录保留日期、预测概率与实际状态。词典查看本身不会算作记得。", "Each prediction is saved before feedback, then the actual response updates the model. Dates, probabilities and outcomes are kept. Looking up a word does not count as remembering it.")}</p>{personalModel.metrics.brier !== null && <p>{t("历史预测误差（越低越好）", "Historical prediction error (lower is better)")}: {personalModel.metrics.brier.toFixed(3)} · {t("固定猜测基准", "Fixed baseline")}: {personalModel.metrics.baselineBrier?.toFixed(3)}</p>}<button className="secondary-button" disabled={!personalModel.sampleCount} onClick={exportReviews}>{t("导出我的学习记录", "Export my learning records")}</button></details>
  </div>;
}

export function VocabularyDictionary({ language, locale, stats, reviews, focusId, onPractice }: SharedProps & { focusId?: string; onPractice: (id: string) => void }) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const [query, setQuery] = useState(() => dictionaryEntries.find(card => card.id === focusId && card.language === language)?.term ?? "");
  const [source, setSource] = useState("all");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const [visibleCount, setVisibleCount] = useState(40);
  const languageEntries = dictionaryEntries.filter(card => card.language === language);
  const entries = languageEntries.filter(card => matchesSource(card, source) && (batch === "all" || (card.batch ?? "foundation") === batch)
    && (status === "all" || (card.dictionary?.reviewStatus ?? "draft") === status)
    && searchText(card).includes(query.trim().toLowerCase()));
  useEffect(() => { setVisibleCount(40); }, [query, source, batch, status]);
  useEffect(() => { if (focusId) { setQuery(dictionaryEntries.find(card => card.id === focusId && card.language === language)?.term ?? ""); setBatch("all"); setSource("all"); setStatus("all"); } }, [focusId, language]);
  return <section className="linked-dictionary">
    <p>{t("词典与背单词使用同一词条和学习记录。可查词后直接练习，也可在背词时回来查看。", "Dictionary and practice share entries and learning records. Look up a word, practise it, and return here anytime.")}</p>
    <div className="lexicon-filters">{language === "ja" && <label>{t("来源", "Source")}<select value={source} onChange={event => setSource(event.target.value)}><option value="all">{t("全部来源", "All sources")}</option>{["1992", "2000"].map(value => <option key={value} value={value}>{value === "1992" ? t("1992 真题词汇", "1992 exam vocabulary") : t("2000词 PDF", "2000-word PDF")} ({languageEntries.filter(card => matchesSource(card, value)).length})</option>)}</select></label>}<label>{t("批次", "Collection")}<select value={batch} onChange={event => setBatch(event.target.value)}><option value="all">{t("全部词库", "All entries")}</option>{[...new Set(languageEntries.map(card => card.batch ?? "foundation"))].map(value => <option key={value} value={value}>{value === "foundation" ? t("基础词库", "Foundation") : value}</option>)}</select></label><label>{t("内容状态", "Content status")}<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t("全部状态", "All statuses")}</option>{Object.entries(reviewLabels).map(([value, labels]) => <option key={value} value={value}>{t(...labels)}</option>)}</select></label><label className="resource-search"><Search size={17} /><input aria-label={t("搜索词典", "Search dictionary")} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("词头、读音或中文义", "Word, reading or meaning")} /></label></div>
    {language === "la" && <details><summary>{t("词典核验来源", "Dictionary verification sources")}</summary><div className="dictionary-sources">{dictionarySources.map(source => <article key={source.id}><strong>{source.name}</strong><p>{source.scope}</p><small>{source.access}</small></article>)}</div></details>}
    <p aria-live="polite">{entries.length} / {languageEntries.length} {t("词条", "entries")}</p>
    <div className="lexicon-list">{entries.slice(0, visibleCount).map(card => {
      const stat = stats[vocabularyKey(language, card.term)];
      const last = reviews.filter(event => event.language === language && event.lemma === card.term).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0];
      return <article key={card.id} id={`word-${card.id}`}><div><small className="lexicon-language">{language.toUpperCase()} · {card.level ?? t("待分级", "Ungraded")}</small><h2 lang={language}>{card.term}</h2>{card.reading && <span lang={language}>{card.reading}</span>}<b>{card.meaning}</b></div>{card.partOfSpeech && <p>{card.partOfSpeech}</p>}{card.context && <blockquote lang={language}>{card.context}</blockquote>}{card.notes && <p>{card.notes}</p>}{card.dictionary && <details><summary>{t("词源与核验线索", "Etymology and review notes")}</summary><p>{card.dictionary.pie}</p><p>{card.dictionary.derivatives.join(" · ")}</p><small>{card.dictionary.reviewStatus} · {card.dictionary.batch}</small></details>}<div className="dictionary-checks lexicon-workflow"><span className={`review-status ${card.dictionary?.reviewStatus ?? "draft"}`}>{t(...reviewLabels[card.dictionary?.reviewStatus ?? "draft"])}</span><span>{card.batch ?? t("基础词库", "Foundation")}</span></div>
        {language === "la" && card.dictionary ? <div className="dictionary-checks">{dictionarySources.map(source => <span key={source.id}>{source.id.toUpperCase()} · {card.dictionary!.dictionaryStatus[source.id] === "已核" ? t("已核", "Verified") : t("待核", "Pending")}</span>)}</div> : <p>{t("专项词典 · 待核", "Language-specific dictionary · pending")}{card.dictionary?.addedOn && ` · ${card.dictionary.addedOn}`}</p>}
        <VocabularySources card={card} locale={locale} />
        <p className="dictionary-learning-state">{stat?.seen ? `${t("已练", "Reviewed")} ${stat.seen} · ${t("记得", "Remembered")} ${stat.correct}` : t("尚未练习", "Not reviewed yet")}{last && ` · ${t("最近", "Last")}: ${last.outcome === "remembered" ? t("记得", "Remembered") : t("忘了", "Forgotten")}`}</p><button className="primary-button" onClick={() => onPractice(card.id)}>{t("练这个词", "Practise this word")}</button></article>;
    })}</div>
    {entries.length > visibleCount && <button className="secondary-button" onClick={() => setVisibleCount(count => count + 40)}>{t("显示更多词条", "Show more entries")}</button>}
    {!entries.length && <div className="empty-state"><Search /><h2>{t("没有匹配词条", "No matching entries")}</h2></div>}
  </section>;
}
