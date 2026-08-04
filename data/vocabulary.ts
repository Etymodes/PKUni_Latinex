import type { LanguageLevel } from "./languages";
import type { LanguageCode } from "./questions";

export type VocabularyMode = "word" | "context";

export type VocabularyCard = {
  id: string;
  language: LanguageCode;
  level: LanguageLevel;
  term: string;
  meaning: string;
  context: string;
};

export type VocabularyStat = { seen: number; correct: number };
export type VocabularyStats = Record<string, VocabularyStat>;
type VocabularySeed = [term: string, meaning: string, context: string, level: LanguageLevel];

const latinCards: VocabularyCard[] = ([
  ["castra, -ōrum n. pl.", "军营", "Castra prope flūmen posita sunt.", "elementary"],
  ["dūcō, dūcere, dūxī, ductum", "引导；率领", "Dux exercitum in Italiam dūcit.", "elementary"],
  ["cōgnōscō, -ere, cōgnōvī, cōgnitum", "认识；得知", "Tandem cōgnōvī quid accidisset.", "elementary"],
  ["proficīscor, proficīscī, profectus sum", "出发", "Mīlitēs prīmā lūce proficīscuntur.", "elementary"],
  ["praesidium, -ī n.", "守备；保护；驻军", "Praesidium urbem dēfendit.", "elementary"],
  ["quod", "因为；这一事实；关系代词中性", "Gaudeō quod advenistī.", "elementary"],
  ["virtūs, virtūtis f.", "勇德；卓越；勇气", "Virtūs in perīculīs appāret.", "elementary"],
  ["auctoritās, -ātis f.", "威望；权威；影响力", "Auctoritās senātūs magna erat.", "intermediate"],
  ["cupīdō, -inis f.", "欲望；贪求", "Cupīdō pecūniae multōs corrumpit.", "intermediate"],
  ["coniūrātiō, -ōnis f.", "共谋；阴谋", "Coniūrātiō ā Cicerōne patefacta est.", "intermediate"],
  ["dignitās, -ātis f.", "身份；威望；尊严", "Dignitātem suam dēfendit.", "intermediate"],
  ["neglegō, -ere, neglēxī, neglēctum", "忽视；疏忽", "Officium neglegere nōn dēbēmus.", "intermediate"],
  ["quamquam", "虽然；尽管", "Quamquam fessus erat, perrexit.", "intermediate"],
  ["ultro", "主动地；此外；甚至", "Hostēs ultrō pācem petīvērunt.", "advanced"],
  ["quippe", "诚然；因为显然", "Quippe rem iam sciēbat.", "advanced"],
  ["faxō", "我一定会做到／使……（古式）", "Faxō sciēs.", "advanced"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `la-${String(index + 1).padStart(3, "0")}`,
  language: "la",
  level,
  term,
  meaning,
  context,
}));

const japaneseCards: VocabularyCard[] = ([
  ["学生", "学生", "学生です。", "n4"],
  ["食べる", "吃", "朝ご飯を食べる。", "n4"],
  ["大切", "重要；珍贵", "健康は大切です。", "n4"],
  ["勉強", "学习", "毎日、日本語を勉強します。", "n4"],
  ["経験", "经验；经历", "日本で働いた経験があります。", "n3"],
  ["続ける", "继续", "練習を続けてください。", "n3"],
  ["確認", "确认", "予定をもう一度確認する。", "n3"],
  ["増える", "增加", "利用者が増えている。", "n3"],
  ["省く", "省略；节省", "無駄な説明を省く。", "n2"],
  ["見極める", "看清；辨明", "情報の真偽を見極める。", "n2"],
  ["信頼性", "可靠性", "この資料は信頼性が高い。", "n2"],
  ["招く", "招致；引起", "誤解を招きかねない。", "n2"],
  ["見解", "见解", "専門家が見解を示した。", "n1"],
  ["促す", "促使；催促", "改善を促す。", "n1"],
  ["顕著", "显著", "差が顕著に現れた。", "n1"],
  ["踏まえる", "根据；立足于", "結果を踏まえて判断する。", "n1"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `ja-${String(index + 1).padStart(3, "0")}`,
  language: "ja",
  level,
  term,
  meaning,
  context,
}));

const spanishCards: VocabularyCard[] = ([
  ["casa", "房子；家", "La casa es pequeña.", "a1"],
  ["comer", "吃", "Quiero comer ahora.", "a1"],
  ["trabajo", "工作", "Busco trabajo.", "a1"],
  ["aprender", "学习；学会", "Aprendo español.", "a1"],
  ["viaje", "旅行", "El viaje fue corto.", "a2"],
  ["todavía", "仍然；还", "Todavía estoy aquí.", "a2"],
  ["elegir", "选择", "Puedes elegir uno.", "a2"],
  ["mejorar", "改善；提高", "Quiero mejorar mi español.", "a2"],
  ["lograr", "实现；成功做到", "Logró terminar a tiempo.", "b1"],
  ["aunque", "虽然；即使", "Aunque llueva, iremos.", "b1"],
  ["desarrollar", "发展；开发", "El equipo desarrolla una aplicación.", "b1"],
  ["entorno", "环境；周边", "Trabaja en un entorno tranquilo.", "b1"],
  ["plantear", "提出；构成", "El informe plantea varias dudas.", "b2"],
  ["llevar a cabo", "实施；完成", "Llevaron a cabo el proyecto.", "b2"],
  ["matiz", "细微差别；色调", "Hay un matiz importante.", "b2"],
  ["fiable", "可靠的", "Es una fuente fiable.", "b2"],
  ["conllevar", "伴随；导致", "La decisión conlleva riesgos.", "c1"],
  ["suscitar", "引起；激起", "La noticia suscitó un debate.", "c1"],
  ["contundente", "有力的；明确的", "Presentó pruebas contundentes.", "c1"],
  ["desempeño", "表现；履职", "Evaluaron su desempeño.", "c1"],
  ["dilucidar", "阐明；查明", "El estudio intenta dilucidar la causa.", "c2"],
  ["soslayar", "回避；忽略", "No podemos soslayar el problema.", "c2"],
  ["acuciante", "紧迫的", "Es una necesidad acuciante.", "c2"],
  ["a todas luces", "显然；明摆着", "La propuesta es, a todas luces, insuficiente.", "c2"],
] satisfies VocabularySeed[]).map(([term, meaning, context, level], index) => ({
  id: `es-${String(index + 1).padStart(3, "0")}`,
  language: "es",
  level,
  term,
  meaning,
  context,
}));

export const vocabularyCards = [...latinCards, ...japaneseCards, ...spanishCards];

export function vocabularyKey(language: LanguageCode, term: string) {
  return `${language}:${term}`;
}

export function vocabularyMatchesLevel(card: VocabularyCard, level: LanguageLevel) {
  if (card.language === "la" && level === "mixed") {
    return card.level === "elementary" || card.level === "intermediate";
  }
  return card.level === level;
}

export function adaptiveVocabularyWeight(stat?: VocabularyStat, recentlyShown = false) {
  const seen = Math.max(0, stat?.seen ?? 0);
  const correct = Math.min(seen, Math.max(0, stat?.correct ?? 0));
  const weight = seen === 0 ? 3 : 1 + (1 - correct / seen) * 5 + 1 / (seen + 1);
  return weight * (recentlyShown ? 0.15 : 1);
}

export function chooseNextVocabularyCard(
  cards: VocabularyCard[],
  stats: VocabularyStats,
  recentlyShown: string[],
  random: () => number = Math.random,
) {
  if (!cards.length) return null;
  const recent = new Set(recentlyShown);
  const weights = cards.map((card) => adaptiveVocabularyWeight(stats[vocabularyKey(card.language, card.term)], recent.has(card.id)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = Math.min(Math.max(random(), 0), 0.999999999999) * total;
  for (let index = 0; index < cards.length; index += 1) {
    target -= weights[index];
    if (target < 0) return cards[index];
  }
  return cards[cards.length - 1];
}
