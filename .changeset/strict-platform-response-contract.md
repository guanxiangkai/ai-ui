---
"@guanxiangkai/platform-client": minor
---

平台客户端将 JSON 响应严格限定为数字 `code`、字符串 `message` 和存在的 `data` 字段组成的标准响应信封，删除跳过信封校验的公开选项；HTTP 状态码与响应信封业务码通过独立公开常量表达，二进制与文本响应继续按声明类型直通。
