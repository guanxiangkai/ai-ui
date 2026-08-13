import { describe, expect, it } from "vitest";

import { PlatformSchedulerClient } from "../src/index.js";
import { RecordingTransport } from "./support/recording-transport.js";

describe("PlatformSchedulerClient", () => {
  it("将调度查询和变更统一映射到平台 API", async () => {
    const transport = new RecordingTransport();
    const client = new PlatformSchedulerClient(transport);

    await client.tasks({ page: 2, size: 50, keyword: "weekly", enabled: true });
    await client.changeEnabled("task/1", false);
    await client.run("task/1", '{"force":true}');

    expect(transport.calls).toEqual([
      {
        path: "/scheduler/tasks",
        options: { query: { page: 2, size: 50, keyword: "weekly", enabled: true } },
      },
      {
        path: "/scheduler/tasks/task%2F1/enabled",
        options: { method: "PUT", query: { enabled: false } },
      },
      {
        path: "/scheduler/tasks/task%2F1/run",
        options: { method: "POST", body: { parameters: '{"force":true}' } },
      },
    ]);
  });

  it("无手工参数时不发送空请求体", async () => {
    const transport = new RecordingTransport(1001);
    const client = new PlatformSchedulerClient(transport);

    await expect(client.run("task-1")).resolves.toBe(1001);
    expect(transport.calls).toEqual([
      {
        path: "/scheduler/tasks/task-1/run",
        options: { method: "POST", body: undefined },
      },
    ]);
  });
});
