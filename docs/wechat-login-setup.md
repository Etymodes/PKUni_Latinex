# 微信扫码登录部署清单

比丘拟通过 Cloudflare Worker 提供标准 OAuth2 桥接，再由 Supabase Auth 统一签发网站会话。微信 AppSecret、桥接 Client Secret 不得写入仓库或 `wrangler.jsonc`。

## 1. 前置条件

- `https://pikku.qzz.io` 已绑定 `pkuni-latinex` Worker，HTTPS 可访问。
- 微信开放平台已创建“网站应用”，回调域配置为 `pikku.qzz.io`。
- 已取得微信网站应用 AppID 与 AppSecret。

微信侧回调地址：

```text
https://pikku.qzz.io/api/oauth/wechat/callback
```

## 2. 生成桥接客户端凭据

在本机密码管理器中生成两个随机值：

- `WECHAT_BRIDGE_CLIENT_ID`：随机公开标识，建议至少 24 字节。
- `WECHAT_BRIDGE_CLIENT_SECRET`：随机机密，建议至少 32 字节。

不要把 Client Secret、微信 AppSecret 发送到聊天、Issue、PR 或提交记录。

## 3. 保存 Cloudflare Secrets

在 Cloudflare Dashboard 的 Worker 设置中添加：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_BRIDGE_CLIENT_ID`
- `WECHAT_BRIDGE_CLIENT_SECRET`
- `WECHAT_LOGIN_ENABLED`，值为 `true`

非机密配置已保存在 `wrangler.jsonc`：

- `WECHAT_PUBLIC_ORIGIN=https://pikku.qzz.io`
- `WECHAT_SUPABASE_CALLBACK_URL=https://tudwzkosrzrusxgpjkfe.supabase.co/auth/v1/callback`

## 4. 配置 Supabase Custom OAuth Provider

在 Supabase Dashboard → Authentication → Providers → New Provider → Manual configuration 中创建：

- Identifier：`custom:wechat`
- Name：`WeChat`
- Client ID：与 `WECHAT_BRIDGE_CLIENT_ID` 相同
- Client Secret：与 `WECHAT_BRIDGE_CLIENT_SECRET` 相同
- Authorization URL：`https://pikku.qzz.io/api/oauth/wechat/authorize`
- Token URL：`https://pikku.qzz.io/api/oauth/wechat/token`
- UserInfo URL：`https://pikku.qzz.io/api/oauth/wechat/userinfo`
- Scopes：`profile`
- PKCE：开启
- Email optional：开启

Supabase 显示的 Callback URL 应为：

```text
https://tudwzkosrzrusxgpjkfe.supabase.co/auth/v1/callback
```

## 5. 安全验收

1. 未配置全部 Secrets 时，`GET /api/auth-config` 必须返回 `{"wechat":false}`。
2. 预览域名即使继承 Secrets，也不得启用微信按钮。
3. 授权请求缺少 S256 PKCE 时必须失败。
4. 授权码只能交换一次；令牌和临时状态在 D1 中只保存 SHA-256 哈希。
5. 完成扫码后检查 Supabase 用户、D1 学习记录及退出/换号隔离。
