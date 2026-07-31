# 哔丘 Pikku 项目长期记忆

更新日期：2026-07-31  
仓库：`Etymodes/PKUni_Latinex`  
正式域名：`https://pikku.qzz.io/`

## 0. 使用规则

每次处理 Pikku 前：

1. 阅读本文件、`docs/Pikku_MasterPlan_v2.md` 和最近 5 条 Git 提交。
2. 以较新的对话、代码和部署状态覆盖旧记录。
3. 每次形成新决策、修复缺陷、完成部署或改变任务状态后，同步更新本文件。
4. 本文件只记录长期有效信息和当前状态，不保存密码、SMTP 密钥、OAuth Secret、私钥或 API Token。
5. 涉及实现时使用 Ponytail 原则：选择能工作的最小方案，避免无必要的依赖、抽象、迁移和重写。

本文件是仓库内的项目记忆协议，不是平台自动记忆钩子。执行者需要主动读取、维护并提交它。

## 1. 项目定位与品牌

- 产品名：**哔丘 Pikku**。
- 历史名：**比丘拟 / PKUni_Latinex**，继续作为拉丁语模式和项目沿革保留。
- 项目已从“北京大学拉丁语水平考试模拟器”转型为多语言学习、复习、测试和考试模拟平台。
- 第一版语言：拉丁语、日语、西班牙语；共用同一账号和网站外壳。
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
- 多语言采用共享网站外壳＋语言配置＋各语言独立题库/资源/等级。
- 核心语言类型：`"la" | "ja" | "es"`。
- 旧题目没有 `language` 字段时必须按拉丁语 `la` 处理，保证向后兼容。
- 新题建议字段：`language`、`level`、`skills`、`source`、`sourceStatus`。

## 4. 等级体系

- 拉丁语：初级、中级、混合难度、进阶；以北京大学拉丁语水平考试考纲为核心标准。
- 日语：N4、N3、N2、N1。
- 西班牙语：A1、A2、B1、B2、C1、C2。
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

## 6. Git 当前基线

- 资源中心 PR #9 已合并。
- `main` 已知基线：`0a5e97a`，合并 PR #9。
- 多语言分支：`agent/pikku-multilingual-mvp`。
- 任务书提交：`6b73289 docs: define Pikku multilingual roadmap`，已推送远端。
- `docs/Pikku_MasterPlan_v2.md` 是多语言转型的总任务书。
- Draft PR #12：`feat: establish Pikku multilingual foundation`，目标分支为 `main`；GitHub 已确认无分支冲突，Cloudflare Workers Preview 与云浏览器冒烟测试已通过；等待 Augusta Firefox 对新增知识卡的最终复验。
- 不直接在 `main` 开发；PR #12 通过预览和浏览器复验后再转为 Ready。

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

后续阶段：

- P2：已从首批日语/西班牙语随机知识卡开始；下一步加入种子题库和训练闭环。
- P3：多语言账号统计与同步。
- P4：多语言管理员题库管理。
- P5：资源、词典、知识图谱。
- P6：带审核能力的社区。

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
- 桌面已有 `C:\Users\kimda\Desktop\Pikku开发检查.cmd`，用于启动开发服务器并打开 Firefox。
- Windows 上 `npm.cmd run build:cloudflare` 会因 POSIX 环境变量语法失败。使用：

```powershell
$env:NEXT_PUBLIC_AUTH_MODE="supabase"; & ".\node_modules\.bin\next.cmd" build; Remove-Item Env:NEXT_PUBLIC_AUTH_MODE -ErrorAction SilentlyContinue
```

- Next 开发/构建可能修改 `next-env.d.ts`；若只有生成差异，使用 `git restore -- next-env.d.ts`。
- 检查顺序：`npm.cmd ci`（依赖变化时）、`npm.cmd run lint`、上述生产构建、Firefox 浏览器测试、`git diff --check`、`git status -sb`。
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

### 浏览器、React 与本地 API

- 首页随机词源若在 SSR 初始渲染中调用 `Math.random()`，服务端和客户端文本不同，会触发 hydration mismatch。正确做法是确定性初值 `0`，挂载后的 `useEffect` 再随机化。
- 本地 `next dev` 下 `/api/me`、`/api/questions`、`/api/auth-config` 返回 404，是因为 Cloudflare Worker API 未加载；不要误判为生产 API 消失。登录、同步和 Worker API 要在 Preview 或正式站验证。
- 登录窗口曾因定位在顶栏容器内而只能覆盖顶栏，矮屏时也会越界。模态框必须相对视口显示、内容区域可滚动，并在打开时锁定页面背景滚动。

### 账号、同步与部署

- 邮箱确认、Brevo SMTP、GitHub OAuth 管理员登录已经实测成功。
- 错题进度已能恢复；收藏曾出现未同步，虽然加入了合并逻辑，仍属于每次认证/数据模型改动后的固定回归项。
- Cloudflare nameserver、Custom Domain 和 Universal SSL 变更存在传播等待时间；域名从 HTTP 可用到 HTTPS 正常曾经历等待。传播期间先检查状态，不重复删除重配。
- Cloudflare Preview 用于合并前浏览器验证；生产域名保持 `https://pikku.qzz.io/`。

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
