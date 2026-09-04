import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformAuthClient } from "../src/auth.js";
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
});
