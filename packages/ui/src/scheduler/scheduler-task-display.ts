import type { SchedulerExpressionType, SchedulerTask } from "@guanxiangkai/platform-client";

/** 定时任务在列表中使用的调度规则展示。 */
export function scheduleLabel(task: SchedulerTask): string {
  const labels: { readonly [Type in SchedulerExpressionType]: string } = {
    CRON: "Cron",
    FIXED_RATE: "固定频率",
    FIXED_DELAY: "固定延迟",
  };
  const expression =
    task.timeExpressionType === "CRON"
      ? task.timeExpression
      : `${Number(task.timeExpression).toLocaleString("zh-CN")} ms`;
  return `${labels[task.timeExpressionType]} · ${expression}`;
}

/** 同步状态在 Element Plus 标签中使用的颜色。 */
export function syncTagType(state: SchedulerTask["syncState"]): "success" | "warning" | "danger" {
  if (state === "SYNCED") return "success";
  if (state === "FAILED") return "danger";
  return "warning";
}

/** 同步状态面向用户的名称。 */
export function syncStateLabel(state: SchedulerTask["syncState"]): string {
  if (state === "SYNCED") return "已同步";
  if (state === "FAILED") return "同步失败";
  return "待同步";
}
