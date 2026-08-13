<script setup lang="ts">
import type { SchedulerInstance, SchedulerTask } from "@guanxiangkai/platform-client";
import { ElDrawer } from "element-plus";

import SchedulerInstanceRecords from "./SchedulerInstanceRecords.vue";

interface Props {
  /** 当前选定的任务；为空时不展示记录。 */
  task: SchedulerTask | null;
  /** 是否在抽屉中展示记录。 */
  drawerVisible: boolean;
  /** 当前任务执行实例。 */
  instances: SchedulerInstance[];
  /** 执行实例是否正在加载。 */
  loading?: boolean;
  /** 当前任务执行实例总数。 */
  total: number;
  /** 当前实例记录页码，从 1 开始。 */
  page: number;
  /** 当前实例记录页大小。 */
  pageSize: number;
}

withDefaults(defineProps<Props>(), { loading: false });

const emit = defineEmits<{
  /** 更新抽屉显示状态。 */
  "update:drawer-visible": [visible: boolean];
  /** 用户切换执行记录页码。 */
  "update:page": [page: number];
  /** 用户切换执行记录页大小。 */
  "update:page-size": [pageSize: number];
}>();
</script>

<template>
  <section v-if="!drawerVisible && task !== null" class="platform-scheduler__records">
    <h2>{{ task.taskName }} · 执行记录</h2>
    <SchedulerInstanceRecords
      :instances="instances"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="emit('update:page', $event)"
      @update:page-size="emit('update:page-size', $event)"
    />
  </section>
  <ElDrawer
    :model-value="drawerVisible"
    :title="`${task?.taskName ?? ''} · 执行记录`"
    size="min(920px, 96vw)"
    @update:model-value="emit('update:drawer-visible', $event)"
  >
    <SchedulerInstanceRecords
      :instances="instances"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="emit('update:page', $event)"
      @update:page-size="emit('update:page-size', $event)"
    />
  </ElDrawer>
</template>

<style scoped>
.platform-scheduler__records {
  margin-top: var(--platform-space-5);
}

.platform-scheduler__records h2 {
  margin: 0 0 var(--platform-space-3);
  color: var(--platform-color-text);
  font-size: 18px;
}
</style>
