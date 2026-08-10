# 哔丘 Pikku 项目长期记忆

更新日期：2026-08-09
仓库：`Etymodes/PKUni_Latinex`  
正式域名：`https://pikku.qzz.io/`

## 0. 使用规则

每次处理 Pikku 前：

1. 阅读本文件、`docs/Pikku_MasterPlan_v2.md` 和最近 5 条 Git 提交。
2. 以较新的对话、代码和部署状态覆盖旧记录。
3. 每次形成新决策、修复缺陷、完成部署或改变任务状态后，同步更新本文件。
4. 本文件只记录长期有效信息和当前状态，不保存密码、SMTP 密钥、OAuth Secret、私钥、API Token，亦不保存 Cloudflare／D1／R2／Supabase 的具体后台标识；这些信息统一写作“见对应后台”。
5. 涉及实现时使用 Ponytail 原则：选择能工作的最小方案，避免无必要的依赖、抽象、迁移和重写。
6. 每个里程碑标记完成前，检查固定 Google Drive 补丁目录，与 GitHub `main`、开放 PR、当前分支和总任务书对照；新内容可排期，已实现内容不得重复，矛盾或旧版指令必须先告知并询问用户。
7. 每次内容型开发里程碑开始前检查固定 Google Drive 素材库的新文件和更新；先登记语言、材料类型、版本／来源、版权状态与拟用途，再决定只作内部参考、可公开引用、可改编或需要用户决定，不能因文件已上传就自动导入题库或公开部署。

本文件是仓库内的项目记忆协议，不是平台自动记忆钩子。执行者需要主动读取、维护并提交它。

## 1. 项目定位与品牌

- 产品名：**哔丘 Pikku**。
- 历史名：**比丘拟 / PKUni_Latinex**，继续作为拉丁语模式和项目沿革保留。
- 项目已从“北京大学拉丁语水平考试模拟器”转型为多语言学习、复习、测试和考试模拟平台。
- 第一版语言：拉丁语、日语、西班牙语；共用同一账号和网站外壳。
- 下一代界面必须支持中文／English 自主切换；界面语言不能与当前学习语言混用。
- 学习语言入口将改为可搜索、可扩展的下拉框；古希腊语加入诚实标注为“规划中”的位置，首期不假装已有完整课程。
- 古希腊语首发方向已确认：一个 `grc` 入口，以古典为主、阿提卡为形态与散文骨架，同时纳入 Homeric、Ionic、Aeolic、Doric 等古典文学方言，作者像拉丁语一样按时代组织。
- 第一个跨语言联合学习试验确定为拉丁语—西班牙语；界面方向确定为“学习台＋可关闭探索地图”。
- 叙事采用两层固定角色：四位当代用户圈朋友＋每种学习语言一男一女的双引导角色。角色设定基线为 `docs/Pikku_Character_Bible_v1.md`。
- 仓库暂不改名，继续使用 `Etymodes/PKUni_Latinex`。
- 吉祥物：哔丘 Pikku，一只稍微拟人化的卡通丘鹬；经典动作是张开一边翅膀做类似人类比大拇指的动作，表情近似微笑，同时保留丘鹬长喙结构。
- Logo 主色由多到少为浅蓝、深蓝、白，可融合 Pikku 文字。

## 2. 基础设施

- 正式域名：`https://pikku.qzz.io/`，已可通过 HTTPS 正常访问。
- Cloudflare Worker：`pkuni-latinex.kimdac.workers.dev`，正式域名已绑定生产环境。
- Cloudflare Account ID：见 Cloudflare 后台。
- D1 数据库名称、Database ID：见 Cloudflare D1 后台。
- R2 Bucket 名称与区域：见 Cloudflare R2 后台。
- FreeDomain 域名：`pikku.qzz.io`；nameserver 见 Cloudflare DNS 后台。
- Supabase 项目标识与 URL：见 Supabase 后台。公开客户端配置按应用需要保留在前端；任何私密密钥不得写入本文件或 Git。
- 身份验证：邮箱＋密码、邮箱确认、GitHub OAuth 管理员登录。
- 邮件：Brevo 发件人已验证，Supabase SMTP 已配置并验证跳转成功。
- 微信扫码登录已决定暂缓，不属于当前阶段。
- 继续沿用现有 Worker、D1、R2、Supabase 和域名，不因多语言转型重建基础设施。

## 3. 技术与架构

- Next.js 16、React 19、TypeScript。
- Cloudflare Workers 负责生产部署和 API；Supabase Auth 负责身份。
- 学习进度采取本地优先、登录后云端同步。
- 当前页面仍以 `app/page.tsx` 为主；短期不拆微服务、不引入全局状态库、不引入图数据库、不更换框架。
- 自适应背词沿用现有页面、D1 词汇统计和账号偏好，不引入模型服务或第三方记忆算法依赖。
- 首版透明权重：未见词保持探索权重；错误率高的词提高权重；熟词降低但不永久移除；最近四张词卡暂时降权。
- 背词等级采用累积覆盖：拉丁语进阶包含初级至进阶，混合包含初级＋中级；日语从 N4 向 N1 累积；西班牙语从 A1 向 C2 累积。高等级不能排除应已掌握的低等级词。
- 多语言采用共享网站外壳＋语言配置＋各语言独立题库/资源/等级。
- 核心语言类型：`"la" | "ja" | "es"`。
- 上述核心类型只代表当前已运行的学习语言。下一代模型分离 `uiLocale`、`targetLanguage` 和 `courseTrack`；内部 `contentLocale` 直接跟随 `uiLocale`。首期不设独立“解释语言”，避免界面语言、学习语言与考试／教材轨道互相污染。
- 古希腊语使用 `grc`，与现代希腊语 `el` 分开；首发采用“古典中心、阿提卡骨架、古典文学方言专题、作者时代轴”，Koine、晚期古代与拜占庭材料作为后续筛选，不与首期主线混级。
- 跨语言联合学习使用关系表／知识图谱表达共同继承、借词、仿译、规律音变、同源异义、同形异源、假朋友和文字共享；短期不引入图数据库，也不把外形相似自动判为同源。
- 旧题目没有 `language` 字段时必须按拉丁语 `la` 处理，保证向后兼容。
- 新题建议字段：`language`、`level`、`skills`、`source`、`sourceStatus`。

## 4. 等级体系

- 拉丁语：初级、中级、混合难度、进阶；以北京大学拉丁语水平考试考纲为核心标准。
- 日语：N4、N3、N2、N1。
- 西班牙语：A1、A2、B1、B2、C1、C2。
- 古希腊语（规划中）：不套用 CEFR；五个学习域为文字与声音、阿提卡形态、古典句法、古典方言与体裁、原典研读。
- 语言切换后，等级、题库、资源、词典、考试和统计必须切换到相应语言域；账号保持不变。

## 5. 已有功能与修复

- 拉丁语题库、随机组卷、有序选题、错题、收藏、词汇量测试/统计、今日目标、正确率和每日词源栏目。
- 注册、登录、退出、切换账号和 GitHub 管理员登录。
- 管理后台已有基础改题能力。
- 资源中心已加入教材、作者、辞典、学者和社区基础视图。
- 登录弹窗在矮屏和页面中的定位问题已修复。
- 邮箱确认与 Brevo SMTP 已实测成功。
- 退出后显示本地进度、重新登录恢复错题已实测；收藏同步曾出现问题，后续代码已加入合并逻辑，仍需持续回归。
- 首页随机词源曾因 SSR/客户端随机值不同产生 hydration 错误。固定方案：初值使用 `0`，挂载后在 `useEffect` 中随机化。
- 本地纯 Next 开发模式出现 `/api/me`、`/api/questions`、`/api/auth-config` 404 属预期，因为 Worker API 未加载；认证与同步应在 Cloudflare Preview/正式站检查。
- P3.1 分支已加入三语自适应背词：56 张分级种子词卡、无限连续轮次、“记得／忘了”反馈、纯单词与单词＋短语境两种显示模式、游客本机记录及账号同步。
- Augusta Firefox 已确认邮箱账号登录、账号记录恢复与背词历史显示正常；背词页会明确显示当前累计词库范围。
- 进入背词页后的首张词卡也必须在客户端挂载后按账号统计加权选择；SSR 初始渲染仍保持确定，不能为首张随机化重新引入 hydration mismatch。
- P3.1 Worker 会在首次 API 请求时检查旧 `user_preferences` 表是否缺少 `vocab_mode`，缺少则安全补列并记录 `vocabulary-trainer-v1`；这样 Branch Preview 不依赖预先手工执行远端迁移，正式迁移文件仍保留。
- “无限”指训练轮次不设每日上限，不表示首版已有无限个不同词目；词库后续持续扩充。
- 词灵 Cling 公开页面宣称无限背词、个性化推词和造句，但未找到公开源码或足以复现的算法说明。Pikku 只学习可观察的产品逻辑，使用自己的透明权重，不声称复制其强化学习或“最优”算法。
- 多语言资源页必须以显式 `targetLanguage` 和词条 `language` 为边界；日语／西班牙语模式不得借用拉丁语教材、作者、辞典来源、真题档案或社区频道。尚未建设的数据应显示本语言的诚实空状态。
- 切换学习语言时保留当前兼容模块，并在当前页面会话内记住各语言最近等级；第一次切换按等级序列中的相对位置映射。拉丁语专属的随机组卷／词汇量测量／真题档案切到其他语言时分别回落到训练或资源页，不能一律跳回首页和最低等级。

## 6. Git 当前基线

- GitHub 远端 `main` 当前精确基线：`f177f1d`；其中 PR #17 的功能合并提交为 `bef79564`。该基线已包含资源中心 PR #9、拉丁语内容 PR #11、多语言外壳 PR #12、种子题库 PR #13、每周复核练习 PR #15、账号同步 PR #14、自适应背词 PR #16 与内容复核底座 PR #17。
- P3 开发分支：`agent/pikku-p3-account-sync`，从 `main@9d6cff3` 创建，已通过 PR #14 合入 `main`。
- 初版任务书提交：`6b73289 docs: define Pikku multilingual roadmap`。
- `docs/Pikku_MasterPlan_v2.md` 是多语言转型的总任务书。
- PR #12：`feat: establish Pikku multilingual foundation` 已于 2026-08-01 合并到 `main`，合并提交为 `5cda856`。Cloudflare Workers Preview、云浏览器冒烟测试、Augusta 批量检查和 Firefox 最终复验均已通过；PR #11 的 Livy 新题、词典语言筛选和周度统计也已一并保留。
- PR #13：`feat: add Pikku multilingual seed practice` 已于 2026-08-01 合并到 `main`，合并提交为 `00a03ae`。
- PR #14：`feat: sync multilingual account records` 已于 2026-08-04 合入 `main`，合并提交为 `5a378cf`；Cloudflare Workers Preview 与 Augusta Firefox 账号同步验收均已通过。
- P3.1 分支：`agent/pikku-vocab-trainer`，合并前已吸收 `main@5a378cf`，包含 PR #15 与已合并的 PR #14。
- PR #16：`feat: add adaptive vocabulary training` 已于 2026-08-04 获得当前阶段明确授权并合入 `main`，合并后基线为 `79a9742`。稳定 Preview、Augusta 8/8、Firefox 累计词库范围、本地合流回归与线上资源哈希复核均已通过。
- PR #15：`feat: add 2026-08-02 weekly review practice set` 已合并到远端 `main`，合并提交 `47b25094`；P3.1 已通过 `main@5a378cf` 吸收该提交，题目 ID 与词条重复检查通过。
- PR #17：`feat: add P3.2 content review foundation` 已在用户明确授权后于 2026-08-08 合入 `main`，合并提交为 `bef79564`。稳定 Preview、Cloudflare 冒烟、Augusta 8/8、20/20 自动测试、原定 Firefox 项目、云端 Chrome 定向复验，以及 Augusta Firefox 的资源隔离／切换连续性最终确认均已通过。
- P3.3 分支：`agent/pikku-p3-3-story-prototype`，从 `main@f177f1d` 创建；只承载第一条自然习得剧情静态原型、测试和对应文档，不新增后端、数据库表或游戏引擎。
- PR #18：`feat: add first Pikku story lesson`，核心功能提交为 `88fa846`，后续提交只更新 memo／任务书状态；当前是可自动合并的 Draft。Cloudflare 稳定 Preview、云端 Chrome 冒烟和 Augusta 8/8 批量检查均已通过；只剩 Augusta Firefox 最终交互验收。在 Firefox 通过并取得明确授权前不得合并。
- 不直接在 `main` 开发；功能分支必须通过 Preview、Augusta 批量检查和 Firefox 复验后才可合并。

## 7. 当前阶段与最小路线

P0 基线整理已完成。P1 多语言外壳已完成并通过 Augusta/Firefox 验收：

1. 已加入拉丁语、日语、西班牙语选择器，并在本机持久化当前语言和等级。
2. 已将拉丁语四级、日语 N4–N1、西班牙语 A1–C2 配置数据化。
3. 旧题无 `language` 字段时继续按拉丁语处理，原拉丁语题库和功能保持可用。
4. 日语、西班牙语已显示正确等级和 P2 占位入口，P1 不同时大量造题。
5. 题库、顶部统计、错题和收藏按语言过滤；更新当前语言收藏时保留其他语言记录。
6. 侧栏支持新增语言/等级并可滚动，避免矮屏或西班牙语六级入口溢出。
7. 本地重建工作副本和 Augusta 均已通过 `tsc --noEmit` 与 Next.js 16.2.10 生产构建。
8. 2026-07-31 Augusta Firefox 浏览器验收通过，未出现 hydration mismatch；P1 可以收口。

P1 代码提交：

- `4e94c84 feat: define Pikku language levels`
- `2090abe feat: tag questions by language`
- `b623e9f style: add multilingual shell`
- `370dd6b feat: add Pikku language switcher`

当前及后续阶段：

- P2：已完成。日语 N4–N1、西班牙语 A1–C2 各有原创种子题，并接通有序／随机练习、即时解析、错题、收藏和统一搜索。
- P3：已完成。账号同步实现、Augusta Firefox 验收与 PR #14 合并均已完成。
- P3.1：已完成。三语自适应背词、两种显示模式及账号偏好同步可用；首批 56 张词卡按所选等级累积覆盖低等级词库。
- P3.2：已完成并通过 PR #17 合入 `main@bef79564`。范围包括独立审核状态、内容批次／状态筛选、现有 62 个候选词条的 48+14 分批标记、六道明确保持 `draft` 的候选错因题、五项教材／资源章节元数据映射、内容复核测试、资源语言隔离，以及保留模块／相近等级的切换；自动检查、云端 Chrome 与 Augusta Firefox 均已通过。
- P3.3：功能实现与自动／Preview 验证完成，等待 Augusta Firefox 最终交互验收。首个拉丁语原型为“香山碑文与版本线索”，采用 70% 当代北京／30% 文献支线、中性第二人称、`Hook → Explore → Negotiate → Act → Notice → Echo` 六阶段；提供 8–12 分钟主线、3 分钟回声复习、20 分钟深读及“更多讲解／更沉浸”手动切换。当前 M0 只在本次章节内计分，不写入账号统计。
- P4：多语言管理员题库管理。
- P5：资源、词典、知识图谱。
- P6：带审核能力的社区。
- 下一代多语言规划闸门：P3／P3.1 收口后，按已经确认的中英双语底座、语言下拉框、古典中心古希腊语、拉丁语—西班牙语联学和“学习台＋探索地图”排期；正式说明语言直接跟随界面语言。

### 自然习得与剧情玩法基线

- 研究报告：`docs/Pikku_Natural_Acquisition_Gameplay_Research_v1.md`。
- Pikku 不把“自然习得”简化为只看输入或完全不讲语法；首版证据链采用“可理解且有意义的输入 → 为完成任务而互动 → 必要输出 → 注意到形式 → 间隔提取”。
- 单章最小循环为 `Hook → Explore → Negotiate → Act → Notice → Echo`，优先做剧情阅读、语言侦探、文献修复、跨文化调解和受约束对话，不先引入大型游戏引擎。
- 剧情方向暂定 70% 当代北京、30% 历史／文献支线；用户用中性第二人称；常规章 8–12 分钟，附 3 分钟复习和可选 20 分钟深读。
- 首个 M0 静态原型只验证内容结构、选择反馈和提取闭环；账号级理解、求助、重读、选择与延迟回忆事件留到 M1，再用这些可解释信号调节输入难度。不能以连胜、点击率或“沉浸感”替代真实学习成效。

## 8. 内容规划

### 拉丁语

- 继续以北大考纲划分词汇、形态、句法、句式、翻译、阅读、古典文化和综合题。
- 已上传/参考过的材料包括 Wheelock 第 7 版及中文版 OCR、Ørberg《Familia Romana》。
- 待对齐教材包括：Learn to Read Latin、Reading Latin、Moreland & Fleischer、Cambridge Latin Course、Oxford Latin Course、Latin for the New Millennium、《拉丁语综合教程 1》《拉丁语基础教程》《简明拉丁语教程》《拉丁语语法》《拉丁语自学读本》等。
- 只基于公开事实和教材知识点编写原创/改编题，不复制受版权保护教材的大段正文、习题或答案。
- 未来文本范围包括古典作者、武加大圣经、牛顿、莱布尼茨、林奈及现代拉丁语歌词、游戏文本、影视对白等。

### 日语与西班牙语

- 日语按 N4–N1，西班牙语按 CEFR A1–C2。
- 两种语言先建立最小种子题库、等级筛选、答题、错题、收藏和统计闭环，再扩充内容。
- 所有新增题必须标注来源状态和技能标签，避免把不确定的网络材料当作真题。
- 日语随机语言知识保留“日汉同形异义”专类；首批核验词为“勉強／勉强、汽車／汽车、新聞／新闻”。
- 西班牙语随机语言知识至少分为“拉丁语词源、同源异义、同形异源”三类；首批核验项为 `filius → hijo`、`clavis → llave`、`exitus → éxito / exit`、名词 `vino` 与动词形式 `vino`。
- 随机知识条目使用统一数据结构，必须保存类型、简短解释、例子和可点击来源；初始索引固定为 `0`，只在挂载后随机，防止 hydration mismatch。

### 古希腊语与跨语言联学（规划中）

- 古希腊语入口使用 `grc`；首发以阿提卡形态／散文为骨架，并在同一古典主线内标注 Homeric、Ionic、Aeolic、Doric 等文学方言。Koine、晚期古代和拜占庭材料按时代／课程筛选，不混成一个等级体系。
- 古希腊语作者种子图按迈锡尼、古风、古典、希腊化、罗马帝国、晚期古代和拜占庭延伸排列；古典时代是首发核心。Linear B 等匿名语料不能伪称为可识别作者。
- 未来联学候选包括罗曼—拉丁、日耳曼、闪米特、突厥、南岛、班图语言群，以及汉语变体—日韩越汉字词。
- 各模式不能共用一套“相似词”玩法：分别处理规律音变、词根词型、黏着形态、名词类别、历史音层、借词层和假朋友。
- 首个联学试验为拉丁语—西班牙语；先处理共同继承、借词、规律音变、同源异义和同形异源。
- 产品研究报告：`docs/Pikku_Global_Language_Learning_Research_v1.md`。界面采用“学习台＋可关闭探索地图”；词源侦探和文献修复是首批候选任务。

### 固定角色与世界观（规划中）

- 四位用户圈朋友处于同一当代北京世界，并与用户在一次香山公开徒步活动中相识；五人群聊名为 **“五方言路 · Five Voices, One Trail”**，同时指“五方／言路”“五／方言／路”和共同走过的香山山路。切换中英文界面不会替换或删除角色。
- 中文界面优先由孔令强、吴铃铃引导；英文界面优先由 Luke Thomas Trexler／崔路加、Yasmin Soraya Ansari／安雅敏引导。
- 孔令强：27 岁徐州人，在京做导游并准备北大历史学相关硕士考试；“令字辈／孔子后代”只作为家族叙述，不对外声称已认证。
- 吴铃铃：24 岁厦门人，厦大软件工程背景，在北京心理学＋互联网企业做前端／数据产品工程；不是心理咨询师。
- Luke／崔路加：28 岁，来自 Lehigh Valley 的 Whitehall Township；Lehigh Business 金融背景，费城工作一年后到北京从事跨境金融风险数据工作；家庭有天主教背景，性格外冷内热、偶尔追求刺激。
- Yasmin／安雅敏：26 岁，Santa Barbara 出生，印度穆斯林母亲与第二代伊朗裔美国人父亲的女儿；UW 社会学毕业，在印度做两年研究工作后到北大攻读亚洲国际关系相关博士。
- 每种学习语言固定一男一女两名当代引导角色；两人来自相距较远的语言使用地区，经历转折后来北京生活、工作或求学，并与用户或“五方言路”部分成员产生具体交集。古典语言角色来自保有教会、古典教育、手稿或礼仪语言环境的现代地区，不使用穿越古人或“血统天赋”。
- 首批语言引导角色：拉丁语 Matteo Bellandi／Elżbieta “Ela” Nowak；日语相馬直樹／白石澪；西班牙语 Tomás Aranda／Valeria Cárdenas；古希腊语 Nikólaos “Níkos” Deligiánnis／Eleni Mavrogeni。姓名、出生地与视觉锚点目前为 v1.1 候选 canon，等待用户最终锁定。
- 不设强制恋爱，不预设用户性别、国籍、母语或取向；角色可犯错，但事实解析必须链接审核内容。

## 9. 辞典、作者与知识图谱

- 拉丁语辞典计划对齐 Lewis & Short、Oxford Latin Dictionary、DMLBS、Gaffiot、Wiktionary，并记录收录状态。
- 词目格式需兼顾释义、词形、搭配、语境、印欧词源和跨语言关联；题目解析、错题和收藏可跳转词典。
- 古典作者按年代、体裁、作品和文本关联；未来逐步补充原文、翻译与解析版本。
- 可引用的汉语/日语/英语研究者与译者包括：大西英文、國原吉之助、雷立柏 Leopold Leeb、李永毅、王焕生、田中秀央、小林標、高橋宏幸、逸身喜一郎、刘津瑜 Jinyu Liu、谢大任、吕健忠、黄瑞成、近山金次、李奭学、杨周翰、麦凯雷 Michele Ferrero、肖原、吴金瑞、夏其龙。
- 引用学者观点时记录明确出处、版本和页码；不能把概括伪装成原话。
- 每日随机词源/语言知识目标为至少 365 条。

## 10. 社区规划

- 预留两个模块：目标语言限定频道；网站设计、功能优化和学习心得频道。
- 多语言后，目标语言频道应按语言隔离。
- 在举报、审核、封禁、速率限制和管理日志完成前，不开放无审核公共发帖。

## 11. Augusta 本地开发

- 系统：Windows；用户目录 `C:\Users\kimda`。
- 仓库：`C:\Users\kimda\Documents\PKUni_Latinex`。
- Firefox：153。
- Node：v24.18.0；npm/npx：11.16.0。
- PowerShell 执行策略会阻止 `npm.ps1`/`npx.ps1`，统一使用 `npm.cmd`、`npx.cmd`。
- 下载目录是 `D:\Downloads`，不是 `$HOME\Downloads`。
- 桌面已有 `C:\Users\kimda\Desktop\Pikku开发检查.cmd`，用于启动纯 Next.js 本地开发服务器并打开 Firefox；它只用于界面检查，不用于登录和云端同步验收。账号功能必须打开当前 Cloudflare Branch Preview 或正式域名。
- Windows 上 `npm.cmd run build:cloudflare` 会因 POSIX 环境变量语法失败。使用：

```powershell
$env:NEXT_PUBLIC_AUTH_MODE="supabase"; & ".\node_modules\.bin\next.cmd" build; Remove-Item Env:NEXT_PUBLIC_AUTH_MODE -ErrorAction SilentlyContinue
```

- Next 开发/构建可能修改 `next-env.d.ts`；若只有生成差异，使用 `git restore -- next-env.d.ts`。
- 检查顺序：`npm.cmd ci`（依赖变化时）、`npm.cmd run lint`、上述生产构建、Firefox 浏览器测试、`git diff --check`、`git status -sb`。
- P3 起，`scripts/Test-Pikku.ps1` 也会运行 Worker Node 单元测试；批量报告由原 7 项增加为 8 项。
- 不使用 `npm audit fix --force`，除非先审查变更影响。

## 12. 协作和发布约定

- 用户偏好一次只执行一条可复制命令，命令需考虑 Windows PowerShell。
- 验证任务应尽量一次批量执行多项检查；单项报错只记录，不应阻止其余检查继续运行。
- 批量验证的控制台输出、错误和最终汇总统一保存到 `D:\Downloads` 下带时间戳的 TXT 报告。
- 先分支、再本地/浏览器测试、再推送、再 PR、检查通过后合并。
- 不直接把未经验证的大改推入 `main`。
- 大提交前提醒用户在 Augusta 的 Firefox 测试；普通网页功能不要求 macOS 测试。
- 聊天附件下载不可靠时，把脚本直接提交到功能分支，用户通过 `git pull --ff-only` 获取。
- `.bundle` 或其他聊天附件出现“无法获取上传状态”时，不重复等待或让用户反复下载；先确认本地提交与远端分支，再优先直接推送可信 GitHub 目标并用 Draft PR 交接。临时工作区可能被平台维护清理，这不等于用户删除；从 GitHub `main` 重建，并只重做远端不存在的工作。
- 所有公开部署继续保留原仓库链接和项目沿革。

### Google Drive 里程碑补丁审查

- 固定补丁目录：`https://drive.google.com/drive/folders/1Tvqxgai5V_c5k1AuIWpNjloDgxh2ngaW?usp=sharing`。
- 每个里程碑标记完成前必须列出目录内容，读取上次审查后新增或更新的补丁书，并与 GitHub `main`、开放 PR、当前分支、总任务书及本文件对照。
- 每条补丁分类为 `接受并排期／已实现／被新版取代／冲突／需要用户决定`。接受项进入总任务；已实现项不重复；冲突、过期基线、重复 ID、旧 PR 指令或优先级变化必须向用户说明并询问，不能静默覆盖。
- 每次审查在本文件记录日期、文件名、Drive 修改时间、GitHub 对照结果和处理结论。

2026-08-04 首次审查：目录内只有 [`Pikku_WeeklyPatch_2026-08-04.md`](https://drive.google.com/file/d/1A8b5EGDMoqRfgkijXvX30Ne-tEfHXlgu/view?usp=drivesdk)，Drive 修改时间为 `2026-08-04T04:59:26.124Z`。GitHub 对照确认 PR #15 已合并为 `47b25094`，PR #14 仍为可合并的开放 Draft。补丁书与当前远端状态没有矛盾，但当前 `agent/pikku-vocab-trainer` 叠加线未包含 PR #15，因此：

- 接受并排期：独立 `reviewStatus`、题目／词条批次筛选、62 个“待核”词条复核、`ja-n1-003`、`ja-n1-004`、`i-mor-04`、`i-syn-08`、`es-a2-002`、`es-b1-003` 六道候选错因题，以及教材章节元数据映射。
- 已实现且不得重复：PR #15 已加入的 `ja-n1-002`、`i-syn-07`、`es-b1-002`、最近 14 个词条和最新批次统计。
- 处理结论：不在当前 P3.1 叠加分支实现；P3／P3.1 收口后从最新 `main` 创建 P3.2 独立分支，并在实现前再次检查 ID、语义与数据重复。

2026-08-04 P3.1 Preview 验收前复查：目录仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，修改时间仍为 `2026-08-04T04:59:26.124Z`，没有新增或更新补丁。PR #14 与 PR #16 均为可自动合并的开放 Draft；原分类和 P3.2 排期继续有效，无冲突或需要用户决定的新条目。

2026-08-04 P3.1 浏览器验收后复查：目录仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，修改时间仍为 `2026-08-04T04:59:26.124Z`，没有新增或更新补丁。PR #14 已 Ready for review，PR #16 仍为可自动合并的 Draft；原 P3.2 分类继续有效。下一步必须先取得用户对 PR #14 的明确合并授权，再把 PR #16 重叠到包含 PR #15 的最新 `main`。

2026-08-04 PR #14 合并与 P3.1 合流后复查：目录仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，修改时间仍为 `2026-08-04T04:59:26.124Z`，没有新增或更新补丁。PR #14 已合并为 `5a378cf`；PR #16 已吸收最新 `main`、改以 `main` 为 base 并转为 Ready for review。原 P3.2 分类继续有效，无冲突或需要用户决定的新条目。

2026-08-06 P3.2 恢复后复查：目录仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，文件 ID `1A8b5EGDMoqRfgkijXvX30Ne-tEfHXlgu`，修改时间仍为 `2026-08-04T04:59:26.124Z`。补丁与 `main@79a9742`、当前 P3.2 分支和任务书无新增矛盾；六道候选题保持 `draft`，62 个现有候选词条按源码实际数量标记为 48+14，不重复导入。

2026-08-06 P3.2 Firefox 反馈：48+14 词条批次、六道草稿／错因题、五项章节映射和三语言基础切换均已通过，不再重复要求验收。遗留问题是日语／西班牙语资源页混入拉丁语内容，以及切换语言时总跳首页／最低等级导致割裂。根因分别为资源组件计算了语言筛选却仍渲染全量数组、社区与档案未按语言分支，以及 `selectLanguage` 强制重置视图和默认等级。修复采用显式资源语言标记、当前语言过滤、非拉丁语诚实空状态、语言化社区，以及保留兼容视图和会话内等级记忆；新增自动测试防止再次直接渲染全量教材／映射。

2026-08-06 P3.2 定向修复自动验证：20/20 Node 测试、TypeScript、Next/Sites、Cloudflare／Pages 构建、Wrangler dry-run 与 Git 格式检查通过；未新增依赖。下一次 Firefox 只复验资源隔离和切换连续性，不重复此前已通过项目。

2026-08-08 P3.2 定向修复云端交互复验：在稳定 Preview 使用云端 Chrome 实际操作通过。日语资源页只显示日语诚实空状态、31 个日语词条和 3 条日汉知识；西班牙语资源页只显示本语言诚实空状态、10 个西班牙语词条和 4 条西语词源知识；两者均未出现拉丁语教材、作者、词典、档案或社区频道。社区、资源、训练模块在跨语言切换时保持；首次从日语 N2 切到西班牙语映射为 B2，返回日语恢复 N2，西班牙语改为 C1 后往返仍恢复 C1。未发现 Pikku 应用错误，只有云浏览器扩展自身的 metadata 日志。该结果不冒充 Augusta Firefox 验收。

2026-08-08 P3.2 定向复验后 Drive 复查：固定目录仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，文件 ID 和修改时间仍为 `1A8b5EGDMoqRfgkijXvX30Ne-tEfHXlgu`、`2026-08-04T04:59:26.124Z`；没有新增或更新补丁，与 PR #17、`main@79a9742` 和总任务书无新冲突。随后用户确认 Augusta Firefox 的资源隔离与切换连续性两项最终验收均通过，P3.2 已达到合并前完成定义。

### Google Drive 构建素材库

- 固定素材目录：`https://drive.google.com/drive/folders/1dsNcxq1mfArmTjZggCpBeRguRLsgXP2Y?usp=sharing`，Drive 标题为“Pikku素材库”。
- 用途：保存构建 Pikku 时可参考的教材、原典／文本、辞典、词表、知识卡、合法音频／图像及其来源说明；与“每周补丁任务书”目录严格分开。
- 内容型里程碑开始前列出新增／更新文件，并登记目标语言、材料类型、作者／版本、来源、版权／许可、可公开范围、审核状态和拟关联模块。
- 上传只代表可供项目审查，不代表已获公开发布、全文镜像或自动改编许可。商业教材与现代注释原则上只作内部知识点映射；公版、授权或原创材料经复核后才可进入公开站。
- 2026-08-10 首次登记：Google Drive 插件确认文件夹可访问，创建时间为 `2026-08-10T06:51:23.965Z`，当前为空；未移动、重命名或创建任何子项。

## 13. Augusta 交互与故障防复发手册

### 命令执行习惯

- Codex 正在执行上传、提交或连接器写入时，发送新消息或点击停止可能产生 `turn_aborted`，只取消尚未完成的当前动作；此前已经成功的远端写入不会自动回滚。等待本轮最终输出再追加非紧急消息；若意外中断，发送“继续刚才未完成的操作，从中断处继续，不重复已完成步骤”。恢复时必须先核对本地状态和远端对象，再只补做缺失动作。

- Augusta 的默认 PowerShell 起点常是 `C:\Users\kimda`；执行 Git 命令前先进入 `C:\Users\kimda\Documents\PKUni_Latinex`，否则会出现 `fatal: not a git repository`。
- 桌面 `进入Pikku仓库.cmd` 用于直接在正确目录打开 PowerShell；桌面 `Pikku开发检查.cmd` 用于启动本地开发检查。
- 用户偏好一条可复制命令完成一批相关操作。检查应跑完全部项目后再汇总，不因第一项失败中止。
- 聊天附件可能无法下载；开发脚本应提交到当前 Git 分支，再由 Augusta 使用 `git pull --ff-only` 获取。
- 云端 Sites 恢复出的生命周期工作副本可能落后于 GitHub；任何编辑前先把 GitHub `main` 同步为唯一基线。`.openai/hosting.json` 若只有 Sites 工具造成的键顺序变化，应恢复而不是纳入功能提交。
- 当前 Next.js 的 `next dev` 不接受 Sites/Vite 的 `--host`、`--strictPort` 参数；不要为了内部预览额外引入 Vite。功能分支用 Cloudflare Preview，最终用 Augusta Firefox 验收。
- Sites checkpoint 只能操作其自己的 `main` 时，不为得到 checkpoint 而改名、合并或污染 GitHub 功能分支。
- 在 shell 中设置构建环境变量时必须与命令处于同一 shell 调用；不要把临时环境变量留给后续不相关命令。
- 内容数量以源码和自动测试为准。P3.2 的 62 个现有词条实际拆分为 48+14；不能从补丁描述反推成 49+13。

### Windows PowerShell 与 Node

- Augusta 实测为 Windows PowerShell `5.1.26100.8875`（Desktop Edition），不是 PowerShell 7。
- 系统执行策略会阻止 `npm.ps1`、`npx.ps1` 和直接运行未授权 `.ps1`：
  - npm/npx 使用 `npm.cmd`、`npx.cmd`。
  - 仓库脚本使用 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\脚本.ps1"`。
- GitHub 写入的 UTF-8 脚本与 Windows PowerShell 5.1 可能发生解析/编码兼容问题。面向 Augusta 的基础设施脚本保持 ASCII 语法和输出标签，避免无必要的复杂嵌套结构。
- 首版 `Test-Pikku.ps1` 在含中文字符串和嵌套 `try/finally` 时出现 `MissingCatchOrFinally`；改为 ASCII、顺序执行和显式结果收集后已正常运行。
- `Start-Transcript` 在 Windows PowerShell 5.1 中不能可靠捕获 Git、Node、npm、Next.js 等原生命令直接写入控制台的内容。必须将原生命令 `2>&1` 管道到 `Write-Host`（或显式写入报告），不能只依赖 Transcript。
- 原生命令进入 PowerShell 5.1 管道后，Next.js 的 `✓`、`○` 和树形符号曾显示为 `鈻?`、`鉁?` 等乱码；这是控制台输出解码问题，不是构建失败。验证脚本应在运行期间把 `[Console]::OutputEncoding` 和 `$OutputEncoding` 设为无 BOM UTF-8，并在结束时恢复。

### 构建与 Git 工作区

- `package.json` 的 `build:cloudflare` 使用 POSIX 环境变量前缀，在 Windows 会报 `NEXT_PUBLIC_AUTH_MODE 不是内部或外部命令`。Windows 上先设置 `$env:NEXT_PUBLIC_AUTH_MODE="supabase"`，再运行 `next.cmd build`，最后删除/恢复环境变量。
- Next.js 开发或构建可能自动修改 `next-env.d.ts`。若确认只有生成性差异，使用 `git restore -- next-env.d.ts`；不要把它误当成功能代码提交。
- Augusta 的 Windows 安全中心可能阻止 Miniflare 附带的未签名 `workerd.exe`，Node 会报 `spawn UNKNOWN`。Pikku 的迁移回归已改用 Node 24 内置内存 SQLite 在同一进程执行真实 SQL；不要为通过测试而关闭安全中心或手工放行未知程序。
- `npm ci` 曾报告高危依赖和待批准安装脚本。不要直接运行 `npm audit fix --force`；先确认依赖升级对 Next.js、Cloudflare 和构建链的影响。
- 批量验证报告固定写入 `D:\Downloads\Pikku_Check_时间戳.txt`。
- 云端 scratch 工作区可能被平台维护清理；若本地克隆消失，应从 GitHub 的最新功能分支重新克隆／恢复，不推断为用户删除，也不从旧输出手工重建代码。
- GitHub 连接器可能把完整 `Pikku_MEMORY.md` 的认证／基础设施历史说明判定为公开仓库持久化风险。遇到拦截时不得换通道绕过；应先确认文件不含密钥或具体后台标识，向用户说明公开范围并取得明确知情授权，再从远端最新分支重建工作区、只补交缺失的 memo 更新。
- 云端执行 npm 辅助命令若因 `/root/.npm` 不可写失败，显式使用 `npm --cache /tmp/npm-cache ...`。
- 云端 Wrangler 若因 `/root/.config` 不可写而报日志目录错误，使用 `XDG_CONFIG_HOME=/tmp/wrangler-config HOME=/tmp/wrangler-home`；这是工具日志路径权限，不是 Worker 或 D1 故障。
- 云端 scratch 直接运行 `next dev` 可能因 `uv_interface_addresses` 失败；显式使用 `next dev --hostname 127.0.0.1` 可正常启动。该限制不适用于 Augusta。
- 当前 Miniflare D1 测试中的 `db.exec()` 可能把多行建表 SQL 按行拆开并报 `incomplete input`；测试夹具使用 `db.batch([db.prepare(...)])`，与 Worker 的实际执行方式一致。该错误不是迁移 SQL 本身失败。
- 云端安全策略会拒绝含 `rm -f` 的整条命令，即使目标只是旧交接包；生成 bundle、报告等构建产物时使用带日期／版本的新文件名，不先执行强制删除。
- 云端工作副本可能只配置某一条远端分支的窄 `remote.origin.fetch`。此时 `git fetch origin <branch>` 只更新 `FETCH_HEAD`，随后合并 `origin/<branch>` 会报 `not something we can merge`；先 `git merge --ff-only FETCH_HEAD`，再把该分支 refspec 加入 `remote.origin.fetch` 并设置 upstream。
- 云端直接调用 `npx wrangler deploy --dry-run` 可能触发网络审批而被取消；仓库已有依赖时改用 `node node_modules/wrangler/bin/wrangler.js deploy --dry-run`，并关闭 Wrangler 指标上报，不把审批层拦截误判为构建失败。

### 浏览器、React 与本地 API

- 首页随机词源若在 SSR 初始渲染中调用 `Math.random()`，服务端和客户端文本不同，会触发 hydration mismatch。正确做法是确定性初值 `0`，挂载后的 `useEffect` 再随机化。
- 本地 `next dev` 下 `/api/me`、`/api/questions`、`/api/auth-config` 返回 404，是因为 Cloudflare Worker API 未加载；不要误判为生产 API 消失。登录、同步和 Worker API 要在 Preview 或正式站验证。
- 云浏览器会拦截开发容器的 `127.0.0.1` loopback，因此不能用云浏览器替代 Augusta Firefox 检查未部署分支；先完成静态／构建验证，推送 Preview 后再做云浏览器与 Augusta 双重验收。
- 登录窗口曾因定位在顶栏容器内而只能覆盖顶栏，矮屏时也会越界。模态框必须相对视口显示、内容区域可滚动，并在打开时锁定页面背景滚动。

### 账号、同步与部署

- 邮箱确认、Brevo SMTP、GitHub OAuth 管理员登录已经实测成功。
- 错题进度已能恢复；收藏曾出现未同步，虽然加入了合并逻辑，仍属于每次认证/数据模型改动后的固定回归项。
- Cloudflare nameserver、Custom Domain 和 Universal SSL 变更存在传播等待时间；域名从 HTTP 可用到 HTTPS 正常曾经历等待。传播期间先检查状态，不重复删除重配。
- Cloudflare Preview 用于合并前浏览器验证；生产域名保持 `https://pikku.qzz.io/`。
- 2026-08-01 本地登录“处理中”排查到 Supabase 免费项目因低活跃自动暂停，状态为 `INACTIVE`，不是前端登录代码死循环。恢复过程经历 `COMING_UP`／`RESTORING`，最终为 `ACTIVE_HEALTHY`。
- 恢复前数据库仍有 2 个认证账号；恢复后伪造密码登录正常返回 `Invalid login credentials`，说明 Auth 服务已响应且旧账号未丢失。
- 登录再次卡住时先查 Supabase 项目状态和 Auth 请求／日志，再改代码；不要设置伪造流量“保活”。单看原始 health URL 可能误导，项目状态与真实 Auth 请求更可靠。

### 当前验证基线

- 2026-07-31 02:38，Augusta 上的 `Test-Pikku.ps1` 首次完整运行成功，约 13 秒。
- 结果：Repository、Node/npm、Dependencies、TypeScript、Cloudflare production build、Git formatting、Final worktree 共 7 项全部通过。
- 该结果证明 PowerShell 5.1 兼容版脚本可运行；由于 Transcript 未收齐原生命令明细，脚本随后增加显式日志管道，下一次报告需确认完整构建输出已进入 TXT。
- 2026-07-31 08:21 第二次完整运行再次 7/7 通过，原生命令、TypeScript 和 Next.js 构建明细均已写入报告，最终 Git 工作区干净。实测版本：Node `24.18.0`、npm `11.16.0`、Next.js `16.2.10`。
- 2026-07-31 08:46 第三次 Augusta 批量验证 7/7 通过，报告中的 Next.js Unicode 符号正常，最终工作区干净；随后 Firefox 浏览器验收通过，P1 多语言外壳正式完成。
- 2026-08-04 17:18，Augusta 报告 `Pikku_Check_20260804_171816.txt` 为 7/8：TypeScript、生产构建、格式与工作区均通过，账号 Firefox 验收成功；唯一失败是 Windows 安全中心阻止 Miniflare 启动 `workerd.exe`，导致迁移测试 `spawn UNKNOWN`，不是网站或迁移逻辑失败。
- 2026-08-04，改用 Node 24 内置内存 SQLite 后，Augusta 完整批量检查 8/8 通过；Firefox 已确认日语 N2 显示 N4–N2、西班牙语 C2 显示 A1–C2，P3.1 功能验收通过。
- 2026-08-04，PR #16 吸收 `main@5a378cf` 后，15/15 Node 测试、TypeScript、Next.js 16.2.10 生产构建、Wrangler 4.110.0 dry-run、Git 格式与题目 ID 重复检查全部通过。稳定 Preview 的应用脚本 SHA-256 与本地构建完全一致，首页及 `/api/me`、`/api/questions`、`/api/auth-config` 均返回 200。
- 2026-08-06，P3.2 恢复分支通过 18/18 Node 测试、TypeScript、Next/Sites 生产构建、Cloudflare Supabase 构建、GitHub Pages 构建、Wrangler 4.110.0 dry-run 与 Git 格式检查。最初的 Supabase／Wrangler 缺模块来自 Sites 工作副本只有旧精简依赖，按锁文件执行 `npm ci` 后全部通过，并非项目代码回归。
- 2026-08-06 23:32，Augusta 报告 `Pikku_Check_20260806_233222.txt` 显示 PR #17 分支 Repository、Node/npm、Dependencies、TypeScript、18/18 Worker tests、Cloudflare production build、Git formatting、Final worktree 共 8/8 通过；工作区干净。该报告不包含 Firefox 视觉／交互结论。
- 2026-08-09，P3.3 分支在云端已通过 26/26 Node 测试、TypeScript、Next/Sites、GitHub Pages、Cloudflare 生产构建、Wrangler 4.110.0 dry-run 与 Git 格式检查；Cloudflare 随后确认 PR #18 的 `6018558` 部署成功。尚待 Augusta 的统一 8 项报告和 Firefox 交互验收。
- 2026-08-09，PR #18 稳定 Preview 的云端 Chrome 冒烟通过：首页和训练页均可进入剧情；主线六阶段可前后退；错选显示错因与修复提示；“更多讲解／更沉浸”切换有效；快速路线为 4 节点；深读显示文献注；完成页可进入资源库；剧情中切换日语／西班牙语会回落到对应语言训练且不残留拉丁语剧情。1363px 视口无横向溢出，未发现 Pikku 应用错误，仅有云浏览器扩展自身 metadata 日志。Augusta Firefox 仍是最终浏览器验收。
- 2026-08-10 14:57，Augusta 报告 `Pikku_Check_20260810_145713.txt` 显示 `agent/pikku-p3-3-story-prototype@9005c71` 的 Repository、Node/npm、Dependencies、TypeScript、26/26 Worker tests、Cloudflare production build、Git formatting、Final worktree 共 8/8 通过；报告完整，工作区干净。P3.3 只剩 Firefox 视觉／交互验收。

## 14. 记忆更新日志

- 2026-07-30：建立 `Pikku_MEMORY.md`；汇总品牌、多语言定位、基础设施、认证、资源中心、内容规划、Augusta 环境、已知修复和 P1 当前状态；确定脚本改为通过 Git 分支分发。
- 2026-07-30：验证流程改为批量完成全部检查后统一汇总，失败项不中断后续检查，报告写入 `D:\Downloads`。
- 2026-07-30：首次 `Test-Pikku.ps1` 在 Augusta 的 Windows PowerShell 5.1 出现解析错误；脚本改为 ASCII 兼容写法并移除嵌套 `try/finally`，避免编码/语法兼容问题。
- 2026-07-31：Augusta 批量验证 7/7 通过；新增系统交互与故障防复发手册；发现 Windows PowerShell 5.1 的 Transcript 未完整收录原生命令输出，验证脚本改用显式输出管道。
- 2026-07-31：完整日志复验再次 7/7 通过；记录 Next.js Unicode 符号乱码的原因并为验证脚本加入临时 UTF-8 输出编码。
- 2026-07-31：完成 P1 多语言外壳最小实现；加入三语言选择、等级持久化、语言数据过滤和日语/西班牙语占位入口，并通过 Augusta 批量检查与 Firefox 浏览器验收。
- 2026-07-31：确定分语言随机知识规则；日语加入日汉同形异义，西班牙语加入拉丁语词源、同源异义和同形异源，首批 7 条使用统一来源可追溯数据模型。
- 2026-07-31：建立 Draft PR #12，包含 P1 多语言基础与首批 7 条语言知识；GitHub 显示可自动合并，等待 Workers Preview 和 Firefox 知识卡复验。

- 2026-07-31：Cloudflare 分支 Preview 部署成功；云浏览器验证日语知识卡切换、日汉来源链接、西班牙语四条跨类别知识卡及来源链接均正常。刷新后未发现 Pikku 应用自身的 hydration 错误；仅观察到云浏览器扩展的 metadata 日志，与网站无关。预览地址：`https://agent-pikku-multilingual-mvp-pkuni-latinex.kimdac.workers.dev/`。
- 2026-08-01：Augusta 报告 `Pikku_Check_20260801_003624.txt` 显示 Repository、Node/npm、Dependencies、TypeScript、Cloudflare production build、Git formatting、Final worktree 共 7/7 通过；Firefox 浏览器复验通过。PR #12 已从 Draft 转为 Ready for review，仍保持未合并状态。
- 2026-08-01：PR #11 合入 `main` 后，PR #12 因双方同时修改 `data/questions.ts` 暂时冲突。已把 `main@e81591a` 合入多语言分支；唯一文本冲突为 `language` 字段的类型写法，保留共享 `LanguageCode`，同时纳入 Livy 新题、词典语言筛选和周度统计。合并后 TypeScript、Next.js 生产构建及 Git 格式检查均通过。
- 2026-08-01：吸收 PR #11 后的 Augusta Firefox 复验通过；拉丁语、日语、西班牙语及知识卡均正常。Livy 新题已确认位于中级题库（`i-syn-06`、`i-tra-04`），但当前缺少作者／来源搜索，用户不易定位；这属于可发现性改进项，不阻塞 PR #12 合并，后续加入作者、来源或题号筛选。
- 2026-08-01：PR #12 已正式合并到 `main`，合并提交 `5cda856`；P1 多语言基础收口，下一阶段进入 P2 日语／西班牙语种子题库与作者／来源定位。
- 2026-08-01：启动 P2 最小训练闭环分支 `agent/pikku-p2-seed-bank`；计划复用现有练习、错题、收藏和统计组件，加入题号／题干／标签／作者／来源统一搜索，并为 JLPT N4–N1 与 CEFR A1–C2 各等级加入一题官方能力框架对齐的原创种子题。
- 2026-08-01：创建 Draft PR #13 `feat: add Pikku multilingual seed practice`；本地 TypeScript、Next.js 生产构建和格式检查通过，等待 Workers Preview 与 Augusta Firefox 验收。

- 2026-08-01：P2 PR #13 的 Cloudflare Workers Preview 部署成功；Augusta 批量检查与 Firefox 浏览器验收均通过。日语 N4–N1、西班牙语 A1–C2 种子练习、统一搜索、错题与收藏分语言隔离及刷新稳定性已确认，PR 可转为 Ready for review，等待用户明确授权后再合并。

- 2026-08-01：PR #13 `feat: add Pikku multilingual seed practice` 已正式合并到 `main`，合并提交为 `00a03ae`；P2 最小种子题库与统一搜索完成收口。下一步进入 P3 多语言账号统计与同步，仍从新功能分支开发并在 Preview 和 Augusta Firefox 验收后合并。
- 2026-08-01：启动 P3 分支 `agent/pikku-p3-account-sync`。新增账号语言/等级偏好，以及按语言存储的进度、收藏和词汇统计表；旧拉丁语 D1 数据通过一次性标记自动迁移，避免冷启动后重新写回已删除收藏。登录合并采用“云端同题优先、本地独有记录补传”，并等待 localStorage 读取完成后才开始账号同步；拉丁语旧等级状态统一跟随持久化等级，词汇统计也进入退出登录前的同步队列。
- 2026-08-01：P3 本地验证通过：8 项 Node 单元测试、TypeScript、Next.js 16.2.10 Cloudflare 生产构建、Git 格式检查、4 个 D1 迁移及 Miniflare 真实 API 冒烟测试均成功。冒烟测试覆盖日语/西班牙语批量进度、跨语言收藏、语言偏好、词汇统计和非法语言拒绝。云容器直接启动 `wrangler dev` 仍会触发环境级 `uv_interface_addresses`，改用 Miniflare `dispatchFetch` 验证 Worker 与 D1，不将该环境限制误判为网站故障。
- 2026-08-01：Augusta 批量验证脚本新增 Worker Node 单元测试步骤；P3 分支起统一报告共 8 项，继续使用 `npm.cmd` 与 Windows PowerShell 5.1 兼容写法。
- 2026-08-01：创建 Draft PR #14 `feat: sync multilingual account records`；GitHub 确认可自动合并，Cloudflare Workers 构建成功。稳定分支预览为 `https://agent-pikku-p3-account-sync-pkuni-latinex.kimdac.workers.dev/`，下一步是在 Augusta Firefox 完成登录、刷新、退出／换号、收藏删除和三语言隔离验收。
- 2026-08-01：PR #14 云浏览器未登录回归通过：拉丁语／日语／西班牙语及其等级均可切换，西班牙语 A1 在刷新后保持，登录弹窗完整位于视口内；未发现 Pikku 应用自身错误，仅有云浏览器扩展的 metadata 日志。用户在 `localhost:3000` 观察到无法完成登录，再次确认原因是纯 Next.js 开发服务器没有 Worker API；此现象不代表 Preview 或 Supabase 登录失败。
- 2026-08-03：复核词灵 Cling 的官网、公开演示和 GitHub 搜索；只确认其公开宣称“无限背单词、个性化推词、造句”，未发现公开源码或可复现算法。Pikku 决定采用可解释的答题次数／正确率加权，并明确不冒充 Cling 算法。
- 2026-08-03：建立 `agent/pikku-vocab-trainer` 叠加分支；加入 56 张三语分级短语境词卡、无限连续训练、个人设置的两种显示模式、游客记录登录合并及 D1 `vocab_mode` 迁移。首轮 14/14 Node 单元测试、TypeScript 和 Git 格式检查通过；5 个本地 D1 迁移及账号偏好／聚合词汇统计 SQL 冒烟通过。
- 2026-08-03：记录云端工具防复发项：scratch 克隆被维护清理时从远端分支恢复；npm 使用 `/tmp` cache；Wrangler 使用可写的临时 XDG/HOME，避免把 `/root/.npm` 或 `/root/.config` 权限错误误判为项目故障。
- 2026-08-03：云端 `next dev` 首次因 `uv_interface_addresses` 失败，指定 `--hostname 127.0.0.1` 后正常；云浏览器随后明确拦截 loopback，故未把云浏览器失败误判为界面缺陷，最终视觉验收仍留给部署 Preview 和 Augusta Firefox。
- 2026-08-03：P3.1 最终本地工程验证通过：14/14 Node 单元测试、TypeScript、Next.js 16.2.10 Cloudflare 生产构建、Git 格式检查、5 个本地 D1 迁移、偏好／聚合词汇统计 SQL 冒烟和 Wrangler 4.110.0 `deploy --dry-run` 全部成功；尚未写入远端 D1、推送分支或部署 Preview。
- 2026-08-03：完成全球语言学习产品与学习证据研究，新增 `docs/Pikku_Global_Language_Learning_Research_v1.md`；确立中英界面、可扩展语言下拉框、`grc` 古希腊语规划入口和关系型跨语言联学为长期方向。研究建议与界面方案仍需用户选择，本轮未修改功能代码、未推送或部署。
- 2026-08-03：用户确认古希腊语采用“古典中心、阿提卡骨架并纳入古典文学方言、作者按时代组织”，首个联学为拉丁语—西班牙语，界面采用学习台＋探索地图。新增 `docs/Pikku_Character_Bible_v1.md`，补全香山初遇、孔令强／吴铃铃／Luke／Yasmin 四位朋友及拉丁语、日语、西班牙语、古希腊语各一男一女的首批引导角色；本轮只更新规划文档，不修改功能代码、远端数据库或部署。
- 2026-08-04：把固定 Google Drive 补丁目录和“每个里程碑完成前必须审查”的协议写入长期记忆；首次读取 `Pikku_WeeklyPatch_2026-08-04.md` 并与 GitHub 对照，确认 PR #15 已合并、PR #14 仍为 Draft，接受内容审核与教材映射任务进入 P3.2，同时记录当前 P3.1 分支不能直接重复导入 PR #15 数据。
- 2026-08-04：角色设定更新为当代北京共同世界。英文角色增加中文名崔路加、安雅敏；群聊定名“五方言路 · Five Voices, One Trail”；每种语言双引导角色采用相距较远的语言地区出身、曲折后来京并与用户圈交集的规则，古典语言角色改为现代教会／古典教育背景；正式说明语言确定直接跟随界面语言，不再单设解释语言。
- 2026-08-04：P3.1 发布前复核发现背词页首张固定为本级第一词，账号权重只从第二张生效；已改为挂载后按账号统计选择首张，同时保留 SSR 确定性。复验 14/14 Node 测试、TypeScript、Next.js 生产构建、Wrangler 4.110.0 dry-run 和 Git 格式检查全部通过；云端工作区缺少 GitHub CLI，本轮未推送或创建 Draft PR。
- 2026-08-04：P3.1 部署链复核发现 Branch Preview 不会自动运行远端 D1 迁移，旧 `user_preferences` 可能缺少 `vocab_mode`。Worker 已加入幂等运行时补列和迁移标记，并新增真实 Miniflare+D1 旧表回归测试。测试夹具初次因多行 `db.exec()` 被拆行而报 `incomplete input`，改用 `db.batch/db.prepare` 后通过；最终 15/15 Node 测试、TypeScript、生产构建、Wrangler dry-run 与 Git 格式检查全部通过。
- 2026-08-04：云端工作区无法直接 Git push 时，P3.1 使用完整 Git bundle 交接给 Augusta，不复制散乱代码：用户从 bundle 导入到独立本地分支，再通过既有 SSH 推送 `agent/pikku-vocab-trainer`；远端分支出现后由连接器创建以 P3 分支为 base 的 Draft PR。bundle 必须在最后一次提交后重建并校验 SHA-256。
- 2026-08-04：Augusta 已从校验 bundle 导入并通过 SSH 推送 `agent/pikku-vocab-trainer@89929f0`；创建 Draft PR #16，以 PR #14 的 P3 分支为 base，GitHub 确认可自动合并。Cloudflare Preview `https://agent-pikku-vocab-trainer-pkuni-latinex.kimdac.workers.dev/` 已上线；首页、`/api/me`、`/api/auth-config`、`/api/questions` 的未登录冒烟均返回 200。下一步为 Augusta 批量检查与 Firefox 登录／背词验收。
- 2026-08-04：同步 GitHub 连接器生成的文档提交时，云端 clone 因窄 fetch refspec 没有把指定分支识别为可跟踪远端分支；使用 `FETCH_HEAD` 快进后补充该分支 refspec 与 upstream，恢复干净的本地／远端跟踪关系。
- 2026-08-04：账号 Preview 验收成功。按用户决定把背词范围改为等级累积：日语 N2 包含 N4–N2，西班牙语 C2 包含 A1–C2，拉丁语中级／混合／进阶同样包含较低等级；页面显示实际覆盖范围。
- 2026-08-04：Augusta 的迁移测试因 Windows 安全中心阻止 `workerd.exe` 而失败。回归测试改用 Node 24 内置内存 SQLite 和轻量 D1 适配器直接调用 Worker `ensureSchema`，无需降低系统安全策略；15/15 测试、TypeScript、生产构建和 Wrangler 4.110.0 dry-run 在云端通过。
- 2026-08-04：累计等级修复以 `10f6026 fix: include lower vocabulary levels` 发布到 PR #16。Cloudflare 稳定 Preview 的前端资源已包含“当前涵盖”标记，首页、`/api/me`、`/api/auth-config`、`/api/questions` 均返回 200；固定 Drive 补丁目录仍只有未修改的 `Pikku_WeeklyPatch_2026-08-04.md`，没有新冲突。
- 2026-08-04：用户确认 Augusta 8/8 批量检查与 Firefox 累计词库范围验收通过。里程碑复查 Drive 后仍无新补丁；PR #16 保持 Draft，不把验收确认解释为合并授权。下一步等待用户明确授权合并 PR #14，再执行 P3.1 合流与回归。
- 2026-08-04：用户明确授权后，PR #14 已合并为 `5a378cf`。P3.1 随后无冲突吸收包含 PR #15 的最新 `main`，PR #16 改以 `main` 为 base；完整工程回归、线上 Preview 哈希与 API 冒烟均通过，Drive 无新补丁，PR #16 已转为 Ready for review，仍须用户另行明确授权才能合并。
- 2026-08-04：一次 GitHub 文档 blob 上传在用户新消息到达时产生 `turn_aborted`；确认此前 PR #14 合并、P3.1 合流、回归和 PR #16 状态均未回滚。把中断恢复规则写入故障防复发手册，后续先查状态再补做缺失动作。
- 2026-08-04：用户授权完成本阶段全部提交、验证、memo 更新及当前 PR #16 合并；PR #16 随后合入 `main`，P3.1 正式收口。此授权不延伸到后续其他 PR 的合并或破坏性操作。
- 2026-08-06：原 P3.2 临时工作区和 `.bundle` 交接件在平台维护后不可用，聊天界面又显示“无法获取上传状态”。从可信 GitHub `main@79a9742` 重建 Sites 生命周期工作副本，按 Drive 补丁和长期记忆恢复 P3.2；此后改用直接 GitHub 功能分支＋Draft PR，不再依赖 bundle 下载。
- 2026-08-06：完成自然习得与剧情玩法研究，新增 `docs/Pikku_Natural_Acquisition_Gameplay_Research_v1.md`；把可理解输入、任务互动、注意形式、间隔提取与可解释自适应组合成六阶段学习循环。本阶段只建立研究和内容数据底座，不引入大型游戏引擎。
- 2026-08-06：用户选择从公开 memo 中清理基础设施标识；Cloudflare Account ID、D1／R2 具体标识、nameserver 与 Supabase 项目标识统一改为“见对应后台”。同时记录 Draft PR #17、稳定 Preview 与 Augusta 8/8 报告，Firefox 验收仍待用户确认。
- 2026-08-08：完整 memo 覆盖曾因包含认证与基础设施历史说明被 GitHub 连接器风险审查拦截；用户在知悉公开范围并确认文件无密钥后明确授权提交。平台维护同时清理了临时工作区，因此从 PR #17 最新远端分支重建，只恢复远端缺失的资源隔离、切换连续性、验证结果与故障防复发记录，不重做已提交代码。
- 2026-08-08：PR #17 稳定 Preview 的云端 Chrome 定向交互复验通过：日语／西班牙语资源与社区均按语言隔离，资源／社区／训练模块切换连续，首次相近等级映射和各语言最近等级恢复正常；Drive 补丁目录无变化。下一步只需 Augusta Firefox 确认这两项修复，PR 仍为 Draft，未取得合并授权。
- 2026-08-08：提交定向复验文档时，GitHub 连接器发现总任务书仍残留具体 D1／R2 名称并拒绝上传。根因是此前只清理了 memo、未同步清理任务书的旧基础设施段；已把任务书对应字段统一改为“见对应后台”。以后公开文档提交前必须同时扫描 memo 与总任务书中的 Account ID、数据库／Bucket 名称、UUID、项目 URL、nameserver、邮箱和密钥格式，不能只扫描 token 与 UUID。
- 2026-08-08：用户在 Augusta Firefox 确认 PR #17 的资源隔离与切换连续性两个定向项目均通过。P3.2 的自动、云端浏览器与 Firefox 验收至此全部完成；Drive 无新增补丁或冲突。PR #17 转为 Ready for review，但仍未合并，等待用户另行明确授权。
- 2026-08-08：用户明确授权合并 PR #17；GitHub 以 merge commit `bef79564` 合入 `main`，P3.2 正式收口。合并前 Drive 复查无新增补丁或冲突。下一阶段进入 P3.3 决策：先确认自然习得剧情静态原型的体验取向，再编码；P4 管理后台与中英双语底座继续随后推进。
- 2026-08-08：用户确认 P3.3 推荐取向：70% 当代北京／30% 历史文献，中性第二人称，默认 8–12 分钟主线并附 3 分钟复习与 20 分钟深读。分支 `agent/pikku-p3-3-story-prototype` 已实现“香山碑文与版本线索”：复用训练中心、三条现有拉丁词典词目和固定角色，提供六阶段闭环、手动引导强度、错误修复提示、结果总结及可关闭入口；不引入游戏引擎、新后端或数据库迁移。
- 2026-08-08：P3.3 首轮工程复核中，`tsc` 最初因新工作区尚无 `node_modules` 而找不到命令；使用 `npm ci --cache /tmp/pikku-npm-cache` 恢复依赖后通过。批量构建命令又因安全执行器拒绝 `rm -rf` 清理临时目录而未启动；改用 `mktemp -d` 为 Wrangler 创建唯一临时目录后，GitHub Pages、Cloudflare 生产构建、Wrangler 4.110.0 dry-run 和格式检查全部通过。以后不能把缺依赖或安全执行器拒绝误判为项目代码失败，也不在自动化命令中用破坏性临时目录清理。
- 2026-08-08：启动 P3.3 时复查固定 Drive 目录；仍只有 `Pikku_WeeklyPatch_2026-08-04.md`，文件 ID 与 `2026-08-04T04:59:26.124Z` 修改时间均未变化。与 `main@f177f1d`、当前分支、memo 和总任务书对照后无新增补丁、重复实现或冲突。
- 2026-08-09：发布 P3.3 时本地 HTTPS push 因容器没有 GitHub 凭据失败，改用已授权 GitHub 连接器建立远端分支；核心功能提交 `88fa846` 已成功落地。随后上传两份长文档时会话中断，平台维护清理了临时工作区；恢复时先核对远端提交，再从 `agent/pikku-p3-3-story-prototype@88fa846` 重建，只补 memo／任务书，不重复创建代码 blob、功能提交或 bundle。以后遇到 `turn_aborted` 与工作区清理仍遵循“先查远端状态、再补缺项”。
- 2026-08-09：文档恢复提交 `3fff1d2` 已发布，Draft PR #18 已创建并由 GitHub 确认可自动合并；其后继续追加纯文档状态提交。Cloudflare Workers 评论已确认 `08b9c897` 部署成功并给出稳定分支 Preview；下一步在 Augusta 拉取分支、运行统一报告并用 Firefox 完成交互验收。
- 2026-08-09：云浏览器一次把多条路线、完成页和资源跳转串在同一控制调用中，超过 30 秒后控制内核重置；重新连接后页面状态仍在，控制台没有 Pikku 应用错误。以后把长浏览器验收拆成单次 1–3 个交互并立即取证，不能把控制器超时误判为网站超时。
- 2026-08-10：用户指定新的“Pikku素材库”Drive 文件夹；插件确认可访问且当前为空。已把其与原补丁任务书目录的用途、内容登记字段和版权闸门写入 memo；同轮 Augusta P3.3 统一报告为 8/8 PASS，下一步只做 Firefox 最终验收。
