# @guanxiangkai/ui

## 0.2.0

### Minor Changes

- cb3c86d: 新增产品无关的 Agent 客户端与公共管理页面，统一维护 Agent 定义、提供方协议、会话、调用审计和语音记录。
- cb3c86d: 统一软件包的 Vite+ 构建配置；通过请求提交策略、传输适配接口与平台客户端工厂复用稳定契约，并新增仅最新请求生效的 Vue 异步控制器，避免快速切换查询时旧响应覆盖新页面状态。刷新令牌改为只通过 JSON 请求体传输，避免进入 URL、代理访问日志和浏览器历史；会话 Store 默认改为内存存储，浏览器持久化必须由产品显式选择。

  四个软件包统一使用 Apache-2.0 许可证并声明公开 GitHub Package；实际包可见性仍在发布后按 GitHub 权限设置复核。

- cb3c86d: 新增通用系统管理与调度客户端，可复用租户、组织、账户、角色、菜单、字典、区域、导入模板、消息、天气、系统设置、审计日志和定时任务页面，以及产品可覆盖的管理端设计令牌。
- cb3c86d: 新增当前部门查询客户端，以及根据“末级部门@姓名”生成并渲染页面身份水印的通用组件与响应式工具。

### Patch Changes

- 2b42bbe: 平台认证和用户写入接口改为通过 Web Crypto 将原密码计算为 SHA-1 摘要，并只传输 `passwordDigest`；浏览器明确处于非安全上下文或 Web Crypto 不可用时拒绝发送密码请求。密码写入禁止在 401 后自动重放，不含密码的用户资料写入保留会话刷新后的重试能力。
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [2b42bbe]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
- Updated dependencies [cb3c86d]
  - @guanxiangkai/platform-client@0.2.0
