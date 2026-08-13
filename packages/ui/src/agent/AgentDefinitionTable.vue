<script setup lang="ts">
import type { AgentDefinition } from "@guanxiangkai/platform-client";
import { ElButton, ElEmpty, ElSwitch, ElTable, ElTableColumn, ElTag } from "element-plus";
import { computed } from "vue";

import { providerLabel, stateTag } from "./agent-view.js";

const props = defineProps<{
  rows: readonly AgentDefinition[];
  loading: boolean;
  permissions: readonly string[];
  superAdmin: boolean;
}>();

const emit = defineEmits<{
  edit: [definition: AgentDefinition];
  test: [definition: AgentDefinition];
  remove: [definition: AgentDefinition];
  "change-enabled": [definition: AgentDefinition, enabled: boolean];
}>();

function can(permission: string): boolean {
  return props.superAdmin || props.permissions.includes(permission);
}

const tableRows = computed(() => [...props.rows]);

function rowAt(index: number): AgentDefinition {
  const row = tableRows.value[index];
  if (!row) throw new RangeError(`智能体定义行索引越界：${index}`);
  return row;
}
</script>

<template>
  <div class="platform-management-table">
    <ElTable v-loading="loading" :data="tableRows" stripe>
      <ElTableColumn label="名称 / 编码" min-width="220">
        <template #default="{ $index }">
          <strong>{{ rowAt($index).agentName }}</strong>
          <small>{{ rowAt($index).agentCode }}</small>
        </template>
      </ElTableColumn>
      <ElTableColumn label="提供方" width="140">
        <template #default="{ $index }">
          {{ providerLabel(rowAt($index).providerType) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="调用模式" prop="invocationMode" width="110" />
      <ElTableColumn label="模型" min-width="150" prop="modelName" show-overflow-tooltip />
      <ElTableColumn label="发布" width="100">
        <template #default="{ $index }">
          <ElTag :type="stateTag(rowAt($index).publishState)">{{
            rowAt($index).publishState
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="修订" prop="revision" width="80" />
      <ElTableColumn label="启用" width="80">
        <template #default="{ $index }">
          <ElSwitch
            :model-value="rowAt($index).enabled"
            :disabled="!can('agent:definition:edit')"
            @change="emit('change-enabled', rowAt($index), $event === true)"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn fixed="right" label="操作" min-width="210">
        <template #default="{ $index }">
          <div class="platform-management-row-actions">
            <ElButton
              v-if="can('agent:definition:test')"
              link
              type="success"
              @click="emit('test', rowAt($index))"
            >
              测试
            </ElButton>
            <ElButton
              v-if="can('agent:definition:edit')"
              link
              type="primary"
              @click="emit('edit', rowAt($index))"
            >
              编辑
            </ElButton>
            <ElButton
              v-if="can('agent:definition:delete')"
              link
              type="danger"
              @click="emit('remove', rowAt($index))"
            >
              删除
            </ElButton>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>
    <ElEmpty v-if="!loading && rows.length === 0" description="暂无智能体定义" />
  </div>
</template>

<style scoped>
:deep(.el-table small) {
  display: block;
  margin-top: 4px;
  color: var(--platform-color-text-muted);
}
</style>
