<script setup lang="ts">
import { ElButton, ElResult } from "element-plus";

import type { PlatformErrorStateProps } from "./component-types.js";

withDefaults(defineProps<PlatformErrorStateProps>(), {
  title: "暂时无法完成操作",
  description: "请稍后重试",
  retryLabel: "重试",
});

const emit = defineEmits<{
  /** 用户请求重新执行失败操作。 */
  retry: [];
}>();
</script>

<template>
  <ElResult icon="error" :title="title" :sub-title="description">
    <template #extra>
      <slot name="actions">
        <ElButton v-if="retryLabel" type="primary" @click="emit('retry')">
          {{ retryLabel }}
        </ElButton>
      </slot>
    </template>
  </ElResult>
</template>
