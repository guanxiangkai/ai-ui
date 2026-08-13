<template>
  <section class="role-management-page">
    <section class="platform-panel role-management-hero platform-accent-blue">
      <div>
        <p class="platform-eyebrow">Access Control</p>
        <h1>角色管理</h1>
        <span>维护真实角色、数据范围与菜单权限；所有变更直接写入系统服务并刷新认证缓存。</span>
      </div>
      <div class="role-stat-grid">
        <article>
          <small>角色总数</small>
          <strong>{{ page.total }}</strong>
          <span>当前租户内角色</span>
        </article>
        <article>
          <small>本页启用</small>
          <strong>{{ enabledCount }}</strong>
          <span>可正常参与授权</span>
        </article>
        <article>
          <small>默认角色</small>
          <strong>{{ defaultCount }}</strong>
          <span>注册审核兜底角色</span>
        </article>
      </div>
    </section>

    <section class="platform-panel role-query-panel">
      <div class="role-query-fields">
        <el-input v-model="draft.roleName" clearable placeholder="角色名称" @keyup.enter="search" />
        <el-input v-model="draft.roleCode" clearable placeholder="角色编码" @keyup.enter="search" />
        <select v-model="draft.enabled" class="role-native-select" aria-label="启用状态">
          <option value="all">全部状态</option>
          <option value="true">启用</option>
          <option value="false">停用</option>
        </select>
      </div>
      <div class="role-query-actions">
        <el-button :icon="Refresh" @click="reset">重置</el-button>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button type="success" :icon="Plus" :disabled="!canCreate" @click="openCreate">
          新增角色
        </el-button>
      </div>
    </section>

    <section class="platform-panel role-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Role Directory</p>
          <h2 class="platform-title">角色与授权</h2>
        </div>
        <span v-if="!canCreate" class="role-permission-hint">当前账号仅可查看角色</span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false">
        <template #default>
          <el-button link type="primary" @click="load">重新加载</el-button>
        </template>
      </el-alert>

      <el-table v-loading="loading" :data="page.records" stripe>
        <el-table-column type="index" label="序号" width="66" align="center" />
        <el-table-column prop="roleName" label="角色名称" min-width="170">
          <template #default="{ row }">
            <div class="role-name-cell">
              <strong>{{ row.roleName }}</strong>
              <span v-if="row.defaultRegistrationRole">默认角色</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="roleCode" label="角色编码" min-width="180">
          <template #default="{ row }">
            <code>{{ row.roleCode }}</code>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="90" align="center">
          <template #default="{ row }">{{ row.sortOrder ?? row.sort ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled !== false"
              :loading="statusLoadingId === row.id"
              :disabled="!canEdit"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="
                (value: boolean | string | number) => changeEnabled(asRole(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="role-row-actions">
              <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asRole(row))"
                >编辑</el-button
              >
              <el-button
                link
                type="success"
                :disabled="!canAssignPermission"
                @click="openPermission(asRole(row))"
              >
                菜单授权
              </el-button>
              <el-button link type="danger" :disabled="!canDelete" @click="remove(asRole(row))"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无匹配角色" />
        </template>
      </el-table>

      <PlatformPager
        :page="query.pageNum"
        :page-size="query.pageSize"
        :total="page.total"
        @change="changePage"
      />
    </section>

    <PlatformRoleFormDialog
      v-model="formVisible"
      :client="props.client"
      :role-id="activeRole?.id"
      @saved="load"
    />
    <PlatformRolePermissionDialog
      v-if="canAssignPermission"
      v-model="permissionVisible"
      :client="props.client"
      :role-id="activeRole?.id"
      :role-name="activeRole?.roleName"
      @saved="load"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onMounted } from "vue";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import {
  ElAlert,
  ElButton,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from "element-plus";
import type { RoleQuery, RoleSummary, SystemPage } from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import PlatformRoleFormDialog from "./PlatformRoleFormDialog.vue";
import PlatformRolePermissionDialog from "./PlatformRolePermissionDialog.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

type EnabledFilter = "all" | "true" | "false";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const can = (permission: string) => hasSystemPermission(props, permission);

const canCreate = can("system:role:add");
const canEdit = can("system:role:edit");
const canDelete = can("system:role:delete");
const canAssignPermission = can("system:role:query") && can("system:role:assignPermission");

const loading = ref(false);
const loadError = ref("");
const statusLoadingId = ref("");
const formVisible = ref(false);
const permissionVisible = ref(false);
const activeRole = ref<RoleSummary>();
const page = reactive<SystemPage<RoleSummary>>({ records: [], total: 0 });
const draft = reactive<{ roleName: string; roleCode: string; enabled: EnabledFilter }>({
  roleName: "",
  roleCode: "",
  enabled: "all",
});
const query = reactive<RoleQuery>({
  pageNum: 1,
  pageSize: 10,
});

const enabledCount = computed(() => page.records.filter((role) => role.enabled !== false).length);
const defaultCount = computed(
  () => page.records.filter((role) => role.defaultRegistrationRole).length,
);

onMounted(load);

function asRole(row: unknown): RoleSummary {
  return row as RoleSummary;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await props.client.listRoles(query);
    page.records = result?.records ?? [];
    page.total = Number(result?.total ?? 0);
    page.pageNum = result?.pageNum;
    page.pageSize = result?.pageSize;
    page.pages = result?.pages;
  } catch (error) {
    page.records = [];
    page.total = 0;
    loadError.value = systemErrorMessage(error, "角色列表加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  query.pageNum = 1;
  query.roleName = draft.roleName.trim() || undefined;
  query.roleCode = draft.roleCode.trim() || undefined;
  query.enabled = draft.enabled === "all" ? undefined : draft.enabled === "true";
  void load();
}

function reset() {
  Object.assign(draft, { roleName: "", roleCode: "", enabled: "all" });
  Object.assign(query, {
    pageNum: 1,
    pageSize: 10,
    roleName: undefined,
    roleCode: undefined,
    enabled: undefined,
  });
  void load();
}

function changePage(nextPage: number) {
  query.pageNum = nextPage;
  void load();
}

function openCreate() {
  activeRole.value = undefined;
  formVisible.value = true;
}

function openEdit(role: RoleSummary) {
  activeRole.value = role;
  formVisible.value = true;
}

function openPermission(role: RoleSummary) {
  if (!canAssignPermission) {
    return;
  }

  activeRole.value = role;
  permissionVisible.value = true;
}

async function changeEnabled(role: RoleSummary, enabled: boolean) {
  const previous = role.enabled !== false;
  role.enabled = enabled;
  statusLoadingId.value = role.id;
  try {
    await props.client.updateRoleEnabled(role.id, enabled);
    ElMessage.success(enabled ? "角色已启用" : "角色已停用");
  } catch (error) {
    role.enabled = previous;
    ElMessage.error(systemErrorMessage(error, "角色状态更新失败"));
  } finally {
    statusLoadingId.value = "";
  }
}

async function remove(role: RoleSummary) {
  try {
    await ElMessageBox.confirm(
      `确认删除角色“${role.roleName}”？已被用户引用的角色将由后端拒绝删除。`,
      "删除角色",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await props.client.deleteRole(role.id);
    ElMessage.success("角色已删除");
    if (page.records.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1;
    }
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "角色删除失败"));
    }
  }
}
</script>
