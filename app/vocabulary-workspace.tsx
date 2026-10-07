"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Search, Settings, XCircle } from "lucide-react";
import { dictionaryEntries, vocabularyCards, vocabularyKey, vocabularyMatchesLevel, vocabularyLevelsFor, publicDictionaryReferences, type VocabularyCard, type VocabularyMode, type VocabularyStats } from "../data/vocabulary";
import { contentText, localizeVocabularyCard } from "../lib/content-locale";
import { dictionarySources } from "../data/resources";
import type { LanguageCode } from "../data/questions";
import type { LanguageLevel } from "../data/languages";
import { completeVocabularyReview, makePrediction, trainVocabularyModel, type ReviewPrediction, type VocabularyReviewEvent, type VocabularyOutcome } from "../lib/vocabulary-model";

type SharedProps = { language: LanguageCode; locale: "zh-CN" | "en"; stats: VocabularyStats; reviews: VocabularyReviewEvent[] };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
import { dictionaryEntry, dictionaryFacets, searchDictionary, type DictionaryOptions, type DictionaryReference } from "../lib/dictionary";

const reviewLabels: Record<string, [string, string]> = { draft: ["内容草稿", "Draft"], reviewed: ["已复核", "Reviewed"], published: ["已发布", "Published"], archived: ["已归档", "Archived"] };
const outcomeLabels: Record<VocabularyOutcome, [string, string]> = { forgotten: ["忘了", "Forgotten"], approximate: ["近似", "Approximate"], remembered: ["记得", "Remembered"] };
const outcomes: VocabularyOutcome[] = ["forgotten", "approximate", "remembered"];
const label = (locale: string, zh: string, en: string) => locale === "en" ? en : zh;
const effectiveMode = (card: VocabularyCard, mode: VocabularyMode): VocabularyMode => mode === "context" && card.context.trim() ? "context" : "word";
const originalSearchText = (card: VocabularyCard) => `${card.term} ${card.spellingVariants?.join(" ") ?? ""} ${card.reading ?? ""} ${card.readingVariants?.join(" ") ?? ""} ${card.meaning} ${card.sourceReading ?? ""} ${card.sourceMeaning ?? ""} ${card.senses?.map(sense => `${sense.reading} ${sense.gloss}`).join(" ") ?? ""} ${card.dictionary?.derivatives.join(" ") ?? ""}`.toLowerCase();

// Search both meaning languages without making locale changes redraw the learning card.
const searchText = (card: VocabularyCard) => `${originalSearchText(card)} ${originalSearchText(localizeVocabularyCard(card, "en"))}`;

function VocabularyDetails({ card: originalCard, locale }: { card: VocabularyCard; locale: string }) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const card = localizeVocabularyCard(originalCard, locale);
  const otherSpellings = card.spellingVariants?.filter(value => value !== card.term) ?? [];
  const otherReadings = card.readingVariants?.filter(value => value !== card.reading && value !== card.sourceReading) ?? [];
  const additionalMeaning = card.sourceMeaning && card.sourceMeaning !== card.meaning ? card.sourceMeaning : undefined;
  return <>
    {otherSpellings.length > 0 && <p>{t("其他写法", "Other spellings")}: <span lang={card.language}>{otherSpellings.join(" · ")}</span></p>}
    {card.sourceReading && card.sourceReading !== card.reading && <p lang={card.language}>{card.sourceReading}</p>}
    {otherReadings.length > 0 && <p>{t("其他读音", "Other readings")}: <span lang={card.language}>{otherReadings.join(" · ")}</span></p>}
    {card.usageNotes && <p>{card.usageNotes}</p>}
    {additionalMeaning && <p>{t("补充释义", "Additional meaning")}: {additionalMeaning}</p>}
    {card.senses?.map((sense, index) => <p key={index}><span lang={card.language}>{sense.reading}</span> · {sense.gloss}</p>)}
    {publicDictionaryReferences(card).map(reference => <p key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.name}</a> · {reference.note}</p>)}
  </>;
}

export function VocabularyTrainer({ language, locale, level, mode, stats, reviews, owner, ready, focusId, onReview, onDictionary, onSettings }: SharedProps & {
  level: LanguageLevel; mode: VocabularyMode; owner: string; ready: boolean; focusId?: string;
  onReview: (event: VocabularyReviewEvent) => boolean; onDictionary: (id?: string) => void; onSettings: () => void;
}) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const [query, setQuery] = useState("");
  const eligible = useMemo(() => vocabularyCards.filter(card => card.language === language
    && vocabularyMatchesLevel(card, level)
    && searchText(card).includes(query.trim().toLowerCase())), [language, level, query]);
  const [cardId, setCardId] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [prediction, setPrediction] = useState<ReviewPrediction | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [round, setRound] = useState({ total: 0, remembered: 0, approximate: 0 });
  const [forecastDate, setForecastDate] = useState(() => localDate(new Date(Date.now() + 86400000)));
  const answered = useRef<ReviewPrediction | null>(null);
  const focusRequest = useRef("");
  const drawInputs = useRef<unknown[]>([]);
  const card = vocabularyCards.find(item => item.id === cardId && item.language === language);
  const focusedPractice = Boolean(card && !vocabularyMatchesLevel(card, level));
  const displayCard = card && localizeVocabularyCard(card, locale);

  function advance(events: VocabularyReviewEvent[], memory: VocabularyStats, recentIds: string[], preferred?: string) {
    const now = new Date().toISOString();
    const model = trainVocabularyModel(events, language, now);
    // One fitted model per draw; cards retain exploration and recent-card suppression.
    // A dictionary request targets one word; the following draw returns to the cumulative pool.
    const focused = preferred && vocabularyCards.find(item => item.id === preferred && item.language === language);
    const pool = focused && !eligible.some(item => item.id === focused.id) ? [...eligible, focused] : eligible;
    const candidates = pool.map(item => {
      const stat = memory[vocabularyKey(language, item.term)];
      const forecast = makePrediction(events, language, item.term, now, effectiveMode(item, mode), stat ? { ...stat, asOf: now } : undefined, now, model);
      return { item, forecast, weight: (stat?.seen ? 1 + 5 * (1 - forecast.probabilities.remembered - 0.5 * forecast.probabilities.approximate) : 3) * (recentIds.includes(item.id) ? 0.15 : 1) };
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
    // React may replay an effect setup; retain the selected word and frozen prediction.
    const inputs = [eligible, owner, ready, mode, focusId];
    if (inputs.every((value, index) => Object.is(value, drawInputs.current[index]))) return;
    drawInputs.current = inputs;
    const request = `${owner}:${ready}:${focusId ?? ""}`;
    advance(reviews, stats, [], request !== focusRequest.current ? focusId : undefined);
    focusRequest.current = request;
    setRecent([]);
    setRound({ total: 0, remembered: 0, approximate: 0 });
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

  const predictedOutcome = future ? outcomes.reduce((best, outcome) => future.probabilities[outcome] > future.probabilities[best] ? outcome : best) : null;

  function remember(outcome: VocabularyOutcome) {
    if (!ready || !card || !prediction || answered.current === prediction) return;
    answered.current = prediction;
    const event = completeVocabularyReview(prediction, outcome);
    const key = vocabularyKey(language, card.term);
    const previous = stats[key] ?? { seen: 0, correct: 0 };
    const memory = { ...stats, [key]: { seen: previous.seen + 1, correct: previous.correct + Number(outcome === "remembered") } };
    const nextRecent = [...recent, card.id].slice(-4);
    if (!onReview(event)) { answered.current = null; return; }
    setRound(current => ({ total: current.total + 1, remembered: current.remembered + Number(outcome === "remembered"), approximate: current.approximate + Number(outcome === "approximate") }));
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
    <div className="lexicon-filters"><p className="vocabulary-range">{t("统一词库 · 学习范围", "One vocabulary bank · Study range")}: <strong>{vocabularyLevelsFor(language, level).join(" · ")}</strong><small>{t("包含当前等级及以下的全部词汇", "All words at your current level and below")}</small></p><label className="resource-search"><Search size={16} /><input aria-label={t("筛选词卡", "Filter cards")} placeholder={t("词头、读音或释义", "Word, reading or meaning")} value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <section className="vocab-session-stats" aria-label={t("背词统计", "Vocabulary statistics")}><div><span>{t("当前词卡", "Available cards")}</span><strong>{eligible.length}</strong></div><div><span>{t("本轮反馈", "This session")}</span><strong>{round.total}</strong><small>{t("记得", "Remembered")} {round.remembered} · {t("近似", "Approximate")} {round.approximate} · {t("忘了", "Forgotten")} {round.total - round.remembered - round.approximate}</small></div><div><span>{t("用于个人预测的反馈", "Feedback for personal predictions")}</span><strong>{personalModel.sampleCount}</strong><small>{t("按语言独立学习", "Separate for each language")}</small></div></section>
    {!card ? <div className="empty-state"><BookOpen /><h2>{t("没有匹配词卡", "No matching cards")}</h2><p>{t("可清空搜索，或在设置中调整学习等级。", "Clear the search or change your study level in settings.")}</p></div> : <>
      {focusedPractice && <p className="vocabulary-focus" role="status">{t("定向练习：仅练当前选词，下一词回到当前等级范围。", "Focused practice: this selected word only. The next word returns to your study range.")}</p>}
      <article className="adaptive-vocab-card"><span>{card.level} · {effectiveMode(card, mode) === "context" ? t("单词＋语境", "Word and context") : t("纯单词", "Word only")}</span><h2 lang={language} dir="auto">{card.term}</h2>{effectiveMode(card, mode) === "context" && <p className="vocab-context" lang={language} dir="auto">{card.context}</p>}
        {revealed ? <div className="vocab-reveal">{card.reading && <span lang={language}>{card.reading}</span>}<strong>{displayCard?.meaning}</strong>{displayCard?.partOfSpeech && <small>{displayCard.partOfSpeech}</small>}<VocabularyDetails card={card} locale={locale} /></div> : <button className="primary-button vocab-reveal-button" onClick={() => setRevealed(true)}>{t("显示释义", "Reveal meaning")}</button>}
      </article>
      {!ready && <p role="status">{t("正在切换学习记录，请稍候。", "Switching learning records. Please wait.")}</p>}
      {revealed && <div className="vocab-feedback" aria-label={t("记忆反馈", "Memory feedback")}><button disabled={!ready || !prediction} onClick={() => remember("forgotten")}><XCircle size={19} /><span><strong>{t("忘了", "Forgotten")}</strong><small>{t("记录实际状态并调整复习", "Record and adapt review")}</small></span></button><button className="approximate" disabled={!ready || !prediction} onClick={() => remember("approximate")}><span className="vocab-approx-symbol" aria-hidden="true">≈</span><span><strong>{t("近似", "Approximate")}</strong><small>{t("有印象，但词义有偏差", "Familiar, but meaning is imprecise")}</small></span></button><button className="remembered" disabled={!ready || !prediction} onClick={() => remember("remembered")}><CheckCircle2 size={19} /><span><strong>{t("记得", "Remembered")}</strong><small>{t("记录实际状态并校准预测", "Record and calibrate prediction")}</small></span></button></div>}
      {revealed && <details className="vocabulary-predictions"><summary>{t("查看未来记忆预测", "Explore a future prediction")}</summary><label>{t("预测日期", "Prediction date")}<input type="date" min={localDate()} value={forecastDate} onChange={event => setForecastDate(event.target.value)} /></label>{future && predictedOutcome && <><p>{t("预计选择", "Predicted choice")}: <strong>{t(...outcomeLabels[predictedOutcome])}</strong></p><p>{outcomes.map(outcome => `${t(...outcomeLabels[outcome])} ${Math.round(future.probabilities[outcome] * 100)}%`).join(" · ")}</p></>}{future && !future.hasTimedHistory && <p role="status">{t("这个词还没有带日期的反馈，暂时无法估计随时间遗忘的变化；不同日期会显示相同的初始估计。", "This word has no dated feedback yet, so forgetting over time cannot be estimated. Different dates show the same initial estimate.")}</p>}<p>{t("日期预测以之后不再复习此词为前提；反馈不足时使用初始估计，不代表已经验证准确。", "Assumes no further reviews before that date. Sparse history uses an initial estimate, not proven accuracy.")}</p></details>}
    </>}
    <details className="vocabulary-predictions"><summary>{t("个人学习模型与记录", "Personal learning model and records")}</summary><p>{t("先保存答题前的预测，再用实际反馈更新模型。每条记录保留日期、预测概率与实际状态。词典查看本身不会算作记得。", "Each prediction is saved before feedback, then the actual response updates the model. Dates, probabilities and outcomes are kept. Looking up a word does not count as remembering it.")}</p>{personalModel.metrics.brier !== null && <p>{t("三状态预测误差（越低越好）", "Three-state prediction error (lower is better)")}: {personalModel.metrics.brier.toFixed(3)} · {personalModel.metrics.count} {t("条三状态记录", "three-state records")} · {t("固定猜测基准", "Fixed baseline")}: {personalModel.metrics.baselineBrier?.toFixed(3)}</p>}<button className="secondary-button" disabled={!personalModel.sampleCount} onClick={exportReviews}>{t("导出我的学习记录", "Export my learning records")}</button></details>
  </div>;
}

function DictionarySource({ reference, locale }: { reference: DictionaryReference; locale: string }) {
  return <span className="dictionary-source"><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.name} ↗</a>{reference.note && <span> · {reference.note}</span>}{reference.license && <small> · {reference.licenseUrl ? <a href={reference.licenseUrl} target="_blank" rel="noopener noreferrer">{reference.license}</a> : reference.license}</small>}</span>;
}

export function VocabularyDictionary({ language, locale, stats, reviews, focusId, onPractice }: SharedProps & { focusId?: string; onPractice: (id: string) => void }) {
  const t = (zh: string, en: string) => label(locale, zh, en);
  const [query, setQuery] = useState("");
  const [field, setField] = useState<DictionaryOptions["field"]>("all");
  const [order, setOrder] = useState<"headword" | "reading">(language === "ja" ? "reading" : "headword");
  const [index, setIndex] = useState("all");
  const [level, setLevel] = useState("all");
  const [partOfSpeech, setPartOfSpeech] = useState("all");
  const [selectedId, setSelectedId] = useState(focusId || "");
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const lastEntryButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (selectedId) detailHeading.current?.focus(); }, [selectedId]);
  const [visibleCount, setVisibleCount] = useState(40);
  const facets = useMemo(() => dictionaryFacets(dictionaryEntries, language, order), [language, order]);
  const entries = useMemo(() => searchDictionary(dictionaryEntries, { language, locale, query, field, order, index, level, partOfSpeech }), [language, locale, query, field, order, index, level, partOfSpeech]);
  const languageCount = useMemo(() => dictionaryEntries.filter(card => card.language === language).length, [language]);
  const original = entries.find(card => card.id === selectedId) || entries[0];
  const entry = original && dictionaryEntry(original, locale);
  const reset = () => { setQuery(""); setIndex("all"); setLevel("all"); setPartOfSpeech("all"); setSelectedId(""); };
  useEffect(() => { setVisibleCount(40); }, [query, field, order, index, level, partOfSpeech]);
  useEffect(() => { if (focusId) { reset(); setSelectedId(focusId); } }, [focusId, language]);
  const stat = original && stats[vocabularyKey(language, original.term)];
  const wordReviews = original ? reviews.filter(event => event.language === language && event.lemma === original.term).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt)) : [];
  const last = wordReviews[0];
  const approximate = wordReviews.filter(event => event.outcome === "approximate").length;
  const indexLabel = (value: string) => value === "漢字" ? t("汉字", "Han characters") : value === "#" ? t("其他／未收录读音", "Other / no reading") : value;
  return <section className="page dictionary-workspace" aria-label={t("独立词典", "Dictionary")}>
    <div className="dictionary-title"><span>PIKKU · DICTIONARY</span><h1>{t("词典", "Dictionary")}</h1><p>{t("查词、辨义、寻词源。与背单词共用词库，查阅不会计入记忆反馈。", "Look up words, explore meanings and trace origins. Entries are shared with vocabulary practice; lookups never count as recall feedback.")}</p></div>
    <div className="dictionary-search"><Search size={21} /><input type="search" aria-label={t("搜索词典", "Search dictionary")} value={query} onChange={event => { setQuery(event.target.value); setSelectedId(""); }} placeholder={t("输入词头、读音或中英释义", "Search a word, reading, or Chinese / English meaning")} /><select aria-label={t("检索方式", "Search field")} value={field} onChange={event => { setField(event.target.value as DictionaryOptions["field"]); setSelectedId(""); }}><option value="all">{t("综合检索", "All fields")}</option><option value="headword">{t("词头／别写", "Headword / spelling")}</option><option value="reading">{t("读音", "Reading")}</option><option value="meaning">{t("释义", "Meaning")}</option></select></div>
    <div className="dictionary-filters"><label>{t("索引顺序", "Index order")}<select value={order} onChange={event => { setOrder(event.target.value as "headword" | "reading"); setIndex("all"); setSelectedId(""); }}><option value="headword">{t("词头字母序", "Headword order")}</option><option value="reading">{t("读音／五十音", "Reading / kana order")}</option></select></label><label>{t("等级", "Level")}<select value={level} onChange={event => { setLevel(event.target.value); setSelectedId(""); }}><option value="all">{t("全部等级", "All levels")}</option>{["C", "F", "G", "M"].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>{t("词性", "Part of speech")}<select value={partOfSpeech} onChange={event => { setPartOfSpeech(event.target.value); setSelectedId(""); }}><option value="all">{t("全部词性", "All parts of speech")}</option>{facets.partsOfSpeech.map(value => <option value={value} key={value}>{contentText(value, locale)}</option>)}</select></label><button className="text-button" onClick={reset}>{t("重置", "Reset")}</button></div>
    <div className="dictionary-index" role="group" aria-label={t("快速索引", "Quick index")}><button aria-pressed={index === "all"} onClick={() => { setIndex("all"); setSelectedId(""); }}>{t("全部", "All")}</button>{facets.indices.map(value => <button key={value} aria-pressed={index === value} onClick={() => { setIndex(value); setSelectedId(""); }}>{indexLabel(value)}</button>)}</div>
    <p className="dictionary-count" aria-live="polite">{entries.length} / {languageCount} {t("词条", "entries")}</p>
    <div className={`dictionary-layout ${selectedId ? "has-selection" : ""}`}>
      <aside className="dictionary-results" aria-label={t("词条列表", "Entries")}>
        {entries.slice(0, visibleCount).map(card => { const item = dictionaryEntry(card, locale); return <button className={card.id === original?.id ? "active" : ""} aria-pressed={card.id === original?.id} key={card.id} onClick={event => { lastEntryButton.current = event.currentTarget; setSelectedId(card.id); }}><strong lang={language} dir="auto">{item.term}</strong>{item.reading && <small lang={language}>{item.reading}</small>}<span>{item.senses[0]?.gloss}</span></button>; })}
        {entries.length > visibleCount && <button className="dictionary-more" onClick={() => setVisibleCount(count => count + 40)}>{t("显示更多词条", "Show more entries")}</button>}
        {!entries.length && <p className="empty-state">{t("没有匹配词条，请调整检索条件。", "No matching entries. Try another search or filter.")}</p>}
      </aside>
      {entry && original && <article className="dictionary-entry" id={`word-${entry.id}`}>
        <button className="text-button dictionary-back" onClick={() => { setSelectedId(""); requestAnimationFrame(() => lastEntryButton.current?.focus()); }}>{t("← 返回词条列表", "← Back to entries")}</button>
        <header><div><span className="dictionary-headword-label">{language.toUpperCase()} · {entry.level}</span><h2 ref={detailHeading} tabIndex={-1} lang={language} dir="auto">{entry.term}</h2>{entry.reading && <p className="dictionary-reading" lang={language}>{entry.reading}</p>}{entry.partOfSpeech && <p>{entry.partOfSpeech}</p>}</div><button className="secondary-button" onClick={() => onPractice(entry.id)}>{t("练这个词", "Practise this word")}</button></header>
        {(entry.spellings.length > 0 || entry.readings.length > 0) && <div className="dictionary-variants">{entry.spellings.length > 0 && <p>{t("其他写法", "Other spellings")} · <span lang={language}>{entry.spellings.join(" · ")}</span></p>}{entry.readings.length > 0 && <p>{t("其他读音", "Other readings")} · <span lang={language}>{entry.readings.join(" · ")}</span></p>}</div>}
        <section><h3>{t("释义", "Meanings")}</h3><ol className="dictionary-senses">{entry.senses.map(sense => <li key={sense.number}><span className="sense-number">{sense.number}</span><div>{sense.reading && sense.reading !== entry.reading && <small lang={language}>{sense.reading}</small>}{sense.partOfSpeech && <small>{sense.partOfSpeech}</small>}<p>{sense.gloss}</p>{sense.source && <DictionarySource reference={sense.source} locale={locale} />}</div></li>)}</ol>{entry.usageNotes && <p>{entry.usageNotes}</p>}</section>
        <section><h3>{t("例句与用法", "Examples & usage")}</h3>{entry.examples.length ? entry.examples.map((example, i) => <figure key={i}><blockquote lang={language} dir="auto">{example.text}</blockquote>{example.translation && <p>{example.translation}</p>}<figcaption>{example.source ? <DictionarySource reference={example.source} locale={locale} /> : t("学习例句", "Study example")}</figcaption></figure>) : <p className="dictionary-pending">{t("例句待补充。", "Examples have not been added yet.")}</p>}</section>
        <section><h3>{t("词源", "Etymology")}</h3>{entry.etymology.length ? entry.etymology.map((item, i) => <div className="dictionary-etymology" key={i}><p>{item.text}</p><DictionarySource reference={item.source} locale={locale} /></div>) : <p className="dictionary-pending">{t("尚未收录有来源的词源说明。", "No sourced etymology has been added yet.")}</p>}</section>
        <section className="dictionary-reference-list"><h3>{t("辞典与来源", "Dictionaries & sources")}</h3>{entry.references.length ? entry.references.map(reference => <p key={`${reference.name}:${reference.url}`}><DictionarySource reference={reference} locale={locale} /></p>) : <p className="dictionary-pending">{t("此词条目前为学习释义，辞典引文待补充。", "This entry currently contains study definitions. Dictionary citations have not been added yet.")}</p>}</section>
        <div className="dictionary-learning-state">{stat?.seen ? `${t("已练", "Reviewed")} ${stat.seen} · ${t("记得", "Remembered")} ${stat.correct} · ${t("近似", "Approximate")} ${approximate}` : t("尚未练习", "Not reviewed yet")}{last && ` · ${t("最近", "Last")}: ${t(...outcomeLabels[last.outcome])}`}</div>
      </article>}
    </div>
  </section>;
}
