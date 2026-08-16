# AI UI

AI UI 是面向通用 AI 应用的前端基础组件库。仓库采用 pnpm monorepo：源码、质量门禁和发布流程统一维护，四个软件包保持独立版本和独立发布。本仓库不面向任何单一业务系统定制，文档、示例、类型和 API 只描述可复用的公开契约。

## 软件包

| 软件包                          | 职责                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `@guanxiangkai/platform-client` | 通用 HTTP、租户、认证、系统、Agent 和调度契约                    |
| `@guanxiangkai/vue-platform`    | Vue/Pinia/Router 的平台注入、会话状态和权限守卫                  |
| `@guanxiangkai/ui`              | 通用登录、异常、系统管理、Agent、定时任务页面和主题令牌          |
| `@guanxiangkai/build-config`    | Vite 库构建与声明文件生成配置                                    |

应用业务页面、业务接口模型和应用路由继续留在各自仓库；租户、组织、账户、角色、菜单、字典、区域、导入模板、消息、天气、系统设置、审计日志、Agent 和定时任务等通用页面只在本仓库实现一次。消费端通过客户端、权限集合、路由注册表和 CSS 变量注入运行上下文与视觉主题。

共享页面中的可重复查询通过 `useLatestRequest` 提交状态：快速切换页签、分页或详情对象时，
过期响应及其错误不会覆盖最新页面状态；组件卸载会自动使在途请求失效。
该控制器将 Vue 生命周期编排与 `RequestCommitPolicy` 策略分离，默认使用
`LatestRequestPolicy` 的“最后发起者获胜”规则；客户端侧则以 `PlatformRequestClient`
作为传输适配接口，由 `PlatformClientFactory` 统一创建认证、系统、Agent 和调度外观。

## 技术基线

- Node.js 24 LTS
- pnpm 11.21.0
- TypeScript 6（与当前 Vite+、Vue 工具链匹配的稳定代际）
- Vue 3.5、Pinia 4、Vue Router 5
- Vite+ 0.2.8（Vite 8、Vitest 4、Oxlint、Oxfmt、tsdown、Vite Task）
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

`vp run ready` 使用 Vite+ 依次执行依赖拓扑构建、Oxfmt、Oxlint、类型检查、Vitest 和发布元数据检查。

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

当 HTTP 收到 401，`onUnauthorized` 返回 `true` 时客户端才会重新读取 Token 并仅重试一次。Vue 应用可用 `createPlatformSessionStore` 提供 `handleUnauthorized`：它会去重并发刷新、校验调用方提供的会话过期规则，并通过 `onRefreshFailure` 把失败导航或提示交给消费端实现。

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
2. 通过功能分支向 `main` 提交 Pull Request 并通过 CI；预发布可使用独立的 `test` 分支。
3. 在 GitHub Actions 手工运行“发布软件包”；`latest` 只能从 `main` 发布，`next` 只能从 `test` 发布。
4. 发布环境 `package-release` 必须配置人工审批，工作流使用仓库临时 `GITHUB_TOKEN` 写入 GitHub Packages。

软件包发布到 `https://npm.pkg.github.com`，作用域为仓库所有者 `@guanxiangkai`，并声明
`access: public`。GitHub Package 的实际可见性仍必须在首次发布和仓库迁移后核验；仓库不保存
长期发布凭据，也不会在普通 push 时自动发布。

GitHub npm registry 的客户端认证要求以 GitHub 当前规则为准；需要 Token 时只在用户级 npm
配置或 CI Secret 中提供 `NODE_AUTH_TOKEN`，不得把 Token 写入本仓库的 `.npmrc`。

更完整的边界和依赖方向见 [架构说明](docs/architecture.md)。
