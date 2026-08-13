<script setup lang="ts">
import type { AgentVoiceRecord } from "@guanxiangkai/platform-client";
import { ElEmpty, ElTable, ElTableColumn, ElTag } from "element-plus";
import { computed } from "vue";

import { formatBytes, formatTime, stateTag } from "./agent-view.js";

const props = defineProps<{
  rows: readonly AgentVoiceRecord[];
  loading: boolean;
}>();

const tableRows = computed(() => [...props.rows]);

function rowAt(index: number): AgentVoiceRecord {
  const row = tableRows.value[index];
  if (!row) throw new RangeError(`智能体语音行索引越界：${index}`);
  return row;
}
</script>

<template>
  <div class="platform-management-table">
    <ElTable v-loading="loading" :data="tableRows" stripe>
      <ElTableColumn label="文件" min-width="200" prop="fileName" show-overflow-tooltip />
      <ElTableColumn label="类型" min-width="150" prop="contentType" />
      <ElTableColumn label="大小" width="110">
        <template #default="{ $index }">
          {{ formatBytes(rowAt($index).contentLength) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="语言" width="90" prop="language" />
      <ElTableColumn label="状态" width="110">
        <template #default="{ $index }">
          <ElTag :type="stateTag(rowAt($index).recognitionStatus)">{{
            rowAt($index).recognitionStatus
          }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="转写文本" min-width="260" prop="transcript" show-overflow-tooltip />
      <ElTableColumn label="创建时间" width="180">
        <template #default="{ $index }">{{ formatTime(rowAt($index).createTime) }}</template>
      </ElTableColumn>
    </ElTable>
    <ElEmpty v-if="!loading && rows.length === 0" description="暂无语音记录" />
  </div>
</template>
