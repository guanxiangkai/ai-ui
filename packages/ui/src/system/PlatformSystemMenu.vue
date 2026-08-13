<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Navigation Authority</p>
        <h1>菜单管理</h1>
        <span>系统菜单是角色授权的权威来源；目录、页面和按钮权限在同一棵树中统一维护。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>节点总数</small>
          <strong>{{ flatMenus.length }}</strong>
          <span>目录、页面与按钮</span>
        </article>
        <article>
          <small>可见页面</small>
          <strong>{{ visibleCount }}</strong>
          <span>进入用户菜单树</span>
        </article>
        <article>
          <small>权限按钮</small>
          <strong>{{ permissionCount }}</strong>
          <span>用于按钮级授权</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input
          v-model="keyword"
          clearable
          placeholder="菜单名称 / 标题 / 权限标识"
          @keyup.enter="applyFilter"
        />
        <select v-model="typeFilter" class="system-native-select" aria-label="菜单类型">
          <option value="all">全部类型</option>
          <option value="DIRECTORY">目录</option>
          <option value="MENU">页面</option>
          <option value="BUTTON">按钮</option>
        </select>
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="resetFilter">重置</el-button>
        <el-button type="primary" :icon="Search" @click="applyFilter">查询</el-button>
        <el-button type="success" :icon="Plus" :disabled="!canCreate" @click="openCreate()">
          新增菜单
        </el-button>
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Permission Tree</p>
          <h2 class="platform-title">菜单与按钮权限树</h2>
        </div>
        <span class="system-permission-hint">删除父节点前必须先清理子节点</span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false">
        <template #default>
          <el-button link type="primary" @click="load">重新加载</el-button>
        </template>
      </el-alert>

      <el-table
        v-loading="loading"
        :data="filteredMenus"
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
      >
        <el-table-column label="菜单标题" min-width="220">
          <template #default="{ row }">
            <div class="system-primary-cell">
              <strong>{{ asMenu(row).menuTitle || asMenu(row).menuName }}</strong>
              <code>{{ asMenu(row).menuName }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="menuTagType(asMenu(row).menuType)" size="small">
              {{ menuTypeLabel(asMenu(row).menuType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路由路径" min-width="190">
          <template #default="{ row }">{{ asMenu(row).path || "—" }}</template>
        </el-table-column>
        <el-table-column prop="component" label="组件" min-width="190">
          <template #default="{ row }">{{ asMenu(row).component || "—" }}</template>
        </el-table-column>
        <el-table-column prop="permission" label="权限标识" min-width="190">
          <template #default="{ row }">
            <code v-if="asMenu(row).permission">{{ asMenu(row).permission }}</code>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="显示" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="asMenu(row).visible !== false"
              :disabled="!canEdit"
              @change="
                (value: boolean | string | number) => changeVisible(asMenu(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="asMenu(row).enabled !== false"
              :loading="statusLoadingId === asMenu(row).id"
              :disabled="!canToggle"
              @change="
                (value: boolean | string | number) => changeEnabled(asMenu(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="80" align="center">
          <template #default="{ row }">{{
            asMenu(row).sortOrder ?? asMenu(row).sort ?? 0
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="205" fixed="right">
          <template #default="{ row }">
            <div class="system-row-actions">
              <el-button
                link
                type="success"
                :disabled="!canCreate"
                @click="openCreate(asMenu(row).id)"
                >新增子项</el-button
              >
              <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asMenu(row))"
                >编辑</el-button
              >
              <el-button link type="danger" :disabled="!canDelete" @click="remove(asMenu(row))"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无匹配菜单" />
        </template>
      </el-table>
    </section>
  </section>

  <el-dialog
    v-model="dialogVisible"
    :title="activeId ? '编辑菜单' : '新增菜单'"
    width="760px"
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
        <el-alert
          v-if="form.menuType === 'MENU'"
          type="info"
          :closable="false"
          show-icon
          title="组件字段保存前端注册键；只有随代码发布的注册键才能成为可访问页面。"
          class="system-dialog-alert"
        />
        <div class="system-dialog-grid">
          <el-form-item label="菜单类型" prop="menuType">
            <select v-model="form.menuType" class="system-native-select">
              <option value="DIRECTORY">目录</option>
              <option value="MENU">页面</option>
              <option value="BUTTON">按钮</option>
            </select>
          </el-form-item>
          <el-form-item label="上级菜单">
            <select v-model="form.parentId" class="system-native-select" aria-label="选择上级菜单">
              <option value="">顶级菜单</option>
              <option
                v-for="option in parentOptions"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </option>
            </select>
          </el-form-item>
          <el-form-item label="菜单标题" prop="menuTitle">
            <el-input v-model="form.menuTitle" maxlength="128" placeholder="页面展示名称" />
          </el-form-item>
          <el-form-item label="菜单名称" prop="menuName">
            <el-input v-model="form.menuName" maxlength="128" placeholder="稳定英文标识" />
          </el-form-item>
          <el-form-item label="路由路径">
            <el-input v-model="form.path" maxlength="255" placeholder="例如 /system/users" />
          </el-form-item>
          <el-form-item label="组件路径">
            <el-input
              v-model="form.component"
              maxlength="255"
              placeholder="例如 admin/UserManagementPage"
            />
          </el-form-item>
          <el-form-item label="权限标识">
            <el-input v-model="form.permission" maxlength="128" placeholder="system:example:list" />
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="form.icon" maxlength="128" placeholder="Element Plus 图标名" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="form.sortOrder" :min="0" :max="9999" style="width: 100%" />
          </el-form-item>
          <el-form-item label="页面选项">
            <div class="system-switch-row">
              <el-switch v-model="form.visible" active-text="显示" inactive-text="隐藏" />
              <el-switch v-model="form.keepAlive" active-text="缓存" inactive-text="不缓存" />
              <el-switch v-model="form.isExternal" active-text="外链" inactive-text="站内" />
            </div>
          </el-form-item>
          <el-form-item label="备注" class="system-dialog-span">
            <el-input
              v-model="form.remark"
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
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存菜单</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules, TagProps } from "element-plus";
import {
  ElAlert,
  ElButton,
  ElDialog,
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
  SystemMenu,
  SystemMenuPayload,
  SystemMenuType,
  SystemOption,
} from "@guanxiangkai/platform-client";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const emit = defineEmits<{ navigationChanged: [] }>();
const can = (permission: string) => hasSystemPermission(props, permission);
const canCreate = can("system:menu:add");
const canQuery = can("system:menu:query");
const canEdit = canQuery && can("system:menu:edit");
const canToggle = can("system:menu:edit");
const canDelete = can("system:menu:delete");

const loading = ref(false);
const detailLoading = ref(false);
const submitting = ref(false);
const loadError = ref("");
const statusLoadingId = ref("");
const dialogVisible = ref(false);
const activeId = ref("");
const keyword = ref("");
const appliedKeyword = ref("");
const typeFilter = ref("all");
const appliedType = ref("all");
const menus = ref<SystemMenu[]>([]);
const formRef = ref<FormInstance>();
const form = reactive({
  parentId: "",
  menuName: "",
  menuTitle: "",
  menuType: "MENU" as SystemMenuType,
  path: "",
  component: "",
  permission: "",
  icon: "",
  visible: true,
  keepAlive: false,
  isExternal: false,
  sortOrder: 0,
  remark: "",
});

const rules: FormRules = {
  menuName: [{ required: true, message: "请输入菜单名称", trigger: "blur" }],
  menuTitle: [{ required: true, message: "请输入菜单标题", trigger: "blur" }],
  menuType: [{ required: true, message: "请选择菜单类型", trigger: "change" }],
};

const MENU_TAG_TYPES = {
  DIRECTORY: "warning",
  MENU: "primary",
  BUTTON: "info",
} satisfies Record<SystemMenuType, NonNullable<TagProps["type"]>>;

const flatMenus = computed(() => flattenMenus(menus.value));
const visibleCount = computed(
  () =>
    flatMenus.value.filter((menu) => menu.menuType !== "BUTTON" && menu.visible !== false).length,
);
const permissionCount = computed(
  () => flatMenus.value.filter((menu) => Boolean(menu.permission)).length,
);
const parentOptions = computed(() => createParentOptions(menus.value, activeId.value));
const filteredMenus = computed(() =>
  filterMenus(menus.value, appliedKeyword.value, appliedType.value),
);

onMounted(load);

function asMenu(value: unknown) {
  return value as SystemMenu;
}

function menuTypeLabel(value: SystemMenuType) {
  return { DIRECTORY: "目录", MENU: "页面", BUTTON: "按钮" }[value];
}

function menuTagType(value: SystemMenuType): NonNullable<TagProps["type"]> {
  return MENU_TAG_TYPES[value];
}

function flattenMenus(nodes: SystemMenu[]): SystemMenu[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children ?? [])]);
}

function createParentOptions(nodes: SystemMenu[], excludedId: string, depth = 0): SystemOption[] {
  return nodes
    .filter((node) => node.id !== excludedId)
    .flatMap((node) => [
      {
        label: `${"　".repeat(depth)}${node.menuTitle || node.menuName}`,
        value: node.id,
      },
      ...createParentOptions(node.children ?? [], excludedId, depth + 1),
    ]);
}

function filterMenus(nodes: SystemMenu[], search: string, type: string): SystemMenu[] {
  const term = search.trim().toLowerCase();

  return nodes.flatMap((node) => {
    const children = filterMenus(node.children ?? [], search, type);
    const matchesType = type === "all" || node.menuType === type;
    const matchesTerm =
      !term ||
      [node.menuName, node.menuTitle, node.permission, node.path].some((value) =>
        value?.toLowerCase().includes(term),
      );

    if ((matchesType && matchesTerm) || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    menus.value = (await props.client.getMenuTree()) ?? [];
  } catch (error) {
    menus.value = [];
    loadError.value = systemErrorMessage(error, "菜单树加载失败");
  } finally {
    loading.value = false;
  }
}

function applyFilter() {
  appliedKeyword.value = keyword.value;
  appliedType.value = typeFilter.value;
}

function resetFilter() {
  keyword.value = "";
  typeFilter.value = "all";
  applyFilter();
}

function notifyNavigationChanged() {
  emit("navigationChanged");
}

function resetForm() {
  activeId.value = "";
  Object.assign(form, {
    parentId: "",
    menuName: "",
    menuTitle: "",
    menuType: "MENU" as SystemMenuType,
    path: "",
    component: "",
    permission: "",
    icon: "",
    visible: true,
    keepAlive: false,
    isExternal: false,
    sortOrder: 0,
    remark: "",
  });
  formRef.value?.clearValidate();
}

function openCreate(parentId = "") {
  resetForm();
  form.parentId = parentId;
  dialogVisible.value = true;
}

async function openEdit(menu: SystemMenu) {
  resetForm();
  activeId.value = menu.id;
  dialogVisible.value = true;
  detailLoading.value = true;
  try {
    const detail = await props.client.getMenu(menu.id);
    Object.assign(form, {
      parentId: detail.parentId || "",
      menuName: detail.menuName || "",
      menuTitle: detail.menuTitle || "",
      menuType: detail.menuType,
      path: detail.path || "",
      component: detail.component || "",
      permission: detail.permission || "",
      icon: detail.icon || "",
      visible: detail.visible !== false,
      keepAlive: Boolean(detail.keepAlive),
      isExternal: Boolean(detail.isExternal),
      sortOrder: detail.sortOrder ?? detail.sort ?? 0,
      remark: detail.remark || "",
    });
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "菜单详情加载失败"));
    dialogVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

function buildPayload(): SystemMenuPayload {
  return {
    ...(activeId.value ? { id: activeId.value } : {}),
    parentId: form.parentId || undefined,
    menuName: form.menuName.trim(),
    menuTitle: form.menuTitle.trim(),
    menuType: form.menuType,
    path: form.path.trim() || undefined,
    component: form.component.trim() || undefined,
    permission: form.permission.trim() || undefined,
    icon: form.icon.trim() || undefined,
    visible: form.visible,
    keepAlive: form.keepAlive,
    isExternal: form.isExternal,
    sortOrder: form.sortOrder,
    sort: form.sortOrder,
    remark: form.remark.trim() || undefined,
  };
}

async function submit() {
  if (!formRef.value || !(await formRef.value.validate().catch(() => false))) {
    return;
  }
  if (form.menuType === "MENU" && !form.path.trim()) {
    ElMessage.warning("页面菜单必须填写路由路径");
    return;
  }
  if (form.menuType === "MENU" && !form.isExternal && !form.component.trim()) {
    ElMessage.warning("站内页面菜单必须填写前端组件注册键");
    return;
  }

  submitting.value = true;
  try {
    const payload = buildPayload();
    if (activeId.value) {
      await props.client.updateMenu(activeId.value, payload);
    } else {
      await props.client.createMenu(payload);
    }
    ElMessage.success("菜单已保存");
    dialogVisible.value = false;
    await load();
    notifyNavigationChanged();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "菜单保存失败"));
  } finally {
    submitting.value = false;
  }
}

async function changeVisible(menu: SystemMenu, visible: boolean) {
  const previous = menu.visible !== false;
  menu.visible = visible;
  try {
    const detail = await props.client.getMenu(menu.id);
    await props.client.updateMenu(menu.id, {
      id: menu.id,
      parentId: detail.parentId,
      menuName: detail.menuName,
      menuTitle: detail.menuTitle,
      menuType: detail.menuType,
      path: detail.path,
      component: detail.component,
      permission: detail.permission,
      icon: detail.icon,
      visible,
      keepAlive: Boolean(detail.keepAlive),
      isExternal: Boolean(detail.isExternal),
      sortOrder: detail.sortOrder,
      sort: detail.sort,
      remark: detail.remark,
    });
    ElMessage.success(visible ? "菜单已显示" : "菜单已隐藏");
    notifyNavigationChanged();
  } catch (error) {
    menu.visible = previous;
    ElMessage.error(systemErrorMessage(error, "菜单显示状态更新失败"));
  }
}

async function changeEnabled(menu: SystemMenu, enabled: boolean) {
  const previous = menu.enabled !== false;
  menu.enabled = enabled;
  statusLoadingId.value = menu.id;
  try {
    await props.client.updateMenuEnabled(menu.id, enabled);
    ElMessage.success(enabled ? "菜单已启用" : "菜单已停用");
    notifyNavigationChanged();
  } catch (error) {
    menu.enabled = previous;
    ElMessage.error(systemErrorMessage(error, "菜单启用状态更新失败"));
  } finally {
    statusLoadingId.value = "";
  }
}

async function remove(menu: SystemMenu) {
  try {
    await ElMessageBox.confirm(
      `确认删除菜单“${menu.menuTitle || menu.menuName}”？存在子菜单时后端将拒绝删除。`,
      "删除菜单",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await props.client.deleteMenu(menu.id);
    ElMessage.success("菜单已删除");
    await load();
    notifyNavigationChanged();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "菜单删除失败"));
    }
  }
}
</script>
