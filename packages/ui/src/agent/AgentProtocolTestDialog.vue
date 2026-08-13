<script setup lang="ts">
import type { AgentClient, AgentDefinition } from "@guanxiangkai/platform-client";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  client: AgentClient;
  definition: AgentDefinition | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const testing = ref(false);
const message = ref("请回复：连接正常");
const result = ref("");

async function run(): Promise<void> {
  const definition = props.definition;
  if (!definition || !message.value.trim()) return;
  testing.value = true;
  try {
    const invocation = await props.client.test(definition.id, {
      message: message.value.trim(),
      variables: {},
    });
    result.value = invocation.text;
    ElMessage.success("真实协议调用成功");
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "智能体测试失败"));
  } finally {
    testing.value = false;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

watch(
  () => props.modelValue,
  (opened) => {
    if (!opened) return;
    message.value = "请回复：连接正常";
    result.value = "";
  },
);
</script>

<template>
  <ElDialog v-model="visible" title="真实协议测试" width="680px">
    <p>测试对象：{{ definition?.agentName }}</p>
    <ElInput v-model="message" :rows="4" type="textarea" placeholder="输入测试消息" />
    <pre v-if="result" class="agent-protocol-test-dialog__result">{{ result }}</pre>
    <template #footer>
      <ElButton @click="visible = false">关闭</ElButton>
      <ElButton type="primary" :loading="testing" @click="run">发送测试</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.agent-protocol-test-dialog__result {
  padding: var(--platform-space-4);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--platform-color-surface-muted);
  border: 1px solid var(--platform-color-border);
  border-radius: var(--platform-radius-sm);
}
</style>
