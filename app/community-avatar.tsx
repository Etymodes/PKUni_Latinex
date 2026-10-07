"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/supabase";
import { communityAvatarPresets, communityAvatarText, defaultCommunityAvatar, isCommunityAvatar, normalizeCommunityAvatar, type CommunityAvatar } from "@/lib/community-avatar";

export function CommunityAvatarBadge({ avatar, locale, small = false }: { avatar?: unknown; locale: string; small?: boolean }) {
  const value = normalizeCommunityAvatar(avatar);
  const preset = communityAvatarPresets.find(item => item.id === value.value);
  const description = value.kind === "initials" ? value.value : preset?.[locale === "en" ? "en" : "zh"] || "";
  return <span className={`community-avatar ${small ? "small" : ""}`} role="img" aria-label={`${locale === "en" ? "Community avatar" : "社区头像"} · ${description}`}>{communityAvatarText(value)}</span>;
}

export function CommunityAvatarSettings({ locale, authenticated }: { locale: string; authenticated: boolean }) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const [avatar, setAvatar] = useState<CommunityAvatar>(defaultCommunityAvatar);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error" | "login">("");
  const active = useRef(true), savingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    const load = new AbortController();
    if (authenticated) {
      setLoading(true);
      apiFetch("/api/community/profile", { signal: load.signal }).then(async response => {
        if (!response.ok) throw new Error("profile_unavailable");
        const data = await response.json();
        if (!isCommunityAvatar(data?.avatar)) throw new Error("invalid_avatar");
        if (active.current && !load.signal.aborted) setAvatar(data.avatar);
      }).catch(failure => { if (active.current && !load.signal.aborted && failure.name !== "AbortError") setStatus("error"); })
        .finally(() => { if (active.current && !load.signal.aborted) setLoading(false); });
    }
    return () => { active.current = false; load.abort(); controller.current?.abort(); };
  }, [authenticated]);
  const save = async () => {
    if (!authenticated || loading || savingRef.current || !isCommunityAvatar(avatar)) return;
    savingRef.current = true; setSaving(true); setStatus("");
    const request = new AbortController(); controller.current = request;
    try {
      const response = await apiFetch("/api/community/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatar }), signal: request.signal });
      const data = await response.json();
      if (!active.current || request.signal.aborted) return;
      if (!response.ok) { setStatus(response.status === 401 ? "login" : "error"); return; }
      if (!isCommunityAvatar(data?.avatar) || data.avatar.kind !== avatar.kind || data.avatar.value !== avatar.value) { setStatus("error"); return; }
      setAvatar(data.avatar); setStatus("saved");
    } catch (failure) { if (active.current && !request.signal.aborted && (failure as Error).name !== "AbortError") setStatus("error"); }
    finally { savingRef.current = false; if (active.current && !request.signal.aborted) setSaving(false); }
  };
  const disabled = !authenticated || loading || saving;
  return <section className="settings-panel avatar-settings">
    <div className="settings-copy"><CommunityAvatarBadge avatar={avatar} locale={locale} /><div><h2>{t("社区头像", "Community avatar")}</h2><p>{t("设置后在社区消息中显示，并随账号在网页与小程序同步。", "Shown beside community messages and shared by your account across web and mini program.")}</p></div></div>
    {!authenticated ? <p role="status">{t("登录后可设置你的社区头像。", "Sign in to choose your community avatar.")}</p> : <>
      <div className="avatar-type" role="group" aria-label={t("头像类型", "Avatar type")}><button disabled={disabled} aria-pressed={avatar.kind === "initials"} onClick={() => { setAvatar({kind:"initials",value:"P"});setStatus(""); }}>{t("字母", "Letters")}</button><button disabled={disabled} aria-pressed={avatar.kind === "preset"} onClick={() => { setAvatar(defaultCommunityAvatar);setStatus(""); }}>{t("水果／动物", "Fruit / animals")}</button></div>
      {avatar.kind === "initials" ? <label className="avatar-initials">{t("头像字母", "Avatar letters")}<input disabled={disabled} maxLength={3} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={avatar.value} onChange={event => { setAvatar({kind:"initials",value:event.target.value});setStatus(""); }} placeholder="A / AB / Ab / Abc" /><small>{t("允许 1–2 个大写字母，或 1 个大写加 1–2 个小写字母。", "Use 1–2 uppercase letters, or one uppercase followed by 1–2 lowercase letters.")}</small>{!isCommunityAvatar(avatar) && <span role="alert">{t("例如 A、AB、Ab、Abc；不支持数字或其他字符。", "Examples: A, AB, Ab, Abc. Numbers and other characters are not supported.")}</span>}</label> : <div className="avatar-presets" role="group" aria-label={t("预设头像", "Preset avatars")}>{communityAvatarPresets.map(preset => <button key={preset.id} disabled={disabled} aria-label={preset[locale === "en" ? "en" : "zh"]} aria-pressed={avatar.value === preset.id} onClick={() => { setAvatar({kind:"preset",value:preset.id});setStatus(""); }}><span aria-hidden="true">{preset.emoji}</span><small>{preset[locale === "en" ? "en" : "zh"]}</small></button>)}</div>}
      <div className="avatar-save"><button className="primary-button" disabled={disabled || !isCommunityAvatar(avatar)} onClick={() => void save()}>{loading ? t("正在读取…", "Loading…") : saving ? t("保存中…", "Saving…") : t("保存头像", "Save avatar")}</button>{status && <p role={status === "saved" ? "status" : "alert"}>{status === "saved" ? t("头像已保存。", "Avatar saved.") : status === "login" ? t("登录已失效，请重新登录。", "Your session expired. Please sign in again.") : t("头像未能同步，请稍后重试。", "The avatar could not be synced. Please try again.")}</p>}</div>
    </>}
  </section>;
}
