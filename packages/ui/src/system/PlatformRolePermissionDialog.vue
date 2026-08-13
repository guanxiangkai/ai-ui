<template>
  <el-dialog
    :model-value="modelValue"
    title="配置角色菜单权限"
    width="760px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @close="close"
  >
    <section v-loading="loading" class="role-permission-dialog">
      <header>
        <div>
          <strong>{{ roleName }}</strong>
          <span>勾选菜单及操作权限，保存后立即刷新该角色用户的认证权限。</span>
        </div>
        <el-checkbox
          :model-value="allChecked"
          :indeterminate="indeterminate"
          :disabled="!loadSucceeded || loading"
          @change="toggleAll"
        >
          全选
        </el-checkbox>
      </header>
      <el-tree
        ref="treeRef"
        :data="menus"
        :props="{ children: 'children', label: 'menuTitle' }"
        node-key="id"
        show-checkbox
        default-expand-all
        class="role-permission-tree"
        @check="syncChecked"
      >
        <template #default="{ data }">
          <span class="role-permission-node">
            <strong>{{ data.menuTitle || data.menuName || "未命名菜单" }}</strong>
            <small v-if="data.permission">{{ data.permission }}</small>
          </span>
        </template>
      </el-tree>
      <el-empty v-if="!loading && loadSucceeded && !menus.length" description="暂无可配置菜单" />
      <el-empty v-if="!loading && !loadSucceeded" description="角色权限加载失败，请重试">
        <el-button type="primary" plain @click="load">重新加载</el-button>
      </el-empty>
    </section>

    <template #footer>
      <span class="role-permission-count">已选 {{ checkedCount }} 项</span>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="submitting" @click="submit">
        保存权限
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ElButton, ElCheckbox, ElDialog, ElEmpty, ElMessage, ElTree } from "element-plus";
import type { MenuTreeNode, SystemClient } from "@guanxiangkai/platform-client";
import { getRestorableLeafIds } from "./role-permission-tree";
import { systemErrorMessage } from "./system-context";

interface TreeControl {
  getCheckedKeys: (leafOnly?: boolean) => unknown[];
  getHalfCheckedKeys: () => unknown[];
  setCheckedKeys: (keys: string[], leafOnly?: boolean) => void;
}

const props = defineProps<{
  client: SystemClient;
  modelValue: boolean;
  roleId?: string | undefined;
  roleName?: string | undefined;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();

const treeRef = ref<TreeControl>();
const menus = ref<MenuTreeNode[]>([]);
const checkedIds = ref<string[]>([]);
const loading = ref(false);
const submitting = ref(false);
const loadSucceeded = ref(false);
const loadedRoleId = ref<string>();
let loadGeneration = 0;

const allIds = computed(() => collectIds(menus.value));
const checkedCount = computed(() => checkedIds.value.length);
const allChecked = computed(
  () => allIds.value.length > 0 && checkedCount.value === allIds.value.length,
);
const indeterminate = computed(() => checkedCount.value > 0 && !allChecked.value);
const canSubmit = computed(() =>
  Boolean(
    props.modelValue &&
    props.roleId &&
    loadedRoleId.value === props.roleId &&
    loadSucceeded.value &&
    !loading.value &&
    !submitting.value,
  ),
);

watch(
  () => [props.modelValue, props.roleId] as const,
  ([visible]) => {
    if (visible) {
      void load();
    }
  },
);

async function load() {
  const roleId = props.roleId;
  const generation = ++loadGeneration;

  menus.value = [];
  checkedIds.value = [];
  loadSucceeded.value = false;
  loadedRoleId.value = undefined;

  if (!roleId || !props.modelValue) {
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const [tree, selectedIds] = await Promise.all([
      props.client.getMenuTree(),
      props.client.getRolePermissionIds(roleId),
    ]);

    if (!isCurrentLoad(generation, roleId)) {
      return;
    }

    menus.value = tree ?? [];
    checkedIds.value = normalizeKeys(selectedIds);
    await nextTick();

    if (!isCurrentLoad(generation, roleId)) {
      return;
    }

    // 后端会同时保存半选父节点和已选子节点。父节点不能直接交给 ElTree，
    // 否则组件会级联选中全部后代；这里只按服务端已明确保存的叶节点恢复。
    treeRef.value?.setCheckedKeys(getRestorableLeafIds(menus.value, checkedIds.value));
    syncChecked();
    loadedRoleId.value = roleId;
    loadSucceeded.value = true;
  } catch (error) {
    if (isCurrentLoad(generation, roleId)) {
      ElMessage.error(systemErrorMessage(error, "角色权限加载失败"));
    }
  } finally {
    if (generation === loadGeneration) {
      loading.value = false;
    }
  }
}

function isCurrentLoad(generation: number, roleId: string) {
  return generation === loadGeneration && props.modelValue && props.roleId === roleId;
}

function collectIds(nodes: MenuTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectIds(node.children ?? [])]).filter(Boolean);
}

function normalizeKeys(keys: unknown[] = []) {
  return keys.map(String).filter(Boolean);
}

function syncChecked() {
  checkedIds.value = normalizeKeys(treeRef.value?.getCheckedKeys());
}

function toggleAll(value: boolean | string | number) {
  const ids = value ? allIds.value : [];
  treeRef.value?.setCheckedKeys(ids);
  syncChecked();
}

async function submit() {
  const roleId = props.roleId;
  const generation = loadGeneration;

  if (!roleId || !canSubmit.value) {
    return;
  }

  const permissionIds = Array.from(
    new Set([
      ...normalizeKeys(treeRef.value?.getHalfCheckedKeys()),
      ...normalizeKeys(treeRef.value?.getCheckedKeys()),
    ]),
  );

  submitting.value = true;
  try {
    await props.client.saveRolePermissionIds(roleId, permissionIds);
    emit("saved");

    if (isCurrentLoad(generation, roleId)) {
      ElMessage.success("角色菜单权限已保存");
      close();
    }
  } catch (error) {
    if (isCurrentLoad(generation, roleId)) {
      ElMessage.error(systemErrorMessage(error, "角色权限保存失败"));
    }
  } finally {
    submitting.value = false;
  }
}

function close() {
  loadGeneration += 1;
  emit("update:modelValue", false);
  menus.value = [];
  checkedIds.value = [];
  loading.value = false;
  loadSucceeded.value = false;
  loadedRoleId.value = undefined;
}
</script>
