import type { QuestionLevel } from "./questions";

export type CurriculumDomain = {
  level: QuestionLevel | "mixed";
  title: string;
  latin: string;
  authors: string;
  examUse: string;
  wheelock: string;
  llpsi: string;
  vocabulary: string[];
  morphology: string[];
  syntax: string[];
  patterns: string[];
  classics: string[];
};

export const curriculumDomains: CurriculumDomain[] = [
  {
    level: "elementary",
    title: "初级",
    latin: "Elementāria",
    authors: "Caesar · Cornelius Nepos",
    examUse: "北大官方初级范围；3 小时完成约 180 词原文英译。",
    wheelock: "第 1–40 章均属基础来源；重点不是学到第几章，而是能在散文中综合调用全书形态与核心从句。",
    llpsi: "Familia Rōmāna I–XXXIII 提供语境化输入；I–XXV 打牢形态和常用句式，XXVI–XXXIII 补齐虚拟式、动名词/动形容词与间接话语。",
    vocabulary: ["Caesar/Nepos 高频军事、地理、人物与行动词", "由曲折词形回溯词典词头", "常用不规则动词主要词形"],
    morphology: ["五套名词变格、三类形容词与比较级", "六时态、三语气、主被动及异相/半异相", "不定式、分词、动名词与动形容词"],
    syntax: ["全部格功能与独立夺格", "简单宾格不定式与时态呼应", "目的、结果、cum、条件、关系特征、恐惧从句"],
    patterns: ["tam/tantus … ut 结果结构", "iubeō + 宾格 + 不定式", "gerundive + 与格施事者"],
    classics: ["Caesar 叙事主干与军事词汇", "Nepos 传记叙事", "Wheelock Locī Antīquī/Immūtātī 的基础散文"],
  },
  {
    level: "intermediate",
    title: "中级",
    latin: "Intermedia",
    authors: "Sallust · Cicero",
    examUse: "包含全部初级要求，并增加历史散文与演说体的特殊形态、语气和嵌套结构。",
    wheelock: "以全 40 章为前置，再使用附录、Locī 与原典阅读补足中级增量；单靠完成正文并不等于覆盖中级。",
    llpsi: "Familia Rōmāna XXVI–XXXV 用于综合；XXXIV 诗艺与 XXXV 语法术语可作为进入原典的桥梁。",
    vocabulary: ["Sallust 道德—政治抽象词", "Cicero 法政、修辞与公共生活词", "同义词语体差异和语境义"],
    morphology: ["希腊式名词变格与 -um/-ū 目的分词", "-īs、-ēre、-re 等历史散文变体", "将来命令式及少见将来被动不定式"],
    syntax: ["间接命令/禁止/愿望/疑问与从属虚拟式", "quin、主观原因、限制与时间从句", "让步、审议、愿望、潜能等主句虚拟式"],
    patterns: ["fore/futūrum esse 与迂说结构", "被动不及物动词的无人称结构", "复合主语/表语的一致规则"],
    classics: ["Sallust 压缩叙事和古风倾向", "Cicero 演说体周期长句", "In Verrem / In Catilinam / Philippicae 题材"],
  },
  {
    level: "mixed",
    title: "混合难度",
    latin: "Gradus mixtus",
    authors: "Elementary ↔ Intermediate",
    examUse: "不是新的官方语法等级；按比例交错抽取初级与中级题，用于未知文本诊断。",
    wheelock: "从正文、附录和 Locī 跨章抽取，不显示章节提示。",
    llpsi: "跨 I–XXXV 取材，训练从语境识别结构而非背章节。",
    vocabulary: ["初/中级词汇交错", "词典回溯速度", "语境义与作者语体判断"],
    morphology: ["规则形态与特殊变体交错", "在无提示情况下判定词形"],
    syntax: ["从单层从句递进到间接话语嵌套", "混合作者与体裁"],
    patterns: ["考前随机组卷", "错题薄弱域加权", "有序与随机模式对照"],
    classics: ["Caesar/Nepos/Sallust/Cicero 混合", "不加入进阶域的超纲难点"],
  },
  {
    level: "advanced",
    title: "进阶",
    latin: "Ultrā fīnēs",
    authors: "Long syntax · textual nuance · poetry",
    examUse: "明确超出北大中级最低清单，用于原典深读和高强度长句训练。",
    wheelock: "Locī Immūtātī、补充句法、词形总表与古式用法。",
    llpsi: "XXXIV De Arte Poēticā、XXXV Ars Grammatica，并向第二册和独立原典延伸。",
    vocabulary: ["古式、诗体和低频词形", "修辞语义与语用色彩", "词源和语义演变"],
    morphology: ["古式/缩合/诗体变体", "罕见迂说与文本异读", "格律导致的形态识别"],
    syntax: ["多层间接话语和长距离一致", "语气选择、歧义消解、信息来源", "周期句与文本批评"],
    patterns: ["过去反事实的间接表达", "主观理由与作者立场", "复杂关系链与修辞次序"],
    classics: ["演说、史学和诗歌跨体裁", "格律、修辞与文本校勘入门", "不以进阶题代替官方中级备考"],
  },
];

export type EtymologyFact = {
  latin: string;
  meaning: string;
  english: string[];
  romance: string[];
  note: string;
};

export const etymologyFacts: EtymologyFact[] = [
  { latin: "aqua", meaning: "水", english: ["aquatic", "aquarium"], romance: ["意大利语 acqua", "西班牙语 agua", "法语 eau"], note: "法语 eau 音形变化最大，但仍来自同一拉丁词。" },
  { latin: "cor, cordis", meaning: "心", english: ["cordial", "courage"], romance: ["意大利语 cuore", "西班牙语 corazón", "法语 cœur"], note: "英语 cordial 通过拉丁/法语进入；courage 的远源也是“心”。" },
  { latin: "scrībō, scrībere", meaning: "写", english: ["scribe", "describe", "manuscript"], romance: ["意大利语 scrivere", "西班牙语 escribir", "法语 écrire"], note: "前缀改变动作方向，词根 scrīb-/scrīpt- 保留“写”的概念。" },
  { latin: "pater, patris", meaning: "父亲", english: ["paternal", "patron"], romance: ["意大利语 padre", "西班牙语 padre", "法语 père"], note: "英语 father 与拉丁 pater 是印欧同源词，并非直接借入。" },
  { latin: "lūx, lūcis", meaning: "光", english: ["lucid", "translucent"], romance: ["意大利语 luce", "西班牙语 luz", "法语 lueur"], note: "完成词干和派生词常保存 lūc- 这一词干。" },
  { latin: "veniō, venīre", meaning: "来", english: ["convene", "intervene", "advent"], romance: ["意大利语 venire", "西班牙语 venir", "法语 venir"], note: "英语 advent 来自 ad- + venīre 的完成分词词干 vent-." },
  { latin: "dūcō, dūcere", meaning: "引导", english: ["conduct", "educate", "reduce"], romance: ["意大利语 condurre", "西班牙语 conducir", "法语 conduire"], note: "dūc- 与完成分词词干 duct- 在英语派生词中交替出现。" },
  { latin: "cīvitās, cīvitātis", meaning: "公民共同体／国家", english: ["civic", "civilization", "city"], romance: ["意大利语 città", "西班牙语 ciudad", "法语 cité"], note: "古典语义不总等于现代“城市”，翻译需依政治语境。" },
];

export type VocabItem = {
  lemma: string;
  gloss: string;
  distractors: string[];
  level: QuestionLevel;
  family: string;
};

export const vocabItems: VocabItem[] = [
  { lemma: "castra, -ōrum n. pl.", gloss: "军营", distractors: ["武器", "军团", "城堡"], level: "elementary", family: "军事" },
  { lemma: "dūcō, dūcere, dūxī, ductum", gloss: "引导；率领", distractors: ["派遣", "战斗", "包围"], level: "elementary", family: "行动" },
  { lemma: "cōgnōscō, -ere, cōgnōvī, cōgnitum", gloss: "认识；得知", distractors: ["隐藏", "命令", "怀疑"], level: "elementary", family: "认知" },
  { lemma: "proficīscor, proficīscī, profectus sum", gloss: "出发", distractors: ["返回", "前进获胜", "宣告"], level: "elementary", family: "异相动词" },
  { lemma: "praesidium, -ī n.", gloss: "守备；保护；驻军", distractors: ["战利品", "会议", "港口"], level: "elementary", family: "军事" },
  { lemma: "quod", gloss: "因为；这一事实；关系代词中性", distractors: ["只有……才", "虽然", "直到"], level: "elementary", family: "连接词" },
  { lemma: "virtūs, virtūtis f.", gloss: "勇德；卓越；勇气", distractors: ["真理", "财富", "年老"], level: "elementary", family: "抽象词" },
  { lemma: "auctoritās, -ātis f.", gloss: "威望；权威；影响力", distractors: ["法律文本", "军队规模", "友谊"], level: "intermediate", family: "政治" },
  { lemma: "cupīdō, -inis f.", gloss: "欲望；贪求", distractors: ["谨慎", "命运", "职责"], level: "intermediate", family: "Sallust" },
  { lemma: "coniūrātiō, -ōnis f.", gloss: "共谋；阴谋", distractors: ["选举", "判决", "辩论"], level: "intermediate", family: "政治" },
  { lemma: "dignitās, -ātis f.", gloss: "身份；威望；尊严", distractors: ["贫困", "军权", "证词"], level: "intermediate", family: "Cicero" },
  { lemma: "neglegō, -ere, neglēxī, neglēctum", gloss: "忽视；疏忽", distractors: ["选择", "否认", "保卫"], level: "intermediate", family: "行动" },
  { lemma: "quamquam", gloss: "虽然；尽管", distractors: ["只要", "以至于", "在……之前"], level: "intermediate", family: "连接词" },
  { lemma: "ultro", gloss: "主动地；此外；甚至", distractors: ["暗中", "从前", "徒劳地"], level: "advanced", family: "语用" },
  { lemma: "quippe", gloss: "诚然；因为显然", distractors: ["几乎不", "无论何时", "因此以后"], level: "advanced", family: "语用" },
  { lemma: "faxō", gloss: "我一定会做到／使……（古式）", distractors: ["我曾说", "让他去做", "我正在制造"], level: "advanced", family: "古式" },
];
