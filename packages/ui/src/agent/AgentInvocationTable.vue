<script setup lang="ts">
import type { AgentInvocation } from "@guanxiangkai/platform-client";
import { ElEmpty, ElTable, ElTableColumn, ElTag } from "element-plus";
import { computed } from "vue";

import { formatTime, providerLabel, stateTag } from "./agent-view.js";

const props = defineProps<{
  rows: readonly AgentInvocation[];
  loading: boolean;
}>();

const tableRows = computed(() => [...props.rows]);

function rowAt(index: number): AgentInvocation {
  const row = tableRows.value[index];
  if (!row) throw new RangeError(`智能体调用行索引越界：${index}`);
  return row;
}
</script>

<template>
  <div class="platform-management-table">
    <ElTable v-loading="loading" :data="tableRows" stripe>
      <ElTableColumn label="调用编号" min-width="180" prop="invocationCode" show-overflow-tooltip />
      <ElTableColumn label="智能体编码" min-width="150" prop="agentCode" />
      <ElTableColumn label="提供方" width="140">
        <template #default="{ $index }">
          {{ providerLabel(rowAt($index).providerType) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="110">
        <template #default="{ $index }">
          <ElTag :type="stateTag(rowAt($index).invocationState)">{{
            rowAt($index).invocationState
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="耗时(ms)" width="110" prop="latencyMs" />
      <ElTableColumn label="输入 / 输出 Token" width="150">
        <template #default="{ $index }">
          {{ rowAt($index).inputTokens ?? 0 }} / {{ rowAt($index).outputTokens ?? 0 }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="错误" min-width="200" prop="errorMessage" show-overflow-tooltip />
      <ElTableColumn label="调用时间" width="180">
        <template #default="{ $index }">{{ formatTime(rowAt($index).createTime) }}</template>
      </ElTableColumn>
    </ElTable>
    <ElEmpty v-if="!loading && rows.length === 0" description="暂无调用记录" />
  </div>
</template>
