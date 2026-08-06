import type { QuestionLevel, ReviewStatus } from "./questions";

export type AccessStatus = "uploaded" | "official" | "preview" | "catalogued" | "public-domain";

export type TextbookRecord = {
  id: string;
  title: string;
  authors: string;
  edition: string;
  language: string;
  access: AccessStatus;
  accessNote: string;
  alignment: Record<QuestionLevel, string>;
  strengths: string[];
};

export const textbookCatalog: TextbookRecord[] = [
  {
    id: "llpsi-fr", title: "Lingua Latīna per sē illūstrāta: Familia Rōmāna", authors: "Hans H. Ørberg", edition: "Pars I", language: "拉丁语",
    access: "uploaded", accessNote: "已上传供内部知识点提取；公开站只发布原创题目和章节映射。",
    alignment: { elementary: "I–XXXIII 覆盖形态、核心从句与连续阅读。", intermediate: "XXVI–XXXV 用于综合识别和向原典过渡。", advanced: "XXXIV–XXXV 进入诗体和拉丁语法术语。" },
    strengths: ["自然输入", "连续叙事", "语境词汇", "拉丁语释义"],
  },
  {
    id: "latin-integrated-1", title: "《拉丁语综合教程 1》", authors: "国内改编教材", edition: "第一册", language: "中文／拉丁语",
    access: "catalogued", accessNote: "待核对正式书目信息与授权来源。",
    alignment: { elementary: "作为 LLPSI 路线的中文课堂补充。", intermediate: "待逐章核对。", advanced: "不作为进阶主要来源。" },
    strengths: ["中文课堂解释", "综合训练", "本土教学语境"],
  },
  {
    id: "ltrl2", title: "Learn to Read Latin", authors: "Andrew Keller · Stephanie Russell", edition: "2nd ed.", language: "英文／拉丁语",
    access: "catalogued", accessNote: "版权教材；只登记官方出版信息、合法预览与原创改编题。",
    alignment: { elementary: "形态与句法的显性体系可校准初级全范围。", intermediate: "长句分析、散文与诗歌阅读可补中级。", advanced: "原典单元适合进阶精读。" },
    strengths: ["形态严密", "句法显性", "大量练习", "原典导向"],
  },
  {
    id: "reading-latin2", title: "Reading Latin", authors: "Peter Jones · Keith Sidwell", edition: "2nd ed.", language: "英文／拉丁语",
    access: "catalogued", accessNote: "版权教材；对齐 Text 与 Grammar/Vocabulary/Exercises 两部分。",
    alignment: { elementary: "叙事材料配合基础语法。", intermediate: "连续阅读、改写文本和原典过渡。", advanced: "喜剧、演说与诗歌的体裁训练。" },
    strengths: ["阅读优先", "体裁意识", "连续文本", "英国古典学传统"],
  },
  {
    id: "wheelock7", title: "Wheelock’s Latin／《韦洛克拉丁语教程》", authors: "Frederic M. Wheelock · Richard A. LaFleur", edition: "7th ed.", language: "英文／中文版",
    access: "uploaded", accessNote: "英文及中文 OCR 版已上传供内部映射；不公开教材正文与答案。",
    alignment: { elementary: "1–40 章覆盖北大初级所需主要形态句法。", intermediate: "需配合附录、Locī 与原典补充。", advanced: "Locī Immūtātī、古式和补充词形。" },
    strengths: ["语法顺序清楚", "章节短", "主要词形", "古典格言"],
  },
  {
    id: "moreland-fleischer", title: "Latin: An Intensive Course", authors: "Floyd L. Moreland · Rita M. Fleischer", edition: "standard ed.", language: "英文／拉丁语",
    access: "catalogued", accessNote: "版权教材；用于密集课程知识域对照，不复制练习。",
    alignment: { elementary: "快速覆盖完整形态与基础句法。", intermediate: "复杂虚拟式、间接话语和高密度操练。", advanced: "适合作为短期强化复盘。" },
    strengths: ["高强度", "形态完整", "句法压缩", "研究生速成"],
  },
  {
    id: "cambridge5", title: "Cambridge Latin Course", authors: "Cambridge School Classics Project", edition: "5th ed.", language: "英文／拉丁语",
    access: "official", accessNote: "优先链接官方数字资源；不镜像受版权保护内容。",
    alignment: { elementary: "情境阅读和文化背景用于早期输入。", intermediate: "后期册补复杂句法与原典桥接。", advanced: "不单独承担进阶语法体系。" },
    strengths: ["故事驱动", "文化史", "可理解输入", "课堂资源"],
  },
  {
    id: "oxford2", title: "Oxford Latin Course", authors: "Maurice Balme · James Morwood", edition: "2nd ed.／College Edition", language: "英文／拉丁语",
    access: "catalogued", accessNote: "版权教材；登记书目与课程映射。",
    alignment: { elementary: "以贺拉斯生平叙事组织基础语法。", intermediate: "College Edition 后段进入原典与诗歌。", advanced: "诗体和文化史可作补充。" },
    strengths: ["人物叙事", "语法渐进", "诗歌桥接", "文化背景"],
  },
  {
    id: "latin-foundation-cn", title: "《拉丁语基础教程》", authors: "待核定版本", edition: "中文教材", language: "中文／拉丁语",
    access: "catalogued", accessNote: "同名版本较多，需以 ISBN 和版权页消歧后再映射。",
    alignment: { elementary: "预期用于中文基础语法术语对齐。", intermediate: "待核对目录。", advanced: "待核对目录。" },
    strengths: ["中文术语", "本土课堂", "待版本消歧"],
  },
  {
    id: "lnm", title: "Latin for the New Millennium", authors: "Milena Minkova · Terence Tunberg et al.", edition: "student text", language: "英文／拉丁语",
    access: "catalogued", accessNote: "版权教材；仅使用公开书目、样章与原创题。",
    alignment: { elementary: "古典到近现代选文串联基础语法。", intermediate: "多时期文体扩展语境义。", advanced: "人文主义及近现代拉丁语正适合扩展模块。" },
    strengths: ["跨时代", "主动拉丁语", "文化连续性", "新拉丁语"],
  },
  {
    id: "lei-concise", title: "《简明拉丁语教程》", authors: "雷立柏（Leopold Leeb）", edition: "中文教材", language: "中文／拉丁语",
    access: "catalogued", accessNote: "版权教材；待取得目录或用户上传后做精确映射。",
    alignment: { elementary: "中文基础教学与词形复盘。", intermediate: "待目录核对。", advanced: "可衔接教会与近现代拉丁语。" },
    strengths: ["中文解释", "简明路线", "欧洲语言对照"],
  },
  {
    id: "xie-grammar", title: "《拉丁语语法》", authors: "谢大任", edition: "参考语法", language: "中文／拉丁语",
    access: "catalogued", accessNote: "作为中文参考语法索引；版权状态与具体版本待核定。",
    alignment: { elementary: "查询形态与格功能。", intermediate: "查询复杂从句和特殊结构。", advanced: "语法史和少见结构的参考入口。" },
    strengths: ["中文参考语法", "条目检索", "系统语法"],
  },
  {
    id: "self-reader-cn", title: "《拉丁语自学读本》", authors: "待核定版本", edition: "中文读本", language: "中文／拉丁语",
    access: "catalogued", accessNote: "需以作者、出版社和 ISBN 消歧；暂不链接来源不明 PDF。",
    alignment: { elementary: "预期用于分级阅读和自测。", intermediate: "待版本核对。", advanced: "待版本核对。" },
    strengths: ["自学路径", "分级阅读", "待版本消歧"],
  },
];

export type ResourceChapterMapping = {
  id: string;
  title: string;
  chapter: string;
  grammarTargets: string[];
  vocabularyTargets: string[];
  exerciseLogic: string;
  publicDomainStatus: string;
  licenseNote: string;
};

export const resourceChapterMappings: ResourceChapterMapping[] = [
  {
    id: "wheelock-workbook-private",
    title: "Wheelock’s Latin Workbook",
    chapter: "Ch. 1–6 · 私人学习进度映射",
    grammarTargets: ["第一、二变格", "现在时系统", "形容词一致"],
    vocabularyTargets: ["基础名词", "规则动词主要词形", "常用介词"],
    exerciseLogic: "只登记章节知识域，公开题目重新设计语境、干扰项和解析。",
    publicDomainStatus: "版权教材 · 元数据",
    licenseNote: "不公开扫描页、教材原题、答案或私人批注。",
  },
  {
    id: "llpsi-fr-sequence",
    title: "Lingua Latīna per sē illūstrāta: Familia Rōmāna",
    chapter: "Cap. I–XII · 连续阅读桥接",
    grammarTargets: ["格功能渐进", "关系从句", "代词与一致"],
    vocabularyTargets: ["家庭", "地理", "日常动作"],
    exerciseLogic: "抽取理解目标与复现顺序，另写短场景和词形判断题。",
    publicDomainStatus: "版权教材 · 内部映射",
    licenseNote: "仅发布章节索引和原创练习，不复制连续正文。",
  },
  {
    id: "horace-public-original",
    title: "Horatius · Carmina",
    chapter: "公版拉丁原文／现代详注分离",
    grammarTargets: ["诗体语序", "省略", "虚拟式语气"],
    vocabularyTargets: ["诗歌关键词", "神话与伦理语义"],
    exerciseLogic: "公版原文可按版本标识引用；现代中文详注只作观点索引并重新表述。",
    publicDomainStatus: "原文公版 · 现代注释受版权保护",
    licenseNote: "逐条标明原文版本、译者／注者与 Pikku 原创分析。",
  },
  {
    id: "latin-core-public",
    title: "Public Latin Core Vocabulary",
    chapter: "跨教材核心词表",
    grammarTargets: ["词典回溯", "主要词形", "搭配识别"],
    vocabularyTargets: ["高频动词", "功能词", "跨体裁核心名词"],
    exerciseLogic: "以公版词典核验词典形，再生成新的语境选义和构词题。",
    publicDomainStatus: "公版数据 · 待逐条核验",
    licenseNote: "保留来源与核验状态，不复制现代版权词典释文。",
  },
  {
    id: "jlpt-n1-private-mock",
    title: "JLPT N1 Weekly Review",
    chapter: "私人模拟反馈 · 去身份化",
    grammarTargets: ["作用域", "条件联动", "语用纠错"],
    vocabularyTargets: ["効率／精度／信頼性／効果", "学术表达"],
    exerciseLogic: "只保留可泛化错因，重新编写句子、选项和解释并进入人工审核。",
    publicDomainStatus: "原创复核题 · 草稿",
    licenseNote: "公开代码不含个人答案、录音、完整日志或可识别信息。",
  },
];

export type AuthorNode = {
  id: string;
  name: string;
  chinese: string;
  dates: string;
  period: "共和早期" | "共和晚期" | "奥古斯都时代" | "帝国早期" | "帝国盛期" | "晚期古代";
  genres: string[];
  works: string[];
  examLevel: QuestionLevel;
};

export const classicalAuthors: AuthorNode[] = [
  ["plautus", "T. Maccius Plautus", "普劳图斯", "c. 254–184 BCE", "共和早期", ["喜剧"], ["Miles Gloriosus", "Menaechmi", "Amphitruo"], "advanced"],
  ["terence", "P. Terentius Afer", "泰伦提乌斯", "c. 195/185–159 BCE", "共和早期", ["喜剧"], ["Andria", "Eunuchus", "Adelphoe"], "advanced"],
  ["cato", "M. Porcius Cato", "老加图", "234–149 BCE", "共和早期", ["散文", "农业"], ["De Agri Cultura", "Origines (fr.)"], "advanced"],
  ["lucretius", "T. Lucretius Carus", "卢克莱修", "c. 99–55 BCE", "共和晚期", ["哲理诗"], ["De Rerum Natura"], "advanced"],
  ["catullus", "C. Valerius Catullus", "卡图卢斯", "c. 84–54 BCE", "共和晚期", ["抒情诗"], ["Carmina"], "advanced"],
  ["caesar", "C. Iulius Caesar", "凯撒", "100–44 BCE", "共和晚期", ["军事叙事", "政论"], ["De Bello Gallico", "De Bello Civili"], "elementary"],
  ["nepos", "Cornelius Nepos", "科尔奈利乌斯·奈波斯", "c. 110–24 BCE", "共和晚期", ["传记"], ["De Viris Illustribus"], "elementary"],
  ["cicero", "M. Tullius Cicero", "西塞罗", "106–43 BCE", "共和晚期", ["演说", "哲学", "书信"], ["In Catilinam", "In Verrem", "De Officiis", "Epistulae"], "intermediate"],
  ["sallust", "C. Sallustius Crispus", "萨卢斯特", "86–c. 35 BCE", "共和晚期", ["史学"], ["Bellum Catilinae", "Bellum Iugurthinum", "Historiae (fr.)"], "intermediate"],
  ["varro", "M. Terentius Varro", "瓦罗", "116–27 BCE", "共和晚期", ["语言学", "博物学"], ["De Lingua Latina", "Rerum Rusticarum"], "advanced"],
  ["vergil", "P. Vergilius Maro", "维吉尔", "70–19 BCE", "奥古斯都时代", ["史诗", "牧歌"], ["Aeneis", "Georgica", "Eclogae"], "advanced"],
  ["horace", "Q. Horatius Flaccus", "贺拉斯", "65–8 BCE", "奥古斯都时代", ["抒情诗", "讽刺诗", "诗论"], ["Carmina", "Sermones", "Epistulae", "Ars Poetica"], "advanced"],
  ["livy", "T. Livius", "李维", "59 BCE–17 CE", "奥古斯都时代", ["史学"], ["Ab Urbe Condita"], "advanced"],
  ["ovid", "P. Ovidius Naso", "奥维德", "43 BCE–17/18 CE", "奥古斯都时代", ["叙事诗", "爱情诗"], ["Metamorphoses", "Fasti", "Amores", "Tristia"], "advanced"],
  ["tibullus", "Albius Tibullus", "提布卢斯", "c. 55–19 BCE", "奥古斯都时代", ["哀歌"], ["Elegiae"], "advanced"],
  ["propertius", "Sextus Propertius", "普罗佩提乌斯", "c. 50–15 BCE", "奥古斯都时代", ["哀歌"], ["Elegiae"], "advanced"],
  ["phaedrus", "Phaedrus", "费德鲁斯", "c. 15 BCE–50 CE", "帝国早期", ["寓言诗"], ["Fabulae Aesopiae"], "advanced"],
  ["seneca", "L. Annaeus Seneca", "小塞涅卡", "c. 4 BCE–65 CE", "帝国早期", ["哲学", "悲剧", "书信"], ["Epistulae Morales", "Dialogi", "Tragoediae"], "advanced"],
  ["petronius", "Petronius", "佩特罗尼乌斯", "d. 66 CE", "帝国早期", ["小说", "讽刺"], ["Satyrica"], "advanced"],
  ["lucan", "M. Annaeus Lucanus", "卢卡努斯", "39–65 CE", "帝国早期", ["史诗"], ["Bellum Civile"], "advanced"],
  ["pliny-elder", "C. Plinius Secundus", "老普林尼", "23/24–79 CE", "帝国早期", ["百科", "博物学"], ["Naturalis Historia"], "advanced"],
  ["quintilian", "M. Fabius Quintilianus", "昆体良", "c. 35–c. 100 CE", "帝国早期", ["修辞", "教育"], ["Institutio Oratoria"], "advanced"],
  ["statius", "P. Papinius Statius", "斯塔提乌斯", "c. 45–c. 96 CE", "帝国早期", ["史诗", "场合诗"], ["Thebais", "Silvae"], "advanced"],
  ["martial", "M. Valerius Martialis", "马提亚尔", "c. 40–c. 104 CE", "帝国早期", ["短诗"], ["Epigrammata"], "advanced"],
  ["tacitus", "P. Cornelius Tacitus", "塔西佗", "c. 56–c. 120 CE", "帝国盛期", ["史学", "传记"], ["Annales", "Historiae", "Germania", "Agricola"], "advanced"],
  ["pliny-younger", "C. Plinius Caecilius Secundus", "小普林尼", "61/62–c. 113 CE", "帝国盛期", ["书信", "颂词"], ["Epistulae", "Panegyricus"], "advanced"],
  ["juvenal", "D. Iunius Iuvenalis", "尤维纳利斯", "late 1st–early 2nd c.", "帝国盛期", ["讽刺诗"], ["Saturae"], "advanced"],
  ["suetonius", "C. Suetonius Tranquillus", "苏埃托尼乌斯", "c. 69–after 122", "帝国盛期", ["传记"], ["De Vita Caesarum", "De Viris Illustribus"], "advanced"],
  ["apuleius", "Apuleius", "阿普列尤斯", "c. 124–after 170", "帝国盛期", ["小说", "演说", "哲学"], ["Metamorphoses", "Apologia", "Florida"], "advanced"],
  ["gellius", "Aulus Gellius", "奥卢斯·革利乌斯", "c. 125–after 180", "帝国盛期", ["杂录", "语言学"], ["Noctes Atticae"], "advanced"],
  ["ammianus", "Ammianus Marcellinus", "阿米阿努斯", "c. 330–c. 395", "晚期古代", ["史学"], ["Res Gestae"], "advanced"],
  ["jerome", "Hieronymus", "哲罗姆", "c. 347–420", "晚期古代", ["圣经翻译", "书信"], ["Vulgata", "Epistulae"], "advanced"],
  ["augustine", "Aurelius Augustinus", "奥古斯丁", "354–430", "晚期古代", ["神学", "哲学", "自传"], ["Confessiones", "De Civitate Dei", "De Doctrina Christiana"], "advanced"],
  ["boethius", "Anicius Manlius Severinus Boethius", "波爱修斯", "c. 480–524", "晚期古代", ["哲学", "逻辑"], ["Consolatio Philosophiae", "Opuscula Sacra"], "advanced"],
].map(([id, name, chinese, dates, period, genres, works, examLevel]) => ({ id, name, chinese, dates, period, genres, works, examLevel })) as AuthorNode[];

export const authorGraphEdges = classicalAuthors.flatMap((author) => author.works.map((work) => ({
  source: author.id,
  target: `${author.id}:${work}`,
  relation: "WROTE" as const,
  provenance: "catalogued" as const,
})));

export type DictionaryId = "old" | "ls" | "gaffiot" | "georges" | "wiktionary";
export type DictionarySource = { id: DictionaryId; name: string; scope: string; access: string };
export type LexiconLanguage = "la" | "ja" | "es";

export const dictionarySources: DictionarySource[] = [
  { id: "old", name: "Oxford Latin Dictionary (OLD)", scope: "古典拉丁语，权威历史语义与引文", access: "版权数据库／纸本；本站记录核对状态，不复制释文" },
  { id: "ls", name: "Lewis & Short", scope: "古典拉丁语—英语，丰富引文", access: "公版；可通过 Perseus/Logeion 检索" },
  { id: "gaffiot", name: "Gaffiot", scope: "拉丁语—法语", access: "早期版本公版；可通过 Gallica/Logeion 检索" },
  { id: "georges", name: "Georges", scope: "拉丁语—德语", access: "历史版本可公开检索" },
  { id: "wiktionary", name: "Wiktionary", scope: "开放协作词典，含形态、派生与词源线索", access: "CC BY-SA；需逐条复核" },
];

export type LexiconEntry = {
  language: LexiconLanguage;
  lemma: string;
  principalParts: string;
  gloss: string;
  partOfSpeech: string;
  pie: string;
  derivatives: string[];
  addedOn?: string;
  batch: string;
  reviewStatus: ReviewStatus;
  dictionaryStatus: Record<DictionaryId, "待核" | "已核">;
};

const pendingDictionaryStatus: Record<DictionaryId, "待核"> = {
  old: "待核", ls: "待核", gaffiot: "待核", georges: "待核", wiktionary: "待核",
};

const foundationLexicon: LexiconEntry[] = [
  ["aqua", "aqua, -ae f.", "水", "名词", "常与 PIE *h₂ekʷeh₂- 联系；具体重建需参照词源专著", ["aquatic", "aquarium"]],
  ["cor", "cor, cordis n.", "心；心志", "名词", "PIE *ḱḗr/*ḱr̥d-", ["cordial", "courage"]],
  ["dūcō", "dūcō, dūcere, dūxī, ductum", "引导；率领", "动词", "PIE *dewk- ‘牵引’", ["conduct", "educate", "reduce"]],
  ["ferō", "ferō, ferre, tulī, lātum", "携带；承受；报告", "动词", "PIE *bʰer- ‘携带’；补充词干来源不同", ["transfer", "refer", "fertile"]],
  ["pater", "pater, patris m.", "父亲", "名词", "PIE *ph₂tḗr", ["paternal", "patron"]],
  ["scrībō", "scrībō, scrībere, scrīpsī, scrīptum", "写；刻写", "动词", "常联系 PIE *skreybʰ- ‘刻划’", ["scribe", "describe", "manuscript"]],
  ["veniō", "veniō, venīre, vēnī, ventum", "来；到达", "动词", "PIE *gʷem- ‘来、行走’", ["convene", "intervene", "advent"]],
  ["videō", "videō, vidēre, vīdī, vīsum", "看见；理解", "动词", "PIE *weyd- ‘看见、知道’", ["video", "evidence", "vision"]],
].map(([lemma, principalParts, gloss, partOfSpeech, pie, derivatives]) => ({
  language: "la" as const, lemma, principalParts, gloss, partOfSpeech, pie, derivatives,
  batch: "foundation", reviewStatus: "published",
  dictionaryStatus: { ...pendingDictionaryStatus },
})) as LexiconEntry[];

const weeklyLexicon: LexiconEntry[] = [
  ["la", "alius", "alius, alia, aliud", "另一个；其他的", "代词性形容词", "词源待专项核验", []],
  ["la", "causa", "causa, -ae f.", "原因；理由；案件", "名词", "词源待专项核验", ["cause", "causal"]],
  ["la", "dīligenter", "dīligenter", "勤勉地；仔细地", "副词", "来自 dīligēns；与 dīligō 的语义发展相关", ["diligent"]],
  ["la", "ergō", "ergō", "因此；所以", "副词／连词性副词", "词源存在争议，待专项核验", []],
  ["la", "fīlius", "fīlius, -ī m.", "儿子", "名词", "词源待专项核验", ["filial"]],
  ["la", "habeō", "habeō, habēre, habuī, habitum", "有；持有；认为", "动词", "常与 PIE *gʰabʰ- ‘给予、取得’联系", ["habit", "inhibit"]],
  ["la", "līber", "līber, lībera, līberum", "自由的", "形容词", "与表示‘自由成员’的印欧词族相关", ["liberty", "liberal"]],
  ["la", "medicus", "medicus, -ī m.", "医生", "名词", "来自 medeor ‘医治’相关词族", ["medical", "medicine"]],
  ["la", "morbus", "morbus, -ī m.", "疾病", "名词", "词源待专项核验", ["morbid"]],
  ["la", "morior", "morior, morī, mortuus sum", "死亡", "异相动词", "常与 PIE *mer- ‘死亡’联系", ["mortal", "mortality"]],
  ["la", "neglegō", "neglegō, neglegere, neglēxī, neglēctum", "忽视；疏忽", "动词", "由 nec/neg- 与 legō 的历史组合形成", ["neglect", "negligence"]],
  ["la", "nisi", "nisi", "如果不；除非", "连词", "由否定成分与 sī ‘如果’结合", []],
  ["la", "oppugnō", "oppugnō, oppugnāre, oppugnāvī, oppugnātum", "攻击；围攻", "动词", "ob- + pugnō ‘战斗’", ["oppugn"]],
  ["la", "pariō", "pariō, parere, peperī, partum", "生产；生下；取得", "动词", "词形包含不同历史词干，需按主要词形记忆", ["parent", "parturition"]],
  ["la", "patria", "patria, -ae f.", "祖国；故乡", "名词", "由 pater ‘父亲’派生的阴性名词化形式", ["patriot", "patriotic"]],
  ["la", "quaerō", "quaerō, quaerere, quaesīvī, quaesītum", "寻找；询问；调查", "动词", "词源待专项核验", ["query", "question", "inquire"]],
  ["la", "sequor", "sequor, sequī, secūtus sum", "跟随；依据；追求", "异相动词", "常与 PIE *sekʷ- ‘跟随’联系", ["sequence", "consequence"]],
  ["la", "signum", "signum, -ī n.", "标志；迹象；信号", "名词", "词源待专项核验", ["sign", "signal", "signature"]],
  ["ja", "曖昧", "あいまい", "含糊；不明确", "形容动词／名词", "汉语来源词；日语中的语义与搭配待专项核验", []],
  ["ja", "埋もれる", "うもれる", "被埋没；湮没", "一段自动词", "和语词；与埋める构成自动词—他动词对应", []],
  ["ja", "影響", "えいきょう", "影响", "名词／サ变动词", "汉语来源词", []],
  ["ja", "解釈", "かいしゃく", "解释；理解", "名词／サ变动词", "汉语来源词", []],
  ["ja", "改善", "かいぜん", "改进；改善", "名词／サ变动词", "汉语来源词", []],
  ["ja", "かえって", "かえって", "反而；结果与预期相反地", "副词", "来自返る／却って相关历史形式；细节待专项核验", []],
  ["ja", "兼ねる", "かねる", "兼任；兼具；接在连用形后表示难以做到", "一段他动词／补助动词", "本义涉及兼具、同时承担；补助用法的语法化路径待专项核验", []],
  ["ja", "関連性", "かんれんせい", "关联性；相关程度", "名词", "関連＋接尾辞「性」", []],
  ["ja", "検査", "けんさ", "检查；检验", "名词／サ变动词", "汉语来源词", []],
  ["ja", "見極める", "みきわめる", "看清；判断清楚；弄明白", "一段他动词", "見＋極める构成的复合动词", []],
  ["ja", "見失う", "みうしなう", "看丢；失去把握", "五段他动词", "見＋失う构成的复合动词", []],
  ["ja", "項目", "こうもく", "项目；条目", "名词", "汉语来源词", []],
  ["ja", "効果", "こうか", "效果；作用产生的结果", "名词", "汉语来源词；注意与効率区分", []],
  ["ja", "効率", "こうりつ", "效率；投入与产出的比例关系", "名词", "汉语来源词；注意与効果区分", []],
  ["ja", "信頼性", "しんらいせい", "可靠性；可信度", "名词", "信頼＋接尾辞「性」", []],
  ["ja", "診断", "しんだん", "诊断；判断", "名词／サ变动词", "汉语来源词", []],
  ["ja", "精度", "せいど", "精确程度；精度", "名词", "汉语来源词", []],
  ["ja", "測定", "そくてい", "测定；测量", "名词／サ变动词", "汉语来源词", []],
  ["ja", "短縮", "たんしゅく", "缩短；压缩", "名词／サ变动词", "汉语来源词", []],
  ["ja", "伝える", "つたえる", "传达；告诉；传承", "一段他动词", "和语词", []],
  ["ja", "詳しい", "くわしい", "详细的；熟悉的", "イ形容词", "和语词", []],
  ["ja", "把握", "はあく", "把握；掌握", "名词／サ变动词", "汉语来源词", []],
  ["ja", "配慮", "はいりょ", "体谅；顾及；考虑", "名词／サ变动词", "汉语来源词", []],
  ["ja", "深まる", "ふかまる", "加深；变深", "五段自动词", "深い派生的自动词；与深める对应", []],
  ["ja", "無駄", "むだ", "浪费；徒劳；无用", "名词／形容动词", "历史词源有不同说法，待专项核验", []],
  ["ja", "招く", "まねく", "招来；导致；邀请", "五段他动词", "和语词；负面结果常译为‘导致’", []],
  ["ja", "要点", "ようてん", "要点；核心", "名词", "汉语来源词", []],
  ["ja", "論点", "ろんてん", "论点；争论焦点", "名词", "汉语来源词", []],
  ["ja", "情報", "じょうほう", "信息；情报", "名词", "汉语来源词；现代语义受近代翻译影响", []],
  ["ja", "重ねる", "かさねる", "叠放；反复进行", "一段他动词", "和语词；検査を重ねる表示反复检查", []],
].map(([language, lemma, principalParts, gloss, partOfSpeech, pie, derivatives]) => ({
  language, lemma, principalParts, gloss, partOfSpeech, pie, derivatives,
  addedOn: "2026-07-26",
  batch: "2026-07-26", reviewStatus: "draft",
  dictionaryStatus: { ...pendingDictionaryStatus },
})) as LexiconEntry[];

const weeklyLexicon20260802: LexiconEntry[] = [
  ["la", "hostis", "hostis, -is m./f.", "敌人；外敌", "名词", "词源待专项核验", ["hostile", "hostility"]],
  ["la", "sum", "sum, esse, fuī, futūrus", "是；存在；充当系词或助动词", "不规则动词", "常与 PIE *h₁es- ‘存在’联系", ["essence", "entity"]],
  ["la", "urbs", "urbs, urbis f.", "城市；城邦（尤指罗马）", "名词", "词源待专项核验", ["urban", "suburb"]],
  ["ja", "省く", "はぶく", "省去；省略；节省", "五段他动词", "和语词；不能仅凭汉字把它等同于汉语‘节省’", []],
  ["es", "bioingeniería", "bioingeniería, f.", "生物工程学", "名词", "bio- + ingeniería；ingeniería 经 ingeniero 与拉丁 ingenium ‘天资、构思能力’相关", ["bioingeniero"]],
  ["es", "cómo", "cómo", "如何；怎样（疑问或感叹副词）", "副词", "来自拉丁 quōmodo ‘以什么方式’的演变；重音用于区别非疑问 como", []],
  ["es", "investigar", "investigar", "调查；研究", "动词", "来自拉丁 investigāre ‘循迹追查’，由 in- + vestīgium ‘足迹’构成", ["investigación", "investigador"]],
  ["es", "laboratorio", "laboratorio, m.", "实验室", "名词", "来自中世纪拉丁 laborātōrium，与 labor ‘劳动’同族", ["laboratory"]],
  ["es", "lenguaje", "lenguaje, m.", "语言；语言表达系统", "名词", "经古法语 langage，最终与拉丁 lingua ‘舌；语言’同族", ["lengua"]],
  ["es", "llamarse", "llamarse", "名叫；自称", "代词式动词", "llamar 来自拉丁 clāmāre ‘呼喊’；现代自我介绍常用 me llamo", ["llamada"]],
  ["es", "neuroingeniería", "neuroingeniería, f.", "神经工程学", "名词", "neuro- + ingeniería；neuro- 经希腊语 neuron ‘神经、腱’进入科学词汇", []],
  ["es", "responder", "responder", "回答；回应；对……产生反应", "动词", "来自拉丁 respondēre；西班牙语 responder a 标记回应对象", ["respuesta", "responsable"]],
  ["es", "seguimiento ocular", "seguimiento ocular, m.", "眼动追踪", "名词短语", "seguimiento 来自 seguir（拉丁 sequī）；ocular 来自拉丁 oculus ‘眼睛’", ["seguimiento", "ocular"]],
  ["es", "trabajar", "trabajar", "工作；从事", "动词", "通常追溯至通俗拉丁 *tripaliāre；与古刑具 tripalium 相关，语义经历‘受苦’到‘劳动’的变化", ["trabajo", "trabajador"]],
].map(([language, lemma, principalParts, gloss, partOfSpeech, pie, derivatives]) => ({
  language, lemma, principalParts, gloss, partOfSpeech, pie, derivatives,
  addedOn: "2026-08-02",
  batch: "2026-08-02", reviewStatus: "draft",
  dictionaryStatus: { ...pendingDictionaryStatus },
})) as LexiconEntry[];

export const lexiconSeed: LexiconEntry[] = [...foundationLexicon, ...weeklyLexicon, ...weeklyLexicon20260802];
