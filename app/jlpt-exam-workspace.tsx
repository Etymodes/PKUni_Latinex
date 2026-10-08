"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildJlptExam, jlptExamProfiles, type JlptProfileId } from "../lib/jlpt-exam";
import type { Question, StudyLevel } from "../data/questions";

type Answer = "correct" | "wrong" | "review";
type Plan = ReturnType<typeof buildJlptExam>;
type Props = { bank: Question[]; level: StudyLevel; locale: "zh-CN" | "en";
  onResult: (question: Question, status: Answer) => void;
  renderQuestion: (question: Question, status: Answer | undefined, answer: (status: Answer) => void) => ReactNode;
};
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function JlptExamWorkspace({ bank, level, locale, onResult, renderQuestion }: Props) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const label = (value: { zh: string; en: string }) => value[locale === "en" ? "en" : "zh"];
  const [profileId, setProfileId] = useState<JlptProfileId>(level === "C" || level === "elementary" ? "n3" : level === "F" || level === "intermediate" ? "n2" : "n1");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [finished, setFinished] = useState(false);
  const active = useRef<{ plan: Plan; sectionIndex: number; deadline: number; answered: Set<string> } | null>(null);
  const preview = useMemo(() => buildJlptExam(bank, profileId, () => 0), [bank, profileId]);
  const section = plan?.sections[sectionIndex];
  const current = section?.questions[questionIndex];
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

  function openSection(nextPlan: Plan, nextIndex: number) {
    const next = nextPlan.sections.findIndex((item, index) => index >= nextIndex && item.questions.length > 0);
    if (next < 0) { finish(); return; }
    const at = Date.now();
    const until = at + nextPlan.sections[next].minutes * 60000;
    if (active.current) { active.current.sectionIndex = next; active.current.deadline = until; }
    setSectionIndex(next); setQuestionIndex(0); setNow(at); setDeadline(until);
  }
  function start() {
    const nextPlan = buildJlptExam(bank, profileId);
    if (!nextPlan.totalSelected) return;
    active.current = { plan: nextPlan, sectionIndex: 0, deadline: 0, answered: new Set() };
    setPlan(nextPlan); setAnswers({}); setFinished(false); openSection(nextPlan, 0);
  }
  function finish() { active.current = null; setFinished(true); }
  useEffect(() => () => { active.current = null; }, []);
  function nextSection() { if (plan && !finished) openSection(plan, sectionIndex + 1); }
  useEffect(() => {
    if (!plan || finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [plan, finished]);
  useEffect(() => {
    if (plan && !finished && deadline && now >= deadline) openSection(plan, sectionIndex + 1);
  }, [now, deadline, plan, finished, sectionIndex]);

  if (!plan) return <section className="page jlpt-workspace">
    <div className="practice-header"><div><span className="eyebrow">JLPT · N3 / N2 / N1</span><h1>{t("日语试卷结构练习", "Japanese structured paper practice")}</h1><p>{t("按官方科目与题型结构，从现有题库随机抽题。", "Draw existing questions using the official section and item-type structure.")}</p></div></div>
    <div className="paper-type" role="group" aria-label={t("选择试卷模板", "Choose a paper template")}>{jlptExamProfiles.map(profile => <button key={profile.id} className={profileId === profile.id ? "active" : ""} aria-pressed={profileId === profile.id} onClick={() => setProfileId(profile.id)}>{label(profile.label)}</button>)}</div>
    <p className="fine-print">{t("N3（C）、N2（F）、N1（G）是本页的模板对应关系，题目与词汇原有等级保持不变。", "N3 (C), N2 (F), and N1 (G) are template associations here. Existing question and vocabulary levels stay unchanged.")}</p>
    <div className="jlpt-coverage-summary" role="status"><strong>{preview.totalSelected} / {preview.totalRequired}</strong><span>{t("本轮可抽题数／参考题数", "Available draw / reference item count")}</span><p>{preview.complete ? t("当前题库可覆盖本模板各题型。", "The bank can fill each item type in this template.") : t("部分题型尚缺题。本轮只练已有题，保留缺口提示，不重复凑题；没有题的科目会跳过。", "Some item types are missing. Practise the available questions without duplicates; empty sections are skipped and gaps remain visible.")}</p></div>
    <div className="jlpt-sections">{preview.sections.map((item, at) => <section key={item.id}>
      <header><h2>{at + 1}. {label(item.label)}</h2><strong>{item.minutes} {t("分钟", "min")}</strong></header>
      <div className="jlpt-structure-row jlpt-structure-header"><span>{t("题型", "Item type")}</span><span>{t("约题数", "Approx.")}</span><span>{t("本轮", "Draw")}</span></div>
      {preview.coverage.filter(row => row.sectionId === item.id).map(row => <div className={`jlpt-structure-row ${row.missing ? "has-gap" : ""}`} key={row.typeId}><span>{label(row.label)}{row.missing > 0 && <small>{t("缺", "Short by")} {row.missing}</small>}</span><span>{row.required}</span><span>{row.selected}</span></div>)}
    </section>)}</div>
    <button className="primary-button large" onClick={start} disabled={!preview.totalSelected}>{t("开始已有题练习", "Practise available questions")} · {preview.totalSelected}</button>
    {!preview.totalSelected && <p role="status">{t("当前等级还没有匹配该模板题型的题目，可选择其他模板查看。", "No questions at this level currently match these item types. Try another template.")}</p>}
    <p className="fine-print">{label(preview.profile.notes)}</p>
    <p className="fine-print">{t("旧制真题按可对应的题型用于练习，并非现行 JLPT 完整模拟卷；结果只统计本次作答，不换算官方分数。", "Compatible items from older papers are used for practice. This is not a complete current JLPT mock or an official scaled-score estimate.")}</p>
    <p className="jlpt-sources">{preview.profile.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}</p>
  </section>;

  if (finished) return <section className="page jlpt-workspace">
    <span className="eyebrow">{label(plan.profile.label)}</span><h1>{t("本轮结构练习完成", "Structured practice complete")}</h1>
    <p>{t("已答", "Answered")} {Object.keys(answers).length} / {plan.totalSelected} · {t("答对", "Correct")} {Object.values(answers).filter(value => value === "correct").length}</p>
    <div className="jlpt-sections">{plan.sections.map(item => <section key={item.id}><h2>{label(item.label)}</h2><p>{t("已答", "Answered")} {item.questions.filter(question => answers[question.id]).length} / {item.questions.length} · {t("答对", "Correct")} {item.questions.filter(question => answers[question.id] === "correct").length}</p></section>)}</div>
    <p className="fine-print">{t("这是已有题练习的原始作答统计，不是官方 JLPT 分数或合格预测。", "These are raw practice results, not an official JLPT score or a pass prediction.")}</p>
    <div className="jlpt-actions"><button className="primary-button" onClick={start}>{t("重新随机组卷", "Draw another paper")}</button><button className="secondary-button" onClick={() => { setPlan(null); setFinished(false); }}>{t("返回模板", "Back to templates")}</button></div>
  </section>;
  if (!section || !current) return null;
  const position = plan.sections.slice(0, sectionIndex).reduce((sum, item) => sum + item.questions.length, 0) + questionIndex + 1;
  const type = plan.questionTypes[current.id];
  const moreSections = plan.sections.some((item, at) => at > sectionIndex && item.questions.length > 0);
  return <section className="page exam-live jlpt-workspace">
    <div className="exam-toolbar"><div><span>{label(plan.profile.label)} · {label(section.label)}</span><strong>{position} / {plan.totalSelected}</strong></div><div className={`timer ${remaining < 600 ? "urgent" : ""}`} aria-label={t("本科剩余时间", "Section time remaining")}>{clockText(remaining)}</div><button className="secondary-button" onClick={finish}>{t("结束本轮", "Finish practice")}</button></div>
    <div className="jlpt-section-status"><strong>{type && label(type.label)}</strong><span>{t("本科第", "Section item")} {questionIndex + 1} / {section.questions.length}</span></div>
    {renderQuestion(current, answers[current.id], status => {
      const run = active.current;
      if (!run || run.plan !== plan || run.sectionIndex !== sectionIndex || Date.now() >= run.deadline || run.answered.has(current.id)) return;
      run.answered.add(current.id);
      setAnswers(previous => ({ ...previous, [current.id]: status })); onResult(current, status);
    })}
    <div className="question-nav"><button className="secondary-button" disabled={questionIndex === 0} onClick={() => setQuestionIndex(value => Math.max(0, value - 1))}>{t("上一题", "Previous")}</button>{questionIndex < section.questions.length - 1 ? <button className="primary-button" onClick={() => setQuestionIndex(value => value + 1)}>{t("下一题", "Next")}</button> : <button className="primary-button" onClick={nextSection}>{moreSections ? t("完成本科，进入下一科", "Finish section and continue") : t("完成本轮", "Finish practice")}</button>}</div>
    <p className="fine-print">{t("每科独立计时；到时自动进入下一有题科目，已结束的科目不能返回。", "Sections have separate timers. When time expires, practice advances to the next available section; closed sections cannot be reopened.")}</p>
  </section>;
}
