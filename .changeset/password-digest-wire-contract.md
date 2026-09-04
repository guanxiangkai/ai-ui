---
"@guanxiangkai/platform-client": minor
"@guanxiangkai/ui": patch
---

平台认证和用户写入接口改为在安全 Web Crypto 环境中将原密码计算为 SHA-1 摘要，并只传输 `passwordDigest`；缺少安全上下文或 Web Crypto 时拒绝发送密码请求。
