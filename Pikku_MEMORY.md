# 哔丘 Pikku 项目长期记忆

更新日期：2026-08-04
仓库：`Etymodes/PKUni_Latinex`  
正式域名：`https://pikku.qzz.io/`

## 0. 使用规则

每次处理 Pikku 前：

1. 阅读本文件、`docs/Pikku_MasterPlan_v2.md` 和最近 5 条 Git 提交。
2. 以较新的对话、代码和部署状态覆盖旧记录。
3. 每次形成新决策、修复缺陷、完成部署或改变任务状态后，同步更新本文件。
4. 本文件只记录长期有效信息和当前状态，不保存密码、SMTP 密钥、OAuth Secret、私钥或 API Token。
5. 涉及实现时使用 Ponytail 原则：选择能工作的最小方案，避免无必要的依赖、抽象、迁移和重写。
6. 每个里程碑标记完成前，检查固定 Google Drive 补丁目录，与 GitHub `main`、开放 PR、当前分支和总任务书对照；新内容可排期，已实现内容不得重复，矛盾或旧版指令必须先告知并询问用户。

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
- Cloudflare Account ID：`43c450a93cd0578e02626a3ccbd1d1ef`。
- D1：`pkuni-latinex-db`，Database ID `c4ae89ef-7e60-4238-98ab-1c7f85e0f195`。
- R2：`pkuni-latinex-assets`，区域 WNAM。
- FreeDomain 域名：`pikku.qzz.io`；Cloudflare nameserver 为 `lady.ns.cloudflare.com`、`yoxall.ns.cloudflare.com`。
- Supabase 项目：`tudwzkosrzrusxgpjkfe.supabase.co`。公开客户端配置可留在前端；任何私密密钥不得写入本文件或 Git。
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
- 进入背词页后的首张词卡也必须在客户端挂载后按账号统计加权选择；SSR 初始渲染仍保持确定，不能为首张随机化重新引入 hydration mismatch。
- P3.1 Worker 会在首次 API 请求时检查旧 `user_preferences` 表是否缺少 `vocab_mode`，缺少则安全补列并记录 `vocabulary-trainer-v1`；这样 Branch Preview 不依赖预先手工执行远端迁移，正式迁移文件仍保留。
- “无限”指训练轮次不设每日上限，不表示首版已有无限个不同词目；词库后续持续扩充。
- 词灵 Cling 公开页面宣称无限背词、个性化推词和造句，但未找到公开源码或足以复现的算法说明。Pikku 只学习可观察的产品逻辑，使用自己的透明权重，不声称复制其强化学习或“最优”算法。

## 6. Git 当前基线

- GitHub 远端 `main` 当前基线：`47b25094`，已合并资源中心 PR #9、拉丁语内容 PR #11、多语言外壳 PR #12、种子题库 PR #13 与每周复核练习 PR #15。
- P3 开发分支：`agent/pikku-p3-account-sync`，从 `main@9d6cff3` 创建。
- 初版任务书提交：`6b73289 docs: define Pikku multilingual roadmap`。
- `docs/Pikku_MasterPlan_v2.md` 是多语言转型的总任务书。
- PR #12：`feat: establish Pikku multilingual foundation` 已于 2026-08-01 合并到 `main`，合并提交为 `5cda856`。Cloudflare Workers Preview、云浏览器冒烟测试、Augusta 批量检查和 Firefox 最终复验均已通过；PR #11 的 Livy 新题、词典语言筛选和周度统计也已一并保留。
- PR #13：`feat: add Pikku multilingual seed practice` 已于 2026-08-01 合并到 `main`，合并提交为 `00a03ae`。
- Draft PR #14：`feat: sync multilingual account records`，分支 `agent/pikku-p3-account-sync`，当前提交 `1c61e60`；Cloudflare Workers Preview 已部署成功，等待 Augusta Firefox 账号同步验收。
- P3.1 叠加分支：`agent/pikku-vocab-trainer`，基于 P3 Draft PR #14；在 P3 验收合并前不直接合入 `main`。
- PR #15：`feat: add 2026-08-02 weekly review practice set` 已合并到远端 `main`，合并提交 `47b25094`；当前 P3／P3.1 叠加线尚未包含该提交，合流时必须先吸收最新 `main` 并检查题目 ID 和词条重复。
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
- P3：进行中。把当前语言与等级写入账号偏好；进度、收藏与词汇统计按语言写入 D1；游客记录在登录后与云端安全合并；旧拉丁语账号数据自动迁移。
- P3.1：开发中。三语自适应背词、两种显示模式及账号偏好同步；首批 56 张词卡覆盖拉丁语初／中／进阶、日语 N4–N1、西班牙语 A1–C2。
- P3.2：已从 2026-08-04 Drive 补丁书接受，等待 P3／P3.1 收口后从包含 PR #15 的最新 `main` 建独立分支；范围为审核状态、内容批次、62 个“待核”词条复核、六道候选错因题与教材章节元数据映射。
- P4：多语言管理员题库管理。
- P5：资源、词典、知识图谱。
- P6：带审核能力的社区。
- 下一代多语言规划闸门：P3／P3.1 收口后，按已经确认的中英双语底座、语言下拉框、古典中心古希腊语、拉丁语—西班牙语联学和“学习台＋探索地图”排期；正式说明语言直接跟随界面语言。

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

## 13. Augusta 交互与故障防复发手册

### 命令执行习惯

- Augusta 的默认 PowerShell 起点常是 `C:\Users\kimda`；执行 Git 命令前先进入 `C:\Users\kimda\Documents\PKUni_Latinex`，否则会出现 `fatal: not a git repository`。
- 桌面 `进入Pikku仓库.cmd` 用于直接在正确目录打开 PowerShell；桌面 `Pikku开发检查.cmd` 用于启动本地开发检查。
- 用户偏好一条可复制命令完成一批相关操作。检查应跑完全部项目后再汇总，不因第一项失败中止。
- 聊天附件可能无法下载；开发脚本应提交到当前 Git 分支，再由 Augusta 使用 `git pull --ff-only` 获取。

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
- `npm ci` 曾报告高危依赖和待批准安装脚本。不要直接运行 `npm audit fix --force`；先确认依赖升级对 Next.js、Cloudflare 和构建链的影响。
- 批量验证报告固定写入 `D:\Downloads\Pikku_Check_时间戳.txt`。
- 云端 scratch 工作区可能被平台维护清理；若本地克隆消失，应从 GitHub 的最新功能分支重新克隆／恢复，不推断为用户删除，也不从旧输出手工重建代码。
- 云端执行 npm 辅助命令若因 `/root/.npm` 不可写失败，显式使用 `npm --cache /tmp/npm-cache ...`。
- 云端 Wrangler 若因 `/root/.config` 不可写而报日志目录错误，使用 `XDG_CONFIG_HOME=/tmp/wrangler-config HOME=/tmp/wrangler-home`；这是工具日志路径权限，不是 Worker 或 D1 故障。
- 云端 scratch 直接运行 `next dev` 可能因 `uv_interface_addresses` 失败；显式使用 `next dev --hostname 127.0.0.1` 可正常启动。该限制不适用于 Augusta。
- 当前 Miniflare D1 测试中的 `db.exec()` 可能把多行建表 SQL 按行拆开并报 `incomplete input`；测试夹具使用 `db.batch([db.prepare(...)])`，与 Worker 的实际执行方式一致。该错误不是迁移 SQL 本身失败。
- 云端安全策略会拒绝含 `rm -f` 的整条命令，即使目标只是旧交接包；生成 bundle、报告等构建产物时使用带日期／版本的新文件名，不先执行强制删除。

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
