<script setup lang="ts">
import type { SchedulerInstance } from "@guanxiangkai/platform-client";
import { ElEmpty, ElPagination, ElTable, ElTableColumn, ElTag } from "element-plus";

interface Props {
  /** 当前选定任务的单页执行实例。 */
  instances: SchedulerInstance[];
  /** 是否正在加载当前任务的执行实例。 */
  loading?: boolean;
  /** 当前任务执行实例总数。 */
  total: number;
  /** 当前实例记录页码，从 1 开始。 */
  page: number;
  /** 当前实例记录页大小。 */
  pageSize: number;
  /** 没有执行实例时显示的说明。 */
  emptyDescription?: string;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  emptyDescription: "暂无执行记录",
});

const emit = defineEmits<{
  /** 用户切换执行记录页码。 */
  "update:page": [page: number];
  /** 用户切换执行记录页大小。 */
  "update:page-size": [pageSize: number];
}>();

function instanceTagType(code: string): "success" | "warning" | "danger" | "info" {
  if (code === "SUCCEED") return "success";
  if (code === "FAILED" || code === "STOPPED") return "danger";
  if (code === "RUNNING" || code.startsWith("WAITING")) return "warning";
  return "info";
}

function formatTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value.length === 0) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <ElTable v-loading="loading" :data="instances" row-key="instanceId">
    <ElTableColumn prop="instanceId" label="实例 ID" min-width="140" />
    <ElTableColumn label="状态" width="110">
      <template #default="scope">
        <ElTag :type="instanceTagType(scope.row.statusCode)">{{ scope.row.statusLabel }}</ElTag>
      </template>
    </ElTableColumn>
    <ElTableColumn label="触发时间" min-width="180">
      <template #default="scope">
        {{ formatTime(scope.row.actualTriggerTime || scope.row.expectedTriggerTime) }}
      </template>
    </ElTableColumn>
    <ElTableColumn label="结束时间" min-width="180">
      <template #default="scope">{{ formatTime(scope.row.finishedTime) }}</template>
    </ElTableColumn>
    <ElTableColumn prop="runningTimes" label="执行次数" width="100" />
    <ElTableColumn prop="result" label="结果" min-width="240" show-overflow-tooltip />
    <template #empty><ElEmpty :description="emptyDescription" /></template>
  </ElTable>
  <ElPagination
    :current-page="page"
    :page-size="pageSize"
    class="platform-management-pagination"
    background
    layout="total, sizes, prev, pager, next"
    :page-sizes="[10, 20, 50]"
    :total="total"
    @current-change="emit('update:page', $event)"
    @size-change="emit('update:page-size', $event)"
  />
</template>
