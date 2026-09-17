import type { VocabItem } from "./curriculum";
import type { LanguageCode, PikkuLevel, Question } from "./questions";

export type MultilingualVocabItem = VocabItem & {
  language: LanguageCode;
  htmlLang: string;
  level: PikkuLevel;
};

// Recovered from Sites v7 (b215d9bb). Its "mixed" seed tier meant M;
// historical Cloudflare "mixed" preferences retain their separate legacy meaning.
export const multilingualVocabItems: MultilingualVocabItem[] = [
  { language: "la", htmlLang: "la", level: "M", lemma: "quīn immo", gloss: "不但如此，反而 / indeed, rather", distractors: ["也许 / perhaps", "最终 / finally", "即使 / even if"], family: "语用 / discourse" },

  { language: "en-us", htmlLang: "en-US", level: "C", lemma: "hello", gloss: "你好；用于问候", distractors: ["再见", "谢谢", "请"], family: "问候" },
  { language: "en-us", htmlLang: "en-US", level: "F", lemma: "although", gloss: "虽然；尽管", distractors: ["因此", "除非", "同时"], family: "连接词" },
  { language: "en-us", htmlLang: "en-US", level: "G", lemma: "notwithstanding", gloss: "尽管；不过", distractors: ["尤其", "立刻", "与此同时"], family: "书面语" },
  { language: "en-us", htmlLang: "en-US", level: "M", lemma: "implicature", gloss: "会话含意；言外之意", distractors: ["字面拼写", "语音同化", "时态一致"], family: "语用学" },

  { language: "zh-mandarin", htmlLang: "zh-CN", level: "C", lemma: "你好 nǐ hǎo", gloss: "hello", distractors: ["goodbye", "thank you", "please"], family: "greeting" },
  { language: "zh-mandarin", htmlLang: "zh-CN", level: "F", lemma: "未必 wèi bì", gloss: "not necessarily", distractors: ["certainly", "immediately", "again"], family: "modality" },
  { language: "zh-mandarin", htmlLang: "zh-CN", level: "G", lemma: "言外之意 yán wài zhī yì", gloss: "an implied meaning", distractors: ["a spelling rule", "a direct quotation", "a final answer"], family: "pragmatics" },
  { language: "zh-mandarin", htmlLang: "zh-CN", level: "M", lemma: "不言而喻 bù yán ér yù", gloss: "self-evident; understood without being said", distractors: ["hard to pronounce", "open to voting", "written word for word"], family: "idiom" },

  { language: "ja", htmlLang: "ja", level: "C", lemma: "ありがとう", gloss: "谢谢 / thank you", distractors: ["早上好 / good morning", "再见 / goodbye", "请稍等 / please wait"], family: "あいさつ" },
  { language: "ja", htmlLang: "ja", level: "F", lemma: "見極める", gloss: "看清并作出判断 / assess carefully", distractors: ["突然忘记 / forget suddenly", "反复朗读 / read repeatedly", "提前离开 / leave early"], family: "動詞" },
  { language: "ja", htmlLang: "ja", level: "G", lemma: "かえって", gloss: "反而；结果与预期相反 / on the contrary", distractors: ["终于 / finally", "大概 / probably", "例如 / for example"], family: "副詞" },
  { language: "ja", htmlLang: "ja", level: "M", lemma: "余韻", gloss: "余味、余音 / lingering resonance", distractors: ["口头约定 / verbal agreement", "临时休息 / short break", "字面顺序 / literal order"], family: "語感" },

  { language: "es", htmlLang: "es", level: "C", lemma: "hola", gloss: "你好 / hello", distractors: ["再见 / goodbye", "谢谢 / thank you", "晚上 / evening"], family: "saludo" },
  { language: "es", htmlLang: "es", level: "F", lemma: "aunque", gloss: "虽然；即使 / although", distractors: ["因为 / because", "直到 / until", "所以 / therefore"], family: "conjunción" },
  { language: "es", htmlLang: "es", level: "G", lemma: "sin embargo", gloss: "然而 / nevertheless", distractors: ["换句话说 / in other words", "立刻 / immediately", "此外 / moreover"], family: "conector" },
  { language: "es", htmlLang: "es", level: "M", lemma: "soslayar", gloss: "回避；绕开 / sidestep", distractors: ["赞扬 / praise", "证实 / verify", "汇总 / compile"], family: "matiz" },

  { language: "grc", htmlLang: "grc", level: "C", lemma: "χαῖρε", gloss: "你好；欢喜吧 / greetings", distractors: ["沉默吧 / be silent", "快走 / hurry", "我知道 / I know"], family: "χαιρετισμός" },
  { language: "grc", htmlLang: "grc", level: "F", lemma: "λόγος", gloss: "言语、论说、道理 / word, account, reason", distractors: ["道路 / road", "礼物 / gift", "城墙 / wall"], family: "ὄνομα" },
  { language: "grc", htmlLang: "grc", level: "G", lemma: "μέν … δέ", gloss: "一方面……另一方面…… / on one hand … on the other", distractors: ["如果……就……", "不但……而且……", "直到……为止……"], family: "μόρια" },
  { language: "grc", htmlLang: "grc", level: "M", lemma: "ἀμφίβολος", gloss: "含混的；可作两解的 / ambiguous", distractors: ["公开的 / public", "迅速的 / swift", "神圣的 / sacred"], family: "σημασία" },

  { language: "ru", htmlLang: "ru", level: "C", lemma: "здравствуйте", gloss: "您好 / hello", distractors: ["谢谢 / thank you", "再见 / goodbye", "请 / please"], family: "приветствие" },
  { language: "ru", htmlLang: "ru", level: "F", lemma: "потому что", gloss: "因为 / because", distractors: ["虽然 / although", "如果 / if", "直到 / until"], family: "союз" },
  { language: "ru", htmlLang: "ru", level: "G", lemma: "однако", gloss: "然而 / however", distractors: ["尤其 / especially", "从前 / formerly", "因此 / therefore"], family: "связь" },
  { language: "ru", htmlLang: "ru", level: "M", lemma: "двусмысленность", gloss: "歧义；双重含义 / ambiguity", distractors: ["清晰度 / clarity", "一致 / agreement", "词序 / word order"], family: "семантика" },
];

export const multilingualSeedQuestions: Question[] = multilingualVocabItems.map((item, index) => ({
  id: `${item.language}-${item.level.toLowerCase()}-seed-${String(index + 1).padStart(2, "0")}`,
  language: item.language,
  level: item.level,
  category: "vocabulary",
  type: "choice",
  prompt: "选择最准确的意思。 / Choose the closest meaning.",
  text: item.lemma,
  targetText: item.lemma,
  targetLang: item.htmlLang,
  options: [item.gloss, ...item.distractors],
  answer: 0,
  explanation: `${item.lemma}：${item.gloss}。`,
  tags: [item.family, `Pikku ${item.level}`],
  source: `Pikku ${item.level} · multilingual seed`,
  sourceStatus: "original",
}));
