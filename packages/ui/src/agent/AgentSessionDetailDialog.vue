<script setup lang="ts">
import type { AgentClient, AgentSession } from "@guanxiangkai/platform-client";
import { ElDescriptions, ElDescriptionsItem, ElDialog, ElEmpty, ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";

import { useLatestRequest } from "../composables/useLatestRequest.js";

const props = defineProps<{
  modelValue: boolean;
  client: AgentClient;
  session: AgentSession | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const latestRequest = useLatestRequest();
const loading = latestRequest.loading;
const detail = ref<AgentSession | null>(null);

async function load(): Promise<void> {
  const session = props.session;
  detail.value = null;
  if (!props.modelValue || !session) {
    latestRequest.invalidate();
    return;
  }
  await latestRequest.run(() => props.client.session(session.id), {
    onSuccess: (loaded) => {
      detail.value = loaded;
    },
    onError: (error) => {
      ElMessage.error(errorMessage(error, "会话详情加载失败"));
    },
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

watch([() => props.modelValue, () => props.session?.id], () => {
  void load();
});
</script>

<template>
  <ElDialog v-model="visible" title="会话详情" width="760px">
    <div v-loading="loading">
      <ElDescriptions v-if="detail" :column="2" border>
        <ElDescriptionsItem label="会话编码">{{ detail.sessionCode }}</ElDescriptionsItem>
        <ElDescriptionsItem label="智能体">{{ detail.agentCode }}</ElDescriptionsItem>
        <ElDescriptionsItem label="上下文命名空间">
          {{ detail.contextNamespace || "—" }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="上下文引用">
          {{ detail.contextReference || "—" }}
        </ElDescriptionsItem>
      </ElDescriptions>
      <div v-if="detail?.messages?.length" class="agent-session-detail-dialog__messages">
        <article v-for="message in detail.messages" :key="message.id">
          <strong>{{ message.role }}</strong>
          <p>{{ message.content }}</p>
        </article>
      </div>
      <ElEmpty v-else-if="detail" description="当前会话没有消息" />
    </div>
  </ElDialog>
</template>

<style scoped>
.agent-session-detail-dialog__messages {
  display: grid;
  gap: var(--platform-space-3);
  margin-top: var(--platform-space-4);
}

.agent-session-detail-dialog__messages article {
  padding: var(--platform-space-4);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--platform-color-surface-muted);
  border: 1px solid var(--platform-color-border);
  border-radius: var(--platform-radius-sm);
}

.agent-session-detail-dialog__messages p {
  margin: var(--platform-space-2) 0 0;
}
</style>
