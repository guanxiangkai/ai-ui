import type { AgentProviderType } from "@guanxiangkai/platform-client";

export type AgentStateTag = "success" | "warning" | "danger" | "info";

/** 返回提供方协议的中文名称。 */
export function providerLabel(value: AgentProviderType): string {
  return value === "DIFY" ? "Dify" : "OpenAI 兼容";
}

/** 返回 Agent 状态对应的 Element Plus 标签类型。 */
export function stateTag(value: string): AgentStateTag {
  if (value === "PUBLISHED" || value === "SUCCEEDED" || value === "ACTIVE") return "success";
  if (value === "FAILED") return "danger";
  if (value === "RUNNING" || value === "DRAFT" || value === "NEED_REVIEW") return "warning";
  return "info";
}

/** 按中文管理端格式展示时间。 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

/** 以适合列表阅读的单位展示字节数。 */
export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
