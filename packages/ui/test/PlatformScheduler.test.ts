import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import PlatformScheduler from "../src/PlatformScheduler.vue";

describe("PlatformScheduler", () => {
  it("加载当前系统的应用目录和任务列表", async () => {
    const client = {
      applications: vi.fn().mockResolvedValue([
        {
          code: "sample",
          displayName: "示例应用",
          appName: "sample-business",
          handlers: [],
        },
      ]),
      tasks: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      create: vi.fn(),
      update: vi.fn(),
      changeEnabled: vi.fn(),
      synchronize: vi.fn(),
      run: vi.fn(),
      instances: vi.fn(),
      delete: vi.fn(),
    };

    const wrapper = mount(PlatformScheduler, {
      props: { client, title: "示例定时任务", view: "task-config" },
      global: {
        directives: {
          loading: () => undefined,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("示例定时任务");
    expect(wrapper.text()).toContain("当前系统还没有登记可执行的业务处理器");
    expect(client.applications).toHaveBeenCalledOnce();
    expect(client.tasks).toHaveBeenCalledWith({ page: 1, size: 20 });
  });

  it("任务记录视图只加载任务供筛选，选择任务后才加载该任务的执行记录", async () => {
    const task = {
      id: "task-1",
      taskCode: "sample.sync.daily",
      taskName: "每日同步",
      applicationCode: "sample",
      applicationName: "示例应用",
      processorInfo: "dailySyncProcessor",
      timeExpressionType: "CRON" as const,
      timeExpression: "0 0 1 * * ?",
      maxInstanceNum: 1,
      concurrency: 1,
      instanceTimeLimit: 0,
      instanceRetryNum: 0,
      taskRetryNum: 0,
      enabled: true,
      syncState: "SYNCED" as const,
    };
    const client = {
      applications: vi.fn(),
      tasks: vi.fn().mockResolvedValue({ records: [task], total: 1 }),
      create: vi.fn(),
      update: vi.fn(),
      changeEnabled: vi.fn(),
      synchronize: vi.fn(),
      run: vi.fn(),
      instances: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      delete: vi.fn(),
    };

    const wrapper = mount(PlatformScheduler, {
      props: {
        client,
        view: "task-records",
        permissions: ["scheduler:instance:list"],
      },
      global: {
        directives: {
          loading: () => undefined,
        },
      },
    });
    await flushPromises();

    expect(client.applications).not.toHaveBeenCalled();
    expect(client.tasks).toHaveBeenCalledTimes(1);
    expect(client.instances).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("不会为任务列表逐个加载记录");

    const recordButton = wrapper.findAll("button").find((button) => button.text() === "查看记录");
    if (!recordButton) throw new Error("任务记录视图未渲染查看记录操作");
    await recordButton.trigger("click");
    await flushPromises();

    expect(client.tasks).toHaveBeenCalledTimes(1);
    expect(client.instances).toHaveBeenCalledWith("task-1", { page: 1, size: 20 });
  });
});
