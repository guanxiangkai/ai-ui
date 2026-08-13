import type { SchedulerTask } from "@guanxiangkai/platform-client";
import { describe, expect, it } from "vitest";

import {
  scheduleLabel,
  syncStateLabel,
  syncTagType,
} from "../src/scheduler/scheduler-task-display.js";

const task = (timeExpressionType: SchedulerTask["timeExpressionType"]): SchedulerTask => ({
  id: "task-1",
  taskCode: "sample.sync.daily",
  taskName: "每日同步",
  applicationCode: "sample",
  applicationName: "示例应用",
  processorInfo: "dailySyncProcessor",
  timeExpressionType,
  timeExpression: timeExpressionType === "CRON" ? "0 0 1 * * ?" : "1000",
  maxInstanceNum: 1,
  concurrency: 1,
  instanceTimeLimit: 0,
  instanceRetryNum: 0,
  taskRetryNum: 0,
  enabled: true,
  syncState: "SYNCED",
});

describe("scheduler task display", () => {
  it("依据强类型表达式类型展示任务调度规则", () => {
    expect(scheduleLabel(task("CRON"))).toBe("Cron · 0 0 1 * * ?");
    expect(scheduleLabel(task("FIXED_RATE"))).toBe("固定频率 · 1,000 ms");
    expect(scheduleLabel(task("FIXED_DELAY"))).toBe("固定延迟 · 1,000 ms");
  });

  it("为全部同步状态提供唯一的标签文案和颜色", () => {
    expect(syncStateLabel("SYNCED")).toBe("已同步");
    expect(syncTagType("SYNCED")).toBe("success");
    expect(syncStateLabel("PENDING")).toBe("待同步");
    expect(syncTagType("PENDING")).toBe("warning");
    expect(syncStateLabel("FAILED")).toBe("同步失败");
    expect(syncTagType("FAILED")).toBe("danger");
  });
});
