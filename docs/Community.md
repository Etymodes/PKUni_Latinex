# Pikku 社区后端与运维

社区仅开放 `la`（拉丁语）与 `ja`（日语），每种语言各有 `language`（目标语练习）和 `study`（不限语言学习交流）两个公开频道。读取匿名开放；发言、翻译和举报要求由服务端验证的 Supabase 账号。管理员仍使用现有 GitHub 白名单身份，不另建登录系统。

## 认证与公开数据

社区路由只使用现有 `supabaseIdentity()` 验证 Bearer token，**不信任外部传入的 `oai-authenticated-*` 请求头**。公开消息只包含 `id / authorName / mine / text / createdAt / detectedLanguage`，不返回邮箱、内部账号 ID、模型提示词或凭据。`authorName` 是显示名，不代表唯一身份认证。

消息属于公开内容；语言检查和按需翻译会将相关正文交给 Cloudflare Workers AI。前端以纯文本渲染。删除使用 `deleted_at` 软删除：消息不再出现在公开列表、举报待办或翻译端点中，数据库记录及已存翻译不会自动物理清除。

## 语言规则与幂等性

- 正文先去除首尾空白并按 NFC 规范化，最多 1000 个 Unicode 字符；JSON 请求体最多 8192 字节。控制字符被拒绝。
- 计词使用 `Intl.Segmenter` 的词级分段，并要求词段含字母。计数副本做 NFKC 规范化、排除 URL；数字、表情和标点不单独算词。原正文不因此改写。
- `study` 不做语言处罚，任何语言均可使用。目标语频道中不超过 5 词的消息直接允许；较长消息必须通过服务端检查，前端提供的语言/判定字段无效。
- 处罚只用于明确的非目标语连续语句：模型须给出原消息中逐字存在、其自身超过 5 词的证据，并通过第二次确认。借词、人名、目标语解释中的引用、学习者错误、无长音号拉丁语、汉字共用等均要求保守判断。
- 不确定、模型拒绝、超时、绑定缺失或额度耗尽：该条长消息不发送，返回可重试的 503，**不增加警告**。
- 同一账号的警告在拉丁语、日语的两个目标语频道间共享。前三次违规返回 422 且不发布；第 4 次返回 403，两个目标语频道同时禁言 1 小时。禁言不会限制 `study`，再次尝试不延长禁言。
- 禁言到期后当前状态的警告归零；未达到第 4 次之前，警告不会按日自动清零。服务端时间为准。
- `clientId` 必须匹配 `[A-Za-z0-9_-]{1,128}`，由客户端为一次发送生成并在网络重试时复用。同一账号同一 ID 的已完成发送或警告返回原回执，不重复发布、不重复处罚；同 ID 改正文/频道返回 409。新的主动发送应使用新 ID。
- 回执记录与警告变更、消息发布在同一个 D1 事务中完成。历史回执保留当时的警告状态，当前状态以 GET 为准。已经处于禁言时的新尝试不形成新的处罚记录，可在到期后重新发送。

## API

所有时间字段使用 ISO 8601；无禁言时 `mutedUntil: null`。所有响应禁止缓存。

| 方法与路径 | 输入/用途 | 成功响应 |
| --- | --- | --- |
| `GET /api/community?language=la&channel=language` | 合法 language/channel 必填，匿名可读 | `{messages,warnings,mutedUntil,aiAvailable}`；最近 50 条，按时间正序 |
| `POST /api/community/messages` | `{language,channel,text,clientId}`，登录 | `{message,warnings,mutedUntil}`；首次 201，完成后幂等重试 200；原消息已删除时 message 为 null |
| `POST /api/community/messages/:id/translate` | `{locale:'en'|'zh-CN'}`，登录 | `{translation,detectedLanguage}`，按消息 ID 与 locale 共享缓存 |
| `DELETE /api/community/messages/:id` | 作者或管理员 | `{ok:true}`，软删除 |
| `POST /api/community/messages/:id/report` | `{reason}`，登录；1–500 字符 | `{ok:true}`；同一账号同一消息的重复举报不增加记录 |
| `GET /api/community/reports` | 仅管理员 | `{reports:[{message,reason,reportedAt}]}`；最新 100 条未删除消息的举报 |

常见错误：400 `invalid_room / invalid_message / invalid_locale / invalid_report`；401 `login_required`；403 `forbidden` 或 `muted`；404 `message_not_found / not_found`；409 `client_id_conflict`；422 `language_warning`；429 `rate_limited`；503 `language_check_unavailable / translation_unavailable / request_pending / community_unavailable`。

警告/禁言响应携带 `warnings` 和 `mutedUntil`；限速/检测暂不可用/处理中响应携带 `retryAfterSeconds`。`request_pending` 表示已有同一请求在处理，应保留正文和 clientId 稍后重试。

## 限额、部署与故障

- 每账号每个固定 60 秒窗口：发送 20 次、未命中缓存的翻译 10 次、举报 10 次。已完成发送的幂等重试、命中缓存的翻译不另扣相应额度。
- 全站、所有账号和所有模型任务共用 **UTC 每日 1000 次 `AI.run` 硬上限**。每次调用前先用 D1 原子预留；检测首轮与第二次确认各占 1 次，翻译占 1 次。失败/超时已发起的调用不退还额度。达到上限或 D1 不可用时不调用模型、不处罚用户。
- 同一发送 ID 和同一消息/翻译语言使用数据库短租约，防止并发重试重复推理；租约 60 秒自动可接管。处理中返回 503 `request_pending`，建议 3 秒后重试。已完成幂等回执和翻译缓存不消耗 AI 日额度。
- 单次识别输出上限 800 token，翻译 2400 token；单次模型等待最多 15 秒。外语确认可有两次调用，加数据库耗时，客户端社区请求应允许至少 45 秒。超时仅结束等待，Workers AI 绑定没有承诺取消底层推理或计费。
- `wrangler.jsonc` 配置 `AI` 绑定及 `COMMUNITY_AI_MODEL`，默认 `@cf/qwen/qwen3-30b-a3b-fp8`，不向客户端提供密钥。`aiAvailable` 只表示 Workers AI 绑定已配置，不能证明当前额度或某条消息的推理一定成功。
- 1000 次是调用次数限制，不是“所有调用必定免费”的承诺。需另在 Cloudflare 后台观察实际使用量及账户限额。

`migrations/0007_community.sql` 与 `worker/community.js` 导出的 `communitySchema` 同构，全部为 `CREATE ... IF NOT EXISTS`。后者已接入现有 `ensureSchema()`：**Workers Git 集成发布新代码后，首次 API 请求会在现有 D1 绑定中自动创建所需表**，无需依赖本地 CLI 凭据或先运行远端迁移命令。建表失败不标记完成，后续请求可重试；已有学习进度表不会被覆盖。若 D1 绑定缺失，社区返回 503。具备运维凭据时仍可正常运行显式迁移来维护迁移登记。

本次只在隔离 SQLite 与模拟 AI 响应中验证规则、事务、并发和接口，不冒充真实模型准确率验收。Latin 不在所选模型公开明确保证的覆盖范围内；上线需以实际拉丁语学习者文本抽查，不可靠时保留“不确定、不处罚”的退路。

## 举报管理的当前边界

网页管理员入口可查看待处理举报并删除违规消息；消息删除后相关举报不再列入待处理。当前没有单独的“保留帖子并关闭举报”接口，也没有用户屏蔽、自动内容审查、举报申诉或保留期限任务。正常帖子不应仅因被举报而删除；可暂时保留在待处理列表，后续需要时再增加不删帖关闭功能。该限制适用于当前小规模版本，不应宣称已提供完整社区治理系统。

## 本地验证

`tests/community.test.mjs` 使用真实内存 SQLite 事务验证：伪造头拒绝、并发幂等、跨频道处罚、到期归零、数据库回滚、账号及全站限速、翻译并发缓存、举报与删除授权。`tests/community-ai.test.mjs` 验证模型适配契约、不确定退路与每次调用的额度预留。测试不发送真实群聊消息。
