import { describe, expect, it, vi } from "vitest";

import { PlatformClientFactory, PlatformHttpClient } from "../src/index.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformHttpClient", () => {
  it("通过传输适配接口创建共享同一请求实现的客户端外观", async () => {
    const transport = new RecordingTransport();
    const client = PlatformClientFactory.fromTransport(transport);

    await client.agent.definitions({ page: 1, size: 20 });
    await client.scheduler.tasks({ page: 1, size: 20 });

    expect(client.http).toBe(transport);
    expect(transport.calls).toEqual([
      {
        path: "/agent/definitions",
        options: { query: { page: 1, size: 20 } },
      },
      {
        path: "/scheduler/tasks",
        options: { query: { page: 1, size: 20 } },
      },
    ]);
  });

  it("使用浏览器原生 Fetch 时保留全局对象接收者", async () => {
    const originalFetch = globalThis.fetch;
    const nativeFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: 200, message: "ok", data: { ready: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: nativeFetch,
    });

    try {
      const client = new PlatformHttpClient({ baseUrl: "/api" });
      await expect(client.request("/health")).resolves.toEqual({ ready: true });
      expect(nativeFetch.mock.contexts[0]).toBe(globalThis);
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    }
  });

  it("发送 Token、租户和 JSON 请求并解开响应", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 200, message: "ok", data: { id: 7 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new PlatformHttpClient({
      baseUrl: "https://platform.example/api",
      fetch: fetchMock,
      tokenProvider: () => "access-token",
      tenantProvider: () => "tenant-a",
    });

    await expect(
      client.request<{ id: number }>("/items", {
        method: "POST",
        query: { active: true },
        body: { name: "共享能力" },
      }),
    ).resolves.toEqual({ id: 7 });

    const request = fetchMock.mock.calls.at(0);
    expect(request?.[0]).toBe("https://platform.example/api/items?active=true");
    const init = request?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(headers.get("X-Tenant-Id")).toBe("tenant-a");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe('{"name":"共享能力"}');
  });

  it("把业务失败转换为 PlatformError", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 40301, message: "无权访问", data: null }), {
        status: 200,
      }),
    );
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/protected")).rejects.toMatchObject({
      name: "PlatformError",
      status: 200,
      code: 40301,
      message: "无权访问",
    });
  });

  it("允许单次请求覆盖或显式禁止访问令牌", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ code: 200, message: "ok", data: null }), { status: 200 }),
      );
    const tokenProvider = vi.fn(() => "provider-token");
    const client = new PlatformHttpClient({
      baseUrl: "/api",
      fetch: fetchMock,
      tokenProvider,
      defaultHeaders: { Authorization: "Bearer default-token" },
    });

    await client.request("/override", { accessToken: "request-token" });
    await client.request("/anonymous", { accessToken: null });

    expect(tokenProvider).not.toHaveBeenCalled();
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer request-token",
    );
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("服务端返回 401 时通知产品清理会话", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 401, message: "会话已失效" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onUnauthorized = vi.fn(() => false);
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock, onUnauthorized });

    await expect(client.request("/protected")).rejects.toMatchObject({
      name: "PlatformError",
      status: 401,
      code: 401,
      message: "会话已失效",
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("HTTP 错误只接受标准 message，不接受历史 error 别名", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "历史错误别名" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/invalid")).rejects.toMatchObject({
      name: "PlatformError",
      status: 400,
      message: "平台请求失败（HTTP 400）",
    });
  });

  it("使用 401 恢复策略仅重试一次，并重新读取访问令牌", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 401, message: "会话已失效", data: null }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, message: "ok", data: { refreshed: true } }), {
          status: 200,
        }),
      );
    let accessToken = "expired-token";
    const client = new PlatformHttpClient({
      baseUrl: "/api",
      fetch: fetchMock,
      tokenProvider: () => accessToken,
      onUnauthorized: () => {
        accessToken = "fresh-token";
        return true;
      },
    });

    await expect(client.request("/protected")).resolves.toEqual({ refreshed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
  });

  it("保留 BodyInit，并按产品钩子转换请求和响应", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("encrypted", { status: 200 }));
    const client = new PlatformHttpClient({
      baseUrl: "/api",
      fetch: fetchMock,
      transformRequest: ({ headers }) => headers.set("X-Trace-Id", "trace-1"),
      transformResponse: ({ payload }) => ({ code: 200, message: "ok", data: payload }),
    });
    const body = new URLSearchParams({ state: "verified" });

    await expect(
      client.request<string>("/callback", {
        method: "POST",
        body,
        responseType: "text",
        credentials: "include",
      }),
    ).resolves.toBe("encrypted");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(body);
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).get("X-Trace-Id")).toBe("trace-1");
  });

  it("拒绝绕过统一网关的绝对端点", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("https://service.example/items")).rejects.toMatchObject({
      name: "PlatformError",
      code: "ABSOLUTE_ENDPOINT_REJECTED",
      message: "平台端点必须使用网关内相对路径",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("拒绝缺少 code 或 data 的无效响应信封", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true, msg: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/items")).rejects.toMatchObject({
      name: "PlatformError",
      code: "INVALID_API_ENVELOPE",
      message: "平台服务返回了无效响应信封",
    });
  });

  it("仅允许非 JSON 响应按声明类型直通", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("ready", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/health", { responseType: "text" })).resolves.toBe("ready");
  });

  it("允许无响应体的 204 成功结果", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/resource", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("拒绝缺少 message 或使用非数字 code 的响应信封", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, data: { id: 7 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "200", message: "ok", data: { id: 8 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new PlatformHttpClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.request("/missing-message")).rejects.toMatchObject({
      name: "PlatformError",
      code: "INVALID_API_ENVELOPE",
    });
    await expect(client.request("/string-code")).rejects.toMatchObject({
      name: "PlatformError",
      code: "INVALID_API_ENVELOPE",
    });
  });
});
