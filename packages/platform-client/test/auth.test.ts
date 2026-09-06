import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformAuthClient } from "../src/auth.js";
import { PlatformHttpClient } from "../src/http.js";
import { digestPassword, generateTemporaryPassword } from "../src/password.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformAuthClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("只对原密码摘要一次，并且登录网络 DTO 不含原密码", async () => {
    vi.stubGlobal("isSecureContext", true);
    const rawPassword = "0123456789012345678901234567890123456789";
    const transport = new RecordingTransport({});
    const client = new PlatformAuthClient(transport);

    await client.login({ username: "alice", password: rawPassword, captcha: "captcha" });

    const body = transport.calls[0]?.options.body as Record<string, unknown>;
    expect(body).toEqual({
      username: "alice",
      captcha: "captcha",
      passwordDigest: await digestPassword(rawPassword),
    });
    expect(body.passwordDigest).not.toBe(rawPassword);
    expect(body.password).toBeUndefined();
    expect(transport.calls[0]?.options).toMatchObject({
      accessToken: null,
      retryUnauthorized: false,
    });
  });

  it("按 UTF-8 计算 Unicode 原密码的固定小写 SHA-1 摘要", async () => {
    vi.stubGlobal("isSecureContext", true);
    expect(await digestPassword("你好")).toBe("440ee0853ad1e99f962b63e459ef992d7c211722");
  });

  it("空原密码不会生成摘要或发送登录请求", async () => {
    vi.stubGlobal("isSecureContext", true);
    const transport = new RecordingTransport({});

    await expect(
      new PlatformAuthClient(transport).login({ username: "alice", password: "" }),
    ).rejects.toThrow("密码不能为空");
    expect(transport.calls).toHaveLength(0);
  });

  it("密码摘要不可用时不会发送登录请求", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("crypto", undefined);
    const transport = new RecordingTransport({});

    await expect(
      new PlatformAuthClient(transport).login({ username: "alice", password: "x" }),
    ).rejects.toThrow("不支持密码摘要");
    expect(transport.calls).toHaveLength(0);
  });

  it("生成 32 字节独立临时密码，且随机源不可用时失败", () => {
    vi.stubGlobal("isSecureContext", true);
    expect(generateTemporaryPassword()).toMatch(/^[0-9a-f]{64}$/u);
    vi.stubGlobal("crypto", undefined);
    expect(() => generateTemporaryPassword()).toThrow("不支持生成临时密码");
  });

  it("通过请求体传输刷新令牌，避免令牌进入 URL", async () => {
    const transport = new RecordingTransport({});
    const client = new PlatformAuthClient(transport);

    await client.refresh("refresh-token-value");

    expect(transport.calls).toEqual([
      {
        path: "/auth/refresh",
        options: {
          method: "POST",
          body: { refreshToken: "refresh-token-value" },
          accessToken: null,
          retryUnauthorized: false,
        },
      },
    ]);
  });

  it("登出时使用显式捕获的令牌，而非之后变化的令牌提供器", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 200, message: "ok", data: null }), { status: 200 }),
      );
    let currentToken = "new-login-token";
    const tokenProvider = vi.fn(() => currentToken);
    const http = new PlatformHttpClient({
      baseUrl: "/api",
      fetch: fetchMock,
      tokenProvider,
    });
    const client = new PlatformAuthClient(http);

    const loggingOut = client.logout("logged-out-token");
    currentToken = "another-new-login-token";
    await loggingOut;

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/logout");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer logged-out-token",
    );
    expect(tokenProvider).not.toHaveBeenCalled();
  });

  it("旧会话注销收到 401 时不刷新当前会话", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 401, message: "会话已失效", data: null }), {
        status: 401,
      }),
    );
    const onUnauthorized = vi.fn(() => true);
    const client = new PlatformAuthClient(
      new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock, onUnauthorized }),
    );

    await expect(client.logout("old-token")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
