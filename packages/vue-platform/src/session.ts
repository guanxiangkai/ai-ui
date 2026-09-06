import type { AuthSession, LoginRequest, PlatformClient } from "@guanxiangkai/platform-client";
import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";

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
  /**
   * 判断会话是否已过期；初始化和认证状态计算会据此拒绝过期身份。Store 仅在浏览器按 expiresAtMs
   * 单次唤醒以重新计算认证状态，SSR 仅在渲染时计算；两者都不会清除会话或自动登出。自定义实现若依赖外部时钟，
   * 该时钟应是 Vue 响应式依赖。
   */
  isSessionExpired?: (session: AuthSession) => boolean;
  /** 刷新当前会话失败后的产品回调，例如跳转登录页或展示提示。已被替代的刷新不会调用。 */
  onRefreshFailure?: (error: unknown) => void | Promise<void>;
}

/**
 * 创建绑定到指定平台客户端的 Pinia 会话 Store。
 *
 * @param options 客户端、Store 标识和存储策略。
 * @returns 可在 Pinia 上实例化的 Store 定义。
 */
export function createPlatformSessionStore(options: PlatformSessionStoreOptions) {
  const maxTimeoutMs = 2_147_483_647;
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
    const pendingOperations = ref(0);
    const pending = computed(() => pendingOperations.value > 0);
    const expiryTick = ref(0);
    const isAuthenticated = computed(() => {
      void expiryTick.value;
      return (
        (session.value?.accessToken.length ?? 0) > 0 &&
        (session.value === null || !isSessionExpired(session.value))
      );
    });
    const accessToken = computed(() => session.value?.accessToken ?? null);
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    function clearExpiryTimer(): void {
      if (expiryTimer === undefined) return;
      clearTimeout(expiryTimer);
      expiryTimer = undefined;
    }

    function scheduleExpiryTimer(nextSession: AuthSession | null): void {
      clearExpiryTimer();
      if (typeof window === "undefined") return;
      const expiresAtMs = nextSession?.expiresAtMs;
      if (expiresAtMs === undefined) return;

      const remainingMs = expiresAtMs - Date.now();
      if (remainingMs <= 0) {
        expiryTick.value += 1;
        return;
      }

      expiryTimer = setTimeout(
        () => {
          expiryTimer = undefined;
          if (session.value !== nextSession) return;
          if (expiresAtMs > Date.now()) {
            scheduleExpiryTimer(nextSession);
            return;
          }
          expiryTick.value += 1;
        },
        Math.min(remainingMs, maxTimeoutMs),
      );
    }

    watch(session, scheduleExpiryTimer, { immediate: true, flush: "sync" });
    onScopeDispose(clearExpiryTimer);

    // 任何会话替换都会推进代次，旧异步操作只能返回自身结果，不能再改变当前身份。
    let sessionGeneration = 0;
    let activeLoginGeneration: number | null = null;
    let refreshOperation: { generation: number; promise: Promise<AuthSession> } | null = null;

    function beginPending(): () => void {
      pendingOperations.value += 1;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        pendingOperations.value -= 1;
      };
    }

    function advanceSessionGeneration(): number {
      sessionGeneration += 1;
      return sessionGeneration;
    }

    function isCurrentLoginPending(): boolean {
      return activeLoginGeneration === sessionGeneration;
    }

    /** 替换当前会话并使此前开始的登录、刷新或注销结果失效。 */
    function replace(nextSession: AuthSession | null): void {
      advanceSessionGeneration();
      if (nextSession === null) storage.clear();
      else storage.write(nextSession);
      session.value = nextSession;
    }

    /** 使用平台认证接口登录并保存新会话。 */
    async function login(request: LoginRequest): Promise<AuthSession> {
      const generation = advanceSessionGeneration();
      activeLoginGeneration = generation;
      const finishPending = beginPending();
      try {
        const nextSession = normalizeSession(await options.client.auth.login(request));
        if (generation === sessionGeneration) replace(nextSession);
        return nextSession;
      } finally {
        if (activeLoginGeneration === generation) activeLoginGeneration = null;
        finishPending();
      }
    }

    /** 使用当前刷新令牌更新并保存会话。 */
    async function refresh(): Promise<AuthSession> {
      if (isCurrentLoginPending()) {
        throw new Error("当前会话正在登录，不能刷新");
      }
      const generation = sessionGeneration;
      if (refreshOperation?.generation === generation) return refreshOperation.promise;

      const refreshToken = session.value?.refreshToken;
      if (refreshToken === undefined || refreshToken.length === 0) {
        throw new Error("当前会话没有可用的刷新令牌");
      }

      const finishPending = beginPending();
      const operation = (async () => {
        try {
          const receivedSession = await options.client.auth.refresh(refreshToken);
          if (generation !== sessionGeneration) {
            throw new Error("当前会话已被替代，忽略过期刷新结果");
          }
          const nextSession = normalizeSession(receivedSession);
          if (isSessionExpired(nextSession)) {
            throw new Error("刷新接口返回的会话已过期");
          }
          replace(nextSession);
          return nextSession;
        } catch (error) {
          if (generation === sessionGeneration) await options.onRefreshFailure?.(error);
          throw error;
        } finally {
          finishPending();
        }
      })();
      const currentOperation = { generation, promise: operation };
      refreshOperation = currentOperation;
      void operation.then(
        () => {
          if (refreshOperation === currentOperation) refreshOperation = null;
        },
        () => {
          if (refreshOperation === currentOperation) refreshOperation = null;
        },
      );
      return operation;
    }

    /**
     * 处理一次未授权响应；并发 401 会复用同一刷新请求。
     *
     * @returns 会话刷新成功时返回 true，供 HTTP 客户端仅重试一次原请求。
     */
    async function handleUnauthorized(): Promise<boolean> {
      if (isCurrentLoginPending()) return false;
      const generation = sessionGeneration;
      try {
        await refresh();
        return sessionGeneration === generation + 1;
      } catch {
        if (!isCurrentLoginPending() && generation === sessionGeneration) replace(null);
        return false;
      }
    }

    /** 注销时立即清除本地身份；服务端请求结束不会影响之后建立的新会话。 */
    async function logout(): Promise<void> {
      const sessionToLogout = session.value;
      replace(null);
      if (sessionToLogout === null) return;

      const finishPending = beginPending();
      try {
        await options.client.auth.logout(sessionToLogout.accessToken);
      } finally {
        finishPending();
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
