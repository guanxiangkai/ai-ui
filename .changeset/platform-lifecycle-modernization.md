---
"@guanxiangkai/platform-client": minor
"@guanxiangkai/vue-platform": patch
"@guanxiangkai/ui": patch
"@guanxiangkai/build-config": minor
---

拆分 HTTP 单次请求构造与恢复流程，保留动态令牌重建和冲突校验；流式请求体不自动重放，异步身份提供器与转换钩子等待期间支持取消。注销接口支持固定访问令牌，防止会话切换后误用新身份。

以会话代次隔离登录、刷新、替换和注销的异步结果，并统一系统管理页面查询的最新结果提交语义。修复过期请求覆盖新页面数据、旧刷新恢复已退出会话等并发问题。

升级兼容的 Vite+、Vue 及配套工具，采用 unplugin-dts 的 Vue 声明生成和 publint 包入口检查；只输出 UI 源码声明，并将外部依赖及子路径保持外置。build-config 的 Vite+ peer 基线升级到 0.3。
