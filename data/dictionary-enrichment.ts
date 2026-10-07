// Selected dictionary material checked on 2026-10-07; this is not a verification
// claim about the rest of the vocabulary bank. Sense order is Pikku's presentation.
// Wiktionary-derived summaries and translations below are adaptations by Pikku,
// offered under CC BY-SA 4.0 with contributor attribution, source revisions and
// the license link on each citation. Other dictionary summaries are independently
// worded. Examples without a source are original Pikku examples, not quotations.

export type DictionaryCitation = {
  name: string;
  url: string;
  license?: string;
  licenseUrl?: string;
};

export type DictionaryText = { "zh-CN": string; en: string };

const aqua: DictionaryCitation = {
  name: "Wiktionary contributors · aqua (Latin); adapted by Pikku",
  url: "https://en.wiktionary.org/w/index.php?title=aqua&oldid=92922178#Latin",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
const fero: DictionaryCitation = {
  name: "Wiktionary contributors · fero (Latin); adapted by Pikku",
  url: "https://en.wiktionary.org/w/index.php?title=fero&oldid=93015271#Latin",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
const kimete: DictionaryCitation = {
  name: "小学館『デジタル大辞泉』· 決め手（コトバンク）",
  url: "https://kotobank.jp/word/決め手-475851",
};
const torikumi: DictionaryCitation = {
  name: "小学館『デジタル大辞泉』· 取組（コトバンク）",
  url: "https://kotobank.jp/word/取組-585764",
};
const torikumiHistorical: DictionaryCitation = {
  name: "小学館『精選版 日本国語大辞典』· 取組（コトバンク）",
  url: "https://kotobank.jp/word/取組-585764",
};
const hello: DictionaryCitation = {
  name: "Wiktionary contributors · hello (English); adapted by Pikku",
  url: "https://en.wiktionary.org/w/index.php?title=hello&oldid=93360782#English",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
const helloHistory: DictionaryCitation = {
  name: "Online Etymology Dictionary · hello",
  url: "https://www.etymonline.com/word/hello",
};
const bonjour: DictionaryCitation = {
  name: "Wiktionary contributors · bonjour (French); adapted by Pikku",
  url: "https://en.wiktionary.org/w/index.php?title=bonjour&oldid=92441184#French",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
const mawid: DictionaryCitation = {
  name: "Wiktionary contributors · موعد (Arabic); adapted by Pikku",
  url: "https://en.wiktionary.org/w/index.php?title=موعد&oldid=93332360#Arabic",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export const dictionaryEnrichment: Record<string, {
  senses?: {
    gloss: DictionaryText;
    reading?: string;
    partOfSpeech?: DictionaryText;
    source?: DictionaryCitation;
  }[];
  examples?: {
    text: string;
    translation?: DictionaryText;
    source?: DictionaryCitation;
  }[];
  etymology?: {
    text: DictionaryText;
    source: DictionaryCitation;
  }[];
  references?: DictionaryCitation[];
}> = {
  "lexicon-la-aqua": {
    senses: [{
      gloss: { "zh-CN": "水。", en: "Water." },
      reading: "aqua, aquae",
      partOfSpeech: { "zh-CN": "名词，阴性，第一变格", en: "Noun, feminine, first declension" },
      source: aqua,
    }],
    examples: [{
      text: "Lavō cum aquā.",
      translation: { "zh-CN": "我用水清洗。", en: "I wash with water." },
      source: aqua,
    }],
    etymology: [{
      text: {
        "zh-CN": "继承自原始意大利语 *akʷā，通常上溯至原始印欧语 *h₂ékʷeh₂。星号标示重建形式。",
        en: "Inherited from Proto-Italic *akʷā, traced to Proto-Indo-European *h₂ékʷeh₂. An asterisk marks a reconstructed form.",
      },
      source: aqua,
    }],
    references: [aqua],
  },
  "lexicon-la-ferō": {
    senses: [
      { gloss: { "zh-CN": "携带；运送。", en: "To carry or transport." }, reading: "ferō, ferre, tulī, lātum", partOfSpeech: { "zh-CN": "动词，不规则变化", en: "Verb, irregular" }, source: fero },
      { gloss: { "zh-CN": "支撑；托住。", en: "To support or hold up." }, source: fero },
      { gloss: { "zh-CN": "忍受；承受。", en: "To endure or tolerate." }, source: fero },
      { gloss: { "zh-CN": "传述；据说（常见于 ferunt 等形式）。", en: "To report or relate; to say, as in the form ferunt." }, source: fero },
    ],
    examples: [{
      text: "Faustulo fuisse nomen ferunt",
      translation: { "zh-CN": "据说他的名字叫福斯图卢斯。", en: "They say that his name was Faustulus." },
      source: { ...fero, name: "Livy, Ab urbe condita 1.4 · quoted by Wiktionary contributors; translation by Pikku" },
    }],
    etymology: [{
      text: {
        "zh-CN": "这是补充式变化：现在词干 fer- 上溯至表示携带的 *bʰer-；tulī、lātum 来自不同词根，与 tollō 有联系。",
        en: "Its paradigm is suppletive: the present stem fer- continues *bʰer-, associated with carrying; tulī and lātum come from a different root, also connected with tollō.",
      },
      source: fero,
    }],
    references: [fero],
  },
  "ja-n1-list-254cc0af9f90": {
    senses: [
      { gloss: { "zh-CN": "决定性因素；使判断或胜负得以确定的手段、方法或依据。", en: "A deciding factor: a means, method or piece of evidence that settles a judgment or outcome." }, reading: "きめて", partOfSpeech: { "zh-CN": "名词", en: "Noun" }, source: kimete },
      { gloss: { "zh-CN": "最终作决定的人。", en: "The person who makes the final decision." }, source: kimete },
    ],
    examples: [{
      text: "価格が購入の決め手になった。",
      translation: { "zh-CN": "价格成为决定购买的关键因素。", en: "Price was the deciding factor in the purchase." },
    }],
    references: [kimete],
  },
  "ja-n1-list-cefe81dd8db6": {
    senses: [
      { gloss: { "zh-CN": "为处理事情、解决问题所作的努力或措施。", en: "Efforts or initiatives to address a task or solve a problem." }, reading: "とりくみ", partOfSpeech: { "zh-CN": "名词", en: "Noun" }, source: torikumi },
      { gloss: { "zh-CN": "搭配；对阵或比赛，尤指相扑。", en: "A pairing or match, especially in sumo." }, source: torikumi },
      { gloss: { "zh-CN": "金融用语：买卖双方的头寸关系，或交易约定。", en: "In finance, the relationship between buying and selling positions, or a trade agreement." }, source: torikumiHistorical },
    ],
    examples: [{
      text: "地域の環境問題への取り組みを紹介します。",
      translation: { "zh-CN": "介绍本地区应对环境问题的措施。", en: "I will present our local efforts to address environmental problems." },
    }],
    references: [torikumi, torikumiHistorical],
  },
  "en-us-c-seed-02": {
    senses: [
      { gloss: { "zh-CN": "见面或到来时的问候：你好。", en: "A greeting when meeting or arriving." }, partOfSpeech: { "zh-CN": "感叹词", en: "Interjection" }, source: hello },
      { gloss: { "zh-CN": "接电话时的招呼：喂。", en: "A greeting used when answering the telephone." }, source: hello },
      { gloss: { "zh-CN": "用于确认是否有人在场、引起回应的呼唤。", en: "A call used to check whether someone is present or to invite a response." }, source: hello },
    ],
    examples: [
      { text: "Hello, everyone.", translation: { "zh-CN": "大家好。", en: "A greeting to everyone present." }, source: hello },
      { text: "Hello? Is anyone there?", translation: { "zh-CN": "喂？有人在吗？", en: "A call asking whether anyone is present." }, source: hello },
    ],
    etymology: [{
      text: {
        "zh-CN": "hello 与更早用于呼唤、引起注意的 hallo、hollo 等形式有关；十九世纪电话的使用推动它成为日常问候语。",
        en: "Hello developed among variants of earlier calls for attention, such as hallo and hollo. Telephone use helped establish it as an everyday greeting in the nineteenth century.",
      },
      source: helloHistory,
    }],
    references: [hello, helloHistory],
  },
  "fr-starter-c-01": {
    senses: [
      { gloss: { "zh-CN": "白天见面时的问候：你好；日安。", en: "A daytime greeting: hello or good day." }, partOfSpeech: { "zh-CN": "感叹词", en: "Interjection" }, source: bonjour },
      { gloss: { "zh-CN": "问候；致意，如托人转达的问好。", en: "A greeting or regards, including those conveyed through another person." }, partOfSpeech: { "zh-CN": "名词，阳性", en: "Noun, masculine" }, source: bonjour },
    ],
    examples: [
      { text: "Bonjour, mon ami !", translation: { "zh-CN": "你好，我的朋友！", en: "Hello, my friend!" }, source: bonjour },
      { text: "Tu passeras le bonjour à ta mère !", translation: { "zh-CN": "请替我向你母亲问好！", en: "Give my regards to your mother!" }, source: bonjour },
    ],
    etymology: [{
      text: {
        "zh-CN": "经中古法语继承自古法语 bonjor；其构成对应 bon（好的）与 jour（日、天）。",
        en: "Inherited through Middle French from Old French bonjor; its components correspond to bon (good) and jour (day).",
      },
      source: bonjour,
    }],
    references: [bonjour],
  },
  "ar-starter-f-01": {
    senses: [
      { gloss: { "zh-CN": "约定的时间；指定的时刻。", en: "An appointed or specified time." }, reading: "mawʿid", partOfSpeech: { "zh-CN": "名词，阳性", en: "Noun, masculine" }, source: mawid },
      { gloss: { "zh-CN": "预约；约定的会面。", en: "An appointment or arranged meeting." }, source: mawid },
      { gloss: { "zh-CN": "约会。", en: "A date or rendezvous." }, source: mawid },
    ],
    examples: [{
      text: "حَانَ مَوْعِدُ الرَّحِيلِ.",
      translation: { "zh-CN": "出发的时间到了。", en: "It is time to leave." },
      source: mawid,
    }],
    etymology: [{
      text: {
        "zh-CN": "来自阿拉伯语词根 و ع د（w-ʿ-d），与表示承诺、许诺的动词 وَعَدَ 有关。",
        en: "From the Arabic root و ع د (w-ʿ-d), related to وَعَدَ, the verb for promising.",
      },
      source: mawid,
    }],
    references: [mawid],
  },
};
