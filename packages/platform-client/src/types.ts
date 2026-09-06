import type { AccessTokenPlacement } from "./token.js";

/** 同步或异步返回值。 */
export type MaybePromise<T> = T | Promise<T>;

/** 平台 API 的标准响应包装。 */
export interface ApiEnvelope<T> {
  /** 业务状态码。 */
  code: number;
  /** 响应数据。 */
  data: T;
  /** 响应说明；标准平台响应必须始终提供该字段。 */
  message: string;
}

/** 查询参数支持的标量值。 */
export type QueryScalar = string | number | boolean | null | undefined;

/** 单个查询参数，可重复传递同名值。 */
export type QueryValue = QueryScalar | readonly QueryScalar[];

/** 平台请求的响应解析方式。 */
export type ResponseType = "json" | "text" | "blob" | "arrayBuffer";

/** 可直接交给 Fetch 的请求体。 */
export type PlatformBody = BodyInit | null | undefined;

/** 请求发出前可调整请求头的上下文。 */
export interface PlatformRequestContext {
  /** 调用方传入的网关内路径。 */
  readonly path: string;
  /** 已解析的完整请求地址。 */
  readonly url: string;
  /** 本次请求的可变请求头。 */
  readonly headers: Headers;
  /** 已完成 JSON 分流后的请求体。 */
  readonly body: PlatformBody;
  /** Fetch 请求初始化参数。 */
  readonly init: RequestInit;
}

/** 对产品自定义请求头、签名或追踪信息的扩展钩子。 */
export type PlatformRequestTransformer = (context: PlatformRequestContext) => MaybePromise<void>;

/** 响应解码完成后的上下文。 */
export interface PlatformResponseContext {
  /** 调用方传入的网关内路径。 */
  readonly path: string;
  /** 请求的完整地址。 */
  readonly url: string;
  /** 服务端原始响应。 */
  readonly response: Response;
  /** 响应解析方式。 */
  readonly responseType: ResponseType;
  /** 按 responseType 解码后的负载。 */
  readonly payload: unknown;
}

/** 对产品自定义响应信封、加密负载或协议字段的扩展钩子。 */
export type PlatformResponseTransformer = (
  context: PlatformResponseContext,
) => MaybePromise<unknown>;

/** 收到 401 后由产品决定是否已恢复会话并允许重试。 */
export type PlatformUnauthorizedHandler = (
  context: PlatformResponseContext,
) => MaybePromise<boolean>;

/** 单次平台请求参数。 */
export interface PlatformRequestOptions {
  /** HTTP 方法。 */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** URL 查询参数。 */
  query?: Readonly<Record<string, QueryValue>>;
  /** 追加或覆盖的请求头。 */
  headers?: HeadersInit;
  /** 请求体；Fetch BodyInit 原样发送，其他可 JSON 序列化值自动编码。 */
  body?: unknown;
  /** 外部取消信号。 */
  signal?: AbortSignal;
  /** 超时时间，单位毫秒。 */
  timeoutMs?: number;
  /** 响应解析方式，默认为 JSON。 */
  responseType?: ResponseType;
  /** Fetch 凭据策略，默认为 same-origin。 */
  credentials?: RequestCredentials;
  /** 覆盖本次请求的访问令牌；传入 null 时显式禁止发送令牌。 */
  accessToken?: string | null;
  /** 本次请求的请求转换钩子，在默认认证头写入后执行。 */
  transformRequest?: PlatformRequestTransformer;
  /** 本次请求的响应转换钩子，在通用响应解包前执行。 */
  transformResponse?: PlatformResponseTransformer;
  /** 是否允许 401 恢复策略重试本次请求，默认允许。 */
  retryUnauthorized?: boolean;
}

/** 可由产品现有鉴权、加密和错误恢复层实现的平台请求传输契约。 */
export interface PlatformRequestClient {
  request<T>(path: string, options?: PlatformRequestOptions): Promise<T>;
}

/** 平台 HTTP 客户端初始化参数。 */
export interface PlatformClientOptions {
  /** 网关基础地址，可以是绝对地址或浏览器相对地址；单个端点不得绕过该网关。 */
  baseUrl: string;
  /** 自定义 Fetch 实现，主要用于 SSR 或测试。 */
  fetch?: typeof globalThis.fetch;
  /** 获取当前访问令牌，不返回令牌时不发送 Authorization。 */
  tokenProvider?: () => MaybePromise<string | null | undefined>;
  /**
   * 显式指定时，除 Authorization 外额外将访问令牌写入 query 或 JSON 请求体顶层 token。
   *
   * query 参数会出现在 URL、浏览器历史和代理日志中；仅应在 TLS 保护且服务端协议明确要求时使用。
   */
  accessTokenPlacement?: AccessTokenPlacement;
  /** 获取当前租户标识，不返回标识时不发送 X-Tenant-Id。 */
  tenantProvider?: () => MaybePromise<string | number | null | undefined>;
  /** 默认超时时间，单位毫秒。 */
  defaultTimeoutMs?: number;
  /** 每次请求都会合并的默认请求头。 */
  defaultHeaders?: HeadersInit;
  /** 所有请求共享的请求转换钩子。 */
  transformRequest?: PlatformRequestTransformer;
  /** 所有请求共享的响应转换钩子。 */
  transformResponse?: PlatformResponseTransformer;
  /** 服务端返回 401 时决定是否已恢复会话；返回 true 时仅重试一次原请求。 */
  onUnauthorized?: PlatformUnauthorizedHandler;
}
