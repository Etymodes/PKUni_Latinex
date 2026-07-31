import type { LanguageCode, Level } from "./questions";

export type JapaneseLevel = "n4" | "n3" | "n2" | "n1";
export type SpanishLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";
export type LanguageLevel = Level | JapaneseLevel | SpanishLevel;

export type LanguageConfig = {
  code: LanguageCode;
  name: string;
  nativeName: string;
  breadcrumb: string;
  mascotCopy: string;
  note: string;
  levels: readonly LanguageLevel[];
  defaultLevel: LanguageLevel;
};

export const languageOrder: readonly LanguageCode[] = ["la", "ja", "es"];

export const languageLevelLabels: Record<LanguageLevel, string> = {
  elementary: "初级",
  intermediate: "中级",
  mixed: "混合难度",
  advanced: "进阶",
  n4: "N4",
  n3: "N3",
  n2: "N2",
  n1: "N1",
  a1: "A1",
  a2: "A2",
  b1: "B1",
  b2: "B2",
  c1: "C1",
  c2: "C2",
};

export const languageConfigs: Record<LanguageCode, LanguageConfig> = {
  la: {
    code: "la",
    name: "拉丁语",
    nativeName: "Latīna",
    breadcrumb: "拉丁语标准化考试训练",
    mascotCopy: "你的拉丁语刷题搭子",
    note: "依据北大公开考试范围编排，题目均为仿真练习。",
    levels: ["elementary", "intermediate", "mixed", "advanced"],
    defaultLevel: "elementary",
  },
  ja: {
    code: "ja",
    name: "日语",
    nativeName: "日本語",
    breadcrumb: "日语能力考试学习与模拟",
    mascotCopy: "你的日语学习搭子",
    note: "首版按 JLPT N4–N1 建立训练域，题库将在 P2 接入。",
    levels: ["n4", "n3", "n2", "n1"],
    defaultLevel: "n4",
  },
  es: {
    code: "es",
    name: "西班牙语",
    nativeName: "Español",
    breadcrumb: "西班牙语 CEFR 学习与模拟",
    mascotCopy: "你的西班牙语学习搭子",
    note: "首版按 CEFR A1–C2 建立训练域，题库将在 P2 接入。",
    levels: ["a1", "a2", "b1", "b2", "c1", "c2"],
    defaultLevel: "a1",
  },
};
