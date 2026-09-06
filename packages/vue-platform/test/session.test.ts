import type { AuthSession, PlatformClient } from "@guanxiangkai/platform-client";
import { createPinia, setActivePinia } from "pinia";
import { watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMemorySessionStorage,
  createPlatformSessionStore,
  hasPermissions,
} from "../src/index.js";

const session: AuthSession = {
  accessToken: "access",
  refreshToken: "refresh",
  tokenType: "Bearer",
  expiresIn: 3600,
  expiresAtMs: Date.now() + 3_600_000,
  userId: "user-1",
  username: "tester",
  name: "测试用户",
  superAdmin: false,
  roleCodes: [],
  postCodes: [],
  permissions: ["file:read", "file:write"],
  deptIds: [],
};

function createSession(accessToken: string, refreshToken: string): AuthSession {
  return { ...session, accessToken, refreshToken };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("平台会话 Store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("登录后同时更新 Store 和存储", async () => {
    const storage = createMemorySessionStorage();
    const client = {
      auth: {
        login: vi.fn().mockResolvedValue(session),
        refresh: vi.fn(),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const useSession = createPlatformSessionStore({ client, storage, id: "session-test" });
    const store = useSession();

    await store.login({ username: "tester", password: "secret" });

    expect(store.session).toEqual(session);
    expect(store.isAuthenticated).toBe(true);
    expect(storage.read()).toEqual(session);
  });

  it("并发未授权只发起一次刷新，并在失败时清除会话", async () => {
    const storage = createMemorySessionStorage(session);
    const refresh = vi.fn().mockRejectedValue(new Error("刷新令牌失效"));
    const onRefreshFailure = vi.fn();
    const client = {
      auth: { login: vi.fn(), refresh, logout: vi.fn() },
      http: {},
    } as unknown as PlatformClient;
    const useSession = createPlatformSessionStore({
      client,
      storage,
      id: "refresh-test",
      onRefreshFailure,
    });
    const store = useSession();

    await expect(
      Promise.all([store.handleUnauthorized(), store.handleUnauthorized()]),
    ).resolves.toEqual([false, false]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onRefreshFailure).toHaveBeenCalledOnce();
    expect(store.session).toBeNull();
    expect(storage.read()).toBeNull();
  });

  it("初始化时拒绝已过期会话", () => {
    const storage = createMemorySessionStorage(session);
    const client = { auth: {}, http: {} } as unknown as PlatformClient;
    const useSession = createPlatformSessionStore({
      client,
      storage,
      id: "expired-test",
      isSessionExpired: () => true,
    });

    const store = useSession();
    expect(store.session).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(storage.read()).toBeNull();
  });

  it("会话到期时重新计算认证状态，但保留会话以允许刷新", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    vi.setSystemTime(0);
    const expiringSession = { ...session, expiresAtMs: 1_000 };
    const client = { auth: {}, http: {} } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage(expiringSession),
      id: "expiry-state-test",
    })();

    expect(store.isAuthenticated).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(store.isAuthenticated).toBe(false);
    expect(store.session).toEqual(expiringSession);
  });

  it("替换会话会清除旧到期定时器", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    vi.setSystemTime(0);
    const client = { auth: {}, http: {} } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage({ ...session, expiresAtMs: 1_000 }),
      id: "expiry-replace-test",
    })();

    vi.advanceTimersByTime(500);
    store.replace({ ...session, accessToken: "replacement", expiresAtMs: 5_000 });
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(store.isAuthenticated).toBe(true);
    vi.advanceTimersByTime(4_000);
    expect(store.isAuthenticated).toBe(false);
  });

  it("销毁 Store 时清除到期定时器", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    vi.setSystemTime(0);
    const client = { auth: {}, http: {} } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage({ ...session, expiresAtMs: 1_000 }),
      id: "expiry-dispose-test",
    })();

    expect(vi.getTimerCount()).toBe(1);
    store.$dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("SSR 创建会话 Store 时不保留到期定时器", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", undefined);
    vi.setSystemTime(0);
    const client = { auth: {}, http: {} } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage({ ...session, expiresAtMs: 1_000 }),
      id: "expiry-ssr-test",
    })();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(store.isAuthenticated).toBe(false);
  });

  it("默认内存会话按 Pinia 实例隔离", async () => {
    const client = {
      auth: {
        login: vi.fn().mockResolvedValue(session),
        refresh: vi.fn(),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const useSession = createPlatformSessionStore({ client, id: "memory-default-test" });
    const store = useSession();

    await store.login({ username: "tester", password: "secret" });

    expect(store.session).toEqual(session);

    setActivePinia(createPinia());
    const isolatedStore = useSession();
    expect(isolatedStore.session).toBeNull();
    expect(isolatedStore.isAuthenticated).toBe(false);
  });

  it("注销立即清除本地会话，并拒绝随后完成的旧刷新", async () => {
    const refreshResult = deferred<AuthSession>();
    const logoutResult = deferred<void>();
    const logout = vi.fn().mockReturnValue(logoutResult.promise);
    const storage = createMemorySessionStorage(session);
    const client = {
      auth: {
        login: vi.fn().mockResolvedValue(createSession("new-access", "new-refresh")),
        refresh: vi.fn().mockReturnValue(refreshResult.promise),
        logout,
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage,
      id: "logout-refresh-race",
    })();

    const refreshing = store.refresh();
    const loggingOut = store.logout();
    expect(store.session).toBeNull();
    expect(storage.read()).toBeNull();
    expect(logout).toHaveBeenCalledWith("access");

    await store.login({ username: "new-user", password: "secret" });
    expect(store.session?.accessToken).toBe("new-access");

    refreshResult.resolve(createSession("old-access", "old-refresh"));
    await expect(refreshing).rejects.toThrow("当前会话已被替代");
    expect(store.session?.accessToken).toBe("new-access");

    logoutResult.resolve();
    await loggingOut;
    expect(store.session?.accessToken).toBe("new-access");
  });

  it("后发登录胜出，先发登录的迟到结果不会覆盖它", async () => {
    const firstLogin = deferred<AuthSession>();
    const secondLogin = deferred<AuthSession>();
    const client = {
      auth: {
        login: vi
          .fn()
          .mockReturnValueOnce(firstLogin.promise)
          .mockReturnValueOnce(secondLogin.promise),
        refresh: vi.fn(),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({ client, id: "login-generation-race" })();

    const first = store.login({ username: "first", password: "secret" });
    const second = store.login({ username: "second", password: "secret" });
    secondLogin.resolve(createSession("second-access", "second-refresh"));
    await second;
    firstLogin.resolve(createSession("first-access", "first-refresh"));
    await first;

    expect(store.session?.accessToken).toBe("second-access");
  });

  it("登录进行时拒绝旧会话刷新，后发登录仍能写入会话", async () => {
    const loginResult = deferred<AuthSession>();
    const refresh = vi.fn();
    const client = {
      auth: {
        login: vi.fn().mockReturnValue(loginResult.promise),
        refresh,
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage(session),
      id: "login-refresh-race",
    })();

    const loggingIn = store.login({ username: "new-user", password: "secret" });
    await expect(store.refresh()).rejects.toThrow("当前会话正在登录");
    await expect(store.handleUnauthorized()).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();

    loginResult.resolve(createSession("new-access", "new-refresh"));
    await loggingIn;
    expect(store.session?.accessToken).toBe("new-access");
  });

  it("替换会话会使旧登录失效，并允许新会话立即刷新", async () => {
    const oldLogin = deferred<AuthSession>();
    const refreshedSession = createSession("refreshed-access", "refreshed-refresh");
    const refresh = vi.fn().mockResolvedValue(refreshedSession);
    const client = {
      auth: {
        login: vi.fn().mockReturnValue(oldLogin.promise),
        refresh,
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage(session),
      id: "replace-login-refresh-race",
    })();

    const loggingIn = store.login({ username: "old-user", password: "secret" });
    store.replace(createSession("replacement-access", "replacement-refresh"));

    await expect(store.refresh()).resolves.toEqual(refreshedSession);
    expect(refresh).toHaveBeenCalledWith("replacement-refresh");

    oldLogin.resolve(createSession("old-access", "old-refresh"));
    await loggingIn;
    expect(store.session?.accessToken).toBe("refreshed-access");
  });

  it("被新会话替代的刷新失败不清除会话，也不触发失败导航", async () => {
    const refreshResult = deferred<AuthSession>();
    const onRefreshFailure = vi.fn();
    const client = {
      auth: {
        login: vi.fn(),
        refresh: vi.fn().mockReturnValue(refreshResult.promise),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage(session),
      id: "stale-refresh-failure",
      onRefreshFailure,
    })();

    const retry = store.handleUnauthorized();
    store.replace(createSession("new-access", "new-refresh"));
    refreshResult.reject(new Error("旧刷新失败"));

    await expect(retry).resolves.toBe(false);
    expect(store.session?.accessToken).toBe("new-access");
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });

  it("刷新后会话再次被替换时，不允许 401 请求重试", async () => {
    const refreshResult = deferred<AuthSession>();
    const client = {
      auth: {
        login: vi.fn(),
        refresh: vi.fn().mockReturnValue(refreshResult.promise),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const storage = createMemorySessionStorage(session);
    const store = createPlatformSessionStore({
      client,
      storage,
      id: "unauthorized-generation-race",
    })();

    let replaced = false;
    const stopWatchingSession = watch(
      () => store.session,
      (currentSession) => {
        if (replaced || currentSession?.accessToken !== "refreshed-access") return;
        replaced = true;
        store.replace(createSession("replacement-access", "replacement-refresh"));
      },
      { flush: "sync" },
    );

    try {
      const retry = store.handleUnauthorized();
      refreshResult.resolve(createSession("refreshed-access", "refreshed-refresh"));

      await expect(retry).resolves.toBe(false);
      expect(store.session?.accessToken).toBe("replacement-access");
      expect(storage.read()?.accessToken).toBe("replacement-access");
    } finally {
      stopWatchingSession();
    }
  });

  it("旧刷新结束不会将新一代刷新从 pending 中抹掉", async () => {
    const oldRefresh = deferred<AuthSession>();
    const newRefresh = deferred<AuthSession>();
    const client = {
      auth: {
        login: vi.fn(),
        refresh: vi
          .fn()
          .mockReturnValueOnce(oldRefresh.promise)
          .mockReturnValueOnce(newRefresh.promise),
        logout: vi.fn(),
      },
      http: {},
    } as unknown as PlatformClient;
    const store = createPlatformSessionStore({
      client,
      storage: createMemorySessionStorage(session),
      id: "refresh-pending-race",
    })();

    const first = store.refresh();
    store.replace(createSession("new-access", "new-refresh"));
    const second = store.refresh();
    expect(store.pending).toBe(true);

    oldRefresh.resolve(createSession("old-access", "old-refresh"));
    await expect(first).rejects.toThrow("当前会话已被替代");
    expect(store.pending).toBe(true);

    newRefresh.resolve(createSession("renewed-access", "renewed-refresh"));
    await second;
    expect(store.pending).toBe(false);
    expect(store.session?.accessToken).toBe("renewed-access");
  });
});

describe("hasPermissions", () => {
  it("支持全部与任一匹配", () => {
    expect(hasPermissions(session.permissions, ["file:read", "file:write"])).toBe(true);
    expect(hasPermissions(session.permissions, ["file:delete", "file:write"], "any")).toBe(true);
    expect(hasPermissions(session.permissions, ["file:delete"])).toBe(false);
  });
});
