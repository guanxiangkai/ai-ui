import { describe, expect, it } from "vitest";

import { hasPlatformPermission } from "../src/auth.js";
import { PlatformSystemClient } from "../src/system.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformSystemClient", () => {
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

  it("通过当前部门接口读取水印所需的组织身份", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSystemClient(transport);

    await client.getCurrentDepartment();

    expect(transport.calls).toEqual([{ path: "/system/dept/current", options: {} }]);
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
