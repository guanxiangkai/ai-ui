<script setup lang="ts">
import { ElButton, ElInput, ElSelect } from "element-plus";

import SchedulerOption from "./SchedulerOption.vue";

/** 任务启用状态筛选值。 */
export type SchedulerEnabledFilter = "ALL" | "ENABLED" | "DISABLED";

interface Props {
  /** 任务名称或编码关键字。 */
  keyword: string;
  /** 任务启用状态。 */
  enabled: SchedulerEnabledFilter;
  /** 仅展示执行记录时使用的搜索提示。 */
  recordsOnly?: boolean;
}

withDefaults(defineProps<Props>(), { recordsOnly: false });

const emit = defineEmits<{
  /** 更新任务名称或编码关键字。 */
  "update:keyword": [keyword: string];
  /** 更新任务启用状态。 */
  "update:enabled": [enabled: SchedulerEnabledFilter];
  /** 用户确认按当前条件查询。 */
  search: [];
}>();
</script>

<template>
  <div class="platform-management-toolbar">
    <ElInput
      :model-value="keyword"
      clearable
      :placeholder="recordsOnly ? '搜索需要查看记录的任务名称或编码' : '搜索任务名称或编码'"
      @update:model-value="emit('update:keyword', $event)"
      @keyup.enter="emit('search')"
      @clear="emit('search')"
    />
    <ElSelect
      :model-value="enabled"
      aria-label="启用状态"
      @update:model-value="emit('update:enabled', $event)"
    >
      <SchedulerOption label="全部状态" value="ALL" />
      <SchedulerOption label="已启用" value="ENABLED" />
      <SchedulerOption label="已停用" value="DISABLED" />
    </ElSelect>
    <ElButton type="primary" plain @click="emit('search')">查询</ElButton>
  </div>
</template>
