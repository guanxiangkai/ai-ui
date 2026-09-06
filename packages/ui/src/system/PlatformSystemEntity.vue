<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">{{ props.config.eyebrow }}</p>
        <h1>{{ props.config.title }}</h1>
        <span>{{ props.config.description }}</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>数据总量</small>
          <strong>{{ page.total }}</strong>
          <span>当前查询范围</span>
        </article>
        <article>
          <small>本页启用</small>
          <strong>{{ enabledCount }}</strong>
          <span>可正常使用</span>
        </article>
        <article>
          <small>本页停用</small>
          <strong>{{ disabledCount }}</strong>
          <span>已暂停使用</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input
          v-for="field in props.config.searchFields"
          :key="field.key"
          v-model="draft[field.key]"
          clearable
          :placeholder="field.placeholder"
          @keyup.enter="search"
        />
        <select v-model="draft.enabled" class="system-native-select" aria-label="启用状态">
          <option value="all">全部状态</option>
          <option value="true">启用</option>
          <option value="false">停用</option>
        </select>
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button type="success" :icon="Plus" :disabled="!canCreate" @click="openCreate">
          新增{{ props.config.entityName }}
        </el-button>
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Live System Data</p>
          <h2 class="platform-title">{{ props.config.entityName }}目录</h2>
        </div>
        <span class="system-permission-hint"> 数据来自 {{ props.config.basePath }} </span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false">
        <template #default>
          <el-button link type="primary" @click="load">重新加载</el-button>
        </template>
      </el-alert>

      <el-table v-loading="loading" :data="page.records" stripe>
        <el-table-column type="index" label="序号" width="66" align="center" />
        <el-table-column
          v-for="column in props.config.tableColumns"
          :key="column.key"
          :label="column.label"
          :width="column.width ?? ''"
          :min-width="column.minWidth ?? 80"
        >
          <template #default="{ row }">
            <code v-if="column.kind === 'code'">{{ displayValue(row, column.key) }}</code>
            <span v-else>{{ displayValue(row, column.key) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="asEntity(row).enabled !== false"
              :loading="statusLoadingId === asEntity(row).id"
              :disabled="!canToggle"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="
                (value: boolean | string | number) => changeEnabled(asEntity(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="system-row-actions">
              <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asEntity(row))">
                编辑
              </el-button>
              <el-button link type="danger" :disabled="!canDelete" @click="remove(asEntity(row))">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="`暂无${props.config.entityName}数据`" />
        </template>
      </el-table>

      <PlatformPager
        :page="query.pageNum"
        :page-size="query.pageSize"
        :total="page.total"
        @change="changePage"
      />
    </section>
  </section>

  <el-dialog
    v-model="dialogVisible"
    :title="activeId ? `编辑${props.config.entityName}` : `新增${props.config.entityName}`"
    width="680px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-skeleton :loading="detailLoading" animated>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="96px"
        :disabled="detailLoading || submitting"
      >
        <div class="system-dialog-grid">
          <el-form-item
            v-for="field in props.config.formFields"
            :key="field.key"
            :class="{ 'system-dialog-span': field.span === 2 }"
            :label="field.label"
            :prop="field.key"
          >
            <PlatformSystemField
              v-model="form[field.key]"
              :field="field"
              :options="selectableOptions(fieldOptions[field.key] ?? [])"
            />
          </el-form-item>
        </div>
      </el-form>
    </el-skeleton>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        保存{{ props.config.entityName }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSkeleton,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import type {
  QueryValue,
  SystemEntity,
  SystemOption,
  SystemPage,
} from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import PlatformSystemField from "./PlatformSystemField.vue";
import { useLatestRequest } from "../composables/useLatestRequest.js";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemEntityConfig, SystemViewProps } from "./system-types";

const props = withDefaults(
  defineProps<
    SystemViewProps & {
      config: SystemEntityConfig;
    }
  >(),
  {
    permissions: () => [],
    superAdmin: false,
  },
);

const can = (suffix: string) =>
  hasSystemPermission(props, `${props.config.permissionPrefix}:${suffix}`);
const canCreate = can("add");
const canQuery = can("query");
const canEdit = canQuery && can("edit");
const canToggle = can("edit");
const canDelete = can("delete");

const listRequest = useLatestRequest();
const detailRequest = useLatestRequest();
const optionsRequest = useLatestRequest();
const loading = listRequest.loading;
const detailLoading = detailRequest.loading;
const submitting = ref(false);
const loadError = ref("");
const statusLoadingId = ref("");
const dialogVisible = ref(false);
const activeId = ref("");
const formRef = ref<FormInstance>();
const page = reactive<SystemPage<SystemEntity>>({ records: [], total: 0 });
const query = reactive<{ pageNum: number; pageSize: number; [key: string]: QueryValue }>({
  pageNum: 1,
  pageSize: 10,
});
const draft = reactive<Record<string, string>>({ enabled: "all" });
const form = reactive<Record<string, unknown>>({});
const fieldOptions = reactive<Record<string, SystemOption[]>>({});

const enabledCount = computed(() => page.records.filter((item) => item.enabled !== false).length);
const disabledCount = computed(() => page.records.filter((item) => item.enabled === false).length);
const rules = computed<FormRules>(() =>
  Object.fromEntries(
    props.config.formFields
      .filter((field) => field.required)
      .map((field) => [
        field.key,
        [{ required: true, message: `请输入${field.label}`, trigger: "blur" }],
      ]),
  ),
);

onMounted(() => {
  props.config.searchFields.forEach((field) => {
    draft[field.key] = "";
  });
  resetForm();
  void load();
});

function asEntity(value: unknown) {
  return value as SystemEntity;
}

function displayValue(value: unknown, key: string) {
  const entity = asEntity(value);
  const field = entity[key];

  if (field === undefined || field === null || field === "") {
    return "—";
  }

  return String(field);
}

function flattenOptions(options: SystemOption[], depth = 0): SystemOption[] {
  return options.flatMap((option) => {
    const { children, ...current } = option;
    return [
      {
        ...current,
        label: `${"　".repeat(depth)}${option.label}`,
      },
      ...flattenOptions(children ?? [], depth + 1),
    ];
  });
}

function selectableOptions(options: SystemOption[]) {
  return flattenOptions(options).filter((option) => option.value !== activeId.value);
}

async function load() {
  loadError.value = "";
  await listRequest.run(
    () => props.client.listEntities<SystemEntity>(props.config.basePath, { ...query }),
    {
      onSuccess: (result) => {
        page.records = result?.records ?? [];
        page.total = Number(result?.total ?? 0);
      },
      onError: (error) => {
        page.records = [];
        page.total = 0;
        loadError.value = systemErrorMessage(error, `${props.config.entityName}列表加载失败`);
      },
    },
  );
}

function search() {
  query.pageNum = 1;
  props.config.searchFields.forEach((field) => {
    query[field.key] = draft[field.key]?.trim() || undefined;
  });
  query.enabled = draft.enabled === "all" ? undefined : draft.enabled === "true";
  void load();
}

function resetSearch() {
  props.config.searchFields.forEach((field) => {
    draft[field.key] = "";
    query[field.key] = undefined;
  });
  draft.enabled = "all";
  query.enabled = undefined;
  query.pageNum = 1;
  void load();
}

function changePage(pageNum: number) {
  query.pageNum = pageNum;
  void load();
}

function resetForm() {
  detailRequest.invalidate();
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(form, props.config.initialValues);
  formRef.value?.clearValidate();
  activeId.value = "";
}

async function loadFieldOptions() {
  const fields = props.config.formFields.filter(
    (field) => field.optionsPath && !fieldOptions[field.key]?.length,
  );
  if (!fields.length) return;
  await optionsRequest.run(
    () => Promise.all(fields.map((field) => props.client.listOptions(field.optionsPath!))),
    {
      onSuccess: (options) => {
        fields.forEach((field, index) => {
          fieldOptions[field.key] = options[index] ?? [];
        });
      },
      onError: (error) => ElMessage.error(systemErrorMessage(error, "选项加载失败")),
    },
  );
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
  void loadFieldOptions();
}

async function openEdit(entity: SystemEntity) {
  resetForm();
  activeId.value = entity.id;
  dialogVisible.value = true;
  await detailRequest.run(
    async () => {
      const [detail] = await Promise.all([
        props.client.getEntity<SystemEntity>(props.config.basePath, entity.id),
        loadFieldOptions(),
      ]);
      return detail;
    },
    {
      onSuccess: (detail) => {
        props.config.formFields.forEach((field) => {
          form[field.key] = detail[field.key] ?? props.config.initialValues[field.key] ?? null;
        });
      },
      onError: (error) => {
        ElMessage.error(systemErrorMessage(error, `${props.config.entityName}详情加载失败`));
        dialogVisible.value = false;
      },
    },
  );
}

async function submit() {
  if (!formRef.value || !(await formRef.value.validate().catch(() => false))) {
    return;
  }

  submitting.value = true;
  try {
    const payload = Object.fromEntries(
      props.config.formFields.map((field) => {
        const value = form[field.key];
        return [field.key, value === "" || value === undefined ? null : value];
      }),
    );

    if (activeId.value) {
      await props.client.updateEntity(props.config.basePath, activeId.value, {
        ...payload,
        id: activeId.value,
      });
    } else {
      await props.client.createEntity(props.config.basePath, payload);
    }

    ElMessage.success(`${props.config.entityName}已保存`);
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, `${props.config.entityName}保存失败`));
  } finally {
    submitting.value = false;
  }
}

async function changeEnabled(entity: SystemEntity, enabled: boolean) {
  const previous = entity.enabled !== false;
  entity.enabled = enabled;
  statusLoadingId.value = entity.id;
  try {
    await props.client.updateEntityEnabled(props.config.basePath, entity.id, enabled);
    ElMessage.success(
      enabled ? `${props.config.entityName}已启用` : `${props.config.entityName}已停用`,
    );
  } catch (error) {
    entity.enabled = previous;
    ElMessage.error(systemErrorMessage(error, `${props.config.entityName}状态更新失败`));
  } finally {
    statusLoadingId.value = "";
  }
}

async function remove(entity: SystemEntity) {
  const label = displayValue(entity, props.config.primaryLabelKey);
  try {
    await ElMessageBox.confirm(
      `确认删除${props.config.entityName}“${label}”？存在业务引用时后端将拒绝删除。`,
      `删除${props.config.entityName}`,
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await props.client.deleteEntity(props.config.basePath, entity.id);
    ElMessage.success(`${props.config.entityName}已删除`);
    if (page.records.length === 1 && Number(query.pageNum) > 1) {
      query.pageNum = Number(query.pageNum) - 1;
    }
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, `${props.config.entityName}删除失败`));
    }
  }
}
</script>
