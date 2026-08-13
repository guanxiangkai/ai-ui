import type { AuthSession, PlatformClient } from "@guanxiangkai/platform-client";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("平台会话 Store", () => {
  beforeEach(() => setActivePinia(createPinia()));

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
});

describe("hasPermissions", () => {
  it("支持全部与任一匹配", () => {
    expect(hasPermissions(session.permissions, ["file:read", "file:write"])).toBe(true);
    expect(hasPermissions(session.permissions, ["file:delete", "file:write"], "any")).toBe(true);
    expect(hasPermissions(session.permissions, ["file:delete"])).toBe(false);
  });
});
