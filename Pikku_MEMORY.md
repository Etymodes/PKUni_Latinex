# 哔丘 Pikku 项目长期记忆

更新日期：2026-07-30  
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
- 当前应在多语言分支完成 P1，检查通过后开 PR，不直接在 `main` 开发。

## 7. 当前阶段与最小路线

P0 基线整理已完成。当前执行 P1：

1. 加入语言选择器和持久化当前语言。
2. 将语言与等级配置数据化。
3. 旧拉丁语题库保持可用。
4. 日语、西班牙语先显示正确的等级和占位入口，不在 P1 同时大量造题。
5. 按语言隔离题目、进度和收藏显示，避免串库。
6. 浏览器、TypeScript、生产构建通过后再开 PR。

后续阶段：

- P2：加入日语/西班牙语种子题库和训练闭环。
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

## 13. 记忆更新日志

- 2026-07-30：建立 `Pikku_MEMORY.md`；汇总品牌、多语言定位、基础设施、认证、资源中心、内容规划、Augusta 环境、已知修复和 P1 当前状态；确定脚本改为通过 Git 分支分发。
- 2026-07-30：验证流程改为批量完成全部检查后统一汇总，失败项不中断后续检查，报告写入 `D:\Downloads`。
- 2026-07-30：首次 `Test-Pikku.ps1` 在 Augusta 的 Windows PowerShell 5.1 出现解析错误；脚本改为 ASCII 兼容写法并移除嵌套 `try/finally`，避免编码/语法兼容问题。
