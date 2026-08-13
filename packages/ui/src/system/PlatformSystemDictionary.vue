<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Controlled Vocabulary</p>
        <h1>字典管理</h1>
        <span>统一维护业务枚举和展示标签，字典与字典项均写入系统服务并参与缓存查询。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>字典总数</small>
          <strong>{{ page.total }}</strong>
          <span>当前租户范围</span>
        </article>
        <article>
          <small>本页字典项</small>
          <strong>{{ itemCount }}</strong>
          <span>聚合列表统计</span>
        </article>
        <article>
          <small>本页启用</small>
          <strong>{{ enabledCount }}</strong>
          <span>可参与业务解析</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input v-model="draft.dictType" clearable placeholder="字典类型" @keyup.enter="search" />
        <el-input
          v-model="draft.dictLabel"
          clearable
          placeholder="字典标签"
          @keyup.enter="search"
        />
        <el-input v-model="draft.dictValue" clearable placeholder="字典值" @keyup.enter="search" />
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
          新增字典
        </el-button>
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Dictionary Registry</p>
          <h2 class="platform-title">字典与字典项</h2>
        </div>
        <span class="system-permission-hint">字典类型应保持稳定，业务代码按类型读取</span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />

      <el-table v-loading="loading" :data="page.records" stripe>
        <el-table-column type="index" label="序号" width="66" align="center" />
        <el-table-column prop="dictLabel" label="字典标签" min-width="170" />
        <el-table-column label="字典类型" min-width="200">
          <template #default="{ row }"
            ><code>{{ asDict(row).dictType }}</code></template
          >
        </el-table-column>
        <el-table-column prop="dictValue" label="字典值" min-width="150" />
        <el-table-column prop="itemCount" label="字典项" width="90" align="center" />
        <el-table-column prop="remark" label="说明" min-width="200" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="asDict(row).enabled !== false"
              :disabled="!canToggle"
              :loading="statusLoadingId === asDict(row).id"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="
                (value: boolean | string | number) => changeEnabled(asDict(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="205" fixed="right">
          <template #default="{ row }">
            <div class="system-row-actions">
              <el-button
                link
                type="success"
                :disabled="!canListItems"
                @click="openItems(asDict(row))"
                >字典项</el-button
              >
              <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asDict(row))"
                >编辑</el-button
              >
              <el-button link type="danger" :disabled="!canDelete" @click="remove(asDict(row))"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无匹配字典" />
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
    v-model="dictVisible"
    :title="activeDict ? '编辑字典' : '新增字典'"
    width="620px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @closed="resetDictForm"
  >
    <el-skeleton :loading="detailLoading" animated>
      <el-form ref="dictFormRef" :model="dictForm" :rules="dictRules" label-width="92px">
        <div class="system-dialog-grid">
          <el-form-item label="字典标签" prop="dictLabel">
            <el-input v-model="dictForm.dictLabel" maxlength="128" />
          </el-form-item>
          <el-form-item label="字典类型" prop="dictType">
            <el-input
              v-model="dictForm.dictType"
              maxlength="64"
              placeholder="例如：SYS_COMMON_STATUS"
            />
          </el-form-item>
          <el-form-item label="字典值" prop="dictValue">
            <el-input v-model="dictForm.dictValue" maxlength="128" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number
              v-model="dictForm.sortOrder"
              :min="0"
              :max="9999"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="备注" class="system-dialog-span">
            <el-input
              v-model="dictForm.remark"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>
      </el-form>
    </el-skeleton>
    <template #footer>
      <el-button @click="dictVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitDict">保存字典</el-button>
    </template>
  </el-dialog>

  <el-drawer
    v-model="itemsVisible"
    :title="`${itemTarget?.dictLabel || ''} · 字典项`"
    size="760px"
    append-to-body
  >
    <section class="system-drawer-toolbar">
      <div>
        <code>{{ itemTarget?.dictType }}</code>
        <span>共 {{ itemPage.total }} 项</span>
      </div>
      <el-button type="primary" :icon="Plus" :disabled="!canCreateItem" @click="openCreateItem">
        新增字典项
      </el-button>
    </section>
    <el-table v-loading="itemsLoading" :data="itemPage.records" stripe>
      <el-table-column prop="itemLabel" label="显示标签" min-width="150" />
      <el-table-column label="字典项值" min-width="150">
        <template #default="{ row }"
          ><code>{{ asItem(row).itemValue }}</code></template
        >
      </el-table-column>
      <el-table-column label="默认" width="82" align="center">
        <template #default="{ row }">
          <el-tag v-if="asItem(row).itemSelected" type="success" size="small">默认</el-tag>
          <el-button
            v-else
            link
            type="primary"
            :disabled="!canToggleItem"
            @click="makeDefault(asItem(row))"
            >设为默认</el-button
          >
        </template>
      </el-table-column>
      <el-table-column label="状态" width="92" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="asItem(row).enabled !== false"
            :disabled="!canToggleItem"
            @change="
              (value: boolean | string | number) => changeItemEnabled(asItem(row), Boolean(value))
            "
          />
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="75" align="center" />
      <el-table-column label="操作" width="125">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="!canEditItem" @click="openEditItem(asItem(row))"
            >编辑</el-button
          >
          <el-button link type="danger" :disabled="!canDeleteItem" @click="removeItem(asItem(row))"
            >删除</el-button
          >
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="该字典暂无字典项" />
      </template>
    </el-table>
    <PlatformPager
      :page="itemQuery.pageNum"
      :page-size="itemQuery.pageSize"
      :total="itemPage.total"
      @change="changeItemPage"
    />
  </el-drawer>

  <el-dialog
    v-model="itemFormVisible"
    :title="activeItem ? '编辑字典项' : '新增字典项'"
    width="580px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @closed="resetItemForm"
  >
    <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="96px">
      <div class="system-dialog-grid">
        <el-form-item label="显示标签" prop="itemLabel">
          <el-input v-model="itemForm.itemLabel" maxlength="128" />
        </el-form-item>
        <el-form-item label="字典项值" prop="itemValue">
          <el-input v-model="itemForm.itemValue" maxlength="128" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-input v-model="itemForm.itemColor" maxlength="32" placeholder="#315f94" />
        </el-form-item>
        <el-form-item label="样式类型">
          <el-input v-model="itemForm.itemStyle" maxlength="64" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sortOrder" :min="0" :max="9999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="选项">
          <div class="system-switch-row">
            <el-switch v-model="itemForm.enabled" active-text="启用" inactive-text="停用" />
            <el-switch v-model="itemForm.itemSelected" active-text="默认" inactive-text="普通" />
          </div>
        </el-form-item>
        <el-form-item label="备注" class="system-dialog-span">
          <el-input
            v-model="itemForm.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="itemFormVisible = false">取消</el-button>
      <el-button type="primary" :loading="itemSubmitting" @click="submitItem">保存字典项</el-button>
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
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElSkeleton,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import type {
  SystemDictionary,
  SystemDictionaryItem,
  SystemPage,
} from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

type EnabledFilter = "all" | "true" | "false";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const can = (permission: string) => hasSystemPermission(props, permission);
const canCreate = can("system:dict:add");
const canEdit = can("system:dict:query") && can("system:dict:edit");
const canToggle = can("system:dict:edit");
const canDelete = can("system:dict:delete");
const canListItems = can("system:dictItem:list");
const canCreateItem = can("system:dictItem:add");
const canEditItem = can("system:dictItem:query") && can("system:dictItem:edit");
const canToggleItem = can("system:dictItem:edit");
const canDeleteItem = can("system:dictItem:delete");

const loading = ref(false);
const detailLoading = ref(false);
const submitting = ref(false);
const itemsLoading = ref(false);
const itemSubmitting = ref(false);
const loadError = ref("");
const statusLoadingId = ref("");
const dictVisible = ref(false);
const itemsVisible = ref(false);
const itemFormVisible = ref(false);
const activeDict = ref<SystemDictionary>();
const itemTarget = ref<SystemDictionary>();
const activeItem = ref<SystemDictionaryItem>();
const dictFormRef = ref<FormInstance>();
const itemFormRef = ref<FormInstance>();
const page = reactive<SystemPage<SystemDictionary>>({ records: [], total: 0 });
const itemPage = reactive<SystemPage<SystemDictionaryItem>>({ records: [], total: 0 });
const query = reactive({ pageNum: 1, pageSize: 10 });
const itemQuery = reactive({ pageNum: 1, pageSize: 10 });
const draft = reactive<{
  dictType: string;
  dictLabel: string;
  dictValue: string;
  enabled: EnabledFilter;
}>({
  dictType: "",
  dictLabel: "",
  dictValue: "",
  enabled: "all",
});
const dictForm = reactive({
  dictType: "",
  dictLabel: "",
  dictValue: "",
  sortOrder: 0,
  remark: "",
});
const itemForm = reactive({
  itemLabel: "",
  itemValue: "",
  itemStyle: "",
  itemColor: "",
  itemSelected: false,
  enabled: true,
  sortOrder: 0,
  remark: "",
});

const dictRules: FormRules = {
  dictType: [{ required: true, message: "请输入字典类型", trigger: "blur" }],
  dictLabel: [{ required: true, message: "请输入字典标签", trigger: "blur" }],
  dictValue: [{ required: true, message: "请输入字典值", trigger: "blur" }],
};
const itemRules: FormRules = {
  itemLabel: [{ required: true, message: "请输入显示标签", trigger: "blur" }],
  itemValue: [{ required: true, message: "请输入字典项值", trigger: "blur" }],
};

const itemCount = computed(() =>
  page.records.reduce((sum, dict) => sum + Number(dict.itemCount ?? 0), 0),
);
const enabledCount = computed(() => page.records.filter((dict) => dict.enabled !== false).length);

onMounted(load);

function asDict(value: unknown) {
  return value as SystemDictionary;
}

function asItem(value: unknown) {
  return value as SystemDictionaryItem;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await props.client.listDictionaries(query);
    page.records = result?.records ?? [];
    page.total = Number(result?.total ?? 0);
  } catch (error) {
    page.records = [];
    page.total = 0;
    loadError.value = systemErrorMessage(error, "字典列表加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  Object.assign(query, {
    pageNum: 1,
    dictType: draft.dictType.trim() || undefined,
    dictLabel: draft.dictLabel.trim() || undefined,
    dictValue: draft.dictValue.trim() || undefined,
    enabled: draft.enabled === "all" ? undefined : draft.enabled === "true",
  });
  void load();
}

function resetSearch() {
  Object.assign(draft, { dictType: "", dictLabel: "", dictValue: "", enabled: "all" });
  Object.assign(query, {
    pageNum: 1,
    dictType: undefined,
    dictLabel: undefined,
    dictValue: undefined,
    enabled: undefined,
  });
  void load();
}

function changePage(pageNum: number) {
  query.pageNum = pageNum;
  void load();
}

function resetDictForm() {
  activeDict.value = undefined;
  Object.assign(dictForm, {
    dictType: "",
    dictLabel: "",
    dictValue: "",
    sortOrder: 0,
    remark: "",
  });
  dictFormRef.value?.clearValidate();
}

function openCreate() {
  resetDictForm();
  dictVisible.value = true;
}

async function openEdit(dict: SystemDictionary) {
  resetDictForm();
  activeDict.value = dict;
  dictVisible.value = true;
  detailLoading.value = true;
  try {
    const detail = await props.client.getDictionary(dict.id);
    Object.assign(dictForm, {
      dictType: detail.dictType,
      dictLabel: detail.dictLabel,
      dictValue: detail.dictValue,
      sortOrder: detail.sortOrder ?? 0,
      remark: detail.remark || "",
    });
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字典详情加载失败"));
    dictVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function submitDict() {
  if (!dictFormRef.value || !(await dictFormRef.value.validate().catch(() => false))) {
    return;
  }

  const payload = {
    dictType: dictForm.dictType.trim(),
    dictLabel: dictForm.dictLabel.trim(),
    dictValue: dictForm.dictValue.trim(),
    sortOrder: dictForm.sortOrder,
    remark: dictForm.remark.trim() || undefined,
  };
  submitting.value = true;
  try {
    if (activeDict.value) {
      await props.client.updateDictionary(activeDict.value.id, {
        ...payload,
        id: activeDict.value.id,
      });
    } else {
      await props.client.createDictionary(payload);
    }
    ElMessage.success("字典已保存");
    dictVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字典保存失败"));
  } finally {
    submitting.value = false;
  }
}

async function changeEnabled(dict: SystemDictionary, enabled: boolean) {
  const previous = dict.enabled !== false;
  dict.enabled = enabled;
  statusLoadingId.value = dict.id;
  try {
    await props.client.updateDictionaryEnabled(dict.id, enabled);
    ElMessage.success(enabled ? "字典已启用" : "字典已停用");
  } catch (error) {
    dict.enabled = previous;
    ElMessage.error(systemErrorMessage(error, "字典状态更新失败"));
  } finally {
    statusLoadingId.value = "";
  }
}

async function remove(dict: SystemDictionary) {
  try {
    await ElMessageBox.confirm(
      `确认删除字典“${dict.dictLabel}”？请先清空其字典项和业务引用。`,
      "删除字典",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await props.client.deleteDictionary(dict.id);
    ElMessage.success("字典已删除");
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "字典删除失败"));
    }
  }
}

async function openItems(dict: SystemDictionary) {
  itemTarget.value = dict;
  itemQuery.pageNum = 1;
  itemsVisible.value = true;
  await loadItems();
}

async function loadItems() {
  if (!itemTarget.value) {
    return;
  }
  itemsLoading.value = true;
  try {
    const result = await props.client.listDictionaryItems({
      ...itemQuery,
      dictId: itemTarget.value.id,
    });
    itemPage.records = result?.records ?? [];
    itemPage.total = Number(result?.total ?? 0);
  } catch (error) {
    itemPage.records = [];
    itemPage.total = 0;
    ElMessage.error(systemErrorMessage(error, "字典项加载失败"));
  } finally {
    itemsLoading.value = false;
  }
}

function changeItemPage(pageNum: number) {
  itemQuery.pageNum = pageNum;
  void loadItems();
}

function resetItemForm() {
  activeItem.value = undefined;
  Object.assign(itemForm, {
    itemLabel: "",
    itemValue: "",
    itemStyle: "",
    itemColor: "",
    itemSelected: false,
    enabled: true,
    sortOrder: 0,
    remark: "",
  });
  itemFormRef.value?.clearValidate();
}

function openCreateItem() {
  resetItemForm();
  itemFormVisible.value = true;
}

async function openEditItem(item: SystemDictionaryItem) {
  resetItemForm();
  activeItem.value = item;
  itemFormVisible.value = true;
  try {
    const detail = await props.client.getDictionaryItem(item.id);
    Object.assign(itemForm, {
      itemLabel: detail.itemLabel,
      itemValue: detail.itemValue,
      itemStyle: detail.itemStyle || "",
      itemColor: detail.itemColor || "",
      itemSelected: Boolean(detail.itemSelected),
      enabled: detail.enabled !== false,
      sortOrder: detail.sortOrder ?? 0,
      remark: detail.remark || "",
    });
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字典项详情加载失败"));
    itemFormVisible.value = false;
  }
}

async function submitItem() {
  if (
    !itemTarget.value ||
    !itemFormRef.value ||
    !(await itemFormRef.value.validate().catch(() => false))
  ) {
    return;
  }

  const payload = {
    dictId: itemTarget.value.id,
    dictCode: itemTarget.value.dictType,
    itemLabel: itemForm.itemLabel.trim(),
    itemValue: itemForm.itemValue.trim(),
    itemStyle: itemForm.itemStyle.trim() || undefined,
    itemColor: itemForm.itemColor.trim() || undefined,
    itemSelected: itemForm.itemSelected,
    enabled: itemForm.enabled,
    sortOrder: itemForm.sortOrder,
    remark: itemForm.remark.trim() || undefined,
  };
  itemSubmitting.value = true;
  try {
    if (activeItem.value) {
      await props.client.updateDictionaryItem(activeItem.value.id, payload);
    } else {
      await props.client.createDictionaryItem(payload);
    }
    ElMessage.success("字典项已保存");
    itemFormVisible.value = false;
    await Promise.all([loadItems(), load()]);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字典项保存失败"));
  } finally {
    itemSubmitting.value = false;
  }
}

async function changeItemEnabled(item: SystemDictionaryItem, enabled: boolean) {
  const previous = item.enabled !== false;
  item.enabled = enabled;
  try {
    await props.client.updateDictionaryItemEnabled(item.id, enabled);
    ElMessage.success(enabled ? "字典项已启用" : "字典项已停用");
  } catch (error) {
    item.enabled = previous;
    ElMessage.error(systemErrorMessage(error, "字典项状态更新失败"));
  }
}

async function makeDefault(item: SystemDictionaryItem) {
  try {
    await props.client.setDefaultDictionaryItem(item.id);
    ElMessage.success("默认字典项已更新");
    await loadItems();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "默认字典项更新失败"));
  }
}

async function removeItem(item: SystemDictionaryItem) {
  try {
    await ElMessageBox.confirm(`确认删除字典项“${item.itemLabel}”？`, "删除字典项", {
      type: "warning",
      confirmButtonText: "确认删除",
      cancelButtonText: "取消",
    });
    await props.client.deleteDictionaryItem(item.id);
    ElMessage.success("字典项已删除");
    await Promise.all([loadItems(), load()]);
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "字典项删除失败"));
    }
  }
}
</script>
