<template>
  <nav class="platform-pagination" aria-label="后台管理分页">
    <span>共 {{ total }} 条</span>
    <button type="button" :disabled="page === 1" @click="emit('change', page - 1)">上一页</button>
    <button
      v-for="item in pages"
      :key="item"
      type="button"
      :class="{ active: item === page }"
      @click="emit('change', item)"
    >
      {{ item }}
    </button>
    <button type="button" :disabled="page === pageTotal" @click="emit('change', page + 1)">
      下一页
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  total: number;
  page: number;
  pageSize: number;
}>();

const emit = defineEmits<{
  change: [page: number];
}>();

const pageTotal = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const pages = computed(() => Array.from({ length: pageTotal.value }, (_, index) => index + 1));
</script>
