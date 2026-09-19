# AI UI

AI UI 是面向通用 AI 应用的前端基础组件库。仓库采用 pnpm monorepo：源码、质量门禁和发布流程统一维护，四个软件包保持独立版本和独立发布。本仓库不面向任何单一业务系统定制，文档、示例、类型和 API 只描述可复用的公开契约。

## 软件包

| 软件包                          | 职责                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `@guanxiangkai/platform-client` | 通用 HTTP、租户、认证、系统、Agent 和调度契约           |
| `@guanxiangkai/vue-platform`    | Vue/Pinia/Router 的平台注入、会话状态和权限守卫         |
| `@guanxiangkai/ui`              | 通用登录、异常、系统管理、Agent、定时任务页面和主题令牌 |
| `@guanxiangkai/build-config`    | Vite 应用与库构建、声明生成及可选业务制品安全配置       |

应用业务页面、业务接口模型和应用路由继续留在各自仓库；租户、组织、账户、角色、菜单、字典、区域、导入模板、消息、天气、系统设置、审计日志、Agent 和定时任务等通用页面只在本仓库实现一次。消费端通过客户端、权限集合、路由注册表和 CSS 变量注入运行上下文与视觉主题。

业务项目可通过 `@guanxiangkai/build-config` 的可选插件配置最终制品混淆与签名，参见
[业务应用制品安全](packages/build-config/README.md)。基础库自身的开源发布方式保持不变。

共享页面中的可重复查询通过 `useLatestRequest` 提交状态：快速切换页签、分页或详情对象时，
过期响应及其错误不会覆盖最新页面状态；组件卸载会自动使在途请求失效。
该控制器将 Vue 生命周期编排与 `RequestCommitPolicy` 策略分离，默认使用
`LatestRequestPolicy` 的“最后发起者获胜”规则；客户端侧则以 `PlatformRequestClient`
作为传输适配接口，由 `PlatformClientFactory` 统一创建认证、系统、Agent 和调度外观。

## 技术基线

- Node.js 24.21.0 LTS
- pnpm 11.27.0
- TypeScript 7.0.2（根工具链及纯 TS 包）；Vue UI 包使用 TypeScript 6.0.3 编译器 API
- Vue 3.5、Pinia 4、Vue Router 5
- Vite+ 0.3.2（Vite 8.3、Vitest 4.1、Oxlint、Oxfmt、tsdown、Vite Task）
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

### 依赖与架构选择依据（2026-09-18）

本次按 npm 官方元数据、维护者发布说明和兼容性核验版本，并保留 24 小时依赖隔离。
“上游最新”记录的是核验时状态，实际安装版本以 catalog 与锁文件为准。

| 依赖                                                                         | 本次版本                                                | 选择依据                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Node.js / Node 类型                                                          | 24.21.0 / 24.13.5                                       | 跟进 Node 24 LTS，保持类型代际一致；不切换非 LTS 的 Node 26                        |
| pnpm                                                                         | 11.27.0                                                 | 采用 11.x 当前稳定版，包含 workspace peer 与安装修复；12.4.2 的跨代迁移单独评估    |
| Vite+ / 内置 Vite core                                                       | 0.3.2 / 0.3.2                                           | 同步升级；0.3.3 发布未满 24 小时，暂不采用                                         |
| Vue / SFC 编译器                                                             | 3.5.43 / 3.5.43                                         | 同步升级补丁，避免运行时与编译器错配                                               |
| Vue 插件 / Test Utils / Happy DOM                                            | 6.0.9 / 2.5.1 / 20.14.5                                 | 采用已过隔离期的修复版本                                                           |
| Changesets                                                                   | 3.0.3                                                   | 修复更新内部依赖时截断 semver 范围的问题                                           |
| TypeScript / Vitest                                                          | 7.0.2 / 4.1.11                                          | 默认使用 TypeScript 7，测试继续使用 Vite+ 内置版本                                 |
| Vue UI 包的 TypeScript                                                       | 6.0.3                                                   | 通过 `catalog:vueCompiler` 固定 SFC 宏解析和声明生成所需的 JavaScript Compiler API |
| Element Plus                                                                 | 2.14.5                                                  | 2.14.6 发布未满 24 小时，暂不采用                                                  |
| Pinia / Router / language-core / unplugin-dts / publint / icons / obfuscator | 4.0.3 / 5.3.1 / 3.3.11 / 1.1.0 / 0.3.24 / 2.3.2 / 5.7.0 | 核验时已是对应包的稳定最新版本                                                     |

- [Node 24.21.0 官方博客](https://nodejs.org/en/blog/release/v24.21.0)列出 OpenSSL、Undici 与根证书更新；
  [pnpm 11.27.0 发布说明](https://github.com/pnpm/pnpm/releases/tag/v11.27.0)提供当前代际的安装与 workspace 修复。
- [Vite+ 0.3.2 发布说明](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.3.2)确认内置 Vitest 仍为 `4.1.11`；
  按 [Vite 迁移指南](https://vite.dev/guide/migration)使用 `rolldownOptions`，移除 UI 构建中已弃用的 `rollupOptions`。
- [TypeScript 7 官方博客](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)说明 Vue/Volar
  仍依赖 TypeScript 6 的 JavaScript Compiler API。默认 catalog 使用 `7.0.2`，供根工具链与
  `build-config`、`platform-client`、`vue-platform` 使用；`packages/ui` 通过命名 catalog
  `vueCompiler` 使用 `6.0.3`，同时支持导入 Props 类型的 SFC 宏解析和 Vue 声明生成。
  构建、检查、测试仍统一通过 Vite+ 执行。Vite+ 对 TypeScript 7 的声明后端仍提示实验性 API，
  升级时须验证完整门禁及生成声明的兼容性。
- [Vue 更新记录](https://github.com/vuejs/core/blob/v3.5.43/CHANGELOG.md)、
  [Vue Test Utils 发布说明](https://github.com/vuejs/test-utils/releases/tag/v2.5.1)和
  [Changesets 修复](https://github.com/changesets/changesets/releases/tag/%40changesets%2Fcli%403.0.3)作为补丁升级依据。
- 依赖审计发现原 `nanoid 3.3.17` 固定版本命中
  [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)，更新为同代修复版 `3.3.18`；
  公告涉及自定义生成器在长度为零时无限循环，未据此推断业务应用存在可利用入口。
- 声明插件按[维护者建议](https://github.com/qmhc/unplugin-dts/tree/main/packages/vite-plugin-dts)
  从 `vite-plugin-dts` 切到 `unplugin-dts`，显式使用 Vue processor。
- 评估了 VueUse 与 TanStack Query：目前没有跨页面查询缓存、失效广播或离线持久化需求，现有 latest-request
  策略已覆盖页面查询的直接需求，保留小型 composable；以后出现共享缓存需求时再引入 QueryClient，避免双重查询状态。
- 制品摘要按 Node 官方 [增量 Hash](https://nodejs.org/docs/latest-v24.x/api/crypto.html#hashupdatedata-inputencoding)
  使用有界分块读取；部署验签使用独立 `@guanxiangkai/build-config/artifact` 入口，运行时不加载 Vite 或混淆器。
  [Sigstore](https://docs.sigstore.dev/about/overview/)适合需要 CI 身份、透明日志与跨组织验证的场景，
  当前固定公钥部署流程保留 Ed25519 清单，不新增在线签名服务。
- [社区关于 Vite 库混淆的讨论](https://stackoverflow.com/questions/72755903/how-to-obfuscate-code-in-vites-library-mode)
  仅作为场景线索；具体 hook 选择和资源占位符兼容性以当前工具链的真实构建测试为准，不照搬旧版插件配置。

具体依赖版本以 `pnpm-workspace.yaml` 和锁文件为准。升级必须通过真实构建、类型与行为测试，
不以版本号更大或第三方库更流行为采用理由。

浏览器会话通过单次到期唤醒更新 `isAuthenticated`，退出、替换和 Store 销毁会清理计时器；
服务端渲染不创建计时器。到期只改变认证状态，保留刷新令牌用于显式刷新；自定义到期规则所需的外部时钟应使用响应式来源。
通过 `replace()` 注入的会话与登录、刷新结果采用相同的到期时间规范化规则，缺少 `expiresAtMs` 时按 `expiresIn` 秒计算。

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

### 类型与树契约

`platform-client` 提供 `PlatformPage`、`PlatformIdentity`、`PlatformCreatedFields`、
`PlatformAuditFields` 和 `PlatformTreeNode` 供 DTO 通过 TypeScript 接口组合；系统分页在此基础上
保留 `pages`，不会要求 DTO 具备运行时基类。`walkTree`、`flattenTree`、`mapTree` 与 `filterTree` 接受普通
树形 DTO，使用迭代遍历、不改写输入，并在检测到循环引用时抛出 `树结构存在循环引用`。筛选结果保留
命中节点及其祖先，且只在返回结果中写入筛选后的 `children`。

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
同一传输器按调用顺序发送调用时固定的载荷，单个订阅按消息到达顺序解封和通知；退订后不再通知在途或排队消息，单条失败不会阻塞后续消息。

## 许可证

源码和四个软件包均使用 [Apache License 2.0](LICENSE)。许可证允许使用、修改和分发，
保留版权与许可证声明即可；商标、部署凭据、真实业务数据和第三方素材不因此获得授权。

## 版本与发布

1. 在变更分支执行 `vp run changeset`，描述受影响的软件包及版本级别。
   发布准备使用 `pnpm run version-packages`：由 Changesets 生成版本和变更记录，再由 `vp fmt` 统一格式化；Changesets 的内置格式化关闭，避免调用 Vite+ 的 IDE 专用 `oxfmt` 包装器。
2. 通过功能分支向受保护的 `main` 提交 Pull Request，并通过全部必需状态检查；人工审核归属遵循 `AGENTS.md` 与全仓库 CODEOWNERS。
3. 在 GitHub Actions 手工运行“发布软件包”；`latest` 只能从 `main` 发布。
4. 发布任务绑定 `package-release` 环境，并在 npm 软件包设置中将本仓库工作流登记为可信发布者；工作流触发与 npm 信任配置分别核验。

软件包发布到公共 npm Registry，作用域为 `@guanxiangkai`，并声明 `access: public`。工作流使用
GitHub Actions OIDC 可信发布，不保存长期 npm Token，也不会在普通 push 时自动发布。首次发布或
可信发布者配置变更必须在 npm 官方界面完成最小权限校验。
