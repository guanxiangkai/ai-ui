# AI UI 架构说明

## 决策

四个共享能力采用一个 Git 仓库、四个 npm 软件包。它们在同一变更中经常需要同步调整接口，集中仓库可以使用一套锁文件、Vite+ 质量门禁和 Changesets；独立包版本仍允许消费方按需升级，避免把所有能力强制绑定为一个发布单元。

## 依赖方向

```text
@guanxiangkai/build-config     Vite+ 构建期能力，不进入浏览器运行时

@guanxiangkai/platform-client  纯 TypeScript，负责传输与平台接口契约
            ↑
@guanxiangkai/vue-platform     Vue、Pinia、Router 集成
            ↑
消费端应用模块                  业务页面和领域实现

@guanxiangkai/ui               依赖 platform-client，提供中性平台页面和设计令牌
```

禁止形成 `platform-client -> Vue`、共享包反向依赖消费端仓库或共享包之间的循环依赖。

## 租户边界

平台服务把每个租户视为独立安全边界。客户端只负责把调用方提供的租户标识写入 `X-Tenant-Id`，不会猜测、缓存或硬编码具体租户。Token 与租户的授权关系必须由网关和平台服务端验证，前端权限只用于交互控制，不能作为安全边界。

## 会话边界

- 基础 Store 默认仅在内存保存会话；浏览器刷新后重新认证是安全默认值。
- `sessionStorage` 适配器只作为消费端显式策略提供，因为其中的访问令牌和刷新令牌仍可被同源 JavaScript 读取。
- 需要长期浏览器会话时，优先由服务端使用 `HttpOnly`、`Secure`、`SameSite` Cookie，并同时设计 CSRF 防护；基础包不会假装用前端加密消除 XSS 风险。
- 任何日志、错误对象、URL、分析事件和跨窗口消息都不得包含未保护的认证凭据。

## 发布边界

- GitHub 公共仓库保存 Apache-2.0 源码和 CI，GitHub Packages 保存不可变 npm 制品；包的实际公开可见性在发布后单独核验。
- Changesets 是版本意图的权威来源；正式包使用 `latest`，测试包使用 `next`。
- 发布必须从受保护分支和受保护 GitHub Environment 手工触发。

## 公共页面边界

- `platform-client` 是认证、系统管理、Agent 和调度 HTTP 契约的唯一来源。区域、导入模板、消息、天气、系统设置和 Agent 管理不得在产品中重新定义传输类型或端点。
- `PlatformRequestClient` 是消费端传输适配接口，`PlatformClientFactory` 负责创建共享该传输的客户端外观；`RequestCommitPolicy` 负责可替换的异步提交规则，Vue 控制器只编排响应式状态与组件生命周期。
- `ui` 实现登录、异常状态、租户、部门、岗位、用户、角色、菜单、字典、区域、导入模板、消息、天气、系统设置、审计日志、Agent 和定时任务页面。
- 消费端仓库只保留薄路由页面、现有传输层适配、权限上下文、应用菜单注册表和主题变量。
- Agent 公共页面只维护定义、提供方协议、发布、会话、调用和语音审计；任何领域业务页面必须留在所属消费端。
- 系统设置的语言、主题、通知与安全字段是稳定公共契约；应用工作台配色等偏好必须使用消费端自有命名空间扩展。
- 天气对浏览器只提供查询契约；采集和写入属于内部同步边界，不对管理页开放通用 CRUD。
