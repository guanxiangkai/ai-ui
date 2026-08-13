<script setup lang="ts">
import type { SchedulerTask } from "@guanxiangkai/platform-client";
import { ElAlert, ElButton, ElEmpty, ElTable, ElTableColumn } from "element-plus";

import { scheduleLabel } from "./scheduler-task-display.js";

interface Props {
  /** 可供选择的任务定义。 */
  tasks: SchedulerTask[];
  /** 任务列表是否正在加载。 */
  loading?: boolean;
  /** 当前用户是否拥有指定权限。 */
  can: (permission: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const emit = defineEmits<{
  /** 用户选择任务并请求查看执行记录。 */
  instances: [task: SchedulerTask];
}>();

/** 以索引从当前强类型任务集合读取表格行，隔离 Element Plus 的 DefaultRow。 */
function rowAt(index: number): SchedulerTask | undefined {
  return props.tasks.at(index);
}

function scheduleLabelAt(index: number): string {
  const task = rowAt(index);
  return task ? scheduleLabel(task) : "—";
}

function showInstances(index: number): void {
  const task = rowAt(index);
  if (task) emit("instances", task);
}
</script>

<template>
  <div class="platform-management-table">
    <ElAlert
      class="platform-scheduler__notice"
      type="info"
      :closable="false"
      title="先筛选并选择一个任务，再查看该任务的执行记录；不会为任务列表逐个加载记录。"
      show-icon
    />
    <ElTable v-loading="loading" :data="tasks" row-key="id">
      <ElTableColumn label="任务" min-width="240">
        <template #default="{ $index }">
          <div class="platform-scheduler__task-name">
            {{ rowAt($index)?.taskName ?? "—" }}
          </div>
          <code>{{ rowAt($index)?.taskCode ?? "—" }}</code>
        </template>
      </ElTableColumn>
      <ElTableColumn label="所属应用 / 处理器" min-width="250">
        <template #default="{ $index }">
          <div>{{ rowAt($index)?.applicationName ?? "—" }}</div>
          <code>{{ rowAt($index)?.processorInfo ?? "—" }}</code>
        </template>
      </ElTableColumn>
      <ElTableColumn label="调度规则" min-width="210">
        <template #default="{ $index }">{{ scheduleLabelAt($index) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="120" fixed="right">
        <template #default="{ $index }">
          <ElButton
            v-if="can('scheduler:instance:list')"
            link
            type="primary"
            @click="showInstances($index)"
            >查看记录</ElButton
          >
        </template>
      </ElTableColumn>
      <template #empty><ElEmpty description="暂无可查看记录的定时任务" /></template>
    </ElTable>
  </div>
</template>

<style scoped>
.platform-scheduler__notice {
  margin-bottom: var(--platform-space-4);
}

.platform-scheduler__task-name {
  margin-bottom: var(--platform-space-1);
  font-weight: 700;
  color: var(--platform-color-text);
}

code {
  color: var(--platform-color-text-muted);
  font-size: 12px;
}
</style>
