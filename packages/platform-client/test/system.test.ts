import { afterEach, describe, expect, it, vi } from "vitest";

import { hasPlatformPermission } from "../src/auth.js";
import { PlatformSystemClient } from "../src/system.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformSystemClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the platform-system contract and removes empty query values", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.listUsers({ pageNum: 1, pageSize: 20, name: "", enabled: undefined });

    expect(transport.calls).toEqual([
      {
        path: "/system/user/list",
        options: { query: { pageNum: 1, pageSize: 20 } },
      },
    ]);
  });

  it("encodes identifiers and writes role permissions through one client", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.saveRolePermissionIds("role/1", ["menu:list"]);

    expect(transport.calls[0]).toEqual({
      path: "/system/role/role%2F1/permissions",
      options: { method: "PUT", body: { permissionIds: ["menu:list"] } },
    });
  });

  it("通过当前部门接口读取水印所需的组织身份", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.getCurrentDepartment();

    expect(transport.calls).toEqual([{ path: "/system/dept/current", options: {} }]);
  });

  it("使用统一契约访问区域、消息、天气和设置", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.getRegionTree("320200");
    await client.listNotices();
    await client.setMessageDisplay("message/1", true);
    await client.getWeatherForecast("320200", 7);
    await client.updateCurrentUserSetting({
      theme: "dark",
      extensions: { "product.workbench": { enableBackgroundColor: true } },
    });

    expect(transport.calls).toEqual([
      { path: "/system/region/tree", options: { query: { code: "320200" } } },
      { path: "/system/message/notices", options: {} },
      {
        path: "/system/message/message%2F1/display",
        options: { method: "PUT", query: { isDisplay: true } },
      },
      {
        path: "/system/weather/forecast",
        options: { query: { cityCode: "320200", days: 7 } },
      },
      {
        path: "/system/setting/current",
        options: {
          method: "PUT",
          body: {
            theme: "dark",
            extensions: { "product.workbench": { enableBackgroundColor: true } },
          },
        },
      },
    ]);
  });

  it("创建和修改用户时仅发送密码摘要", async () => {
    vi.stubGlobal("isSecureContext", true);
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.createUser({
      username: "alice",
      password: "你好",
      userType: "USER",
      sortOrder: 0,
    });
    await client.updateUser("user-1", {
      username: "alice",
      password: "0123456789012345678901234567890123456789",
      userType: "USER",
      sortOrder: 0,
    });

    for (const call of transport.calls) {
      const body = call.options.body as Record<string, unknown>;
      expect(body.password).toBeUndefined();
      expect(body.passwordDigest).toMatch(/^[0-9a-f]{40}$/u);
      expect(call.options.retryUnauthorized).toBe(false);
    }
  });

  it("重置密码时只提交摘要，并由服务端确认结果", async () => {
    vi.stubGlobal("isSecureContext", true);
    const transport = new RecordingTransport(false);
    const client = new PlatformSystemClient(transport);

    await expect(client.resetUserPassword("user/1", "temporary-value")).resolves.toBe(false);
    expect(transport.calls).toEqual([
      {
        path: "/system/user/resetPassword",
        options: {
          method: "POST",
          query: { id: "user/1" },
          body: { newPasswordDigest: expect.any(String) },
          retryUnauthorized: false,
        },
      },
    ]);
    const body = transport.calls[0]?.options.body as Record<string, unknown>;
    expect(body.newPasswordDigest).toMatch(/^[0-9a-f]{40}$/u);
    expect(body.newPassword).toBeUndefined();
  });

  it("把导入模板和字段映射作为两个独立资源", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.listImportTemplates({ pageNum: 1, pageSize: 20 });
    await client.listImportMappings({ pageNum: 1, pageSize: 100, templateId: "template-1" });

    expect(transport.calls).toEqual([
      {
        path: "/system/import-template/list",
        options: { query: { pageNum: 1, pageSize: 20 } },
      },
      {
        path: "/system/import-mapping/list",
        options: { query: { pageNum: 1, pageSize: 100, templateId: "template-1" } },
      },
    ]);
  });
});

describe("hasPlatformPermission", () => {
  it("supports exact, segmented wildcard and super administrator permissions", () => {
    expect(hasPlatformPermission(["system:role:*"], "system:role:edit")).toBe(true);
    expect(hasPlatformPermission(["system:user:list"], "system:role:edit")).toBe(false);
    expect(hasPlatformPermission([], "system:role:edit", true)).toBe(true);
  });
});
