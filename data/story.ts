export type StoryPace = "quick" | "standard" | "deep";
export type StorySupport = "immersive" | "guided";
export type StoryStage = "hook" | "explore" | "negotiate" | "act" | "notice" | "echo";

export type StoryChoice = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type StoryNode = {
  id: string;
  stage: StoryStage;
  place: string;
  title: string;
  body: string;
  targetText?: string;
  prompt?: string;
  guidedNote?: string;
  deepNote?: string;
  repairPrompt?: string;
  choices?: readonly StoryChoice[];
};

export const storyStageLabels: Record<StoryStage, string> = {
  hook: "进入情境",
  explore: "探索线索",
  negotiate: "协商意义",
  act: "作出判断",
  notice: "注意形式",
  echo: "延迟提取",
};

export const storyPaces: Record<StoryPace, { label: string; duration: string; description: string }> = {
  quick: { label: "快速复习", duration: "约 3 分钟", description: "保留核心判断与回声提取。" },
  standard: { label: "主线任务", duration: "8–12 分钟", description: "完成六阶段自然习得闭环。" },
  deep: { label: "文献深读", duration: "约 20 分钟", description: "加入词形、碑铭转写与版本说明。" },
};

export const xiangshanLatinStory = {
  id: "la-xiangshan-inscription-001",
  language: "la",
  level: "intermediate",
  title: "香山碑文与版本线索",
  subtitle: "五方言路 · 第一份共同委托",
  setting: "当代北京香山与一份民国时期拓片的数字副本",
  objectives: ["从屈折一致关系确认句子骨架", "把 neglecta 回溯到 neglegō", "将分析策略迁移到新句"],
  targetItems: ["neglegō", "signum", "quaerō"],
  contentReviewStatus: "draft",
  sourceStatus: "original-training",
  nodes: [
    {
      id: "hook",
      stage: "hook",
      place: "周六 09:10 · 香山步道",
      title: "一张来历不明的拓片",
      body: "你和孔令强、吴铃铃在徒步活动的集合点收到一张匿名拓片。纸边写着“请先判断文字，再追查年代”。孔令强怀疑它不是古代原件，而是旧社团留下的拉丁语谜面。",
      targetText: "VERBA NEGLECTA SIGNVM OSTENDVNT",
      guidedNote: "先不要逐词翻译。找出最像复数主语的词和复数谓语，建立一个可修正的整体猜测。",
      deepNote: "训练图像采用碑铭式大写，以 V 同时表示元音 u 和辅音 v；句子本身是 Pikku 原创训练材料，不冒充真实碑铭。",
    },
    {
      id: "explore",
      stage: "explore",
      place: "09:13 · 步道休息亭",
      title: "先用已知部分搭骨架",
      body: "吴铃铃把大写转写成普通拼写。你已经认出 verba 与英语 verbal 有关联，也看到 ostendunt 的复数词尾。",
      targetText: "Verba neglecta signum ostendunt.",
      prompt: "哪一个整体理解最符合词形线索？",
      guidedNote: "verba 是 verbum 的中性复数；ostendunt 是第三人称复数。先让两者成为主语和谓语。",
      deepNote: "中性复数主格和宾格同形；此处由复数谓语 ostendunt 判断 verba 作主语，signum 则是单数宾格。",
      repairPrompt: "若判断不稳，先只核对 verba—ostendunt 的数，再决定 signum 的句法位置。",
      choices: [
        { id: "a", label: "被忽略的话语显出一个标记。", correct: true, feedback: "成立：verba neglecta 是中性复数主语，signum 是宾语，ostendunt 是复数谓语。" },
        { id: "b", label: "一个被忽略的标记展示了话语。", correct: false, feedback: "这个理解把单复数关系倒置了：ostendunt 需要复数主语，signum 是单数。" },
        { id: "c", label: "话语命令那个标记不要忽视。", correct: false, feedback: "句中没有命令式；neglecta 是分词，不是“不要忽视”的命令。" },
      ],
    },
    {
      id: "negotiate",
      stage: "negotiate",
      place: "09:17 · 五方言路群聊",
      title: "把求助变成一个小问题",
      body: "崔路加在线回了一句：“别让我整句翻译；告诉我你需要核对哪一个连接。”你要选择最省力、又能保留自己推理的提问。",
      prompt: "你先向词典或同伴核对什么？",
      guidedNote: "有效协商不是直接索取答案，而是把不确定性缩成可验证的词形或搭配。",
      deepNote: "neglecta 来自 neglegō 的完成被动分词；中性复数主格形式与 verba 一致。英语 neglect 是方便的记忆桥，但不能替代拉丁语词形分析。",
      repairPrompt: "把问题改写成“这个形式来自哪个词、与哪个名词一致？”",
      choices: [
        { id: "a", label: "“neglecta 来自哪个词，又与哪个名词一致？”", correct: true, feedback: "这是可验证的局部问题：既能查词典，也保留了你对句子骨架的判断。" },
        { id: "b", label: "“请直接把整句译成中文。”", correct: false, feedback: "能得到答案，却绕过了最需要练习的词形连接；下一步仍可能认不出同类结构。" },
        { id: "c", label: "“英语 neglect 和它长得像，所以意思完全一样吗？”", correct: false, feedback: "同源联想可以助记，但“长得像”不能证明词形、句法和语义范围完全相同。" },
      ],
    },
    {
      id: "act",
      stage: "act",
      place: "09:22 · 拓片校对页",
      title: "在两个转写版本中下注",
      body: "数字化记录里出现两份转写。你必须选一个版本交给馆员继续检索；这个选择会决定后续搜索词。",
      prompt: "哪份转写同时保留了拓片字形和句法一致？",
      guidedNote: "逐组检查：verba—neglecta、verba—ostendunt，以及 signum 的数和格。",
      deepNote: "版本 A 只把碑铭式 V 规范化为普通拼写的 u；版本 B 还无依据地改变了 neglecta、signum 和谓语的数。",
      repairPrompt: "先标出每个版本唯一可能的复数主语，再看谓语是否与它配合。",
      choices: [
        { id: "a", label: "转写版本 A · Verba neglecta signum ostendunt.", correct: true, feedback: "校对通过：三处数的一致关系完整，也没有擅自改写原句。" },
        { id: "b", label: "转写版本 B · Verba neglectae signa ostendit.", correct: false, feedback: "B 同时破坏了 neglecta 与 verba 的中性复数一致，也让复数主语搭配了单数谓语。" },
      ],
    },
    {
      id: "notice",
      stage: "notice",
      place: "09:26 · 馆员回信",
      title: "把刚才有效的线索说清楚",
      body: "馆员确认这是一份二十世纪学生社团谜题的后期拓印，不是古代碑铭。安雅敏追问：你刚才真正依靠的是哪条语法线索？",
      targetText: "verba neglecta",
      prompt: "neglecta 在这里怎样工作？",
      guidedNote: "注意它没有自己承担句子的时态和人称；真正的限定动词是 ostendunt。",
      deepNote: "完成被动分词表达先于主句状态形成的结果：“已经被忽略的”。语境中也可自然译成汉语定语“被忽略的”。",
      repairPrompt: "试着把 neglecta 和它修饰的词一起框起来，再找句中有时态和人称的动词。",
      choices: [
        { id: "a", label: "它是完成被动分词，以中性复数主格与 verba 一致。", correct: true, feedback: "准确。你注意到的是形态一致，而不是只凭词序猜关系。" },
        { id: "b", label: "它是第三人称单数动词，负责全句时态。", correct: false, feedback: "限定动词是 ostendunt；neglecta 没有人称词尾，并与 verba 在性、数、格上一致。" },
        { id: "c", label: "它是副词，只说明 ostendunt 的方式。", correct: false, feedback: "副词不会与名词发生性、数、格一致；这里的 -a 正好与中性复数 verba 对应。" },
      ],
    },
    {
      id: "echo",
      stage: "echo",
      place: "当晚 20:40 · 回声复习",
      title: "换一句话，再取回同一策略",
      body: "Pikku 在晚间复习中只给出一条新线索，不重放白天的解释。你需要把同一套判断顺序迁移过去。",
      targetText: "Signa dīligenter quaesīta viam ostendunt.",
      prompt: "最稳妥的第一步是什么？",
      guidedNote: "先找有限动词 ostendunt，再用数的一致确认 signa；随后检查 quaesīta 与哪个名词一致。",
      deepNote: "quaesīta 是 quaerō 的完成被动分词中性复数；dīligenter 修饰 quaesīta 所表达的寻找过程。整句可译为“经仔细寻找的标记显示道路”。",
      repairPrompt: "不要从第一个词开始机械替换；先找有限动词和与之匹配的主语。",
      choices: [
        { id: "a", label: "先配对 signa—ostendunt，再检验 quaesīta 与 signa 的一致。", correct: true, feedback: "迁移成功：先搭主干，再确认分词一致，策略可以用于新的句子。" },
        { id: "b", label: "先把每个词各找一个中文意思，再按原顺序串起来。", correct: false, feedback: "逐词替换可能漏掉屈折关系；这句话最可靠的入口仍是谓语、主语和分词一致。" },
        { id: "c", label: "看到 -a 就一律判断为第一变格阴性单数。", correct: false, feedback: "-a 也可能是中性复数；signa、quaesīta 和复数谓语共同排除了阴性单数。" },
      ],
    },
  ] satisfies readonly StoryNode[],
} as const;

const quickNodeIds = new Set(["explore", "act", "notice", "echo"]);

export function storyNodesForPace(pace: StoryPace): readonly StoryNode[] {
  return pace === "quick" ? xiangshanLatinStory.nodes.filter((node) => quickNodeIds.has(node.id)) : xiangshanLatinStory.nodes;
}

export function storyScore(answers: Record<string, string>, nodes: readonly StoryNode[]) {
  const answeredNodes = nodes.filter((node) => node.choices?.length && answers[node.id]);
  return {
    correct: answeredNodes.filter((node) => node.choices?.some((choice) => choice.id === answers[node.id] && choice.correct)).length,
    total: nodes.filter((node) => node.choices?.length).length,
  };
}
