export type Level = "elementary" | "intermediate" | "mixed" | "advanced";
export type QuestionLevel = Exclude<Level, "mixed">;
export type Category = "morphology" | "syntax" | "sentencePattern" | "vocabulary" | "classics" | "translation";

export type Question = {
  id: string;
  level: QuestionLevel;
  category: Category;
  type: "choice" | "self-check";
  prompt: string;
  latin?: string;
  context?: string;
  options?: string[];
  answer?: number;
  modelAnswer?: string;
  explanation: string;
  tags: string[];
  source: string;
};

export const questions: Question[] = [
  {
    id: "e-mor-01", level: "elementary", category: "morphology", type: "choice",
    prompt: "识别 amaverant 的完整形态。", latin: "amāverant",
    options: ["直陈式、愈过去时、主动、第三人称复数", "虚拟式、未完成时、主动、第三人称复数", "直陈式、将来完成时、主动、第三人称复数", "直陈式、完成时、被动、第三人称复数"],
    answer: 0, explanation: "完成词干 amāv- + 愈过去时标记 -era- + 第三人称复数 -nt。它表示相对于另一个过去动作更早完成的动作。", tags: ["动词", "愈过去时"], source: "初级范围 · 动词形态"
  },
  {
    id: "e-mor-02", level: "elementary", category: "morphology", type: "choice",
    prompt: "下列哪一项是 hic, haec, hoc 的属格单数？", latin: "hic · haec · hoc",
    options: ["huius", "huic", "hunc", "hōrum"], answer: 0,
    explanation: "hic 的属格单数三性同形为 huius；与格单数为 huic。", tags: ["代词", "变格"], source: "初级范围 · 指示代词"
  },
  {
    id: "e-mor-03", level: "elementary", category: "morphology", type: "choice",
    prompt: "locūtus est 的语态与类别是什么？", latin: "locūtus est",
    options: ["主动意义的异相动词完成时", "被动意义的规则动词完成时", "半异相动词现在时", "主动意义的规则动词未完成时"], answer: 0,
    explanation: "loquor 是异相动词：形式采用被动系统，意义为主动。locūtus est 是完成时第三人称单数。", tags: ["异相动词", "完成时"], source: "初级范围 · 异相动词"
  },
  {
    id: "e-mor-04", level: "elementary", category: "morphology", type: "choice",
    prompt: "fortius 在此句中是什么形式？", latin: "Mīles fortius quam anteā pugnat.",
    options: ["副词比较级", "中性形容词比较级主格", "形容词最高级", "副词原级"], answer: 0,
    explanation: "fortius 修饰 pugnat，是 fortiter 的比较级副词：‘更勇敢地’。", tags: ["副词", "比较级"], source: "初级范围 · 副词比较"
  },
  {
    id: "e-syn-01", level: "elementary", category: "syntax", type: "choice",
    prompt: "划线结构在句中承担什么功能？", latin: "Hīs rēbus cognitīs, Caesar exercitum dūxit.", context: "目标结构：Hīs rēbus cognitīs",
    options: ["独立夺格", "间接陈述", "目的从句", "施事夺格"], answer: 0,
    explanation: "名词/代词与分词均为夺格，且在主句中没有直接句法位置，构成独立夺格：‘得知这些事情后’。", tags: ["独立夺格", "分词"], source: "仿 Caesar 句法"
  },
  {
    id: "e-syn-02", level: "elementary", category: "syntax", type: "choice",
    prompt: "ut 从句属于哪一种？", latin: "Tam fortiter pugnavērunt ut hostēs fugerent.",
    options: ["结果从句", "目的从句", "间接命令", "恐惧从句"], answer: 0,
    explanation: "主句的程度标志 tam 与 ut 呼应，说明实际产生的结果；否定时用 ut nōn。", tags: ["ut", "结果从句"], source: "初级范围 · 虚拟式从句"
  },
  {
    id: "e-syn-03", level: "elementary", category: "syntax", type: "choice",
    prompt: "选择最准确的句法分析。", latin: "Dux mīlitēs pontem facere iussit.",
    options: ["iubeō + 宾格 + 不定式", "间接陈述中的宾格不定式", "动名词目的结构", "被动迂说结构"], answer: 0,
    explanation: "iubeō 常以宾格表示被命令者，以不定式表示被命令的动作：‘将军命令士兵架桥’。", tags: ["不定式", "iubeo"], source: "初级范围 · 不定式结构"
  },
  {
    id: "e-syn-04", level: "elementary", category: "syntax", type: "choice",
    prompt: "ne 在此处应怎样理解？", latin: "Timēmus nē hostēs veniant.",
    options: ["恐怕……会……", "为了不……", "以至于不……", "除非……"], answer: 0,
    explanation: "恐惧动词后 ne 引出所害怕会发生的事情；ut 则可表示害怕某事不发生。", tags: ["恐惧从句", "ne"], source: "初级范围 · 恐惧从句"
  },
  {
    id: "e-voc-01", level: "elementary", category: "vocabulary", type: "choice",
    prompt: "在词典中查找 tulērunt，应回溯到哪个词头？", latin: "tulērunt",
    options: ["ferō", "tollō", "tulō", "lātus"], answer: 0,
    explanation: "ferō 的主要词形是 ferō, ferre, tulī, lātum；tulērunt 来自完成词干 tul-.", tags: ["词典形", "不规则动词"], source: "初级范围 · 词典回溯"
  },
  {
    id: "e-voc-02", level: "elementary", category: "vocabulary", type: "choice",
    prompt: "在军事叙事中，castra 通常表示什么？", latin: "Rōmānī castra posuērunt.",
    options: ["军营", "城堡", "武器", "军团"], answer: 0,
    explanation: "castra 是只用复数的中性名词（pluralia tantum），常见搭配 castra pōnere：扎营。", tags: ["军事词汇", "复数专用名词"], source: "Caesar 高频词汇"
  },
  {
    id: "e-tra-01", level: "elementary", category: "translation", type: "self-check",
    prompt: "先断句，再译成通顺英文或中文。", latin: "Caesar, quod hostēs appropinquāre intellēxit, legiōnēs ex castrīs ēdūxit atque aciem īnstrūxit.",
    modelAnswer: "凯撒了解到敌人正在逼近，便把军团带出营地并列成战阵。 / Caesar, because he understood that the enemy were approaching, led the legions out of camp and drew up the battle line.",
    explanation: "骨架是 Caesar … legiōnēs ēdūxit atque aciem īnstrūxit。quod 引原因从句；hostēs appropinquāre 是 intellēxit 支配的宾格不定式结构。", tags: ["分句", "间接陈述"], source: "仿 Caesar · 自拟训练句"
  },
  {
    id: "e-tra-02", level: "elementary", category: "translation", type: "self-check",
    prompt: "翻译并说明独立夺格表达的时间关系。", latin: "Signō datō, mīlitēs tantō impetū cucurrērunt ut hostēs locum tenēre nōn possent.",
    modelAnswer: "信号发出后，士兵们以如此猛烈的势头冲锋，以至于敌人无法守住阵地。 / When the signal had been given, the soldiers charged with such force that the enemy could not hold their position.",
    explanation: "Signō datō 是完成被动分词构成的独立夺格，动作先于主句；tantō … ut 构成程度—结果关联。", tags: ["独立夺格", "结果从句"], source: "仿 Caesar · 自拟训练句"
  },
  {
    id: "i-mor-01", level: "intermediate", category: "morphology", type: "choice",
    prompt: "hostīs 在古典散文中可能是哪一种变体？", latin: "hostīs",
    options: ["第三变格 i-词干宾格复数，等同 hostēs", "hostis 的属格单数", "第二变格与格复数", "希腊式宾格单数"], answer: 0,
    explanation: "中级范围包括第三变格阳/阴性 i-词干宾格复数 -īs 代替 -ēs 的变体。具体数格仍须结合句法判断。", tags: ["变体", "第三变格"], source: "中级范围 · 变体词形"
  },
  {
    id: "i-mor-02", level: "intermediate", category: "morphology", type: "choice",
    prompt: "dīxēre 最可能等同于哪个常见形式？", latin: "dīxēre",
    options: ["dīxērunt", "dīxerint", "dīcere", "dictū"], answer: 0,
    explanation: "完成时主动直陈式第三人称复数可用 -ēre 代替 -ērunt，是历史散文常见形式。", tags: ["完成时", "变体"], source: "中级范围 · -ēre"
  },
  {
    id: "i-mor-03", level: "intermediate", category: "morphology", type: "choice",
    prompt: "dictū 在 mīrābile dictū 中是什么形式？", latin: "mīrābile dictū",
    options: ["目的/关系夺格的 -ū 目的分词", "动名词夺格", "完成被动分词夺格", "第四变格名词夺格"], answer: 0,
    explanation: "dictū 是 supinum（目的分词）的 -ū 形式，常与形容词连用：‘说来奇妙’。", tags: ["supine", "-u"], source: "中级范围 · 目的分词"
  },
  {
    id: "i-syn-01", level: "intermediate", category: "syntax", type: "choice",
    prompt: "quin 从句在此处为什么成立？", latin: "Nōn dubium est quīn cīvitās in perīculō sit.",
    options: ["否定/疑问的怀疑表达后引出名词性从句", "引出比较从句", "代替目的从句的 nē", "引出直接引语"], answer: 0,
    explanation: "在 nōn dubium est 等否定怀疑结构后，quin 引出‘……是无疑的’具体内容，使用虚拟式。", tags: ["quin", "名词性从句"], source: "中级范围 · quin 从句"
  },
  {
    id: "i-syn-02", level: "intermediate", category: "syntax", type: "choice",
    prompt: "虚拟式在主句中的用法是什么？", latin: "Quid facerem? Omnēs mē relīquerant.",
    options: ["过去时间的审议虚拟式", "愿望虚拟式", "让步虚拟式", "潜能虚拟式"], answer: 0,
    explanation: "说话者回顾当时面临的选择：‘我能/该怎么办呢？’未完成时虚拟式表达过去的审议。", tags: ["审议虚拟式", "主句"], source: "中级范围 · 主句虚拟式"
  },
  {
    id: "i-syn-03", level: "intermediate", category: "syntax", type: "choice",
    prompt: "间接引语中 esset 的虚拟式应如何解释？", latin: "Dīxit sē, quamquam fessus esset, profectūrum esse.",
    options: ["从属虚拟式：从句被吸收到间接引语", "目的从句", "结果从句", "反事实条件句"], answer: 0,
    explanation: "直接话语中的让步从句进入 orātiō oblīqua（间接引语）后通常采用虚拟式；主干是 sē … profectūrum esse。", tags: ["间接引语", "从属虚拟式"], source: "中级范围 · oratio obliqua"
  },
  {
    id: "i-syn-04", level: "intermediate", category: "syntax", type: "choice",
    prompt: "被动形式 pugnātum est 应怎样分析？", latin: "Diū atque ācriter pugnātum est.",
    options: ["不及物动词的无人称被动", "中性主语的普通被动", "异相动词完成时", "被动迂说"], answer: 0,
    explanation: "不及物动词没有可提升为主语的宾语，因此第三人称单数中性形式构成无人称被动：‘战斗持续了很久且十分激烈’。", tags: ["无人称被动", "不及物动词"], source: "中级范围 · 被动结构"
  },
  {
    id: "i-syn-05", level: "intermediate", category: "syntax", type: "choice",
    prompt: "dum 从句表达什么条件？", latin: "Oderint, dum metuant.",
    options: ["限制/但求：只要他们害怕", "同时：当他们害怕时", "持续：直到他们害怕", "原因：因为他们害怕"], answer: 0,
    explanation: "dum + 虚拟式可表达 proviso（限制条件）：‘让他们恨吧，只要他们害怕。’", tags: ["dum", "限制从句"], source: "中级范围 · proviso"
  },
  {
    id: "i-voc-01", level: "intermediate", category: "vocabulary", type: "choice",
    prompt: "在 Cicero 的政治演说中，res pūblica 最合适的译法通常是？", latin: "rēs pūblica",
    options: ["国家／共和国／公共事务（依语境选择）", "公共财产", "军事命令", "公民大会"], answer: 0,
    explanation: "它的语义范围比固定译成‘共和国’更宽。翻译时应根据制度、共同体或公共事务的语境选词。", tags: ["政治词汇", "语境"], source: "Cicero 高频词汇"
  },
  {
    id: "i-voc-02", level: "intermediate", category: "vocabulary", type: "choice",
    prompt: "Sallust 笔下 cupīdō 常偏向什么含义？", latin: "cupīdō dominandī",
    options: ["支配欲／权力欲", "谨慎", "命运", "公民义务"], answer: 0,
    explanation: "cupīdō + 属格表示对某事的欲望；dominātus/ dominandī 语境中常涉及权力和支配。", tags: ["抽象名词", "属格"], source: "Sallust 高频词汇"
  },
  {
    id: "i-tra-01", level: "intermediate", category: "translation", type: "self-check",
    prompt: "保持长句层级，先找主干，再翻译。", latin: "Senātōrēs, cum intellegerent quantum perīculum reī pūblicae imminēret, cōnsulem monuērunt nē quid dē salūte cīvium neglegeret.",
    modelAnswer: "元老们意识到国家面临多大的危险，便告诫执政官不要疏忽任何关乎公民安全之事。 / Since the senators understood how great a danger threatened the state, they warned the consul not to neglect anything concerning the safety of the citizens.",
    explanation: "主干：Senātōrēs cōnsulem monuērunt。cum 为原因/情境从句；quantum … imminēret 是 intellegerent 支配的间接疑问；nē … neglegeret 是间接禁止。", tags: ["间接疑问", "间接命令"], source: "仿 Cicero · 自拟训练句"
  },
  {
    id: "i-tra-02", level: "intermediate", category: "translation", type: "self-check",
    prompt: "翻译并标出间接引语的边界。", latin: "Orātor respondit sē, sī sibi loquendī potestās daretur, facile demonstrātūrum esse cūr haec cōnsilia perniciosa essent.",
    modelAnswer: "演说家回答说，如果给他发言的机会，他很容易证明这些计划为何有害。 / The orator replied that, if he were given an opportunity to speak, he would easily demonstrate why these plans were ruinous.",
    explanation: "respondit 后从 sē 到 essent 均属间接引语；sē … demonstrātūrum esse 是主干，sī … daretur 是条件从句，cūr … essent 是间接疑问。", tags: ["间接引语", "条件句"], source: "仿 Cicero · 自拟训练句"
  },
  {
    id: "i-tra-03", level: "intermediate", category: "translation", type: "self-check",
    prompt: "译出历史叙事中的转折和因果关系。", latin: "Quamquam paucī restiterant, dux tamen, veritus nē fuga reliquōs quoque terrēret, signum receptuī darī vetuit.",
    modelAnswer: "尽管只有少数人仍在抵抗，将领却担心溃逃也会吓坏其余的人，因而禁止发出撤退信号。 / Although only a few had held their ground, the commander, fearing that the flight would also terrify the rest, forbade the signal for retreat to be given.",
    explanation: "主干：dux … vetuit。quamquam 表让步；veritus 是异相动词 vereor 的完成分词；nē 引恐惧从句；signum … darī 是 vetuit 的被动不定式补语。", tags: ["异相分词", "恐惧从句"], source: "仿 Sallust · 自拟训练句"
  },
  {
    id: "a-mor-01", level: "advanced", category: "morphology", type: "choice",
    prompt: "faxō 在古典散文与戏剧性表达中应怎样回溯？", latin: "faxō ut sciās",
    options: ["faciō 的古式将来完成形，语用上近于‘我一定会使……’", "faciō 的现在虚拟式", "fāri 的将来不定式", "facessō 的命令式"], answer: 0,
    explanation: "faxō 源自 faciō 的古式 sigmatic future/future perfect，用于有力承诺或保证。它超出北大中级清单的最低要求，适合作为文本校勘与古式识别训练。", tags: ["古式词形", "语体"], source: "进阶 · 古式形态"
  },
  {
    id: "a-mor-02", level: "advanced", category: "morphology", type: "choice",
    prompt: "fore ut + 虚拟式最适合在何种情况下替代将来不定式？", latin: "Spērō fore ut intellegat.",
    options: ["动词缺乏方便的将来不定式或需表达非人称/被动意义时", "所有现在间接陈述中", "只有反事实条件句中", "只在诗歌格律要求下"], answer: 0,
    explanation: "fore ut + 虚拟式可作为迂说的未来间接陈述，尤其适合没有自然将来不定式的表达。", tags: ["迂说", "间接陈述"], source: "进阶 · 迂说结构"
  },
  {
    id: "a-syn-01", level: "advanced", category: "syntax", type: "choice",
    prompt: "此处 quod 从句的语气为何采用虚拟式？", latin: "Socrates accūsātus est quod iuventūtem corrumperet.",
    options: ["表示转述的指控理由，作者不为其真实性背书", "因为 quod 总要求虚拟式", "构成目的从句", "受到历史不定式吸引"], answer: 0,
    explanation: "因果 quod/quia/quoniam 使用虚拟式时，常把理由呈现为他人主张、主观理由或未获作者认可的说法。", tags: ["主观原因", "语用"], source: "进阶 · 语气选择"
  },
  {
    id: "a-syn-02", level: "advanced", category: "syntax", type: "choice",
    prompt: "下列长句中 quae 的先行词最可能是什么？", latin: "Lēgēs, quās maiorēs nōbīs trādidērunt, quae cīvitātem diū servāverant, contemnēbantur.",
    options: ["lēgēs；第二个关系从句与第一个关系从句并列修饰它", "maiōrēs", "nōbīs", "cīvitātem"], answer: 0,
    explanation: "quae 是阴性复数主格，与 lēgēs 一致；嵌入的 quās…trādidērunt 结束后，句法重新接回同一先行词。", tags: ["长距离一致", "关系从句"], source: "进阶 · 长句消歧"
  },
  {
    id: "a-tra-01", level: "advanced", category: "translation", type: "self-check",
    prompt: "限时 8 分钟：保留信息来源层级，避免把转述写成作者断言。", latin: "Dīcēbātur enim eōs, quī rem pūblicam administrārent, tam cupidōs glōriae factōs esse ut nihil, quod ad suam dignitātem augendam pertinēret, omitterent.",
    modelAnswer: "据说，那些治理国家的人变得如此渴求荣耀，以至于凡是有助于提高自身地位之事，他们无一放过。 / For it was said that those who governed the state had become so eager for glory that they omitted nothing which contributed to increasing their own standing.",
    explanation: "最外层 dīcēbātur 标记传闻；eōs … factōs esse 是无人称被动后的宾格不定式；quī…administrārent 因处于间接话语范围而用虚拟式；tam…ut 为结果结构。", tags: ["信息来源", "嵌套从句"], source: "进阶 · 仿演说体自拟"
  },
  {
    id: "a-tra-02", level: "advanced", category: "translation", type: "self-check",
    prompt: "限时 10 分钟：拆解多层条件、让步与间接疑问。", latin: "Etiamsī concedāmus cōnsulem, nisi tempestās impedīvisset, maturius ventūrum fuisse, quaerendum tamen est utrum eius adventus tantam calamitatem āvertere potuerit.",
    modelAnswer: "即便我们承认：若非风暴阻挠，执政官本会更早抵达；仍须追问，他的到来是否真能避免如此巨大的灾难。 / Even if we grant that the consul would have arrived earlier had the storm not prevented him, it must still be asked whether his arrival could have averted so great a disaster.",
    explanation: "concedāmus 为让步/假设承认；cōnsulem…ventūrum fuisse 是过去反事实的间接表达；nisi…impedīvisset 为内嵌条件；quaerendum est 是无人称被动迂说；utrum 引间接疑问。", tags: ["反事实", "被动迂说"], source: "进阶 · 长句自拟"
  },
  {
    id: "e-pat-01", level: "elementary", category: "sentencePattern", type: "choice",
    prompt: "哪一组词最直接标记‘如此……以至于……’的结果句式？", latin: "Tanta erat tempestās ut nāvēs portum petere nōn possent.",
    options: ["tanta … ut", "erat … possent", "nāvēs … portum", "ut … nōn"], answer: 0,
    explanation: "程度词 tantus 与 ut + 虚拟式呼应，后句陈述实际结果；结果从句的否定是 ut nōn。", tags: ["结果句式", "关联词"], source: "Wheelock 29 · 北大初级"
  },
  {
    id: "e-cla-01", level: "elementary", category: "classics", type: "choice",
    prompt: "在 Caesar 式军事叙事中，句子的叙事主干是哪一项？", latin: "Explōrātōribus missīs, Caesar, priusquam hostēs advenīrent, castra mūnīvit.",
    options: ["Caesar castra mūnīvit", "explōrātōribus missīs", "priusquam hostēs advenīrent", "hostēs castra mūnīvērunt"], answer: 0,
    explanation: "先摘出主格主语 Caesar 与限定动词 mūnīvit；独立夺格和时间从句随后分层处理。", tags: ["Caesar", "叙事主干"], source: "仿 Caesar · 北大初级"
  },
  {
    id: "i-pat-01", level: "intermediate", category: "sentencePattern", type: "choice",
    prompt: "选择最准确的结构骨架。", latin: "Nōn dubitō quīn, sī adsīs, cīvitās servārī possit.",
    options: ["nōn dubitō + quīn 从句，内嵌条件从句", "目的从句内嵌结果从句", "间接命令内嵌让步从句", "宾格不定式内嵌关系从句"], answer: 0,
    explanation: "否定的怀疑表达后用 quīn + 虚拟式；sī adsīs 是嵌入其中的开放条件。", tags: ["quin", "嵌套结构"], source: "北大中级 · 句式专题"
  },
  {
    id: "i-cla-01", level: "intermediate", category: "classics", type: "choice",
    prompt: "这句话最值得保留的 Sallust 式语义对照是什么？", latin: "Aliī glōriae, aliī avāritiae serviēbant.",
    options: ["有人追逐荣耀，有人受贪欲驱使", "所有人都拒绝荣耀与财富", "荣耀服务于贪欲", "士兵分别服侍两位主人"], answer: 0,
    explanation: "aliī … aliī 构成分组对举；servīre + 与格。Sallust 常以抽象道德词压缩人物动机。", tags: ["Sallust", "对举"], source: "仿 Sallust · 北大中级"
  },
  {
    id: "a-pat-01", level: "advanced", category: "sentencePattern", type: "choice",
    prompt: "此句最外层的信息来源标记是什么？", latin: "Ferunt eum, quae pollicitus sit, factūrum esse.",
    options: ["ferunt：‘人们说／据说’", "quae：作者断言", "sit：目的语气", "factūrum：命令"], answer: 0,
    explanation: "先保留 ferunt 的传闻框架，再处理 eum … factūrum esse；关系从句被吸收到间接话语范围。", tags: ["信息来源", "间接话语"], source: "进阶 · 语篇层级"
  },
  {
    id: "a-cla-01", level: "advanced", category: "classics", type: "choice",
    prompt: "在诗句 arma virumque canō 中，-que 的作用是什么？", latin: "Arma virumque canō.",
    options: ["后附连词，连接 arma 与 virum", "疑问后缀", "夺格标记", "格律填充而无句法作用"], answer: 0,
    explanation: "-que 后附于第二个并列项，等于 arma et virum。进阶阅读还会观察词序、格律与开篇主题。", tags: ["诗歌", "后附连词"], source: "Vergilius · Aeneis 1.1"
  }
];

export const categoryLabels: Record<Category, string> = {
  morphology: "形态识别",
  syntax: "句法结构",
  sentencePattern: "句式专题",
  vocabulary: "词典回溯",
  classics: "古典阅读",
  translation: "分句翻译",
};

export const levelLabels: Record<Level, string> = {
  elementary: "初级",
  intermediate: "中级",
  mixed: "混合难度",
  advanced: "进阶",
};

export function matchesLevel(question: Question, level: Level) {
  if (level === "mixed") return question.level === "elementary" || question.level === "intermediate";
  return question.level === level;
}
