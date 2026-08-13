<script setup lang="ts">
import type { SchedulerTask } from "@guanxiangkai/platform-client";
import { ElButton, ElEmpty, ElSwitch, ElTable, ElTableColumn, ElTag } from "element-plus";

import { scheduleLabel, syncStateLabel, syncTagType } from "./scheduler-task-display.js";

interface Props {
  /** 当前页任务定义。 */
  tasks: SchedulerTask[];
  /** 任务列表是否正在加载。 */
  loading?: boolean;
  /** 是否允许查看执行记录。 */
  showTaskRecords: boolean;
  /** 当前用户是否拥有指定权限。 */
  can: (permission: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const emit = defineEmits<{
  /** 用户请求切换任务启用状态。 */
  "change-enabled": [task: SchedulerTask, enabled: boolean];
  /** 用户请求立即执行任务。 */
  run: [task: SchedulerTask];
  /** 用户请求查看单个任务的执行记录。 */
  instances: [task: SchedulerTask];
  /** 用户请求同步任务。 */
  synchronize: [task: SchedulerTask];
  /** 用户请求编辑任务。 */
  edit: [task: SchedulerTask];
  /** 用户请求删除任务。 */
  remove: [task: SchedulerTask];
}>();

/** 以索引从当前强类型任务集合读取表格行，隔离 Element Plus 的 DefaultRow。 */
function rowAt(index: number): SchedulerTask | undefined {
  return props.tasks.at(index);
}

function scheduleLabelAt(index: number): string {
  const task = rowAt(index);
  return task ? scheduleLabel(task) : "—";
}

function changeEnabled(index: number, value: boolean | string | number): void {
  const task = rowAt(index);
  if (task) emit("change-enabled", task, value === true);
}

function runTask(index: number): void {
  const task = rowAt(index);
  if (task) emit("run", task);
}

function showInstances(index: number): void {
  const task = rowAt(index);
  if (task) emit("instances", task);
}

function synchronize(index: number): void {
  const task = rowAt(index);
  if (task) emit("synchronize", task);
}

function edit(index: number): void {
  const task = rowAt(index);
  if (task) emit("edit", task);
}

function remove(index: number): void {
  const task = rowAt(index);
  if (task) emit("remove", task);
}
</script>

<template>
  <div class="platform-management-table">
    <ElTable v-loading="loading" :data="tasks" row-key="id">
      <ElTableColumn label="任务" min-width="220">
        <template #default="{ $index }">
          <div class="platform-scheduler__task-name">{{ rowAt($index)?.taskName ?? "—" }}</div>
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
      <ElTableColumn label="同步状态" width="150">
        <template #default="{ $index }">
          <ElTag :type="syncTagType(rowAt($index)?.syncState ?? 'PENDING')" effect="light">
            {{ syncStateLabel(rowAt($index)?.syncState ?? "PENDING") }}
          </ElTag>
          <p class="platform-scheduler__sync-message" :title="rowAt($index)?.lastSyncMessage ?? ''">
            {{ rowAt($index)?.lastSyncMessage || "—" }}
          </p>
        </template>
      </ElTableColumn>
      <ElTableColumn label="启用" width="90" align="center">
        <template #default="{ $index }">
          <ElSwitch
            :model-value="rowAt($index)?.enabled ?? false"
            :disabled="!can('scheduler:task:changeStatus')"
            @change="changeEnabled($index, $event)"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" min-width="290" fixed="right">
        <template #default="{ $index }">
          <div class="platform-management-row-actions">
            <ElButton
              v-if="can('scheduler:task:run')"
              link
              type="primary"
              :disabled="!rowAt($index)?.enabled || rowAt($index)?.syncState !== 'SYNCED'"
              @click="runTask($index)"
              >执行</ElButton
            >
            <ElButton
              v-if="showTaskRecords && can('scheduler:instance:list')"
              link
              @click="showInstances($index)"
              >记录</ElButton
            >
            <ElButton
              v-if="can('scheduler:task:sync')"
              link
              :type="rowAt($index)?.syncState === 'FAILED' ? 'danger' : 'primary'"
              @click="synchronize($index)"
              >同步</ElButton
            >
            <ElButton v-if="can('scheduler:task:edit')" link @click="edit($index)">编辑</ElButton>
            <ElButton v-if="can('scheduler:task:delete')" link type="danger" @click="remove($index)"
              >删除</ElButton
            >
          </div>
        </template>
      </ElTableColumn>
      <template #empty><ElEmpty description="暂无定时任务" /></template>
    </ElTable>
  </div>
</template>

<style scoped>
.platform-scheduler__task-name {
  margin-bottom: var(--platform-space-1);
  font-weight: 700;
  color: var(--platform-color-text);
}

code {
  color: var(--platform-color-text-muted);
  font-size: 12px;
}

.platform-scheduler__sync-message {
  max-width: 140px;
  margin: var(--platform-space-1) 0 0;
  overflow: hidden;
  color: var(--platform-color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
