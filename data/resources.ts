import type { QuestionLevel } from "./questions";

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

export const dictionarySources: DictionarySource[] = [
  { id: "old", name: "Oxford Latin Dictionary (OLD)", scope: "古典拉丁语，权威历史语义与引文", access: "版权数据库／纸本；本站记录核对状态，不复制释文" },
  { id: "ls", name: "Lewis & Short", scope: "古典拉丁语—英语，丰富引文", access: "公版；可通过 Perseus/Logeion 检索" },
  { id: "gaffiot", name: "Gaffiot", scope: "拉丁语—法语", access: "早期版本公版；可通过 Gallica/Logeion 检索" },
  { id: "georges", name: "Georges", scope: "拉丁语—德语", access: "历史版本可公开检索" },
  { id: "wiktionary", name: "Wiktionary", scope: "开放协作词典，含形态、派生与词源线索", access: "CC BY-SA；需逐条复核" },
];

export type LexiconEntry = {
  lemma: string;
  principalParts: string;
  gloss: string;
  partOfSpeech: string;
  pie: string;
  derivatives: string[];
  dictionaryStatus: Record<DictionaryId, "待核" | "已核">;
};

export const lexiconSeed: LexiconEntry[] = [
  ["aqua", "aqua, -ae f.", "水", "名词", "常与 PIE *h₂ekʷeh₂- 联系；具体重建需参照词源专著", ["aquatic", "aquarium"]],
  ["cor", "cor, cordis n.", "心；心志", "名词", "PIE *ḱḗr/*ḱr̥d-", ["cordial", "courage"]],
  ["dūcō", "dūcō, dūcere, dūxī, ductum", "引导；率领", "动词", "PIE *dewk- ‘牵引’", ["conduct", "educate", "reduce"]],
  ["ferō", "ferō, ferre, tulī, lātum", "携带；承受；报告", "动词", "PIE *bʰer- ‘携带’；补充词干来源不同", ["transfer", "refer", "fertile"]],
  ["pater", "pater, patris m.", "父亲", "名词", "PIE *ph₂tḗr", ["paternal", "patron"]],
  ["scrībō", "scrībō, scrībere, scrīpsī, scrīptum", "写；刻写", "动词", "常联系 PIE *skreybʰ- ‘刻划’", ["scribe", "describe", "manuscript"]],
  ["veniō", "veniō, venīre, vēnī, ventum", "来；到达", "动词", "PIE *gʷem- ‘来、行走’", ["convene", "intervene", "advent"]],
  ["videō", "videō, vidēre, vīdī, vīsum", "看见；理解", "动词", "PIE *weyd- ‘看见、知道’", ["video", "evidence", "vision"]],
].map(([lemma, principalParts, gloss, partOfSpeech, pie, derivatives]) => ({
  lemma, principalParts, gloss, partOfSpeech, pie, derivatives,
  dictionaryStatus: { old: "待核", ls: "待核", gaffiot: "待核", georges: "待核", wiktionary: "待核" },
})) as LexiconEntry[];
