<script setup lang="ts">
import type {
  AgentClient,
  AgentDefinition,
  AgentDefinitionInput,
  AgentProviderType,
  AgentPublishState,
} from "@guanxiangkai/platform-client";
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElSelect,
  ElSwitch,
} from "element-plus";
import { computed, reactive, ref, watch } from "vue";

import { AgentSelectOption as AgentOption } from "./AgentSelectOption.js";

interface AgentEditorForm {
  agentCode: string;
  agentName: string;
  description: string;
  providerType: AgentProviderType;
  invocationMode: AgentDefinitionInput["invocationMode"];
  endpointUrl: string;
  modelName: string;
  credential: string;
  systemPrompt: string;
  temperature: number;
  runtimeConfig: string;
  publishState: AgentPublishState;
  enabled: boolean;
  remark: string;
}

const props = defineProps<{
  modelValue: boolean;
  client: AgentClient;
  definition: AgentDefinition | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [definition: AgentDefinition];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const saving = ref(false);
const form = reactive<AgentEditorForm>(emptyForm());

function emptyForm(): AgentEditorForm {
  return {
    agentCode: "",
    agentName: "",
    description: "",
    providerType: "OPENAI_COMPATIBLE",
    invocationMode: "CHAT",
    endpointUrl: "",
    modelName: "",
    credential: "",
    systemPrompt: "",
    temperature: 0.7,
    runtimeConfig: "{}",
    publishState: "DRAFT",
    enabled: true,
    remark: "",
  };
}

function resetForm(): void {
  const definition = props.definition;
  Object.assign(
    form,
    definition
      ? {
          agentCode: definition.agentCode,
          agentName: definition.agentName,
          description: definition.description ?? "",
          providerType: definition.providerType,
          invocationMode: definition.invocationMode,
          endpointUrl: definition.endpointUrl,
          modelName: definition.modelName ?? "",
          credential: "",
          systemPrompt: definition.systemPrompt ?? "",
          temperature: definition.temperature ?? 0.7,
          runtimeConfig: definition.runtimeConfig ?? "{}",
          publishState: definition.publishState,
          enabled: definition.enabled,
          remark: definition.remark ?? "",
        }
      : emptyForm(),
  );
}

function validateForm(): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{2,127}$/u.test(form.agentCode.trim())) {
    return "智能体编码需以字母开头，至少 3 位，且只能包含字母、数字、点、下划线和短横线";
  }
  if (!form.agentName.trim()) return "请输入智能体名称";
  if (!/^https?:\/\//iu.test(form.endpointUrl.trim())) return "请输入完整的 HTTP 或 HTTPS 接入地址";
  if (form.providerType === "OPENAI_COMPATIBLE" && !form.modelName.trim()) return "请输入模型名称";
  if (form.providerType === "OPENAI_COMPATIBLE" && form.invocationMode === "WORKFLOW") {
    return "OpenAI Chat Completions 协议不支持工作流模式";
  }
  if (
    form.publishState === "PUBLISHED" &&
    !form.credential.trim() &&
    !props.definition?.credentialConfigured
  ) {
    return "发布前必须配置提供方密钥";
  }
  try {
    const config = JSON.parse(form.runtimeConfig || "{}") as unknown;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error();
  } catch {
    return "运行扩展配置必须是 JSON 对象";
  }
  return null;
}

function formInput(): AgentDefinitionInput {
  return {
    agentCode: form.agentCode.trim(),
    agentName: form.agentName.trim(),
    description: form.description.trim() || null,
    providerType: form.providerType,
    invocationMode: form.invocationMode,
    endpointUrl: form.endpointUrl.trim(),
    modelName: form.modelName.trim() || null,
    ...(form.credential.trim() ? { credential: form.credential.trim() } : {}),
    systemPrompt: form.systemPrompt.trim() || null,
    temperature: form.temperature,
    runtimeConfig: JSON.stringify(JSON.parse(form.runtimeConfig || "{}")),
    publishState: form.publishState,
    enabled: form.enabled,
    remark: form.remark.trim() || null,
  };
}

async function submit(): Promise<void> {
  const validationError = validateForm();
  if (validationError) {
    ElMessage.warning(validationError);
    return;
  }
  saving.value = true;
  try {
    const definition = props.definition
      ? await props.client.update(props.definition.id, formInput())
      : await props.client.create(formInput());
    visible.value = false;
    ElMessage.success(props.definition ? "智能体已更新" : "智能体已创建");
    emit("saved", definition);
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "智能体保存失败"));
  } finally {
    saving.value = false;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

watch(
  () => props.modelValue,
  (opened) => {
    if (opened) resetForm();
  },
);
watch(
  () => props.definition,
  () => {
    if (props.modelValue) resetForm();
  },
);
</script>

<template>
  <ElDialog v-model="visible" :title="definition ? '编辑智能体' : '新建智能体'" width="760px">
    <ElForm label-position="top">
      <div class="agent-definition-dialog__grid">
        <ElFormItem label="智能体编码"><ElInput v-model="form.agentCode" /></ElFormItem>
        <ElFormItem label="智能体名称"><ElInput v-model="form.agentName" /></ElFormItem>
        <ElFormItem label="提供方协议">
          <ElSelect v-model="form.providerType">
            <AgentOption label="OpenAI 兼容" value="OPENAI_COMPATIBLE" />
            <AgentOption label="Dify" value="DIFY" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="调用模式">
          <ElSelect v-model="form.invocationMode">
            <AgentOption label="对话" value="CHAT" />
            <AgentOption label="工作流" value="WORKFLOW" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem class="agent-definition-dialog__wide" label="接入地址">
          <ElInput v-model="form.endpointUrl" placeholder="https://example.com/v1" />
        </ElFormItem>
        <ElFormItem label="模型名称"><ElInput v-model="form.modelName" /></ElFormItem>
        <ElFormItem label="提供方密钥">
          <ElInput
            v-model="form.credential"
            show-password
            type="password"
            :placeholder="definition?.credentialConfigured ? '留空保留原密钥' : '请输入密钥'"
          />
        </ElFormItem>
        <ElFormItem label="温度">
          <ElInputNumber v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </ElFormItem>
        <ElFormItem label="发布状态">
          <ElSelect v-model="form.publishState">
            <AgentOption label="草稿" value="DRAFT" />
            <AgentOption label="已发布" value="PUBLISHED" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem class="agent-definition-dialog__wide" label="描述">
          <ElInput v-model="form.description" type="textarea" />
        </ElFormItem>
        <ElFormItem class="agent-definition-dialog__wide" label="系统提示词">
          <ElInput v-model="form.systemPrompt" :rows="5" type="textarea" />
        </ElFormItem>
        <ElFormItem class="agent-definition-dialog__wide" label="运行扩展配置 JSON">
          <ElInput v-model="form.runtimeConfig" :rows="4" type="textarea" />
        </ElFormItem>
        <ElFormItem label="启用"><ElSwitch v-model="form.enabled" /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" /></ElFormItem>
      </div>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="submit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.agent-definition-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--platform-space-4);
}

.agent-definition-dialog__wide {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .agent-definition-dialog__grid {
    grid-template-columns: 1fr;
  }

  .agent-definition-dialog__wide {
    grid-column: auto;
  }
}
</style>
