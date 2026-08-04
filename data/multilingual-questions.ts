import type { Question } from "./questions";

const jlptSource = "https://www.jlpt.jp/cn/about/levelsummary.html";
const cefrSource = "https://www.coe.int/en/web/common-european-framework-reference-languages/";

export const multilingualQuestions: Question[] = [
  {
    id: "ja-n4-001", language: "ja", level: "n4", category: "syntax", skill: "particles", type: "choice",
    prompt: "空格里最自然的助词是什么？", text: "きのう、図書館（　）本を読みました。",
    options: ["で", "を", "へ", "が"], answer: 0,
    explanation: "动作发生的场所用助词「で」：図書館で本を読む。这里的「を」已经标记宾语「本」。",
    tags: ["助词", "场所", "N4"], source: "JLPT N4 能力域 · 官方框架对齐自拟", sourceUrl: jlptSource, sourceStatus: "original",
  },
  {
    id: "ja-n3-001", language: "ja", level: "n3", category: "sentencePattern", skill: "grammar", type: "choice",
    prompt: "选择最自然的表达。", text: "健康のために、毎日歩く（　）しています。",
    options: ["ように", "ほどに", "ばかりに", "ものの"], answer: 0,
    explanation: "「V辞書形＋ようにしている」表示把某种行为作为持续努力或习惯：尽量做到每天走路。",
    tags: ["ようにしている", "习惯", "N3"], source: "JLPT N3 能力域 · 官方框架对齐自拟", sourceUrl: jlptSource, sourceStatus: "original",
  },
  {
    id: "ja-n2-001", language: "ja", level: "n2", category: "syntax", skill: "scope", type: "choice",
    prompt: "这句话最准确的意思是什么？", text: "高ければ、必ず品質がいいとは限らない。",
    options: ["贵的东西未必质量就好", "只要贵，质量一定好", "质量好所以价格高", "无论质量如何都应该买贵的"], answer: 0,
    explanation: "「～とは限らない」否定“总是如此”的概括，并不等于完全否定：价格高不必然推出质量好。",
    tags: ["とは限らない", "部分否定", "N2"], source: "JLPT N2 能力域 · 官方框架对齐自拟", sourceUrl: jlptSource, sourceStatus: "original",
  },
  {
    id: "ja-n1-001", language: "ja", level: "n1", category: "vocabulary", skill: "pragmatics", type: "choice",
    prompt: "「招きかねない」在句中表达什么判断？", text: "説明不足は重大な誤解を招きかねない。",
    options: ["可能导致严重误解，而且说话者认为这是负面风险", "绝不可能导致误解", "已经故意造成了误解", "只要解释就一定会误解"], answer: 0,
    explanation: "「～かねない」表示存在发生某种结果的可能，通常用于说话者不希望出现的负面后果。",
    tags: ["かねない", "风险判断", "N1"], source: "JLPT N1 能力域 · 官方框架对齐自拟", sourceUrl: jlptSource, sourceStatus: "original",
  },
  {
    id: "ja-n1-002", language: "ja", level: "n1", category: "syntax", skill: "scope", type: "choice",
    prompt: "哪一项既保留原句逻辑，又不使用「からといって／とは限らない」？",
    text: "効率が高いからといって、測定の信頼性や精度まで高いとは限らない。",
    options: [
      "効率が高くても、測定の信頼性や精度が高いとは言えない。",
      "効率が高いので、測定の信頼性と精度も必ず高い。",
      "測定の信頼性より、効率と精度のほうが高い。",
      "効率、信頼性、精度は同じ意味である。",
    ],
    answer: 0,
    explanation: "原句否定从‘效率高’到‘可靠性和精度也高’的必然推论。「まで」把断言范围扩展到信頼性や精度，并不表示从信頼性按顺序移动到精度。用「～ても、～とは言えない」可以保留让步与非必然关系。",
    tags: ["からといって", "とは限らない", "まで", "改写", "N1"], source: "本周学习错误 · 去身份化原创复核题", sourceUrl: jlptSource, sourceStatus: "original",
  },
  {
    id: "es-a1-001", language: "es", level: "a1", category: "morphology", skill: "ser", type: "choice",
    prompt: "选择正确形式。", text: "Soy Pedro y (　) estudiante de bioingeniería.",
    options: ["soy", "eres", "es", "somos"], answer: 0,
    explanation: "主语省略但仍是第一人称单数 yo，因此 ser 使用 soy。",
    tags: ["ser", "自我介绍", "A1"], source: "CEFR A1 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-a2-001", language: "es", level: "a2", category: "syntax", skill: "prepositions", type: "choice",
    prompt: "选择最自然的介词。", text: "Trabajo (　) un laboratorio de neuroingeniería.",
    options: ["en", "a", "por", "sobre"], answer: 0,
    explanation: "表示工作发生的地点通常使用 en：trabajar en un laboratorio。",
    tags: ["介词", "地点", "A2"], source: "CEFR A2 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-b1-001", language: "es", level: "b1", category: "syntax", skill: "indirect-question", type: "choice",
    prompt: "选择能表达“研究大脑如何回应语言”的词。", text: "Investigo (　) responde el cerebro al lenguaje.",
    options: ["cómo", "que", "porque", "cuál"], answer: 0,
    explanation: "间接疑问“如何”使用带重音的 cómo：Investigo cómo responde...。陈述中的 que 不表达方式。",
    tags: ["间接疑问", "cómo", "B1"], source: "CEFR B1 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-b1-002", language: "es", level: "b1", category: "sentencePattern", skill: "prepositions", type: "choice",
    prompt: "选择介词和重音都正确的一组。",
    text: "Trabajo (1) un laboratorio, trabajo (2) datos de BCI e investigo (3) responde el cerebro (4) lenguaje.",
    options: ["en · con · cómo · al", "con · en · como · el", "en · sobre · que · al", "a · con · cómo · en"],
    answer: 0,
    explanation: "trabajar en 标记工作地点，trabajar con 标记处理的材料或工具；间接疑问‘如何’写 cómo；responder a 标记回应对象，a + el 缩合为 al。",
    tags: ["en", "con", "cómo", "al", "研究自述", "B1"], source: "本周学习错误 · 去身份化原创复核题", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-b2-001", language: "es", level: "b2", category: "sentencePattern", skill: "subjunctive", type: "choice",
    prompt: "空格中应使用哪一种形式？", text: "Aunque el método (　) útil, todavía necesita validación clínica.",
    options: ["sea", "es", "será", "fue"], answer: 0,
    explanation: "这里把“方法有用”作为让步性判断而非推进主断言，aunque 后使用现在虚拟式 sea。",
    tags: ["aunque", "虚拟式", "B2"], source: "CEFR B2 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-c1-001", language: "es", level: "c1", category: "vocabulary", skill: "discourse", type: "choice",
    prompt: "选择最适合连接两个相反论点的正式表达。", text: "Los resultados son prometedores; (　), la muestra sigue siendo pequeña.",
    options: ["sin embargo", "por lo tanto", "además", "es decir"], answer: 0,
    explanation: "sin embargo 引出与前句形成限制或转折的信息；其余选项分别偏结果、补充和改述。",
    tags: ["语篇连接", "转折", "C1"], source: "CEFR C1 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
  {
    id: "es-c2-001", language: "es", level: "c2", category: "vocabulary", skill: "semantic-nuance", type: "choice",
    prompt: "哪一项最准确地区分这两个近义表达？", text: "No es imposible. / Es posible.",
    options: ["前者通过双重否定保留谨慎或有限肯定，后者直接陈述可能性", "两句在所有语境中语气完全相同", "前者表示绝对不可能", "后者表示事情已经发生"], answer: 0,
    explanation: "命题真值可能接近，但语用力度不同；no es imposible 往往刻意避免强肯定，可传达保留、修正或委婉立场。",
    tags: ["语用", "语义细微差别", "C2"], source: "CEFR C2 能力域 · 官方框架对齐自拟", sourceUrl: cefrSource, sourceStatus: "original",
  },
];
