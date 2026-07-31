import type { LanguageCode } from "./questions";

export type LanguageFact = {
  id: string;
  kind: "日汉同形异义" | "拉丁语词源" | "同源异义" | "同形异源";
  title: string;
  summary: string;
  example: string;
  sources: readonly { label: string; url: string }[];
};

export const languageFacts: Partial<Record<LanguageCode, readonly LanguageFact[]>> = {
  ja: [
    {
      id: "ja-benkyou",
      kind: "日汉同形异义",
      title: "勉強（べんきょう）≠ 勉强",
      summary: "日语主要表示学习、钻研；现代汉语通常表示强迫、将就或不情愿地做。",
      example: "日本語：日本語を勉強する｜汉语：勉强答应",
      sources: [
        { label: "小学馆《類語例解辞典》", url: "https://dictionary.goo.ne.jp/thsrs/9532/meaning/m0u/" },
        { label: "教育部《重編國語辭典》", url: "https://dict.revised.moe.edu.tw/search.jsp?word=%E5%8B%89%E5%BC%B7" },
      ],
    },
    {
      id: "ja-kisha",
      kind: "日汉同形异义",
      title: "汽車（きしゃ）≠ 汽车",
      summary: "日语指蒸汽机车牵引的列车，也可泛指铁路列车；现代汉语的“汽车”主要是在道路上行驶的机动车。",
      example: "日本語：汽車で旅をする｜汉语：开汽车上班",
      sources: [
        { label: "小学馆《デジタル大辞泉》", url: "https://dictionary.goo.ne.jp/srch/all/%E6%B1%BD/m0u/" },
        { label: "教育部《重編國語辭典》", url: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=99141&la=0&powerMode=0" },
      ],
    },
    {
      id: "ja-shinbun",
      kind: "日汉同形异义",
      title: "新聞（しんぶん）≠ 新闻",
      summary: "现代日语通常指报纸；现代汉语通常指新近发生的事件及其报道。",
      example: "日本語：新聞を読む｜汉语：看今天的新闻",
      sources: [
        { label: "小学馆《デジタル大辞泉》", url: "https://dictionary.goo.ne.jp/word/%E6%96%B0%E8%81%9E/" },
        { label: "教育部《重編國語辭典》", url: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=109301&q=1&word=%E6%96%B0%E8%81%9E" },
      ],
    },
  ],
  es: [
    {
      id: "es-hijo",
      kind: "拉丁语词源",
      title: "filius → hijo",
      summary: "西班牙语 hijo“儿子、孩子”继承自拉丁语 filius；今天的词形已经不容易直接看出这层关系。",
      example: "lat. filius｜es. hijo",
      sources: [{ label: "RAE《DLE》hijo", url: "https://dle.rae.es/hijo" }],
    },
    {
      id: "es-llave",
      kind: "拉丁语词源",
      title: "clavis → llave",
      summary: "西班牙语 llave“钥匙”来自拉丁语 clavis，同一词还发展出工具、阀门和“关键手段”等义项。",
      example: "lat. clavis｜es. llave",
      sources: [{ label: "RAE《DLE》llave", url: "https://dle.rae.es/llave" }],
    },
    {
      id: "es-exito-exit",
      kind: "同源异义",
      title: "éxito ≈ exit，但意思不同",
      summary: "西班牙语 éxito“成功”和英语 exit“出口、离开”都连接到拉丁语 exitus / exīre；两种语言保留了不同的语义方向。",
      example: "es. éxito：成功｜en. exit：出口、离开",
      sources: [
        { label: "RAE《DLE》éxito", url: "https://dle.rae.es/%C3%A9xito" },
        { label: "Merriam-Webster: exit", url: "https://www.merriam-webster.com/dictionary/exit" },
      ],
    },
    {
      id: "es-vino",
      kind: "同形异源",
      title: "vino“葡萄酒”≠ vino“他／她来了”",
      summary: "名词 vino 来自拉丁语 vinum；动词形式 vino 则属于 venir，而 venir 来自拉丁语 venīre。写法相同，词源链不同。",
      example: "El vino llegó.｜Vino ayer.",
      sources: [
        { label: "RAE《DLE》vino", url: "https://dle.rae.es/vino" },
        { label: "RAE《DLE》venir", url: "https://dle.rae.es/venir" },
      ],
    },
  ],
};
