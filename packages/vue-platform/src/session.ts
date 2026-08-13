import type { AuthSession, LoginRequest, PlatformClient } from "@guanxiangkai/platform-client";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createMemorySessionStorage, type PlatformSessionStorage } from "./storage.js";

/** 会话 Store 工厂参数。 */
export interface PlatformSessionStoreOptions {
  /** 当前应用的平台客户端。 */
  client: PlatformClient;
  /** Store 唯一标识；同一应用存在多套平台上下文时必须显式区分。 */
  id?: string;
  /**
   * 会话存储策略；默认仅驻留内存。产品只有在完成 XSS 威胁建模后才应显式选择浏览器存储。
   */
  storage?: PlatformSessionStorage<AuthSession>;
  /** 判断会话是否已过期；过期会话不会作为已认证身份保留。 */
  isSessionExpired?: (session: AuthSession) => boolean;
  /** 刷新失败后的产品回调，例如跳转登录页或展示提示。 */
  onRefreshFailure?: (error: unknown) => void | Promise<void>;
}

/**
 * 创建绑定到指定平台客户端的 Pinia 会话 Store。
 *
 * @param options 客户端、Store 标识和存储策略。
 * @returns 可在 Pinia 上实例化的 Store 定义。
 */
export function createPlatformSessionStore(options: PlatformSessionStoreOptions) {
  const isSessionExpired =
    options.isSessionExpired ??
    ((session: AuthSession) =>
      session.expiresAtMs !== undefined && session.expiresAtMs <= Date.now());

  function normalizeSession(nextSession: AuthSession): AuthSession {
    if (nextSession.expiresAtMs !== undefined) return nextSession;
    return { ...nextSession, expiresAtMs: Date.now() + nextSession.expiresIn * 1_000 };
  }

  return defineStore(options.id ?? "platform-session", () => {
    // 默认存储必须属于单个 Pinia Store 实例，避免 SSR 请求或多个应用实例之间共享会话。
    const storage = options.storage ?? createMemorySessionStorage();
    const persistedSession = storage.read();
    const initialSession = persistedSession === null ? null : normalizeSession(persistedSession);
    const session = ref<AuthSession | null>(
      initialSession !== null && !isSessionExpired(initialSession) ? initialSession : null,
    );
    if (persistedSession !== null && session.value === null) storage.clear();
    else if (session.value !== null && session.value !== persistedSession)
      storage.write(session.value);
    const pending = ref(false);
    const isAuthenticated = computed(
      () =>
        (session.value?.accessToken.length ?? 0) > 0 &&
        (session.value === null || !isSessionExpired(session.value)),
    );
    const accessToken = computed(() => session.value?.accessToken ?? null);
    let refreshOperation: Promise<AuthSession> | null = null;

    function replace(nextSession: AuthSession | null): void {
      session.value = nextSession;
      if (nextSession === null) storage.clear();
      else storage.write(nextSession);
    }

    /** 使用平台认证接口登录并保存新会话。 */
    async function login(request: LoginRequest): Promise<AuthSession> {
      pending.value = true;
      try {
        const nextSession = normalizeSession(await options.client.auth.login(request));
        replace(nextSession);
        return nextSession;
      } finally {
        pending.value = false;
      }
    }

    /** 使用当前刷新令牌更新并保存会话。 */
    async function refresh(): Promise<AuthSession> {
      if (refreshOperation !== null) return refreshOperation;

      const refreshToken = session.value?.refreshToken;
      if (refreshToken === undefined || refreshToken.length === 0) {
        throw new Error("当前会话没有可用的刷新令牌");
      }

      pending.value = true;
      refreshOperation = options.client.auth
        .refresh(refreshToken)
        .then((receivedSession) => {
          const nextSession = normalizeSession(receivedSession);
          if (isSessionExpired(nextSession)) {
            throw new Error("刷新接口返回的会话已过期");
          }
          replace(nextSession);
          return nextSession;
        })
        .catch(async (error: unknown) => {
          await options.onRefreshFailure?.(error);
          throw error;
        })
        .finally(() => {
          pending.value = false;
          refreshOperation = null;
        });
      return refreshOperation;
    }

    /**
     * 处理一次未授权响应；并发 401 会复用同一刷新请求。
     *
     * @returns 会话刷新成功时返回 true，供 HTTP 客户端仅重试一次原请求。
     */
    async function handleUnauthorized(): Promise<boolean> {
      try {
        await refresh();
        return true;
      } catch {
        replace(null);
        return false;
      }
    }

    /** 注销服务端会话；即使服务端失败也清除本地身份。 */
    async function logout(): Promise<void> {
      pending.value = true;
      try {
        if (session.value !== null) await options.client.auth.logout();
      } finally {
        replace(null);
        pending.value = false;
      }
    }

    return {
      session,
      pending,
      isAuthenticated,
      accessToken,
      login,
      refresh,
      handleUnauthorized,
      logout,
      replace,
    };
  });
}
