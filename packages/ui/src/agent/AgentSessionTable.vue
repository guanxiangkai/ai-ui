<script setup lang="ts">
import type { AgentSession } from "@guanxiangkai/platform-client";
import { ElButton, ElEmpty, ElTable, ElTableColumn, ElTag } from "element-plus";
import { computed } from "vue";

import { formatTime, stateTag } from "./agent-view.js";

const props = defineProps<{
  rows: readonly AgentSession[];
  loading: boolean;
}>();

const emit = defineEmits<{
  detail: [session: AgentSession];
}>();

const tableRows = computed(() => [...props.rows]);

function rowAt(index: number): AgentSession {
  const row = tableRows.value[index];
  if (!row) throw new RangeError(`智能体会话行索引越界：${index}`);
  return row;
}
</script>

<template>
  <div class="platform-management-table">
    <ElTable v-loading="loading" :data="tableRows" stripe>
      <ElTableColumn label="会话标题" min-width="220" prop="title" show-overflow-tooltip />
      <ElTableColumn label="智能体编码" min-width="160" prop="agentCode" />
      <ElTableColumn label="用户" min-width="150" prop="userId" />
      <ElTableColumn label="消息数" width="90" prop="messageCount" />
      <ElTableColumn label="状态" width="110">
        <template #default="{ $index }">
          <ElTag :type="stateTag(rowAt($index).sessionState)">{{
            rowAt($index).sessionState
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="开始时间" width="180">
        <template #default="{ $index }">{{ formatTime(rowAt($index).startedAt) }}</template>
      </ElTableColumn>
      <ElTableColumn fixed="right" label="操作" width="90">
        <template #default="{ $index }">
          <ElButton link type="primary" @click="emit('detail', rowAt($index))">详情</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <ElEmpty v-if="!loading && rows.length === 0" description="暂无会话记录" />
  </div>
</template>
