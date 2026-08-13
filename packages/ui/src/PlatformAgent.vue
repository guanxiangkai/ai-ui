<script setup lang="ts">
import type {
  AgentDefinition,
  AgentInvocation,
  AgentInvocationState,
  AgentProviderType,
  AgentPublishState,
  AgentSession,
  AgentSessionState,
  AgentVoiceRecord,
} from "@guanxiangkai/platform-client";
import { ElButton, ElInput, ElMessage, ElMessageBox, ElPagination, ElSelect } from "element-plus";
import { computed, onMounted, ref } from "vue";

import AgentDefinitionDialog from "./agent/AgentDefinitionDialog.vue";
import AgentDefinitionTable from "./agent/AgentDefinitionTable.vue";
import AgentInvocationTable from "./agent/AgentInvocationTable.vue";
import AgentProtocolTestDialog from "./agent/AgentProtocolTestDialog.vue";
import AgentSessionDetailDialog from "./agent/AgentSessionDetailDialog.vue";
import AgentSessionTable from "./agent/AgentSessionTable.vue";
import { AgentSelectOption as AgentOption } from "./agent/AgentSelectOption.js";
import AgentVoiceTable from "./agent/AgentVoiceTable.vue";
import type { PlatformAgentProps, PlatformAgentTab } from "./component-types.js";
import { useLatestRequest } from "./composables/useLatestRequest.js";

const props = withDefaults(defineProps<PlatformAgentProps>(), {
  title: "智能体",
  description: "集中维护产品无关的智能体定义、运行协议、会话与调用审计。",
  initialTab: "definitions",
  permissions: () => [],
  superAdmin: false,
});

const emit = defineEmits<{
  /** 智能体定义发生创建、更新、状态变化或删除。 */
  change: [definition: AgentDefinition | null];
}>();

const activeTab = ref<PlatformAgentTab>(props.initialTab);
const tabs: ReadonlyArray<{
  value: PlatformAgentTab;
  label: string;
  permission: string;
}> = [
  { value: "definitions", label: "智能体定义", permission: "agent:definition:list" },
  { value: "sessions", label: "会话记录", permission: "agent:session:list" },
  { value: "invocations", label: "调用审计", permission: "agent:invocation:list" },
  { value: "voices", label: "语音记录", permission: "agent:voice:list" },
];
const latestRequest = useLatestRequest();
const loading = latestRequest.loading;
const definitions = ref<AgentDefinition[]>([]);
const sessions = ref<AgentSession[]>([]);
const invocations = ref<AgentInvocation[]>([]);
const voices = ref<AgentVoiceRecord[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const providerType = ref<AgentProviderType | "">("");
const publishState = ref<AgentPublishState | "">("");
const sessionState = ref<AgentSessionState | "">("");
const invocationState = ref<AgentInvocationState | "">("");
const voiceStatus = ref("");

const editorVisible = ref(false);
const editingDefinition = ref<AgentDefinition | null>(null);

const testVisible = ref(false);
const testingDefinition = ref<AgentDefinition | null>(null);

const sessionVisible = ref(false);
const selectedSession = ref<AgentSession | null>(null);

function can(permission: string): boolean {
  return props.superAdmin || props.permissions.includes(permission);
}

const availableTabs = computed(() => tabs.filter((tab) => can(tab.permission)));

async function load(): Promise<void> {
  await latestRequest.run(
    async () => {
      if (activeTab.value === "definitions") {
        const query: Parameters<typeof props.client.definitions>[0] = {
          page: page.value,
          size: pageSize.value,
        };
        if (keyword.value.trim()) query.keyword = keyword.value.trim();
        if (providerType.value) query.providerType = providerType.value;
        if (publishState.value) query.publishState = publishState.value;
        return { tab: "definitions" as const, page: await props.client.definitions(query) };
      }
      if (activeTab.value === "sessions") {
        const query: Parameters<typeof props.client.sessions>[0] = {
          page: page.value,
          size: pageSize.value,
        };
        if (keyword.value.trim()) query.keyword = keyword.value.trim();
        if (sessionState.value) query.state = sessionState.value;
        return { tab: "sessions" as const, page: await props.client.sessions(query) };
      }
      if (activeTab.value === "invocations") {
        const query: Parameters<typeof props.client.invocations>[0] = {
          page: page.value,
          size: pageSize.value,
        };
        if (keyword.value.trim()) query.keyword = keyword.value.trim();
        if (invocationState.value) query.state = invocationState.value;
        return { tab: "invocations" as const, page: await props.client.invocations(query) };
      }
      const query: Parameters<typeof props.client.voices>[0] = {
        page: page.value,
        size: pageSize.value,
      };
      if (keyword.value.trim()) query.keyword = keyword.value.trim();
      if (voiceStatus.value) query.status = voiceStatus.value;
      return { tab: "voices" as const, page: await props.client.voices(query) };
    },
    {
      onSuccess: (result) => {
        total.value = result.page.total;
        switch (result.tab) {
          case "definitions":
            definitions.value = result.page.records;
            break;
          case "sessions":
            sessions.value = result.page.records;
            break;
          case "invocations":
            invocations.value = result.page.records;
            break;
          case "voices":
            voices.value = result.page.records;
            break;
        }
      },
      onError: (error) => {
        ElMessage.error(errorMessage(error, "智能体数据加载失败"));
      },
    },
  );
}

function search(): void {
  page.value = 1;
  void load();
}

function switchTab(): void {
  page.value = 1;
  keyword.value = "";
  total.value = 0;
  void load();
}

function openCreate(): void {
  editingDefinition.value = null;
  editorVisible.value = true;
}

function openEdit(definition: AgentDefinition): void {
  editingDefinition.value = definition;
  editorVisible.value = true;
}

async function handleSaved(definition: AgentDefinition): Promise<void> {
  emit("change", definition);
  await load();
}

async function changeEnabled(definition: AgentDefinition, value: unknown): Promise<void> {
  const enabled = value === true;
  try {
    const updated = await props.client.changeEnabled(definition.id, enabled);
    const target = definitions.value.find((item) => item.id === definition.id);
    if (target) Object.assign(target, updated);
    emit("change", updated);
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "智能体状态修改失败"));
  }
}

async function remove(definition: AgentDefinition): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除“${definition.agentName}”吗？`, "删除智能体", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
    await props.client.delete(definition.id);
    ElMessage.success("智能体已删除");
    emit("change", null);
    await load();
  } catch (error: unknown) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(errorMessage(error, "智能体删除失败"));
  }
}

function openTest(definition: AgentDefinition): void {
  testingDefinition.value = definition;
  testVisible.value = true;
}

function openSession(session: AgentSession): void {
  selectedSession.value = session;
  sessionVisible.value = true;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

onMounted(() => {
  if (!availableTabs.value.some((tab) => tab.value === activeTab.value)) {
    activeTab.value = availableTabs.value[0]?.value ?? props.initialTab;
  }
  if (availableTabs.value.length > 0) void load();
});
</script>

<template>
  <section class="platform-management-page platform-agent">
    <header class="platform-management-page__header">
      <div>
        <p class="platform-management-page__eyebrow">PLATFORM AGENT</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="platform-management-page__actions">
        <ElButton @click="load">刷新</ElButton>
        <ElButton
          v-if="activeTab === 'definitions' && can('agent:definition:add')"
          type="primary"
          @click="openCreate"
        >
          新建智能体
        </ElButton>
      </div>
    </header>

    <nav class="platform-agent__tabs" aria-label="智能体管理分类">
      <button
        v-for="tab in availableTabs"
        :key="tab.value"
        type="button"
        :class="{ 'is-active': activeTab === tab.value }"
        @click="
          activeTab = tab.value;
          switchTab();
        "
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="platform-management-toolbar platform-agent__toolbar">
      <ElInput
        v-model="keyword"
        clearable
        placeholder="按名称、编码或记录内容查询"
        @keyup.enter="search"
      />
      <ElSelect
        v-if="activeTab === 'definitions'"
        v-model="providerType"
        aria-label="全部提供方"
        clearable
      >
        <AgentOption label="OpenAI 兼容" value="OPENAI_COMPATIBLE" />
        <AgentOption label="Dify" value="DIFY" />
      </ElSelect>
      <ElSelect
        v-if="activeTab === 'definitions'"
        v-model="publishState"
        aria-label="全部发布状态"
        clearable
      >
        <AgentOption label="草稿" value="DRAFT" />
        <AgentOption label="已发布" value="PUBLISHED" />
      </ElSelect>
      <ElSelect
        v-if="activeTab === 'sessions'"
        v-model="sessionState"
        aria-label="全部会话状态"
        clearable
      >
        <AgentOption label="进行中" value="ACTIVE" />
        <AgentOption label="已结束" value="COMPLETED" />
        <AgentOption label="失败" value="FAILED" />
      </ElSelect>
      <ElSelect
        v-if="activeTab === 'invocations'"
        v-model="invocationState"
        aria-label="全部调用状态"
        clearable
      >
        <AgentOption label="运行中" value="RUNNING" />
        <AgentOption label="成功" value="SUCCEEDED" />
        <AgentOption label="失败" value="FAILED" />
      </ElSelect>
      <ElSelect
        v-if="activeTab === 'voices'"
        v-model="voiceStatus"
        aria-label="全部转写状态"
        clearable
      >
        <AgentOption label="运行中" value="RUNNING" />
        <AgentOption label="成功" value="SUCCEEDED" />
        <AgentOption label="待复核" value="NEED_REVIEW" />
        <AgentOption label="失败" value="FAILED" />
      </ElSelect>
      <ElButton type="primary" @click="search">查询</ElButton>
    </div>

    <AgentDefinitionTable
      v-if="activeTab === 'definitions'"
      :rows="definitions"
      :loading="loading"
      :permissions="permissions"
      :super-admin="superAdmin"
      @edit="openEdit"
      @test="openTest"
      @remove="remove"
      @change-enabled="changeEnabled"
    />
    <AgentSessionTable
      v-else-if="activeTab === 'sessions'"
      :rows="sessions"
      :loading="loading"
      @detail="openSession"
    />
    <AgentInvocationTable
      v-else-if="activeTab === 'invocations'"
      :rows="invocations"
      :loading="loading"
    />
    <AgentVoiceTable v-else :rows="voices" :loading="loading" />

    <ElPagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="platform-management-pagination"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      background
      layout="total, sizes, prev, pager, next"
      @current-change="load"
      @size-change="search"
    />

    <AgentDefinitionDialog
      v-model="editorVisible"
      :client="client"
      :definition="editingDefinition"
      @saved="handleSaved"
    />
    <AgentProtocolTestDialog
      v-model="testVisible"
      :client="client"
      :definition="testingDefinition"
    />
    <AgentSessionDetailDialog
      v-model="sessionVisible"
      :client="client"
      :session="selectedSession"
    />
  </section>
</template>

<style scoped>
.platform-agent__toolbar {
  grid-template-columns: minmax(260px, 1fr) minmax(150px, 190px) minmax(150px, 190px) auto;
}

.platform-agent__tabs {
  display: flex;
  gap: var(--platform-space-2);
  padding-bottom: var(--platform-space-4);
  border-bottom: 1px solid var(--platform-color-border);
}

.platform-agent__tabs button {
  padding: var(--platform-space-2) var(--platform-space-4);
  color: var(--platform-color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--platform-radius-sm);
}

.platform-agent__tabs button:hover,
.platform-agent__tabs button.is-active {
  color: var(--platform-color-primary);
  background: var(--platform-color-surface-muted);
}

@media (max-width: 720px) {
  .platform-agent__toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
