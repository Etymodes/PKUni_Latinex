import { levelLabels, pikkuLevels } from "./questions.ts";
import type { LanguageCode, StudyLevel } from "./questions";

export type JapaneseLevel = "n4" | "n3" | "n2" | "n1";
export type SpanishLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";
export type LanguageLevel = StudyLevel;

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

export const languageOrder: readonly LanguageCode[] = ["zh-mandarin", "en-us", "la", "ja", "es", "grc", "ru"];
export const languageLevelLabels = levelLabels;

export const languageConfigs: Record<LanguageCode, LanguageConfig> = {
  "zh-mandarin": {
    code: "zh-mandarin", name: "汉语（普通话）", nativeName: "普通话",
    breadcrumb: "普通话课程与练习", mascotCopy: "你的普通话学习搭子",
    note: "按 Pikku C/F/G/M 组织独立种子练习。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  "en-us": {
    code: "en-us", name: "英语（美式）", nativeName: "American English",
    breadcrumb: "美式英语课程与练习", mascotCopy: "你的英语学习搭子",
    note: "按 Pikku C/F/G/M 组织独立种子练习。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  la: {
    code: "la", name: "拉丁语", nativeName: "Latīna",
    breadcrumb: "拉丁语课程与练习", mascotCopy: "你的拉丁语学习搭子",
    note: "按 Pikku C/F/G/M 组织练习；北大考试范围保留为外部资源标签。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  ja: {
    code: "ja", name: "日语", nativeName: "日本語",
    breadcrumb: "日语课程与练习", mascotCopy: "你的日语学习搭子",
    note: "按 Pikku C/F/G/M 组织练习；JLPT 标签保留在原题来源中。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  es: {
    code: "es", name: "西班牙语", nativeName: "español",
    breadcrumb: "西班牙语课程与练习", mascotCopy: "你的西班牙语学习搭子",
    note: "按 Pikku C/F/G/M 组织练习；CEFR 标签保留在原题来源中。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  grc: {
    code: "grc", name: "古希腊语", nativeName: "Ἑλληνική",
    breadcrumb: "古希腊语课程与练习", mascotCopy: "你的古希腊语学习搭子",
    note: "恢复古希腊语独立种子练习，按 Pikku C/F/G/M 组织。",
    levels: pikkuLevels, defaultLevel: "C",
  },
  ru: {
    code: "ru", name: "俄语", nativeName: "русский",
    breadcrumb: "俄语课程与练习", mascotCopy: "你的俄语学习搭子",
    note: "按 Pikku C/F/G/M 组织独立种子练习。",
    levels: pikkuLevels, defaultLevel: "C",
  },
};
