# AI UI

AI UI 是面向通用 AI 应用的前端基础组件库。仓库采用 pnpm monorepo：源码、质量门禁和发布流程统一维护，四个软件包保持独立版本和独立发布。本仓库不面向任何单一业务系统定制，文档、示例、类型和 API 只描述可复用的公开契约。

## 软件包

| 软件包                          | 职责                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `@guanxiangkai/platform-client` | 通用 HTTP、租户、认证、系统、Agent 和调度契约           |
| `@guanxiangkai/vue-platform`    | Vue/Pinia/Router 的平台注入、会话状态和权限守卫         |
| `@guanxiangkai/ui`              | 通用登录、异常、系统管理、Agent、定时任务页面和主题令牌 |
| `@guanxiangkai/build-config`    | Vite 库构建与声明文件生成配置                           |

应用业务页面、业务接口模型和应用路由继续留在各自仓库；租户、组织、账户、角色、菜单、字典、区域、导入模板、消息、天气、系统设置、审计日志、Agent 和定时任务等通用页面只在本仓库实现一次。消费端通过客户端、权限集合、路由注册表和 CSS 变量注入运行上下文与视觉主题。

共享页面中的可重复查询通过 `useLatestRequest` 提交状态：快速切换页签、分页或详情对象时，
过期响应及其错误不会覆盖最新页面状态；组件卸载会自动使在途请求失效。
该控制器将 Vue 生命周期编排与 `RequestCommitPolicy` 策略分离，默认使用
`LatestRequestPolicy` 的“最后发起者获胜”规则；客户端侧则以 `PlatformRequestClient`
作为传输适配接口，由 `PlatformClientFactory` 统一创建认证、系统、Agent 和调度外观。

## 技术基线

- Node.js 24 LTS
- pnpm 11.25.0
- TypeScript 6（与当前 Vite+、Vue 工具链匹配的稳定代际）
- Vue 3.5、Pinia 4、Vue Router 5
- Vite+ 0.3.0（Vite 8.2、Vitest 4.1、Oxlint、Oxfmt、tsdown、Vite Task）
- Element Plus 2.14

所有版本均锁定在 workspace catalog、根目录和各软件包的 `package.json` 中。pnpm 使用严格的
24 小时 `minimumReleaseAge` 隔离新发布依赖，且不会信任来自外部变更的锁文件绕过该规则。
升级必须审阅发布说明并通过完整质量门禁；不使用预览版或实验性构建工具。

## 开发与验证

依赖、测试和构建在满足版本基线的 Linux 环境执行：

```bash
pnpm install --frozen-lockfile
vp run ready
```

`vp run ready` 使用 Vite+ 依次执行依赖拓扑构建、Oxfmt、Oxlint、类型检查、Vitest 和发布检查。
发布检查由仓库元数据约束和 [publint](https://publint.dev/docs/javascript-api) 共同完成，后者检查
真实打包文件的 ESM 入口、exports 与声明文件。UI 声明使用 `unplugin-dts` 的 Vue processor，
通过独立 `tsconfig.build.json` 只生成源码声明，不包含测试与构建配置。

## 设计与演进

依赖方向是 `build-config → 构建期`，以及运行期 `platform-client → vue-platform / ui`。
客户端不依赖 Vue；UI 通过注入客户端使用通用平台能力，消费应用继续掌握路由、凭据和业务模型。

| 边界         | 当前职责与扩展点                                                                  | 优化理由                                                                         |
| ------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 传输适配     | `PlatformRequestClient` 可接入消费端已有请求层；默认采用浏览器原生 Fetch          | 保留已验证的租户、响应信封、匿名请求和令牌承载契约，避免叠加第二套 HTTP 重试机制 |
| 单次请求构造 | 每次尝试重新获取身份、序列化并执行转换钩子；执行层只负责超时、响应和一次 401 恢复 | 刷新后重新生成令牌，流式请求体不自动重放；等待扩展钩子时也能取消                 |
| 领域外观     | Auth、System、Agent、Scheduler 分别封装平台协议，工厂统一装配                     | 可替换传输而不更改页面，不为每个端点添加额外抽象层                               |
| 会话生命周期 | Pinia Store 按实例隔离，通过会话代次控制登录、刷新与退出的提交权                  | 旧刷新不能恢复已退出身份或清除新会话，注销固定作用于原会话                       |
| 页面查询     | 列表、详情、选项等独立使用 `useLatestRequest` 和 `RequestCommitPolicy`            | 统一乱序结果、错误与 loading 的提交逻辑，关闭弹窗和卸载会使在途结果失效          |
| 构建与发布包 | Vite+ 统一工具链，unplugin-dts 处理 Vue 类型，publint 检查 npm 产物               | 使用成熟第三方处理编译与打包规则，排除测试声明和重复打包的依赖                   |

### 依赖选择依据（2026-09-06）

- 采用 [Vite+ 0.3.0 官方版本](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.3.0)，
  Vitest 跟随其内置的 `4.1.11`；独立的 Vitest 5 会形成不匹配的测试工具链。
- Vue 与 SFC 编译器同步到 `3.5.42`，并升级兼容的 Pinia、Router、Element Plus、DOM 测试工具。
- 保留 TypeScript `6.0.3`：[TypeScript 7 官方说明](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
  明确其尚无稳定编程 API，Vue/Volar 仍需要 TypeScript 6；Node 类型定义保持 Node 24 对应代际。
- pnpm 采用成熟的 11.x 最新补丁，保留当前锁文件和 24 小时依赖隔离策略。pnpm 12 改用 Rust CLI，
  当前项目没有需要跨代迁移的功能缺口。
- 声明插件按[维护者建议](https://github.com/qmhc/unplugin-dts/tree/main/packages/vite-plugin-dts)
  从 `vite-plugin-dts` 切到 `unplugin-dts`，显式使用 Vue processor。
- 评估了 VueUse 与 TanStack Query：目前没有跨页面查询缓存、失效广播或离线持久化需求，现有 latest-request
  策略已覆盖页面查询的直接需求，保留小型 composable；以后出现共享缓存需求时再引入 QueryClient，避免双重查询状态。

具体依赖版本以 `pnpm-workspace.yaml` 和锁文件为准。升级必须通过真实构建、类型与行为测试，
不以版本号更大或第三方库更流行为采用理由。

浏览器会话通过单次到期唤醒更新 `isAuthenticated`，退出、替换和 Store 销毁会清理计时器；
服务端渲染不创建计时器。到期只改变认证状态，保留刷新令牌用于显式刷新；自定义到期规则所需的外部时钟应使用响应式来源。

## 使用

安装软件包后，由消费端应用提供网关地址、当前 Token 和租户标识：

```ts
import { createPlatformClient } from "@guanxiangkai/platform-client";

let accessToken: string | null = null;
const platform = createPlatformClient({
  baseUrl: "/api",
  tokenProvider: () => accessToken,
  tenantProvider: () => "tenant-id",
});
```

共享包不保存任何具体租户、组织或业务系统值，租户由部署环境和消费端入口决定。

### 认证与传输扩展

`platform-client` 直接支持 `responseType`、`credentials` 与单次 `accessToken` 覆盖。JSON 响应始终校验统一信封；`BodyInit`（如 `FormData`、`Blob` 和 `URLSearchParams`）会原样发送，其他请求体会编码为 JSON。消费端如需签名、追踪、加密载荷或自定义响应信封，可通过 `transformRequest` 与 `transformResponse` 注入策略，不应把业务字段写入基础包。

默认只通过 `Authorization` 发送访问令牌。服务端协议明确要求额外携带顶层 `token` 时，才可显式设置 `accessTokenPlacement: "query"` 或 `"json-body"`；两种方式仍会保留 Authorization。query 会暴露在 URL、浏览器网络记录、反向代理和访问日志中，应优先使用 JSON 请求体，并且只可在 TLS 保护的链路中使用。客户端会拒绝空白令牌和调用方已提供的 `token` 字段，且不会修改原查询参数或请求体。

```ts
const platform = createPlatformClient({
  baseUrl: "/api",
  tokenProvider: () => accessToken,
  accessTokenPlacement: "json-body",
});
```

当 HTTP 收到 401，`onUnauthorized` 返回 `true` 时客户端才会重新读取 Token 并仅重试一次。Vue 应用可用 `createPlatformSessionStore` 提供 `handleUnauthorized`：它会去重并发刷新、校验调用方提供的会话过期规则，并通过 `onRefreshFailure` 把失败导航或提示交给消费端实现。

`ReadableStream` 请求体（包括转换钩子生成的流）只发送一次，401 不触发自动恢复或重放。
取消信号与超时覆盖异步身份提供器和转换钩子的等待；钩子自身已启动的外部工作仍由钩子实现负责取消。
查询控制器仅控制结果是否提交，不会自动取消消费端已经发送的网络请求。

会话 Store 默认只使用内存，不把访问令牌和刷新令牌写入浏览器存储。确需跨页面刷新保留会话时，产品可显式注入 `createBrowserSessionStorage()`，但必须先完成 XSS 威胁建模、严格 CSP 与退出清理；更高安全级别的部署应由服务端使用 `HttpOnly`、`Secure`、`SameSite` Cookie，并配套 CSRF 防护。

```ts
let useSession: ReturnType<typeof createPlatformSessionStore>;
const platform = createPlatformClient({
  baseUrl: "/api",
  tokenProvider: () => useSession().accessToken,
  onUnauthorized: () => useSession().handleUnauthorized(),
});
useSession = createPlatformSessionStore({
  client: platform,
  isSessionExpired: (session) => (session.expiresAtMs ?? 0) <= Date.now(),
  onRefreshFailure: () => router.replace({ name: "login" }),
});
```

跨窗口传输是可选能力。`createWindowSessionTransport` 默认只允许 HTTPS 精确 Origin；非 HTTPS 场景必须由消费端提供 `PlatformPublicKeyEnvelopeStrategy`。基础包不保存浏览器对称密钥、pepper 或派生材料。

## 许可证

源码和四个软件包均使用 [Apache License 2.0](LICENSE)。许可证允许使用、修改和分发，
保留版权与许可证声明即可；商标、部署凭据、真实业务数据和第三方素材不因此获得授权。

## 版本与发布

1. 在变更分支执行 `vp run changeset`，描述受影响的软件包及版本级别。
2. 通过功能分支向受保护的 `main` 提交 Pull Request，并通过全部必需状态检查；人工审核归属遵循 `AGENTS.md` 与全仓库 CODEOWNERS。
3. 在 GitHub Actions 手工运行“发布软件包”；`latest` 只能从 `main` 发布。
4. 发布任务绑定 `package-release` 环境，并在 npm 软件包设置中将本仓库工作流登记为可信发布者；工作流触发与 npm 信任配置分别核验。

软件包发布到公共 npm Registry，作用域为 `@guanxiangkai`，并声明 `access: public`。工作流使用
GitHub Actions OIDC 可信发布，不保存长期 npm Token，也不会在普通 push 时自动发布。首次发布或
可信发布者配置变更必须在 npm 官方界面完成最小权限校验。
