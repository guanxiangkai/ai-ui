<script setup lang="ts">
import type {
  SchedulerApplication,
  SchedulerInstance,
  SchedulerTask,
  SchedulerTaskInput,
} from "@guanxiangkai/platform-client";
import { ElAlert, ElButton, ElMessage, ElMessageBox, ElPagination } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import type { PlatformSchedulerProps } from "./component-types.js";
import { useLatestRequest } from "./composables/useLatestRequest.js";
import SchedulerInstanceDetail from "./scheduler/SchedulerInstanceDetail.vue";
import SchedulerTaskConfiguration from "./scheduler/SchedulerTaskConfiguration.vue";
import SchedulerTaskEditor from "./scheduler/SchedulerTaskEditor.vue";
import SchedulerTaskFilters, {
  type SchedulerEnabledFilter,
} from "./scheduler/SchedulerTaskFilters.vue";
import SchedulerTaskRecords from "./scheduler/SchedulerTaskRecords.vue";

const props = withDefaults(defineProps<PlatformSchedulerProps>(), {
  title: "定时任务",
  description: "统一维护任务定义、运行状态和执行记录，业务处理逻辑仍由所属系统负责。",
  permissions: () => [],
  superAdmin: false,
});

const emit = defineEmits<{
  /** 任务定义发生创建、更新、删除或同步状态变化。 */
  change: [task: SchedulerTask | null];
  /** 用户成功手工触发任务。 */
  run: [task: SchedulerTask, instanceId: number];
}>();

const taskRequest = useLatestRequest();
const loading = taskRequest.loading;
const saving = ref(false);
const tasks = ref<SchedulerTask[]>([]);
const applications = ref<SchedulerApplication[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const filters = reactive<{ keyword: string; enabled: SchedulerEnabledFilter }>({
  keyword: "",
  enabled: "ALL",
});
const editorVisible = ref(false);
const editingTask = ref<SchedulerTask | null>(null);
const instanceDrawerVisible = ref(false);
const instanceRequest = useLatestRequest();
const instanceLoading = instanceRequest.loading;
const instanceTask = ref<SchedulerTask | null>(null);
const instances = ref<SchedulerInstance[]>([]);
const instanceTotal = ref(0);
const instancePage = ref(1);
const instancePageSize = ref(20);

const canCreate = computed(() =>
  applications.value.some((application) => application.handlers.length > 0),
);
const showTaskConfiguration = computed(() => props.view !== "task-records");
const showTaskRecords = computed(() => props.view !== "task-config");
const isTaskRecordsOnly = computed(() => props.view === "task-records");

function can(permission: string): boolean {
  return props.superAdmin || props.permissions.includes(permission);
}

function enabledQuery(): boolean | undefined {
  if (filters.enabled === "ENABLED") return true;
  if (filters.enabled === "DISABLED") return false;
  return undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

async function loadApplications(): Promise<void> {
  applications.value = await props.client.applications();
}

async function loadTasks(): Promise<void> {
  const query: { page: number; size: number; keyword?: string; enabled?: boolean } = {
    page: page.value,
    size: pageSize.value,
  };
  if (filters.keyword.trim().length > 0) query.keyword = filters.keyword.trim();
  const enabled = enabledQuery();
  if (enabled !== undefined) query.enabled = enabled;
  await taskRequest.run(() => props.client.tasks(query), {
    onSuccess: (result) => {
      tasks.value = result.records;
      total.value = result.total;
    },
    onError: (error) => {
      ElMessage.error(errorMessage(error, "定时任务加载失败"));
    },
  });
}

async function refresh(): Promise<void> {
  try {
    await Promise.all([loadTasks(), ...(showTaskConfiguration.value ? [loadApplications()] : [])]);
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "调度配置加载失败"));
  }
}

function search(): void {
  page.value = 1;
  void loadTasks();
}

function openCreate(): void {
  if (!canCreate.value) {
    ElMessage.warning("当前系统尚未登记可调度的业务处理器");
    return;
  }
  editingTask.value = null;
  editorVisible.value = true;
}

function openEdit(task: SchedulerTask): void {
  editingTask.value = task;
  editorVisible.value = true;
}

async function submit(input: SchedulerTaskInput): Promise<void> {
  saving.value = true;
  try {
    const task =
      editingTask.value === null
        ? await props.client.create(input)
        : await props.client.update(editingTask.value.id, input);
    editorVisible.value = false;
    ElMessage.success(
      task.syncState === "SYNCED" ? "任务已保存并同步" : "任务已保存，等待重新同步",
    );
    emit("change", task);
    await loadTasks();
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "任务保存失败"));
  } finally {
    saving.value = false;
  }
}

async function changeEnabled(task: SchedulerTask, enabled: boolean): Promise<void> {
  try {
    const updated = await props.client.changeEnabled(task.id, enabled);
    Object.assign(task, updated);
    emit("change", updated);
    if (updated.syncState !== "SYNCED") {
      ElMessage.warning(updated.lastSyncMessage ?? "状态同步失败");
    }
  } catch (error: unknown) {
    task.enabled = !enabled;
    ElMessage.error(errorMessage(error, "任务状态修改失败"));
  }
}

async function synchronize(task: SchedulerTask): Promise<void> {
  try {
    const updated = await props.client.synchronize(task.id);
    Object.assign(task, updated);
    emit("change", updated);
    if (updated.syncState === "SYNCED") ElMessage.success("任务已同步");
    else ElMessage.error(updated.lastSyncMessage ?? "任务同步失败");
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, "任务同步失败"));
  }
}

async function runTask(task: SchedulerTask): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认立即执行“${task.taskName}”吗？`, "手工执行", {
      type: "warning",
      confirmButtonText: "执行",
      cancelButtonText: "取消",
    });
    const instanceId = await props.client.run(task.id);
    ElMessage.success(`任务已触发，实例 ${instanceId}`);
    emit("run", task, instanceId);
  } catch (error: unknown) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(errorMessage(error, "任务触发失败"));
  }
}

async function removeTask(task: SchedulerTask): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除“${task.taskName}”会同时删除调度引擎中的任务，是否继续？`,
      "删除定时任务",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
    await props.client.delete(task.id);
    ElMessage.success("任务已删除");
    emit("change", null);
    await loadTasks();
  } catch (error: unknown) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(errorMessage(error, "任务删除失败"));
  }
}

async function openInstances(task: SchedulerTask): Promise<void> {
  instanceTask.value = task;
  instancePage.value = 1;
  instanceDrawerVisible.value = !isTaskRecordsOnly.value;
  await loadInstances();
}

async function loadInstances(): Promise<void> {
  if (instanceTask.value === null) return;
  const taskId = instanceTask.value.id;
  await instanceRequest.run(
    () =>
      props.client.instances(taskId, {
        page: instancePage.value,
        size: instancePageSize.value,
      }),
    {
      onSuccess: (result) => {
        instances.value = result.records;
        instanceTotal.value = result.total;
      },
      onError: (error) => {
        ElMessage.error(errorMessage(error, "执行记录加载失败"));
      },
    },
  );
}

function changeInstancePage(nextPage: number): void {
  instancePage.value = nextPage;
  void loadInstances();
}

function changeInstancePageSize(nextPageSize: number): void {
  instancePageSize.value = nextPageSize;
  void loadInstances();
}

function updateInstanceDrawerVisible(visible: boolean): void {
  instanceDrawerVisible.value = visible;
  if (!visible) instanceRequest.invalidate();
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <section class="platform-management-page platform-scheduler">
    <header class="platform-management-page__header">
      <div>
        <p class="platform-management-page__eyebrow">PLATFORM SCHEDULER</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="platform-management-page__actions">
        <ElButton @click="refresh">刷新</ElButton>
        <ElButton
          v-if="showTaskConfiguration && can('scheduler:task:add')"
          type="primary"
          :disabled="!canCreate"
          @click="openCreate"
        >
          新建任务
        </ElButton>
      </div>
    </header>
    <ElAlert
      v-if="showTaskConfiguration && applications.length > 0 && !canCreate"
      class="platform-scheduler__notice"
      type="info"
      :closable="false"
      title="当前系统还没有登记可执行的业务处理器；可以查看已有任务，新增处理器后即可创建任务。"
      show-icon
    />
    <SchedulerTaskFilters
      v-model:keyword="filters.keyword"
      v-model:enabled="filters.enabled"
      :records-only="isTaskRecordsOnly"
      @search="search"
    />
    <SchedulerTaskConfiguration
      v-if="showTaskConfiguration"
      :tasks="tasks"
      :loading="loading"
      :show-task-records="showTaskRecords"
      :can="can"
      @change-enabled="changeEnabled"
      @run="runTask"
      @instances="openInstances"
      @synchronize="synchronize"
      @edit="openEdit"
      @remove="removeTask"
    />
    <SchedulerTaskRecords
      v-if="isTaskRecordsOnly"
      :tasks="tasks"
      :loading="loading"
      :can="can"
      @instances="openInstances"
    />
    <SchedulerInstanceDetail
      :task="instanceTask"
      :drawer-visible="instanceDrawerVisible"
      :instances="instances"
      :loading="instanceLoading"
      :total="instanceTotal"
      :page="instancePage"
      :page-size="instancePageSize"
      @update:drawer-visible="updateInstanceDrawerVisible"
      @update:page="changeInstancePage"
      @update:page-size="changeInstancePageSize"
    />
    <ElPagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="platform-management-pagination"
      background
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      @current-change="loadTasks"
      @size-change="search"
    />
    <SchedulerTaskEditor
      v-model="editorVisible"
      :task="editingTask"
      :applications="applications"
      :saving="saving"
      @save="submit"
    />
  </section>
</template>

<style scoped>
.platform-scheduler__notice {
  margin-bottom: var(--platform-space-4);
}
</style>
