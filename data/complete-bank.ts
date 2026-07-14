import type { Question, QuestionLevel, Category } from "./questions";

type VocabSeed = [lemma: string, gloss: string, surface: string, level: QuestionLevel, source: string, family: string];

const vocabSeeds: VocabSeed[] = [
  ["amō, amāre, amāvī, amātum", "爱；喜欢", "amāverant", "elementary", "Wheelock 1 · LLPSI V", "动词"],
  ["cōgitō, cōgitāre, cōgitāvī, cōgitātum", "思考；考虑；计划", "cōgitābat", "elementary", "Wheelock 1", "认知"],
  ["dēbeō, dēbēre, dēbuī, dēbitum", "欠；应当；必须", "dēbuerimus", "elementary", "Wheelock 1", "动词"],
  ["dō, dare, dedī, datum", "给；提供", "dedissent", "elementary", "Wheelock 1 · LLPSI VII", "动词"],
  ["errō, errāre, errāvī, errātum", "漫游；犯错", "errāvisse", "elementary", "Wheelock 1", "动词"],
  ["laudō, laudāre, laudāvī, laudātum", "赞扬", "laudātus", "elementary", "Wheelock 1", "动词"],
  ["moneō, monēre, monuī, monitum", "提醒；警告", "monitus", "elementary", "Wheelock 1", "动词"],
  ["servō, servāre, servāvī, servātum", "保存；守护；拯救", "servābitur", "elementary", "Wheelock 1", "动词"],
  ["terreō, terrēre, terruī, territum", "使恐惧", "territī", "elementary", "Wheelock 1", "动词"],
  ["videō, vidēre, vīdī, vīsum", "看见；理解", "vīderint", "elementary", "Wheelock 1", "感知"],
  ["fāma, fāmae f.", "传闻；名声", "fāmae", "elementary", "Wheelock 2", "抽象名词"],
  ["fortūna, fortūnae f.", "命运；运气", "fortūnā", "elementary", "Wheelock 2", "抽象名词"],
  ["īra, īrae f.", "愤怒", "īram", "elementary", "Wheelock 2", "情感"],
  ["patria, patriae f.", "祖国；故乡", "patriae", "elementary", "Wheelock 2", "共同体"],
  ["sententia, sententiae f.", "意见；想法；判决", "sententiārum", "elementary", "Wheelock 2", "抽象名词"],
  ["vita, vitae f.", "生命；生活方式", "vītās", "elementary", "Wheelock 2", "基础名词"],
  ["ager, agrī m.", "田地；农场", "agrōs", "elementary", "Wheelock 3 · LLPSI XXVII", "乡村"],
  ["amicus, amīcī m.", "朋友", "amīcīs", "elementary", "Wheelock 3 · LLPSI VI", "人物"],
  ["populus, populī m.", "人民；民族", "populō", "elementary", "Wheelock 3", "共同体"],
  ["puer, puerī m.", "男孩", "puerōrum", "elementary", "Wheelock 3 · LLPSI III", "人物"],
  ["vir, virī m.", "男子；英雄", "virōs", "elementary", "Wheelock 3", "人物"],
  ["bellum, bellī n.", "战争", "bella", "elementary", "Wheelock 4 · LLPSI XII", "军事"],
  ["cōnsilium, cōnsiliī n.", "建议；计划；判断", "cōnsiliō", "elementary", "Wheelock 4", "政治"],
  ["dōnum, dōnī n.", "礼物", "dōnīs", "elementary", "Wheelock 4 · LLPSI VIII", "基础名词"],
  ["officium, officiī n.", "职责；服务", "officia", "elementary", "Wheelock 4", "抽象名词"],
  ["perīculum, perīculī n.", "危险", "perīculīs", "elementary", "Wheelock 4 · LLPSI XXVIII", "叙事"],
  ["possum, posse, potuī", "能够", "potuerant", "elementary", "Wheelock 6 · LLPSI XV", "不规则动词"],
  ["sum, esse, fuī, futūrum", "是；存在", "fueritis", "elementary", "Wheelock 4–6 · LLPSI I", "不规则动词"],
  ["amor, amōris m.", "爱", "amōre", "elementary", "Wheelock 7 · LLPSI XIX", "情感"],
  ["cīvitās, cīvitātis f.", "公民共同体；国家；公民权", "cīvitātī", "elementary", "Wheelock 7", "政治"],
  ["homō, hominis m./f.", "人；人类", "hominibus", "elementary", "Wheelock 7 · LLPSI X", "人物"],
  ["pāx, pācis f.", "和平", "pācem", "elementary", "Wheelock 7", "政治"],
  ["rēx, rēgis m.", "国王", "rēgum", "elementary", "Wheelock 7", "政治"],
  ["scrībō, scrībere, scrīpsī, scrīptum", "写", "scrīpserat", "elementary", "Wheelock 8 · LLPSI XVIII", "行动"],
  ["agō, agere, ēgī, āctum", "驱赶；做；度过", "ēgerunt", "elementary", "Wheelock 8 · LLPSI V", "行动"],
  ["dīcō, dīcere, dīxī, dictum", "说；讲述", "dīxissent", "elementary", "Wheelock 8 · LLPSI XXI", "言语"],
  ["mittō, mittere, mīsī, missum", "派遣；投送", "missīs", "elementary", "Wheelock 8 · LLPSI XII", "行动"],
  ["trahō, trahere, trāxī, tractum", "拖；拉；吸引", "tractus", "elementary", "Wheelock 8", "行动"],
  ["hic, haec, hoc", "这；这个", "huius", "elementary", "Wheelock 9 · LLPSI VII", "代词"],
  ["ille, illa, illud", "那；那个；著名的", "illīus", "elementary", "Wheelock 9 · LLPSI VIII", "代词"],
  ["alius, alia, aliud", "另一个；别的", "aliud", "elementary", "Wheelock 9 · LLPSI X", "代词形容词"],
  ["capiō, capere, cēpī, captum", "拿；捕获；占领", "cēperunt", "elementary", "Wheelock 10 · LLPSI X", "行动"],
  ["faciō, facere, fēcī, factum", "做；制造", "factūrus", "elementary", "Wheelock 10 · LLPSI XXI", "行动"],
  ["audiō, audīre, audīvī, audītum", "听见", "audīverat", "elementary", "Wheelock 10 · LLPSI III", "感知"],
  ["veniō, venīre, vēnī, ventum", "来；到达", "ventūrōs", "elementary", "Wheelock 10 · LLPSI VII", "行动"],
  ["ego, meī", "我", "mihi", "elementary", "Wheelock 11 · LLPSI II", "代词"],
  ["is, ea, id", "他／她／它；那个", "eōrum", "elementary", "Wheelock 11 · LLPSI IV", "代词"],
  ["ferō, ferre, tulī, lātum", "携带；忍受；报告", "tulissent", "elementary", "Wheelock 12/31 · LLPSI XIV", "不规则动词"],
  ["ipse, ipsa, ipsum", "本人；本身", "ipsīus", "elementary", "Wheelock 13 · LLPSI XI", "代词"],
  ["loquor, loquī, locūtus sum", "说话", "locūtī sunt", "elementary", "Wheelock 34 · LLPSI XVI", "异相动词"],
  ["proficīscor, proficīscī, profectus sum", "出发", "profectī", "elementary", "Wheelock 34 · LLPSI XXVIII", "异相动词"],
  ["mare, maris n.", "海", "maria", "elementary", "Wheelock 14 · LLPSI XVI", "自然"],
  ["mīles, mīlitis m.", "士兵", "mīlitum", "elementary", "Wheelock 15 · LLPSI XII", "军事"],
  ["castra, castrōrum n. pl.", "军营", "castrīs", "elementary", "Wheelock 15 · LLPSI XXXII", "军事"],
  ["omnis, omne", "全部的；每一个", "omnium", "elementary", "Wheelock 16 · LLPSI X", "形容词"],
  ["fortis, forte", "勇敢的；强壮的", "fortiōribus", "elementary", "Wheelock 16", "形容词"],
  ["quī, quae, quod", "谁；哪个；关系代词", "quōrum", "elementary", "Wheelock 17 · LLPSI XI", "代词"],
  ["premō, premere, pressī, pressum", "压迫；逼近", "pressus", "elementary", "Wheelock 18", "行动"],
  ["quaerō, quaerere, quaesīvī, quaesītum", "寻找；询问", "quaesīvisset", "elementary", "Wheelock 19 · LLPSI XVIII", "言语"],
  ["exercitus, exercitūs m.", "军队", "exercituī", "elementary", "Wheelock 20 · LLPSI XXXIII", "军事"],
  ["manus, manūs f.", "手；一队人马", "manuum", "elementary", "Wheelock 20 · LLPSI XI", "基础名词"],
  ["domus, domūs f.", "房屋；家", "domī", "elementary", "Wheelock 20/37 · LLPSI V", "地点"],
  ["fidēs, fideī f.", "信任；忠诚；信用", "fidem", "elementary", "Wheelock 22", "抽象名词"],
  ["rēs, reī f.", "事情；事物；局势", "rērum", "elementary", "Wheelock 22 · LLPSI XX", "抽象名词"],
  ["sequor, sequī, secūtus sum", "跟随；追赶", "secūtī", "elementary", "Wheelock 23/34 · LLPSI XXVI", "异相动词"],
  ["cōgnōscō, cōgnōscere, cōgnōvī, cōgnitum", "得知；认识；完成时表示知道", "cognitīs", "elementary", "Wheelock 24 · LLPSI XXIV", "认知"],
  ["ūtor, ūtī, ūsus sum", "使用；利用（支配夺格）", "ūsī sunt", "elementary", "Wheelock 34", "异相动词"],
  ["intellegō, intellegere, intellēxī, intellēctum", "理解；察觉", "intellēxisset", "elementary", "Wheelock 25 · LLPSI XXV", "认知"],
  ["putō, putāre, putāvī, putātum", "认为；估计", "putāvit", "elementary", "Wheelock 25 · LLPSI XVII", "认知"],
  ["melior, melius", "更好的", "meliōrem", "elementary", "Wheelock 26–27", "比较级"],
  ["optimus, optima, optimum", "最好的", "optimīs", "elementary", "Wheelock 27", "最高级"],
  ["iubeō, iubēre, iussī, iussum", "命令", "iussit", "elementary", "Wheelock 28 · LLPSI XV", "言语"],
  ["petō, petere, petīvī, petītum", "寻求；请求；攻击；前往", "petīverant", "elementary", "Wheelock 28 · LLPSI IX", "行动"],
  ["accidō, accidere, accidī", "发生；降临于（与格）", "accidisset", "elementary", "Wheelock 29 · LLPSI XXVI", "事件"],
  ["timeō, timēre, timuī", "害怕", "timeant", "elementary", "Wheelock 30 · LLPSI XXVIII", "情感"],
  ["volō, velle, voluī", "愿意；想要", "vellet", "elementary", "Wheelock 32 · LLPSI XX", "不规则动词"],
  ["nōlō, nōlle, nōluī", "不愿意", "nōluerant", "elementary", "Wheelock 32 · LLPSI XX", "不规则动词"],
  ["eō, īre, iī/īvī, itum", "去", "iissent", "elementary", "Wheelock 37 · LLPSI VI", "不规则动词"],
  ["fīō, fierī, factus sum", "成为；发生；被做", "fieret", "elementary", "Wheelock 36 · LLPSI XXIII", "不规则动词"],
  ["gerundium, gerundiī n.", "动名词", "gerundiī", "advanced", "Wheelock 39 · LLPSI XXVI", "语法术语"],
  ["gerundīvum, gerundīvī n.", "动形容词；被动必需结构", "gerundīvō", "advanced", "Wheelock 24/39 · LLPSI XXXI", "语法术语"],
  ["supīnum, supīnī n.", "目的分词（supine）", "supīnō", "intermediate", "北大中级 · LLPSI XXII", "语法术语"],
  ["auctoritās, auctoritātis f.", "威望；权威；影响力", "auctoritāte", "intermediate", "Cicero 高频 · Wheelock Locī", "政治"],
  ["dignitās, dignitātis f.", "身份；声望；尊严", "dignitātem", "intermediate", "Cicero 高频 · LLPSI XXXII", "政治"],
  ["rēs pūblica, reī pūblicae f.", "国家；共和国；公共事务", "reī pūblicae", "intermediate", "Cicero/Sallust 高频", "政治"],
  ["coniūrātiō, coniūrātiōnis f.", "共谋；阴谋", "coniūrātiōnem", "intermediate", "Sallust · Bellum Catilinae", "政治"],
  ["cupīdō, cupīdinis f.", "欲望；贪求", "cupīdine", "intermediate", "Sallust 高频", "道德词汇"],
  ["avaritia, avaritiae f.", "贪婪", "avaritiae", "intermediate", "Sallust 高频", "道德词汇"],
  ["ambitiō, ambitiōnis f.", "竞选活动；野心", "ambitiōne", "intermediate", "Sallust/Cicero 高频", "政治"],
  ["virtūs, virtūtis f.", "卓越；勇德；勇气", "virtūtem", "intermediate", "Sallust/Cicero 高频", "道德词汇"],
  ["scelus, sceleris n.", "罪行；邪恶", "scelerum", "intermediate", "Cicero · In Catilinam", "法律"],
  ["salūs, salūtis f.", "安全；福祉；拯救", "salūtī", "intermediate", "Cicero 高频", "政治"],
  ["ōrātiō, ōrātiōnis f.", "言说；演说；文体", "ōrātiōnem", "intermediate", "Cicero 高频", "修辞"],
  ["iūdex, iūdicis m.", "法官；审判者", "iūdicibus", "intermediate", "Cicero · In Verrem", "法律"],
  ["crīmen, crīminis n.", "指控；罪名", "crīminibus", "intermediate", "Cicero · In Verrem", "法律"],
  ["testis, testis m./f.", "证人", "testium", "intermediate", "Cicero · In Verrem", "法律"],
  ["senātus, senātūs m.", "元老院", "senātuī", "intermediate", "Cicero/Sallust 高频", "政治"],
  ["cōnsul, cōnsulis m.", "执政官", "cōnsulem", "intermediate", "Cicero/Sallust 高频", "政治"],
  ["imperium, imperiī n.", "命令权；统治；帝国", "imperiō", "intermediate", "Cicero/Sallust 高频", "政治"],
  ["potestās, potestātis f.", "权力；能力；机会", "potestāte", "intermediate", "Cicero 高频", "政治"],
  ["neglegō, neglegere, neglēxī, neglēctum", "忽视；疏忽", "neglēxerit", "intermediate", "Cicero 高频", "行动"],
  ["arbitror, arbitrārī, arbitrātus sum", "判断；认为", "arbitrātus", "intermediate", "Cicero 高频", "异相动词"],
  ["vereor, verērī, veritus sum", "敬畏；害怕", "veritus", "intermediate", "Cicero/Sallust 高频", "异相动词"],
  ["polliceor, pollicērī, pollicitus sum", "许诺", "pollicitus", "intermediate", "Cicero 高频", "异相动词"],
  ["cōnfiteor, cōnfitērī, cōnfessus sum", "承认；坦白", "cōnfessus", "intermediate", "Cicero 高频", "异相动词"],
  ["hortor, hortārī, hortātus sum", "鼓励；劝告", "hortātus", "intermediate", "Cicero 高频", "异相动词"],
  ["persuādeō, persuādēre, persuāsī, persuāsum", "说服（支配与格）", "persuāsit", "intermediate", "Cicero 高频", "言语"],
  ["contendō, contendere, contendī, contentum", "努力；争辩；赶赴", "contenderant", "intermediate", "Caesar/Sallust 高频", "行动"],
  ["constituō, constituere, constituī, constitūtum", "决定；设立；安排", "constituisset", "intermediate", "Caesar/Cicero 高频", "行动"],
  ["suscipiō, suscipere, suscēpī, susceptum", "承担；接受", "susceptum", "intermediate", "Cicero 高频", "行动"],
  ["quippe", "诚然；因为显然", "quippe", "advanced", "Wheelock Locī · 进阶语用", "语用"],
  ["ultro", "主动地；此外；甚至", "ultro", "advanced", "原典进阶", "语用"],
  ["forsitan", "也许（常配虚拟式）", "forsitan", "advanced", "原典进阶", "语用"],
  ["faxō", "我一定会做／使……（古式）", "faxō", "advanced", "Wheelock 补充词形", "古式"],
  ["siet", "sit 的古式形式", "siet", "advanced", "古式与诗体", "古式"],
  ["duim", "dem 的古式形式", "duim", "advanced", "古式与诗体", "古式"],
  ["fore", "将会是；esse 的将来不定式", "fore", "intermediate", "北大中级特殊词形", "不规则动词"],
  ["dictū", "说来；-ū 目的分词", "dictū", "intermediate", "北大中级 supine", "非限定形式"],
  ["rogātum", "为了询问；-um 目的分词", "rogātum", "intermediate", "北大中级 supine", "非限定形式"],
  ["poēta, poētae m.", "诗人", "poētārum", "elementary", "Wheelock 2 · LLPSI XXXIV", "诗歌"],
  ["carmen, carminis n.", "歌；诗", "carmina", "elementary", "Wheelock 7 · LLPSI XXXIV", "诗歌"],
  ["versus, versūs m.", "诗行；方向", "versuum", "advanced", "LLPSI XXXIV", "诗歌"],
  ["metrum, metrī n.", "格律；韵律单位", "metra", "advanced", "LLPSI XXXIV", "诗歌"],
  ["syllaba, syllabae f.", "音节", "syllabārum", "advanced", "LLPSI XXXV", "语法术语"],
  ["nōminātīvus, nōminātīvī m.", "主格", "nōminātīvō", "advanced", "LLPSI XXXV", "语法术语"],
  ["accūsātīvus, accūsātīvī m.", "宾格", "accūsātīvum", "advanced", "LLPSI XXXV", "语法术语"],
];

function hash(value: string) {
  return [...value].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function rotatedOptions(correct: string, distractors: string[], key: string) {
  const unique = [correct, ...distractors.filter((item) => item !== correct)].slice(0, 4);
  const shift = hash(key) % unique.length;
  const options = [...unique.slice(shift), ...unique.slice(0, shift)];
  return { options, answer: options.indexOf(correct) };
}

const vocabQuestions: Question[] = vocabSeeds.flatMap((seed, index) => {
  const [lemma, gloss, surface, level, source, family] = seed;
  const sameLevel = vocabSeeds.filter((item) => item[3] === level && item[1] !== gloss);
  const glosses = [3, 11, 19].map((offset) => sameLevel[(index + offset) % sameLevel.length][1]);
  const lemmas = [5, 13, 23].map((offset) => sameLevel[(index + offset) % sameLevel.length][0]);
  const meaning = rotatedOptions(gloss, glosses, `meaning-${lemma}`);
  const lookup = rotatedOptions(lemma, lemmas, `lookup-${lemma}`);
  return [
    {
      id: `tb-voc-${String(index + 1).padStart(3, "0")}`,
      level, category: "vocabulary", type: "choice",
      prompt: "选择最符合词典词头的核心义。", latin: lemma,
      options: meaning.options, answer: meaning.answer,
      explanation: `${lemma}：${gloss}。北大考试允许使用指定拉英词典，但要求考生熟悉高频义并能依语境调整。`,
      tags: [family, "教材词汇", source.split(" · ")[0]], source,
    },
    {
      id: `tb-look-${String(index + 1).padStart(3, "0")}`,
      level, category: "vocabulary", type: "choice",
      prompt: `在连续文本中遇到 ${surface}，应优先回溯到哪个词典词头？`, latin: surface,
      options: lookup.options, answer: lookup.answer,
      explanation: `${surface} 回溯到 ${lemma}，核心义为“${gloss}”。查词典前先去掉曲折词尾，并识别完成词干、不规则词干或分词。`,
      tags: [family, "词典回溯", source.split(" · ")[0]], source,
    },
  ];
});

type FormSeed = [form: string, analysis: string, explanation: string, level: QuestionLevel, source: string, tag: string];

const formSeeds: FormSeed[] = [
  ["amābāmus", "直陈式未完成时主动第一人称复数", "现在词干 amā- + 未完成时标记 -bā- + -mus。", "elementary", "Wheelock 5", "未完成时"],
  ["monēbitis", "直陈式将来时主动第二人称复数", "第二变位将来时使用 -bi-，第二人称复数词尾 -tis。", "elementary", "Wheelock 5", "将来时"],
  ["poterant", "直陈式未完成时主动第三人称复数", "possum 的未完成时以 poterā- 为词干。", "elementary", "Wheelock 6", "不规则动词"],
  ["rēgibus", "第三变格与格或夺格复数", "rēx, rēgis 的复数与格和夺格同形为 rēgibus。", "elementary", "Wheelock 7", "第三变格"],
  ["scrībite", "现在时主动命令式第二人称复数", "第三变位命令式复数以 -ite 结尾。", "elementary", "Wheelock 8", "命令式"],
  ["huius", "hic/haec/hoc 的属格单数三性同形", "huius 是指示代词 hic 的不规则属格单数。", "elementary", "Wheelock 9", "指示代词"],
  ["capiunt", "现在时主动直陈式第三人称复数", "第三变位 -iō 动词 capiō 在第三人称复数出现 -iu-。", "elementary", "Wheelock 10", "-io 动词"],
  ["nōbīs", "第一人称复数代词的与格或夺格", "nōs 的与格、夺格复数均为 nōbīs。", "elementary", "Wheelock 11", "人称代词"],
  ["tulērunt", "ferō 的完成时主动直陈式第三人称复数", "完成词干 tul- 来自第三主要部分 tulī。", "elementary", "Wheelock 12", "完成时"],
  ["ipsīus", "ipse 的属格单数三性同形", "ipse 属于 -īus 属格、-ī 与格的代词形容词系统。", "elementary", "Wheelock 13", "强调代词"],
  ["maribus", "第三变格中性 i-词干与格或夺格复数", "mare, maris 的复数与格/夺格为 maribus。", "elementary", "Wheelock 14", "i-词干"],
  ["quīnque", "不变数词‘五’", "quīnque 不随格、性、数变化。", "elementary", "Wheelock 15", "数词"],
  ["fortiōra", "第三变格比较级中性主格或宾格复数", "比较级中性复数用 -iōra；实际格由句法决定。", "elementary", "Wheelock 16/26", "比较级"],
  ["quibus", "关系代词与格或夺格复数三性同形", "quī, quae, quod 的复数与格和夺格均为 quibus。", "elementary", "Wheelock 17", "关系代词"],
  ["laudāminī", "现在时被动直陈式第二人称复数", "第一变位现在词干 + 被动第二人称复数词尾 -minī。", "elementary", "Wheelock 18", "现在被动"],
  ["missa est", "完成时被动直陈式第三人称单数阴性", "完成被动分词与主语性数格一致，再加 sum 的现在时。", "elementary", "Wheelock 19", "完成被动"],
  ["manuum", "第四变格属格复数", "manus, -ūs f. 的属格复数为 manuum。", "elementary", "Wheelock 20", "第四变格"],
  ["audiēbantur", "未完成时被动直陈式第三人称复数", "第四变位保留 -iē-，再接 -bantur。", "elementary", "Wheelock 21", "被动语态"],
  ["rērum", "第五变格属格复数", "rēs, reī 的属格复数为 rērum。", "elementary", "Wheelock 22", "第五变格"],
  ["ventūrus", "将来主动分词阳性主格单数", "由第四主要部分的 supine 词干 ventūr- 构成，表示后续/意图。", "elementary", "Wheelock 23", "将来分词"],
  ["faciendum est", "无人称被动迂说，表达必须做", "动形容词中性单数 + est 可无人称表达必要性。", "elementary", "Wheelock 24", "被动迂说"],
  ["vīdisse", "完成时主动不定式", "完成词干 vīd- + -isse；在间接陈述中表示先时。", "elementary", "Wheelock 25", "不定式"],
  ["celerius", "比较级副词", "第三变格形容词 celer 的比较级副词使用中性单数形式 celerius。", "elementary", "Wheelock 26", "副词比较"],
  ["optimē", "副词最高级", "bonus 的不规则最高级 optimus 对应副词 optimē。", "elementary", "Wheelock 27", "不规则比较"],
  ["laudet", "现在时主动虚拟式第三人称单数", "第一变位现在虚拟式用特征元音 -ē-。", "elementary", "Wheelock 28", "现在虚拟式"],
  ["agerent", "未完成时主动虚拟式第三人称复数", "现在主动不定式 agere + 人称词尾 -nt。", "elementary", "Wheelock 29", "未完成虚拟式"],
  ["fēcissent", "愈过去时主动虚拟式第三人称复数", "完成主动不定式 fēcisse + -nt。", "elementary", "Wheelock 30", "愈过去虚拟式"],
  ["lātus esset", "愈过去时被动虚拟式第三人称单数阳性", "完成被动分词 + sum 未完成虚拟式。", "elementary", "Wheelock 30/31", "完成被动"],
  ["ferāmus", "ferō 的现在时主动虚拟式第一人称复数", "不规则动词 ferō 的现在虚拟式为 feram, ferās...。", "elementary", "Wheelock 31", "fero"],
  ["vellet", "volō 的未完成时主动虚拟式第三人称单数", "未完成虚拟式由 velle + -t 构成。", "elementary", "Wheelock 32", "volo"],
  ["locūtus erat", "异相动词愈过去时第三人称单数阳性", "loquor 形式被动、意义主动；分词与主语一致。", "elementary", "Wheelock 34", "异相动词"],
  ["cui", "关系/疑问代词与格单数三性同形", "cui 是 quī/quis 的与格单数。", "elementary", "Wheelock 17/35", "代词"],
  ["fierī", "fīō 的现在不定式；亦作 faciō 的被动不定式", "fīō 的非限定形式保留 fier-；语境决定‘成为/发生/被做’。", "elementary", "Wheelock 36", "fio"],
  ["eunt", "eō 的现在时主动直陈式第三人称复数", "不规则词干 e-/i- 在此形成 eunt。", "elementary", "Wheelock 37", "eo"],
  ["dictum", "-um 目的分词或完成被动分词中性形式", "孤立形式有歧义；运动动词后常作 -um supine，中性名词一致时可作分词。", "intermediate", "Wheelock 38 · 北大中级", "supine"],
  ["legendī", "动名词属格单数或动形容词属格单数", "需结合是否有与其一致的名词判断；动名词没有性数变化。", "elementary", "Wheelock 39", "动名词"],
  ["metū", "第四变格夺格单数", "metus, -ūs m. 的夺格单数为 metū。", "elementary", "Wheelock 40", "第四变格"],
  ["hostīs", "第三变格 i-词干宾格复数变体", "中级要求识别 -īs 代替 -ēs 的阳/阴性宾格复数。", "intermediate", "北大中级特殊词形", "变体"],
  ["loquere", "异相动词现在命令式第二人称单数", "中级还应能区分被动 -re 变体与异相动词命令式。", "intermediate", "北大中级 · -re", "变体"],
  ["rogāstī", "rogāvistī 的缩合完成形式", "-āvistī 可缩合为 -āstī，是中级特殊词形。", "intermediate", "北大中级缩合完成时", "变体"],
  ["dīxēre", "完成时主动直陈式第三人称复数变体", "-ēre 等同 -ērunt，常见于史学散文。", "intermediate", "北大中级 · Sallust", "变体"],
  ["amatum īrī", "将来时被动不定式", "由 -um 目的分词 + īrī 构成，属于北大中级增量。", "intermediate", "北大中级特殊词形", "将来被动不定式"],
  ["fore", "esse 的将来时主动不定式变体", "fore 等同 futūrum esse，可用于未来间接陈述。", "intermediate", "北大中级特殊词形", "fore"],
  ["mementō", "将来命令式第二人称单数", "中级要求识别将来命令式；mementō 是常见固定形式。", "intermediate", "北大中级将来命令式", "命令式"],
  ["Socratēs", "希腊式第一变格阳性主格单数", "希腊人名常保留 -ēs 主格、-ae/-ī 属格等特殊形式。", "intermediate", "北大中级希腊式名词", "希腊变格"],
  ["mīrābile dictū", "形容词 + -ū 目的分词，表示‘说来……’", "-ū supine 常与形容词搭配，限定评价所涉及的动作。", "intermediate", "北大中级 supine", "supine"],
  ["faxō", "faciō 的古式 s-将来/将来完成形式", "常表达强烈保证，超出中级最低要求。", "advanced", "Wheelock 补充词形", "古式"],
  ["siet", "sit 的古式现在虚拟式第三人称单数", "早期或诗体可见 siet，标准古典散文通常用 sit。", "advanced", "古式与诗体", "古式"],
  ["dixtī", "dīxistī 的诗体/缩合形式", "音节缩减常服务格律，需由完成词干 dīx- 回溯。", "advanced", "LLPSI XXXIV · 诗体", "诗体"],
  ["genus", "第三变格中性主格/宾格单数", "genus, generis n. 遵循中性主宾同形。", "elementary", "LLPSI XXXV", "语法术语"],
];

const formQuestions: Question[] = formSeeds.map((seed, index) => {
  const [form, analysis, explanation, level, source, tag] = seed;
  const pool = [
    ...formSeeds.filter((item) => item[3] === level && item[1] !== analysis),
    ...formSeeds.filter((item) => item[3] !== level && item[1] !== analysis),
  ];
  const distractors = [4, 9, 15].map((offset) => pool[(index + offset) % pool.length][1]);
  const choice = rotatedOptions(analysis, distractors, `form-${form}`);
  return {
    id: `tb-mor-${String(index + 1).padStart(3, "0")}`,
    level, category: "morphology", type: "choice", prompt: `识别 ${form} 的形态。`, latin: form,
    options: choice.options, answer: choice.answer, explanation,
    tags: [tag, "教材形态"], source,
  };
});

type StructureSeed = [latin: string, prompt: string, correct: string, wrong: [string, string, string], explanation: string, level: QuestionLevel, category: Extract<Category, "syntax" | "sentencePattern" | "classics">, source: string, tags: string[]];

const structureSeeds: StructureSeed[] = [
  ["Puella nautam rosā ornat.", "rosā 的格功能是什么？", "手段夺格：‘用玫瑰’", ["直接宾语", "间接宾语", "施事夺格"], "无介词的事物夺格可表示手段。", "elementary", "syntax", "Wheelock 2 · LLPSI VII", ["夺格", "手段"]],
  ["Marcus est puer Rōmānus.", "Rōmānus 如何与 puer 关联？", "表语形容词，与 puer 性数格一致", ["宾语补足语", "属格定语", "独立主格"], "系词 sum 连接主语与表语，形容词与所说明名词一致。", "elementary", "syntax", "Wheelock 4 · LLPSI II", ["表语", "一致"]],
  ["Puerī librum magistrī legunt.", "magistrī 最自然的功能是什么？", "属有属格：‘老师的书’", ["部分属格", "主语", "地点夺格"], "magistrī 限定 librum，表示所有者。", "elementary", "syntax", "Wheelock 3 · LLPSI XV", ["属格"]],
  ["Possumus Latīnē legere.", "legere 与 possumus 构成什么结构？", "补足不定式", ["间接陈述", "历史不定式", "目的分词"], "possum 常以现在不定式补充说明能力内容。", "elementary", "sentencePattern", "Wheelock 6 · LLPSI XV", ["不定式"]],
  ["Caesar mīlitibus signum dedit.", "mīlitibus 的格功能是什么？", "间接宾语与格", ["施事与格", "手段夺格", "方向宾格"], "dare 的受给者通常用与格。", "elementary", "syntax", "Wheelock 7 · Caesar 语体", ["与格"]],
  ["Hic liber est eius.", "eius 为什么不用 suus？", "指非主语的第三人称所有者", ["与主语共指", "表示强调", "表示相互关系"], "反身物主 suus 指向句子主语；eius/eōrum 指非主语所有者。", "elementary", "syntax", "Wheelock 11/13", ["反身", "物主"]],
  ["Rōmānī tribus diēbus iter fēcērunt.", "tribus diēbus 表示什么？", "时间延续/范围的夺格用法", ["时间点的宾格", "施事夺格", "比较夺格"], "时间表达需结合教材体系判断；此处说明行军历时三日。", "elementary", "syntax", "Wheelock 15", ["时间表达"]],
  ["Mīles fortior quam hostis erat.", "quam 后的 hostis 为什么是主格？", "比较双方在省略谓语后保持同一格", ["quam 支配宾格", "部分属格", "关系代词吸引"], "quam 比较结构中，被比较项通常与前项句法地位一致。", "elementary", "sentencePattern", "Wheelock 26", ["比较"]],
  ["Mīles hoste fortior erat.", "hoste 的功能是什么？", "比较夺格", ["分离夺格", "绝对夺格", "处所夺格"], "不用 quam 时，比较级后可用夺格表示比较对象。", "elementary", "syntax", "Wheelock 26", ["比较夺格"]],
  ["Haec est via facilior.", "facilior 与哪个词一致？", "via", ["haec 作为中性复数", "隐含的 iter", "est"], "facilior 是阴性单数主格，与 via 一致；haec 同样指向 via。", "elementary", "syntax", "Wheelock 16/26", ["一致"]],
  ["Dux, quī aderat, mīlitēs convocāvit.", "quī 的先行词是什么？", "dux", ["mīlitēs", "隐含的 populus", "没有先行词"], "关系代词性数取决于先行词 dux，格取决于从句中作 aderat 的主语。", "elementary", "syntax", "Wheelock 17", ["关系从句"]],
  ["Caesar ā mīlitibus laudātur.", "ā mīlitibus 是什么？", "有生命施事者的施事夺格", ["手段夺格", "分离夺格", "与格施事者"], "普通被动语态的有生命施事者通常用 ā/ab + 夺格。", "elementary", "syntax", "Wheelock 18", ["被动", "施事"]],
  ["Urbs ab hostibus capta est.", "capta 为什么是阴性单数？", "与主语 urbs 一致", ["与 hostibus 一致", "中性复数固定形式", "与省略的 exercitus 一致"], "复合完成被动中的分词必须与主语性数格一致。", "elementary", "syntax", "Wheelock 19", ["完成被动"]],
  ["Caesar Rōmam profectus est.", "Rōmam 为什么没有介词？", "城市名方向宾格", ["直接宾语", "持续时间宾格", "希腊式宾格"], "城市名和 domus/rūs 表示趋向时常直接用宾格。", "elementary", "syntax", "Wheelock 37", ["地点格"]],
  ["Caesar Rōmae manēbat.", "Rōmae 是什么形式？", "处所格单数", ["属格单数", "与格单数", "主格复数"], "第一、第二变格城市名处所格常与属格单数同形。", "elementary", "syntax", "Wheelock 37", ["处所格"]],
  ["Hīs rēbus cognitīs, Caesar profectus est.", "句首结构是什么？", "完成分词构成的独立夺格", ["被动迂说", "间接陈述", "目的从句"], "名词与分词均为夺格且在主句无句法位置，动作通常先于主句。", "elementary", "sentencePattern", "Wheelock 24 · Caesar 语体", ["独立夺格"]],
  ["Carthāgō dēlenda est.", "dēlenda est 表达什么？", "被动迂说的必要性", ["将来被动时态", "完成被动", "目的分词"], "动形容词 + sum 表示必须发生的被动动作。", "elementary", "sentencePattern", "Wheelock 24", ["被动迂说"]],
  ["Nōbīs hoc faciendum est.", "nōbīs 的功能是什么？", "被动迂说中的施事与格", ["间接宾语", "判断者与格", "手段夺格"], "动形容词必要结构中的执行者通常用与格。", "elementary", "syntax", "Wheelock 24", ["施事与格"]],
  ["Dīcit hostēs advenīre.", "hostēs advenīre 是什么？", "现在时宾格不定式间接陈述", ["目的从句", "间接命令", "历史不定式"], "感知/言说动词后宾格作不定式的逻辑主语；现在不定式表示与 dīcit 同时。", "elementary", "sentencePattern", "Wheelock 25", ["间接陈述"]],
  ["Dīxit hostēs advenisse.", "advenisse 相对于 dīxit 表示什么？", "先时：敌人此前已经到达", ["同时", "后时", "反事实"], "完成不定式在间接陈述中通常表示相对主句的先时。", "elementary", "syntax", "Wheelock 25", ["不定式时态"]],
  ["Dīxit hostēs ventūrōs esse.", "ventūrōs esse 表示什么？", "后时：敌人随后会来", ["先时", "同时", "习惯动作"], "将来主动不定式由将来主动分词 + esse 构成，并与宾格主语一致。", "elementary", "syntax", "Wheelock 25", ["将来不定式"]],
  ["Veniat!", "独立虚拟式的用法是什么？", "第三人称命令/愿使式：让他来", ["现在反事实", "潜能虚拟式", "恐惧从句"], "现在虚拟式可在主句表达命令或劝告。", "elementary", "sentencePattern", "Wheelock 28", ["命令虚拟式"]],
  ["Mīlitēs mittit ut pontem defendant.", "ut 从句是什么？", "目的从句", ["结果从句", "间接疑问", "事实从句"], "主句派遣士兵的目的由 ut + 虚拟式表示；否定目的用 nē。", "elementary", "sentencePattern", "Wheelock 28", ["目的从句"]],
  ["Tam celeriter cucurrit ut omnēs superāret.", "ut 从句是什么？", "结果从句", ["目的从句", "间接命令", "条件从句"], "tam 是程度标志，ut 从句说明实际结果。", "elementary", "sentencePattern", "Wheelock 29", ["结果从句"]],
  ["Rogat quid faciam.", "quid faciam 是什么？", "间接疑问", ["关系特征从句", "目的从句", "审议主句"], "疑问词保留，限定动词改用虚拟式。", "elementary", "sentencePattern", "Wheelock 30", ["间接疑问"]],
  ["Cum hostēs advenissent, Caesar discessit.", "cum 从句的时间关系是什么？", "先时背景：敌人到达后", ["同时背景", "后时目的", "开放条件"], "历史 cum + 愈过去虚拟式表示从句动作先于过去主句。", "elementary", "sentencePattern", "Wheelock 31", ["cum 从句"]],
  ["Dum spīrō, spērō.", "dum 在此表示什么？", "同时发生：当我呼吸时", ["限制条件：只要", "直到", "在……以前"], "dum + 现在直陈式可描写与主句同时的持续背景。", "elementary", "classics", "Wheelock 32 · 古代名言", ["名言", "时间从句"]],
  ["Sī hoc facit, bene est.", "条件句属于哪类？", "开放条件，现在直陈式", ["现在反事实", "过去反事实", "较不生动未来条件"], "直陈式用于说话者不把条件标为非现实的普通条件。", "elementary", "sentencePattern", "Wheelock 33", ["条件句"]],
  ["Sī hoc faceret, bene esset.", "条件句属于哪类？", "现在反事实", ["过去反事实", "开放条件", "较生动未来条件"], "未完成虚拟式同时出现在条件和结论中，表达与现在事实相反。", "elementary", "sentencePattern", "Wheelock 33", ["反事实"]],
  ["Sī hoc fēcisset, bene fuisset.", "条件句属于哪类？", "过去反事实", ["现在反事实", "开放过去条件", "混合条件"], "愈过去虚拟式表达过去未发生的条件和结果。", "elementary", "sentencePattern", "Wheelock 33", ["反事实"]],
  ["Caesar mīlitibus persuāsit ut proficīscerentur.", "ut 从句是什么？", "间接命令，persuādeō 的对象用与格", ["结果从句", "间接陈述", "关系目的从句"], "persuādeō + 与格表示说服某人，ut + 虚拟式表示被劝做的事。", "elementary", "sentencePattern", "Wheelock 35", ["间接命令"]],
  ["Accidit ut dux absit.", "ut 从句承担什么功能？", "作无人称动词主语的事实/发生名词从句", ["目的从句", "结果从句", "间接疑问"], "中级要求区分事实/发生动词后的 ut 名词从句与结果从句。", "intermediate", "sentencePattern", "北大中级 · factum/occurrence", ["ut 名词从句"]],
  ["Nōn dubitō quīn veniat.", "quīn 从句为何成立？", "否定的怀疑表达后引出内容", ["比较从句", "目的从句", "直接疑问"], "nōn dubitō 等否定怀疑结构后常用 quīn + 虚拟式。", "intermediate", "sentencePattern", "北大中级 · quin", ["quin"]],
  ["Quid facerem?", "虚拟式主句是什么用法？", "过去时间的审议虚拟式", ["愿望虚拟式", "潜能虚拟式", "命令虚拟式"], "说话者回顾当时面临的选择：‘我当时能怎么办？’", "intermediate", "sentencePattern", "北大中级 · 主句虚拟式", ["审议虚拟式"]],
  ["Velim hoc faciās.", "velim 表达什么语气？", "较委婉的愿望／请求", ["过去反事实", "强制命令", "让步"], "volō 的现在虚拟式可缓和愿望或请求。", "intermediate", "sentencePattern", "北大中级 · 愿望虚拟式", ["愿望"]],
  ["Dīcat aliquis.", "dīcat 最可能是什么主句用法？", "潜能虚拟式：有人或许会说", ["直接命令", "过去反事实", "恐惧从句"], "不定主语 + 现在虚拟式常表达可能性。", "intermediate", "sentencePattern", "北大中级 · 潜能虚拟式", ["潜能"]],
  ["Quamvīs fessus sit, pergit.", "sit 的用法是什么？", "让步虚拟式", ["目的从句", "结果从句", "间接疑问"], "quamvīs 引出让步内容，主句事实仍成立。", "intermediate", "sentencePattern", "北大中级 · 让步", ["让步"]],
  ["Oderint, dum metuant.", "dum 从句表示什么？", "限制条件：只要他们害怕", ["同时背景", "直到", "原因"], "dum/dummodo/modo + 虚拟式可表达 proviso。", "intermediate", "classics", "北大中级 · Accius/Caligula 名言", ["限制从句", "名言"]],
  ["Exspectāvit dum hostēs discessissent.", "dum 最合适的解释是什么？", "直到预期动作完成", ["同时进行", "限制条件", "原因"], "等待、持续语境中的 dum/donec/quoad 可用虚拟式表示预期目标。", "intermediate", "sentencePattern", "北大中级 · 时间从句", ["dum"]],
  ["Priusquam loquar, audi.", "loquar 为什么用虚拟式？", "动作被设想为尚未发生／预期", ["因为是结果从句", "因为是否定命令", "因为进入间接引语"], "antequam/priusquam 在预期、目的色彩或非事实语境中可用虚拟式。", "intermediate", "syntax", "北大中级 · 时间从句", ["priusquam"]],
  ["Socrates damnātus est quod iuventūtem corrumperet.", "corrumperet 为什么用虚拟式？", "转述指控者提出的主观理由", ["quod 永远支配虚拟式", "目的从句", "吸引到条件句"], "原因连词 + 虚拟式常标记理由属于他人观点而非作者断言。", "intermediate", "syntax", "北大中级 · 主观原因", ["主观原因"]],
  ["Dīxit sē, quamquam fessus esset, ventūrum esse.", "esset 为什么用虚拟式？", "从句被吸收到间接话语范围", ["结果从句", "反事实条件", "关系特征"], "间接话语内部从句常用从属虚拟式。", "intermediate", "sentencePattern", "北大中级 · orātiō oblīqua", ["间接话语"]],
  ["Dux quī mīlitēs servāret missus est.", "关系从句表达什么？", "目的：派去拯救士兵", ["单纯事实", "结果", "原因"], "中级要求识别关系代词 + 虚拟式可替代 ut + 代词表达目的。", "intermediate", "sentencePattern", "北大中级 · 关系目的", ["关系从句"]],
  ["Nēmō est quī hoc faciat.", "关系从句是什么类型？", "关系特征从句", ["关系目的从句", "间接疑问", "结果从句"], "否定或不定先行词后，虚拟式关系从句描述一类人的特征。", "elementary", "sentencePattern", "Wheelock 38 · 北大初级", ["关系特征"]],
  ["Diū pugnātum est.", "被动结构如何分析？", "不及物动词的无人称被动", ["中性主语普通被动", "完成异相动词", "被动迂说"], "不及物动词不能提升宾语为主语，因而用第三人称单数中性无人称被动。", "intermediate", "syntax", "北大中级 · 被动不及物", ["无人称被动"]],
  ["Caesar et Cicerō clārī erant.", "表语为何是阳性复数？", "复合主语均为阳性人物", ["就近一致", "中性复数概括", "固定副词形式"], "中级要求掌握复合主语与表语的一致；同为阳性时用阳性复数。", "intermediate", "syntax", "北大中级 · 复合一致", ["一致"]],
  ["Haec cum ita sint, pergāmus.", "句首关系/指示结构的篇章作用是什么？", "承接前文并总结为‘既然情况如此’", ["引入新人物", "表示目的", "构成直接疑问"], "连接性关系代词或指示结构可把新句与上文逻辑相连。", "intermediate", "classics", "Cicero 演说体", ["篇章衔接"]],
  ["Catilīna abiit, excessit, ēvāsit, ērūpit.", "动词连用的主要修辞效果是什么？", "无连接并列造成加速和累积强调", ["每个动词引不同从句", "被动结构", "严格同义而无语用差别"], "Ciceronian 演说常通过 asyndeton 和近义动词累积增强气势。", "intermediate", "classics", "Cicero · In Catilinam 2.1", ["Cicero", "修辞"]],
  ["Omnēs hominēs quī sēsē student praestāre cēterīs animālibus...", "Sallust 开篇最突出的句法倾向是什么？", "抽象论述中嵌入关系从句并压缩道德判断", ["纯粹对话体", "短促命令链", "法律问答格式"], "Sallust 常以抽象名词、对举和紧缩句法引出历史叙事。", "intermediate", "classics", "Sallust · Bellum Catilinae 1", ["Sallust", "史学"]],
  ["Gallia est omnis dīvīsa in partēs trēs.", "句中 omnis 的位置产生什么效果？", "后置并与 Gallia 呼应，强调‘全高卢’", ["修饰 partēs", "作副词", "引出间接陈述"], "拉丁语词序灵活，形容词与名词分置可形成强调，同时仍靠一致关系识别。", "elementary", "classics", "Caesar · Bellum Gallicum 1.1", ["Caesar", "词序"]],
  ["Arma virumque canō.", "-que 的功能是什么？", "后附连词，连接 arma 与 virum", ["疑问后缀", "格律填充无句法作用", "宾格词尾"], "-que 附着于第二个并列项，相当于 et。", "advanced", "classics", "LLPSI XXXIV · Vergilius", ["诗歌", "后附词"]],
  ["Mūsa, mihi causās memorā.", "Mūsa 的格与功能是什么？", "呼格，直接呼唤缪斯", ["主格主语", "与格间接宾语", "夺格工具"], "诗歌开篇常以呼格祈请缪斯。", "advanced", "classics", "LLPSI XXXIV · Vergilius", ["诗歌", "呼格"]],
  ["Spērō fore ut intellegat.", "fore ut 结构为何有用？", "用迂说方式表达未来间接陈述", ["表达过去反事实", "引目的从句", "替代现在不定式"], "当动词缺少便利的将来不定式或结构为非人称时，fore ut + 虚拟式尤其常用。", "advanced", "sentencePattern", "进阶 · 迂说", ["fore ut"]],
  ["Dīcēbātur eum ventūrum fuisse.", "ventūrum fuisse 表达什么？", "过去视角下本会发生的后续动作", ["普通将来事实", "与 dīcēbātur 同时", "先于 dīcēbātur"], "将来主动分词 + fuisse 常用于间接话语中的过去反事实或未实现未来。", "advanced", "syntax", "进阶 · 间接反事实", ["间接话语"]],
  ["Lēgēs, quās maiōrēs trādidērunt, quae cīvitātem servāverant...", "quae 最可能接回哪个先行词？", "lēgēs", ["maiōrēs", "cīvitātem", "没有先行词"], "阴性复数主格 quae 与 lēgēs 一致；需跨越前一关系从句重新接回。", "advanced", "syntax", "进阶 · 长距离一致", ["长句消歧"]],
];

const structureQuestions: Question[] = structureSeeds.map((seed, index) => {
  const [latin, prompt, correct, wrong, explanation, level, category, source, tags] = seed;
  const choice = rotatedOptions(correct, wrong, `structure-${latin}`);
  return { id: `tb-${category === "syntax" ? "syn" : category === "classics" ? "cla" : "pat"}-${String(index + 1).padStart(3, "0")}`, level, category, type: "choice", prompt, latin, options: choice.options, answer: choice.answer, explanation, tags, source };
});

type TranslationSeed = [latin: string, modelAnswer: string, explanation: string, level: QuestionLevel, source: string, tags: string[]];

const translationSeeds: TranslationSeed[] = [
  ["Mārcus, quī in magnā vīllā cum familiā habitat, librum quem magister dedit cotīdiē legit.", "Marcus, who lives with his family in a large villa, reads every day the book that the teacher gave him. / 马库斯和家人住在一座大宅里，每天都阅读老师给他的那本书。", "主干 Mārcus librum cotīdiē legit；两个关系从句分别修饰 Mārcus 与 librum。", "elementary", "LLPSI II/V/XV · 综合改写", ["关系从句", "生活场景"]],
  ["Iūlius servōs monet ut portās claudant, quod dominus timet nē fūrēs nocte veniant.", "Julius warns the slaves to close the gates, because the master fears that thieves may come at night. / 尤利乌斯告诫奴隶关好大门，因为主人担心盗贼夜间会来。", "monet ut 为间接命令；quod 原因从句中又嵌入 timet nē 恐惧从句。", "elementary", "LLPSI IV/VII/XXII · 综合改写", ["间接命令", "恐惧从句"]],
  ["Tempestāte ortā, nautae, quamquam mare valdē movēbātur, nāvem ad portum dūcere cōnātī sunt.", "When a storm arose, the sailors, although the sea was very rough, tried to guide the ship to port. / 风暴一起，水手们尽管面对汹涌的大海，仍试图把船驶向港口。", "tempestāte ortā 为独立夺格；quamquam 让步；cōnātī sunt 是异相动词完成时。", "elementary", "LLPSI XVI/XXVIII · 综合改写", ["独立夺格", "异相动词"]],
  ["Caesar, ubi explorātōrēs cognōvit hostēs flūmen trānsīsse, pontem faciendum esse cēnsuit.", "When Caesar learned from the scouts that the enemy had crossed the river, he judged that a bridge had to be built. / 凯撒从侦察兵处得知敌军已经渡河，便认为必须架桥。", "hostēs trānsīsse 为先时宾格不定式；pontem faciendum esse 是带必要意义的间接陈述。", "elementary", "Wheelock 24/25 · 仿 Caesar", ["间接陈述", "被动迂说"]],
  ["Signō datō, mīlitēs tantō impetū cucurrērunt ut hostēs, quī locum tenēre temptābant, fugerent.", "When the signal had been given, the soldiers charged with such force that the enemy, who were trying to hold their position, fled. / 信号发出后，士兵们冲势极猛，以至于试图守住阵地的敌人逃走了。", "signō datō 先时独立夺格；tantō...ut 结果结构；quī 关系从句。", "elementary", "Wheelock 24/29 · 仿 Caesar", ["结果从句", "独立夺格"]],
  ["Dux mīlitibus imperāvit nē castra relinquerent priusquam novum signum datum esset.", "The commander ordered the soldiers not to leave camp before a new signal had been given. / 将领命令士兵在新信号发出前不得离营。", "imperāre + 与格 + nē 引间接禁止；priusquam + 愈过去被动虚拟式表示预期界限。", "elementary", "Wheelock 35 · 北大范围综合", ["间接禁止", "时间从句"]],
  ["Cornēlius Nepōs scrībit multōs ducēs clārōs nōn sōlum victōriīs sed etiam mōribus laudātōs esse.", "Cornelius Nepos writes that many famous commanders were praised not only for their victories but also for their character. / 科尔内利乌斯·尼波斯写道，许多著名将领不仅因战功，也因品格而受到赞扬。", "multōs ducēs...laudātōs esse 是完成被动间接陈述；nōn sōlum...sed etiam 对举。", "elementary", "仿 Cornelius Nepos", ["间接陈述", "传记"]],
  ["Cum discipulī numerōs difficilēs intellegere nōn possent, magister eōs rogāvit quot pedēs quisque versus habēret.", "Since the pupils could not understand the difficult numbers, the teacher asked them how many feet each verse had. / 学生们无法理解这些难题，老师便问他们每行诗各有多少音步。", "cum 原因背景；quot...habēret 是间接疑问。", "elementary", "LLPSI XVII/XXXIV · 综合改写", ["间接疑问", "诗歌术语"]],
  ["Senātōrēs, cum intellegerent quantum perīculum reī pūblicae imminēret, cōnsulem monuērunt nē quid neglegeret.", "Since the senators understood how great a danger threatened the state, they warned the consul not to neglect anything. / 元老们意识到国家面临多大危险，便警告执政官不要有任何疏忽。", "cum 原因从句；quantum...imminēret 间接疑问；nē quid 间接禁止，否定后用 quid。", "intermediate", "仿 Cicero", ["间接疑问", "间接禁止"]],
  ["Orātor respondit sē, sī sibi loquendī potestās daretur, facile demonstrātūrum esse cūr cōnsilium perniciosum esset.", "The orator replied that, if he were given an opportunity to speak, he would easily show why the plan was ruinous. / 演说家回答说，如果给他发言机会，他很容易说明该计划为何有害。", "sē...demonstrātūrum esse 为主干；sī 条件和 cūr 间接疑问都处于间接话语范围。", "intermediate", "仿 Cicero", ["间接话语", "条件句"]],
  ["Quamquam paucī restiterant, dux tamen, veritus nē fuga reliquōs terrēret, signum receptuī darī vetuit.", "Although only a few had stood their ground, the commander, fearing that flight would terrify the rest, forbade the signal for retreat to be given. / 尽管只有少数人仍坚守，将领担心溃逃会吓坏其余的人，因而禁止发出撤退信号。", "veritus 为异相分词；nē 恐惧从句；signum darī 是被动不定式补语。", "intermediate", "仿 Sallust", ["恐惧从句", "被动不定式"]],
  ["Nōn dubium erat quīn iūdicēs, testibus audītīs, intellegerent quantō scelere prōvincia oppressa esset.", "There was no doubt that the judges, after hearing the witnesses, understood by how great a crime the province had been oppressed. / 毫无疑问，法官听取证人证言后，明白该行省遭受了何等严重罪行的压迫。", "quīn 名词从句；testibus audītīs 独立夺格；quantō...esset 间接疑问。", "intermediate", "仿 In Verrem", ["quin", "法律语体"]],
  ["Catilīna, postquam ex urbe excessit, sociīs persuāsit ut arma caperent atque rem pūblicam, quam cōnsulēs servāre cōnābantur, oppugnārent.", "After Catiline left the city, he persuaded his allies to take up arms and attack the state which the consuls were trying to preserve. / 喀提林离城后，说服同党拿起武器，攻击执政官们力图保全的国家。", "persuāsit 的对象 sociīs 用与格；两个 ut 从句共用；quam 关系从句内含异相动词。", "intermediate", "仿 Sallust/Cicero", ["间接命令", "政治叙事"]],
  ["Dīcēbātur eōs quī rem pūblicam administrārent tam cupidōs glōriae factōs esse ut nihil omitterent.", "It was said that those who governed the state had become so eager for glory that they omitted nothing. / 据说，治理国家的人变得如此渴求荣耀，以至于无一事放过。", "最外层 dīcēbātur 标明传闻；关系从句被吸收到间接话语；tam...ut 结果。", "advanced", "进阶 · 仿史学体", ["信息来源", "嵌套从句"]],
  ["Etiamsī concedāmus cōnsulem, nisi tempestās impedīvisset, maturius ventūrum fuisse, quaerendum tamen est utrum eius adventus calamitatem āvertere potuerit.", "Even if we grant that the consul would have arrived earlier had the storm not prevented him, it must still be asked whether his arrival could have averted the disaster. / 即便承认若无风暴阻碍，执政官本会更早到达，仍须追问他的到来能否避免灾难。", "concedāmus 让步承认；ventūrum fuisse 过去反事实间接表达；quaerendum est 无人称必要；utrum 间接疑问。", "advanced", "进阶 · 长句综合", ["反事实", "被动迂说"]],
];

const translationQuestions: Question[] = translationSeeds.map((seed, index) => {
  const [latin, modelAnswer, explanation, level, source, tags] = seed;
  return { id: `tb-tra-${String(index + 1).padStart(3, "0")}`, level, category: "translation", type: "self-check", prompt: "先标出主句骨架和从句边界，再译成正确英文；可附中文帮助自检。", latin, modelAnswer, explanation, tags, source };
});

const officialMockQuestions: Question[] = [
  {
    id: "pku-mock-e-01", level: "elementary", category: "translation", type: "self-check",
    prompt: "北大初级制式模拟：限时完成整段英译。先划分句群，不要求逐字保留拉丁语词序。",
    latin: "Caesar, cum ex explōrātōribus cognōvisset hostēs ad alteram flūminis rīpam castra posuisse, legiōnēs ex hībernīs ēdūxit. Pons, quō exercitus priōre aestā ūsus erat, magnā tempestāte dēlētus erat; itaque fabris imperāvit ut eum quam celerrimē reficerent. Interim equitēs praemīsit quī itinera cognōscerent atque hostēs ab opere prohibērent. Illī, adventū Rōmānōrum nūntiātō, partem cōpiārum in silvīs occultāvērunt, partem ad vadum dēdūxērunt. Caesar veritus nē mīlitēs, quī longum iter fēcerant, subitō impetū terrērentur, prope flūmen cōnstitit ac castra mūnīrī iussit. Nocte autem lēgātī hostium vēnērunt; dīxērunt suōs pācem petere neque arma captūrōs esse, sī Rōmānī agrīs eōrum parcerent. Caesar respondit sē iniūriārum meminisse, sed veniam datūrum esse, modo obsidēs ante lūcem mitterentur. Lēgātīs dimissīs, centuriōnēs convocāvit et quid fierī vellet exposuit. Prīmā lūce pons perfectus est; signō datō, legiōnēs flūmen trānsiērunt, dum equitātus utramque rīpam tuerētur. Hostēs, cum neque pontem rumpere neque Rōmānōs trānsitū prohibēre possent, ad proximōs montēs sē recēpērunt. Caesar eōs statim persequī nōluit, quod frūmentum mīlitibus comparandum erat; sed explōrātōrēs mīsit quī cognōscerent quō hostēs iter facerent. Reliquō exercitū refectō, posterō diē cautius prōgredī atque loca superiora occupāre cōnstituit.",
    modelAnswer: "Caesar, after learning from scouts that the enemy had pitched camp on the far bank of the river, led the legions out of winter quarters. A bridge used the previous summer had been destroyed by a great storm, so he ordered the engineers to rebuild it as quickly as possible. Meanwhile he sent cavalry ahead to reconnoitre the routes and keep the enemy from the works. When the Roman approach was reported, the enemy hid some troops in the woods and led others to a ford. Fearing that soldiers tired by a long march might be frightened by a sudden attack, Caesar halted near the river and ordered a camp fortified. Envoys came at night, claiming that their people sought peace and would not take up arms if the Romans spared their fields. Caesar replied that he remembered their wrongs but would grant pardon, provided hostages were sent before dawn. After dismissing them, he summoned the centurions and explained his plan. At dawn the bridge was finished and the legions crossed while the cavalry guarded both banks. Since the enemy could neither break the bridge nor prevent the Roman crossing, they withdrew to the nearest mountains. Caesar did not pursue them at once because grain had to be procured for the soldiers; instead he sent scouts to discover where the enemy were marching.",
    explanation: "约 180 词。核心结构：cum + 愈过去虚拟式；quō 关系夺格；ut 间接命令；quī 关系目的；多个独立夺格；nē 恐惧从句；条件句；modo 限制；间接话语；dum 时间背景。",
    tags: ["北大制式", "约180词", "Caesar 语体", "英译"], source: "初级制式 · 仿 Caesar 原创",
  },
  {
    id: "pku-mock-e-02", level: "elementary", category: "translation", type: "self-check",
    prompt: "北大初级制式模拟：将传记体段落译成正确英文，注意评价语与事件先后。",
    latin: "Themistoclēs Athēniensis, etsī multōs inimīcōs habēbat, cīvitātī saepe maximō ūsuī fuit. Iuvenis erat ingeniō ācer et tantā memoriā ut omnia quae audīverat retinēret. Cum Persae Graeciam invāderent, cīvibus persuāsit nē pecūniam pūblicam statim dividerent, sed nāvēs aedificārent quibus patria dēfenderētur. Cōnsiliō probātō, classis paucīs annīs parāta est. Postquam Xerxēs cum ingentī exercitū vēnit, Themistoclēs sociōs monuit ut in angustō marī pugnam committerent, ubi multitūdō nāvium hostibus nocēre posset. Eō duce Graecī victoriam clāram reportāvērunt. Tamen, glōriā eius crescente, quīdam cīvēs veritī sunt nē nimiam potestātem acciperet. Crīminibus falsīs accūsātus, ex urbe discessit atque ad rēgem Persārum pervēnit. Ille virum, quī paulō ante Persās vīcerat, benignē recēpit. Themistoclēs autem, quamquam in terrā aliēnā habitābat, patriae semper meminit. Ferunt eum, cum iussus esset bellum contrā Graecōs parāre, mortem voluntāriam subīsse, quod neque novum dominum fallere neque suīs cīvibus arma īnferre vellet. Rēx, virtūte hospitis commōtus, corpus eius honōrificē sepeliendum cūrāvit. Athēniēnsēs post multōs annōs iniūriārum oblītī sunt atque virum, cui vīvō invidērant, mortuum laudāvērunt, quod salūtem Graeciae cōnsiliō suō servāvisset. Exemplum eius docet glōriam cīvium ingratitūdine minui posse, virtūtem autem nōn facile abolērī.",
    modelAnswer: "The Athenian Themistocles, although he had many enemies, was often of the greatest service to his state. As a young man he possessed a keen mind and such a memory that he retained everything he heard. When the Persians invaded Greece, he persuaded the citizens not to divide the public money immediately but to build ships with which their country might be defended. Once the plan was approved, a fleet was prepared within a few years. After Xerxes arrived with a huge army, Themistocles advised the allies to fight in narrow waters, where the enemy would be harmed by the size of their fleet. Under his leadership the Greeks won a famous victory. Yet as his fame grew, some citizens feared that he might gain excessive power. Accused on false charges, he left the city and reached the Persian king, who received the man who had recently defeated the Persians. Themistocles always remembered his homeland. It is said that, when ordered to prepare war against the Greeks, he chose death, since he wished neither to deceive his new master nor to take up arms against his fellow citizens. The king, moved by his guest's courage, arranged an honourable burial. Many years later the Athenians forgot their grievances and praised in death the man they had envied in life, because his strategy had preserved the safety of Greece.",
    explanation: "约 180 词。包含 etsī 让步、双重与格、tantā...ut、关系目的、独立夺格、恐惧、间接命令、无人称传闻与主观原因。",
    tags: ["北大制式", "约180词", "Nepos 语体", "英译"], source: "初级制式 · 仿 Cornelius Nepos 原创",
  },
  {
    id: "pku-mock-i-01", level: "intermediate", category: "translation", type: "self-check",
    prompt: "北大中级制式模拟：译成正确英文，并保留史家对人物动机的评价层级。",
    latin: "Eā tempestāte in urbe magna discordia erat. Nobilēs, quī honōrēs diū inter sē partītī erant, potestātem retinēre cupiēbant; plēbs autem, aere aliēnō oppressa, novās tabulās postulābat. Inter eōs Catilīna, vir nōbilī genere nātus sed animō pravō, iuventūtem facile alliciēbat. Corpus patiēns inediae, algōris, vigiliae suprā quam cuiquam crēdibile est; animus audāx, subdolus, varius, cuius reī lubet simulātor ac dissimulātor. Is, ubi cōnsulātum quem petīverat obtinēre nōn potuit, cum paucīs sociīs rem pūblicam armīs occupāre cōnstituit. Aliīs pecūniam, aliīs magistrātūs pollicēbātur; servīs lībertātem, egentibus praedam ostendēbat. Nōn deerant quī tantīs praemiīs moverentur. At quīdam ex coniūrātīs, veritus nē cōnsilia patefierent atque ipse poenās daret, rem cōnsulī aperuit. Tum senātus, quamquam nōndum satis cōnstābat quantus exercitus parārētur, dēcrēvit ut cōnsulēs vidērent nē quid rēs pūblica detrīmentī caperet. Catilīna, ubi hoc cognōvit, nocte ex urbe profectus est; sociīs tamen mandāvit ut incendia facerent cōnsulēsque interficerent. Cōnsul vigiliās per urbem disposuit atque bonōs cīvēs hortātus est nē falsīs rūmōribus terrērentur. Coniūrātī, cum omnia itinera praesidiīs tenerī intellegerent, aliī aliō fugērunt. Paucī, quōs pudor aut fidēs retinuit, ad Catilīnam pervēnērunt et cum eō in aciem prōfectī sunt.",
    modelAnswer: "At that time there was great discord in the city. The nobles, who had long divided offices among themselves, wished to retain power, while the commons, crushed by debt, demanded cancellation of debts. Among them Catiline, a man of noble birth but corrupt character, easily attracted the young. His body could endure hunger, cold, and sleeplessness beyond belief; his mind was bold, deceitful, and changeable, capable of pretending or concealing anything. When he failed to obtain the consulship he sought, he decided with a few associates to seize the state by force. He promised money to some and offices to others; he offered liberty to slaves and plunder to the needy. There were people moved by such rewards. But one conspirator, fearing that the plans might be revealed and that he himself would be punished, disclosed the matter to the consul. Then the senate, although it was not yet sufficiently established how large an army was being prepared, decreed that the consuls should ensure that the state suffered no harm. Catiline left the city by night but instructed his associates to start fires and kill the consuls. The consul posted guards throughout the city and urged loyal citizens not to be frightened by false rumours. When the conspirators understood that every route was held by guards, they scattered in different directions. A few, restrained by shame or loyalty, reached Catiline and marched with him into battle.",
    explanation: "约 180 词。Sallust 式名词短句、历史现在/不定式色彩、关系特征、主观原因、间接命令，以及 senātūs cōnsultum ultimum 公式。",
    tags: ["北大制式", "约180词", "Sallust 语体", "英译"], source: "中级制式 · 仿 Sallust 原创",
  },
  {
    id: "pku-mock-i-02", level: "intermediate", category: "translation", type: "self-check",
    prompt: "北大中级制式模拟：处理演说体周期句，区分演说者断言、指控与反问。",
    latin: "Quō ūsque tandem, iūdicēs, patieminī istum hominem, quī sociōs populī Rōmānī tam crūdēliter vexāverit, impūne glōriārī? Nōn agitur hodiē dē parvā iniūriā neque dē ūnīus agricolae fortūnīs. Tōta prōvincia queritur templa spoliāta, urbēs pecūniā exhaustās, cīvēs Rōmānōs sine iūdiciō verberātōs esse. Accūsātus respondet sē nihil nisi ex antīquā cōnsuētūdine fēcisse; quasi vērō cōnsuētūdō, sī mala sit, vim lēgis habēre possit. Testēs, quōrum fidem ille pecūniā corrumpere cōnātus est, dīcunt quantum aurī ab urbe quāque exāctum sit. Tabulae pūblicae docent nōn modo vectīgālia ablātā esse sed etiam pecūniam, quae mīlitibus danda fuerit, ad domum praetōris trānslātam. Quid plūra quaerimus? Etiamsī concedāmus quaedam ā ministrīs, dominō ignōrante, commissa esse, tamen necesse est eum reddere ratiōnem cūr, postquam tot querellae ad eum perlātae sunt, nēminem pūnīverit. Cavēte igitur nē, dum ūnī nocentī parcitis, spem iūstōrum sociīs adimātis et posterīs praetōribus licentiam peccandī dētis. Memineritis potestātem populi Rōmānī nōn metū tantum sed fidē sociōrum continērī. Sī hunc absolvētis, cēterae prōvinciae arbitrābuntur sē frūstrā auxilium senātūs implōrāre; sī condemnābitis, intellegent lēgēs Rōmānās etiam potentibus imperāre. In vestrā igitur sententiā salūs atque auctōritās imperiī posita est.",
    modelAnswer: "How long, judges, will you allow that man, who has so cruelly harassed the allies of the Roman people, to boast without punishment? Today the issue is not a slight wrong or the fortune of a single farmer. An entire province complains that temples were plundered, cities drained of money, and Roman citizens beaten without trial. The defendant replies that he did nothing except according to ancient custom—as though a custom, if bad, could have the force of law. Witnesses whose trust he tried to corrupt with money state how much gold was exacted from each city. Public records show not only that revenues were taken but also that money meant for the soldiers was transferred to the governor’s house. What more do we seek? Even if we grant that some acts were committed by servants without their master’s knowledge, he must still explain why, after so many complaints reached him, he punished no one. Beware, therefore, lest by sparing one guilty man you take hope from loyal allies and give future governors licence to do wrong. Remember that Roman power is sustained not only by fear but by the trust of the allies. If you acquit him, the other provinces will think they appeal in vain to the senate for help; if you condemn him, they will understand that Roman laws command even the powerful. The security and authority of the empire therefore rest in your verdict.",
    explanation: "约 180 词。含演说反问、虚拟式关系从句、三重被动间接陈述、quasi vērō、间接疑问、动形容词、让步承认、主观理由和 cavēte nē。",
    tags: ["北大制式", "约180词", "Cicero 语体", "英译"], source: "中级制式 · 仿 In Verrem 原创",
  },
];

export const completeQuestions: Question[] = [
  ...vocabQuestions,
  ...formQuestions,
  ...structureQuestions,
  ...translationQuestions,
  ...officialMockQuestions,
];

function validateCompleteBank(bank: Question[]) {
  const ids = new Set<string>();
  for (const question of bank) {
    if (ids.has(question.id)) throw new Error(`题库存在重复 ID：${question.id}`);
    ids.add(question.id);
    if (!question.prompt.trim() || !question.explanation.trim() || !question.source.trim()) {
      throw new Error(`题目缺少提示、解析或来源：${question.id}`);
    }
    if (question.type === "choice") {
      if (!question.options || question.options.length !== 4 || new Set(question.options).size !== 4) {
        throw new Error(`选择题必须有四个不同选项：${question.id}`);
      }
      if (question.answer === undefined || question.answer < 0 || question.answer >= question.options.length) {
        throw new Error(`选择题答案索引无效：${question.id}`);
      }
    } else if (!question.latin || !question.modelAnswer) {
      throw new Error(`翻译自评题缺少原文或参考译文：${question.id}`);
    }
  }
  return { valid: true as const, uniqueIds: ids.size };
}

export const completeBankValidation = validateCompleteBank(completeQuestions);

export const completeVocabItems = vocabSeeds.map(([lemma, gloss, , level, , family], index) => {
  const sameLevel = vocabSeeds.filter((item) => item[3] === level && item[1] !== gloss);
  return {
    lemma,
    gloss,
    distractors: [3, 11, 19].map((offset) => sameLevel[(index + offset) % sameLevel.length][1]),
    level,
    family,
  };
});

export const completeBankStats = {
  vocabularyEntries: vocabSeeds.length,
  vocabularyQuestions: vocabQuestions.length,
  morphologyQuestions: formQuestions.length,
  structureQuestions: structureQuestions.length,
  translationQuestions: translationQuestions.length,
  officialMockQuestions: officialMockQuestions.length,
  total: completeQuestions.length,
};
