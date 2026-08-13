import type { AuthSession } from "@guanxiangkai/platform-client";

/** 认证会话持久化接口。 */
export interface PlatformSessionStorage<TSession> {
  /** 读取已保存会话。 */
  read(): TSession | null;
  /** 原子覆盖当前会话。 */
  write(session: TSession): void;
  /** 删除当前会话。 */
  clear(): void;
}

/** 把不可信的持久化值转换为已验证会话的适配器。 */
export interface PlatformSessionCodec<TSession> {
  /** 校验并解码存储内容；无法确认时返回 null。 */
  decode(value: unknown): TSession | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.tokenType === "string" &&
    typeof value.expiresIn === "number" &&
    value.expiresIn >= 0 &&
    typeof value.username === "string" &&
    typeof value.name === "string" &&
    typeof value.superAdmin === "boolean" &&
    Array.isArray(value.roleCodes) &&
    Array.isArray(value.postCodes) &&
    Array.isArray(value.permissions)
  );
}

/**
 * 创建浏览器 sessionStorage 会话适配器。
 *
 * <p>该适配器会把访问令牌和刷新令牌持久化到 JavaScript 可读存储。基础 Store 不会默认启用；
 * 产品必须在完成 XSS 防护、CSP 与退出清理设计后显式选择。</p>
 *
 * @param key 存储键，默认使用平台统一键。
 * @returns SSR 环境下安全退化为空会话的存储适配器。
 */
export function createBrowserSessionStorage(
  key = "guanxiangkai.platform.session",
): PlatformSessionStorage<AuthSession> {
  return createBrowserSessionStorageWithCodec({
    key,
    codec: { decode: (value) => (isAuthSession(value) ? value : null) },
  });
}

/**
 * 创建带会话校验器的浏览器 sessionStorage 适配器。
 *
 * @param options 存储键和产品定义的安全解码器。
 */
export function createBrowserSessionStorageWithCodec<TSession>(options: {
  /** 浏览器 sessionStorage 键。 */
  key: string;
  /** 用于拒绝篡改或过期结构的解码器。 */
  codec: PlatformSessionCodec<TSession>;
}): PlatformSessionStorage<TSession> {
  const { key, codec } = options;
  const browserStorage = typeof window === "undefined" ? undefined : window.sessionStorage;

  return {
    read() {
      const rawValue = browserStorage?.getItem(key);
      if (rawValue === null || rawValue === undefined) return null;

      try {
        const parsed = JSON.parse(rawValue) as unknown;
        const session = codec.decode(parsed);
        if (session !== null) return session;
      } catch {
        // JSON 解析失败时删除不可用会话，不将异常存储内容作为认证依据。
      }
      browserStorage?.removeItem(key);
      return null;
    },
    write(session) {
      browserStorage?.setItem(key, JSON.stringify(session));
    },
    clear() {
      browserStorage?.removeItem(key);
    },
  };
}

/** 创建仅驻留内存的会话存储，适用于 SSR 和测试。 */
export function createMemorySessionStorage(
  initialSession: AuthSession | null = null,
): PlatformSessionStorage<AuthSession> {
  return createMemorySessionStorageWithValue(initialSession);
}

/** 创建类型化的仅内存会话存储，适用于 SSR、测试或短生命周期会话。 */
export function createMemorySessionStorageWithValue<TSession>(
  initialSession: TSession | null = null,
): PlatformSessionStorage<TSession> {
  let currentSession = initialSession;
  return {
    read: () => currentSession,
    write: (session) => {
      currentSession = session;
    },
    clear: () => {
      currentSession = null;
    },
  };
}
