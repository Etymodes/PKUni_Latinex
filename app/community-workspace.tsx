"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, MessageCircle, Send, Users } from "lucide-react";
import { apiFetch } from "@/lib/supabase";
import { CommunityAvatarBadge } from "./community-avatar";

type Message = { avatar?: unknown; id: string; authorName: string; mine: boolean; text: string; createdAt: string; detectedLanguage: string | null };
type Channel = "language" | "study";
type Props = { language: string; languageName: string; locale: string; authenticated: boolean; isAdmin?: boolean };
type RoomState = { messages: Message[]; warnings: number; mutedUntil: string | null; aiAvailable: boolean };
const emptyRoom: RoomState = { messages: [], warnings: 0, mutedUntil: null, aiAvailable: true };

export function CommunityWorkspace(props: Props) {
  const [channel, setChannel] = useState<Channel>("language");
  const t = (zh: string, en: string) => props.locale === "en" ? en : zh;
  return <div className="page community-page">
    <div className="practice-header"><div><span className="eyebrow">FORUM PIKKU</span><h1>{props.languageName} · {t("交流社区", "Community")}</h1><p>{t("和同伴交流、练习、一起进步。", "Learn, practise and exchange ideas with other learners.")}</p></div></div>
    {process.env.NEXT_PUBLIC_STATIC_PUBLIC === "true" ? <section className="story-pending"><MessageCircle size={36} /><h2>{t("前往正式 Pikku 交流", "Join the community on Pikku")}</h2><p>{t("公开静态镜像不提供账号与群聊服务。", "This static mirror does not provide accounts or live chat.")}</p><a className="primary-button" href="https://pikku.qzz.io/">{t("打开 Pikku", "Open Pikku")}</a></section> : !["la", "ja"].includes(props.language) ? <section className="story-pending"><Users size={36} /><h2>{t("即将推出", "Coming soon")}</h2><p>{t("交流社区先开放拉丁语与日语，其他语言将陆续加入。", "Latin and Japanese communities are available first. Other languages will follow.")}</p></section> : <>
      <div className="community-channels" role="group" aria-label={t("选择频道", "Choose a channel")}>
        <button className={channel === "language" ? "active" : ""} aria-pressed={channel === "language"} onClick={() => setChannel("language")}><Languages size={20} /><span>{props.languageName}<small>{t("语言练习频道", "Language practice")}</small></span></button>
        <button className={channel === "study" ? "active" : ""} aria-pressed={channel === "study"} onClick={() => setChannel("study")}><Users size={20} /><span>{t("学习交流", "Study discussion")}<small>{t("任何语言都可以", "All languages welcome")}</small></span></button>
      </div>
      <CommunityRoom key={channel} {...props} channel={channel} />
    </>}
  </div>;
}

function CommunityRoom({ language, languageName, locale, authenticated, isAdmin, channel }: Props & { channel: Channel }) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const [room, setRoom] = useState<RoomState>(emptyRoom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [reported, setReported] = useState<string[]>([]);
  const [reports, setReports] = useState<{message: Message; reason: string; reportedAt: string}[] | null>(null);
  const active = useRef(true);
  const sendingRef = useRef(false);
  const revision = useRef(0);
  const attempt = useRef<{ text: string; clientId: string } | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const refresh = useRef<() => void>(() => {});
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const muteSeconds = Math.max(0, Math.ceil((Date.parse(room.mutedUntil ?? "") - now) / 1000)) || 0;
  const muted = channel === "language" && muteSeconds > 0;

  function errorText(code: string, warnings = room.warnings) {
    switch (code) {
      case "language_warning": return t(`这条消息未发送：超过 5 个词的消息需要使用${languageName}。第 ${warnings}/3 次警告，第 4 次将禁言 1 小时。`, `Message not sent: messages over 5 words must use ${languageName}. Warning ${warnings}/3; the fourth violation mutes language channels for one hour.`);
      case "muted": return t("语言频道已禁言 1 小时，结束后警告重新计数。学习交流频道仍可使用。", "Language channels are muted for one hour. Warnings reset afterward; study discussion remains available.");
      case "language_check_unavailable": return t("暂时无法可靠判断消息语言，未增加警告。请稍后重试，或使用学习交流频道。", "The message language could not be checked reliably. No warning was added. Retry later or use study discussion.");
      case "request_pending": return t("上次发送仍在处理中，请稍后重试。", "Your previous send is still being processed. Please retry shortly.");
      case "translation_unavailable": return t("翻译暂时不可用，请稍后重试。", "Translation is unavailable. Please try again later.");
      case "unauthorized": case "authentication_required": return t("请先通过页面上方的账号入口登录。", "Please sign in using the account control at the top of the page.");
      case "rate_limited": return t("操作太频繁，请稍后再试。", "Too many requests. Please try again shortly.");
      case "not_found": return t("这条消息已不可用，请刷新频道。", "This message is no longer available. Refresh the channel.");
      default: return t("操作未完成，请重试。未成功发送的文字会保留。", "The request failed. Please retry. Unsent text has been kept.");
    }
  }

  async function request(path: string, body?: unknown, method = "POST") {
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const response = await apiFetch(path, { method, signal: controller.signal, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(errorText(data.error, data.warnings)), { data });
      return data;
    } finally { controllers.current.delete(controller); }
  }

  useEffect(() => {
    active.current = true;
    let reading = false, queued = false;
    const load = async () => {
      if (document.hidden || !active.current) return;
      if (reading) { queued = true; return; }
      reading = true;
      const startedAt = revision.current;
      try {
        const data = await request(`/api/community?language=${language}&channel=${channel}`, undefined, "GET");
        if (active.current && startedAt === revision.current) { setRoom(data); setLoading(false); }
        else if (active.current) queued = true;
      } catch (failure) {
        if (active.current && (failure as Error).name !== "AbortError") { setError(t("频道加载失败，请重试。", "Could not load the channel. Please retry.")); setLoading(false); }
      } finally { reading = false; if (queued && active.current) { queued = false; void load(); } }
    };
    refresh.current = () => { setError(""); void load(); };
    const visible = () => { if (!document.hidden) void load(); };
    void load();
    const poll = window.setInterval(load, 10000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", visible);
    return () => { active.current = false; window.clearInterval(poll); window.clearInterval(clock); document.removeEventListener("visibilitychange", visible); controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); };
  }, [language, channel, locale, authenticated]);

  useEffect(() => { if (nearBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [room.messages]);

  const send = async () => {
    const text = draft.trim();
    if (!authenticated || muted || !text || sendingRef.current) return;
    sendingRef.current = true; revision.current += 1; setSending(true); setError("");
    if (!attempt.current || attempt.current.text !== text) attempt.current = { text, clientId: crypto.randomUUID() };
    try {
      const data = await request("/api/community/messages", { language, channel, text, clientId: attempt.current.clientId });
      if (!active.current) return;
      revision.current += 1;
      setRoom(current => ({ ...current, warnings: data.warnings, mutedUntil: data.mutedUntil, messages: data.message ? [...current.messages.filter(item => item.id !== data.message.id), data.message].slice(-50) : current.messages }));
      setDraft(""); attempt.current = null; nearBottom.current = true; refresh.current();
    } catch (failure) {
      if (!active.current || (failure as Error).name === "AbortError") return;
      revision.current += 1;
      const data = (failure as Error & { data?: (Partial<RoomState> & { error?: string }) }).data;
      if (data && typeof data.warnings === "number") setRoom(current => ({ ...current, warnings: data.warnings!, mutedUntil: data.mutedUntil ?? null }));
      if (data?.error === "language_warning" || data?.error === "muted") attempt.current = null;
      setError(data ? (failure as Error).message : errorText(""));
    } finally { sendingRef.current = false; if (active.current) setSending(false); }
  };

  const translate = async (id: string) => {
    if (!authenticated || translating[id]) return;
    setTranslating(current => ({ ...current, [id]: true })); setError("");
    try {
      const data = await request(`/api/community/messages/${encodeURIComponent(id)}/translate`, { locale });
      if (active.current) setTranslations(current => ({ ...current, [id]: data.translation }));
    } catch (failure) { if (active.current && (failure as Error).name !== "AbortError") setError((failure as Error).message); }
    finally { if (active.current) setTranslating(current => ({ ...current, [id]: false })); }
  };

  const moderate = async (message: Message, remove: boolean) => {
    if (!authenticated) return;
    if (remove && !window.confirm(t("删除这条消息？", "Delete this message?"))) return;
    try {
      if (remove) revision.current += 1;
      await request(`/api/community/messages/${encodeURIComponent(message.id)}${remove ? "" : "/report"}`, remove ? undefined : { reason: "Content needs moderator review" }, remove ? "DELETE" : "POST");
      if (!active.current) return;
      if (remove) { revision.current += 1; setRoom(current => ({ ...current, messages: current.messages.filter(item => item.id !== message.id) })); setReports(current => current?.filter(report => report.message.id !== message.id) ?? null); refresh.current(); }
      else setReported(current => [...current, message.id]);
    } catch (failure) { if (active.current && (failure as Error).name !== "AbortError") setError((failure as Error).message); }
  };

  const loadReports = async () => {
    try {
      const data = await request("/api/community/reports", undefined, "GET");
      if (active.current) setReports(data.reports);
    } catch (failure) { if (active.current && (failure as Error).name !== "AbortError") setError(errorText("")); }
  };

  const languageLabel = (code: string | null) => {
    const names: Record<string, [string, string]> = { la: ["拉丁语", "Latin"], ja: ["日语", "Japanese"], en: ["英语", "English"], zh: ["中文", "Chinese"], "zh-CN": ["中文", "Chinese"], fr: ["法语", "French"], es: ["西班牙语", "Spanish"], ar: ["阿拉伯语", "Arabic"], ru: ["俄语", "Russian"] };
    return code && names[code] ? t(...names[code]) : t("语言待识别", "Language not identified");
  };

  return <section className="chat-room" aria-label={t("群聊", "Group chat")}>
    <div className="chat-rules"><MessageCircle size={19} /><div><strong>{channel === "language" ? `${languageName} · ${t("语言频道", "Language channel")}` : t("学习交流 · 不限语言", "Study discussion · any language")}</strong><p>{channel === "language" ? t("超过 5 个词的非本频道语言消息不予发送：前三次警告，第 4 次禁言语言频道 1 小时，结束后重新计数。", "Off-language messages over 5 words are not sent: three warnings, then a one-hour mute on the fourth violation. Warnings reset when the mute ends.") : t("分享学习方法与问题，任何语言都可以。点击他人的消息下方按钮可翻译。", "Share study tips and questions in any language. Use the button below another learner’s message to translate it.")}</p><small>{t("这是公开频道，请勿发布私人信息。长句由 AI 辅助识别；翻译按需生成并缓存，可能有误。消息内容会交由 Cloudflare 处理。", "This is a public channel; avoid private information. AI checks long messages. Translations are generated on request and cached; errors are possible. Message text is processed by Cloudflare.")}</small></div></div>
    {!room.aiAvailable && !loading && <p className="chat-notice" role="status">{t("语言识别和翻译暂时不可用。长句请在学习交流频道发送。", "Language checks and translation are unavailable. Please use study discussion for longer messages.")}</p>}
    {channel === "language" && <div className="chat-status" role="status">{muted ? t(`禁言剩余 ${Math.ceil(muteSeconds / 60)} 分钟 · 学习交流仍可使用`, `Muted for ${Math.ceil(muteSeconds / 60)} more min · study discussion remains available`) : t(`警告 ${room.warnings}/3 · 第 4 次禁言`, `Warnings ${room.warnings}/3 · fourth violation triggers a mute`)}</div>}
    {isAdmin && <details className="chat-moderation"><summary>{t("举报管理", "Reported messages")}</summary><button className="text-button" onClick={() => void loadReports()}>{t("刷新待处理举报", "Refresh pending reports")}</button>{reports?.length === 0 && <p>{t("暂无待处理举报。", "No pending reports.")}</p>}{reports?.map((report, index) => <article key={`${report.message.id}:${index}`}><strong>{report.message.authorName}</strong><p dir="auto">{report.message.text}</p><small>{report.reason}</small><button className="text-button" onClick={() => void moderate(report.message, true)}>{t("删除消息并处理举报", "Delete message and resolve report")}</button></article>)}</details>}
    <div className="chat-messages" ref={scroll} role="log" aria-live="polite" aria-relevant="additions" onScroll={() => { const box = scroll.current; if (box) nearBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; }}>
      {loading ? <p className="chat-empty">{t("正在加载频道…", "Loading channel…")}</p> : !room.messages.length ? <div className="chat-empty"><MessageCircle size={28} /><p>{error ? t("消息暂未加载。", "Messages have not loaded.") : t("还没有消息，来开始交流吧。", "No messages yet. Start a conversation.")}</p></div> : room.messages.map(message => <article className={`chat-message ${message.mine ? "mine" : ""}`} key={message.id}>
        <div className="chat-meta"><CommunityAvatarBadge avatar={message.avatar} locale={locale} small /><strong>{message.authorName}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div>
        <div className="chat-bubble" dir="auto">{message.text}</div>
        {translations[message.id] && <div className="chat-translation" lang={locale}><small>{t("机器翻译 · 仅供参考", "Machine translation · may contain errors")}</small><p>{translations[message.id]}</p></div>}
        <div className="chat-message-actions"><span>{languageLabel(message.detectedLanguage)}</span>{!message.mine && <button disabled={!authenticated || translating[message.id] || Boolean(translations[message.id]) || !room.aiAvailable} onClick={() => void translate(message.id)}>{translating[message.id] ? t("翻译中…", "Translating…") : translations[message.id] ? t("已翻译", "Translated") : t("译为中文", "Translate to English")}</button>}{authenticated && (message.mine || isAdmin) && <button onClick={() => void moderate(message, true)}>{t("删除", "Delete")}</button>}{authenticated && !message.mine && <button disabled={reported.includes(message.id)} onClick={() => void moderate(message, false)}>{reported.includes(message.id) ? t("已举报", "Reported") : t("举报", "Report")}</button>}</div>
      </article>)}
    </div>
    {error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => refresh.current()}>{t("刷新频道", "Refresh channel")}</button></div>}
    {!authenticated && <p className="chat-notice">{t("可浏览公开消息。登录后可发言、翻译和举报；账号入口位于页面上方。", "You can read public messages. Sign in at the top of the page to send, translate or report messages.")}</p>}
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="community-message">{t("消息内容", "Message")}</label><textarea id="community-message" value={draft} maxLength={1000} rows={3} disabled={!authenticated || muted || sending} placeholder={t("输入消息…", "Write a message…")} onChange={event => { setDraft(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div><small>{draft.length}/1000 · {t("Shift + Enter 换行", "Shift + Enter for a new line")}</small><button type="submit" className="primary-button" disabled={!authenticated || muted || sending || !draft.trim()}><Send size={16} />{sending ? t("发送中…", "Sending…") : t("发送", "Send")}</button></div>
    </form>
  </section>;
}
