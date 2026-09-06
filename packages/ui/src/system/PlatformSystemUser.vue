<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Identity Directory</p>
        <h1>账户管理</h1>
        <span>维护真实登录账户、基础资料、角色与岗位；账号状态变更会同步刷新认证缓存。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>账户总数</small>
          <strong>{{ page.total }}</strong>
          <span>当前租户范围</span>
        </article>
        <article>
          <small>本页启用</small>
          <strong>{{ enabledCount }}</strong>
          <span>允许正常登录</span>
        </article>
        <article>
          <small>本页已分配角色</small>
          <strong>{{ assignedCount }}</strong>
          <span>具备角色授权</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input
          v-model="draft.name"
          clearable
          placeholder="用户名 / 姓名 / 昵称"
          @keyup.enter="search"
        />
        <el-input v-model="draft.email" clearable placeholder="邮箱" @keyup.enter="search" />
        <el-input v-model="draft.phone" clearable placeholder="手机号" @keyup.enter="search" />
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
          新增账户
        </el-button>
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Authenticated Accounts</p>
          <h2 class="platform-title">登录账户与授权</h2>
        </div>
        <span class="system-permission-hint">密码不会在列表和日志中显示</span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false">
        <template #default>
          <el-button link type="primary" @click="load">重新加载</el-button>
        </template>
      </el-alert>

      <el-table v-loading="loading" :data="page.records" stripe>
        <el-table-column type="index" label="序号" width="66" align="center" />
        <el-table-column label="账户" min-width="190">
          <template #default="{ row }">
            <div class="system-primary-cell">
              <strong>{{
                asUser(row).realName || asUser(row).nickname || asUser(row).username
              }}</strong>
              <code>{{ asUser(row).username }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="190" />
        <el-table-column prop="phone" label="手机号" width="145" />
        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">
            <div class="system-tag-list">
              <el-tag v-for="role in asUser(row).roleNames" :key="role" size="small" type="primary">
                {{ role }}
              </el-tag>
              <span v-if="!asUser(row).roleNames?.length">未分配</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="岗位" min-width="150">
          <template #default="{ row }">
            {{ asUser(row).postNames?.join("、") || "—" }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="asUser(row).enabled !== false"
              :loading="statusLoadingId === asUser(row).id"
              :disabled="!canEdit"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              @change="
                (value: boolean | string | number) => changeEnabled(asUser(row), Boolean(value))
              "
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="255" fixed="right">
          <template #default="{ row }">
            <div class="system-row-actions">
              <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asUser(row))"
                >编辑</el-button
              >
              <el-button
                link
                type="success"
                :disabled="!canAssignRole"
                @click="openRoles(asUser(row))"
                >分配角色</el-button
              >
              <el-dropdown
                trigger="click"
                @command="(command: string) => handleMore(command, asUser(row))"
              >
                <el-button link>更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="reset" :disabled="!canResetPassword"
                      >重置密码</el-dropdown-item
                    >
                    <el-dropdown-item command="delete" :disabled="!canDelete" divided
                      >删除账户</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无匹配账户" />
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
    v-model="formVisible"
    :title="activeUser ? '编辑账户' : '新增账户'"
    width="720px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-skeleton :loading="detailLoading" animated>
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="92px"
        :disabled="detailLoading || submitting"
      >
        <div class="system-dialog-grid">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" :disabled="Boolean(activeUser)" maxlength="64" />
          </el-form-item>
          <el-form-item label="登录密码" :prop="activeUser ? '' : 'password'">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="activeUser ? '留空表示不修改' : '至少 6 位'"
            />
          </el-form-item>
          <el-form-item label="真实姓名">
            <el-input v-model="form.realName" maxlength="64" />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="form.nickname" maxlength="64" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" maxlength="128" />
          </el-form-item>
          <el-form-item label="手机号">
            <div class="system-field-stack">
              <el-input
                v-model="form.phone"
                maxlength="11"
                :disabled="form.clearPhone"
                :placeholder="activeUser ? '留空保留原手机号' : '11 位手机号'"
              />
              <el-checkbox v-if="activeUser" v-model="form.clearPhone">
                清空已绑定手机号
              </el-checkbox>
            </div>
          </el-form-item>
          <el-form-item label="性别">
            <select v-model.number="form.gender" class="system-native-select">
              <option :value="0">未设置</option>
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </el-form-item>
          <el-form-item label="用户类型">
            <select v-model="form.userType" class="system-native-select">
              <option value="USER">普通用户</option>
              <option value="ADMIN">管理员</option>
            </select>
          </el-form-item>
          <el-form-item v-if="!activeUser && canListPosts" label="初始岗位">
            <select
              v-model="form.postCodes"
              class="system-native-select system-native-select--multiple"
              multiple
              aria-label="选择初始岗位"
            >
              <option v-for="post in postOptions" :key="post.code" :value="post.code">
                {{ post.label }}
              </option>
            </select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="form.sortOrder" :min="0" :max="9999" style="width: 100%" />
          </el-form-item>
          <el-form-item
            v-if="!activeUser && canAssignInitialRole"
            label="初始角色"
            class="system-dialog-span"
          >
            <select
              v-model="form.roleCodes"
              class="system-native-select system-native-select--multiple"
              multiple
              aria-label="选择初始角色"
            >
              <option v-for="role in roleOptions" :key="role.code" :value="role.code">
                {{ role.label }}
              </option>
            </select>
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
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存账户</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="rolesVisible"
    title="分配账户角色"
    width="520px"
    @closed="closeRoles"
    align-center
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form label-width="88px" :disabled="rolesLoading">
      <el-form-item label="账户">
        <strong>{{ roleTarget?.realName || roleTarget?.username }}</strong>
      </el-form-item>
      <el-form-item label="用户类型">
        <select v-model="roleAssignment.userType" class="system-native-select">
          <option value="USER">普通用户</option>
          <option value="ADMIN">管理员</option>
        </select>
      </el-form-item>
      <el-form-item label="角色">
        <select
          v-model="roleAssignment.roleIds"
          class="system-native-select system-native-select--multiple"
          multiple
          aria-label="选择账户角色"
        >
          <option v-for="role in roleOptions" :key="role.id" :value="role.id">
            {{ role.label }}
          </option>
        </select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rolesVisible = false">取消</el-button>
      <el-button type="primary" :loading="rolesLoading" @click="saveRoles">保存角色</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
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
import { generateTemporaryPassword } from "@guanxiangkai/platform-client";
import type {
  QueryValue,
  SystemEntity,
  SystemPage,
  UserSavePayload,
  UserSummary,
} from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import { useLatestRequest } from "../composables/useLatestRequest.js";
import type { SystemViewProps } from "./system-types";

interface LookupOption {
  id: string;
  code: string;
  label: string;
}

interface RoleLookup extends SystemEntity {
  roleCode: string;
  roleName: string;
}

interface PostLookup extends SystemEntity {
  postCode: string;
  postName: string;
}

type EnabledFilter = "all" | "true" | "false";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const can = (permission: string) => hasSystemPermission(props, permission);
const canCreate = can("system:user:add");
const canQuery = can("system:user:query");
const canEdit = canQuery && can("system:user:edit");
const canDelete = can("system:user:delete");
const canListRoles = can("system:role:list");
const canListPosts = can("system:post:list");
const canAssignInitialRole = can("system:user:assignRole") && canListRoles;
const canAssignRole = canAssignInitialRole && canQuery;
const canResetPassword = can("system:user:resetPwd");

const listRequest = useLatestRequest();
const lookupsRequest = useLatestRequest();
const detailRequest = useLatestRequest();
const rolesRequest = useLatestRequest();
const loading = listRequest.loading;
const detailLoading = detailRequest.loading;
const submitting = ref(false);
const rolesSaving = ref(false);
const rolesLoading = computed(() => rolesRequest.loading.value || rolesSaving.value);
const loadError = ref("");
const statusLoadingId = ref("");
const formVisible = ref(false);
const rolesVisible = ref(false);
const activeUser = ref<UserSummary>();
const roleTarget = ref<UserSummary>();
const formRef = ref<FormInstance>();
const roleOptions = ref<LookupOption[]>([]);
const postOptions = ref<LookupOption[]>([]);
const page = reactive<SystemPage<UserSummary>>({ records: [], total: 0 });
const draft = reactive<{ name: string; email: string; phone: string; enabled: EnabledFilter }>({
  name: "",
  email: "",
  phone: "",
  enabled: "all",
});
const query = reactive<{ pageNum: number; pageSize: number; [key: string]: QueryValue }>({
  pageNum: 1,
  pageSize: 10,
});
const form = reactive({
  username: "",
  password: "",
  realName: "",
  nickname: "",
  email: "",
  phone: "",
  clearPhone: false,
  gender: 0,
  userType: "USER" as "ADMIN" | "USER",
  roleCodes: [] as string[],
  postCodes: [] as string[],
  sortOrder: 0,
  remark: "",
});
const roleAssignment = reactive({
  roleIds: [] as string[],
  userType: "USER" as "ADMIN" | "USER",
});

const enabledCount = computed(() => page.records.filter((user) => user.enabled !== false).length);
const assignedCount = computed(() => page.records.filter((user) => user.roleNames?.length).length);
const formRules = computed<FormRules>(() => ({
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  ...(!activeUser.value
    ? {
        password: [
          { required: true, message: "请输入登录密码", trigger: "blur" },
          { min: 6, max: 64, message: "密码长度为 6 至 64 位", trigger: "blur" },
        ],
      }
    : {}),
}));

onMounted(() => {
  void Promise.all([load(), loadLookups()]);
});

function asUser(value: unknown) {
  return value as UserSummary;
}

async function loadLookups() {
  await lookupsRequest.run(
    () =>
      Promise.all([
        canListRoles
          ? props.client.listEntities<RoleLookup>("/system/role", { pageNum: 1, pageSize: 100 })
          : Promise.resolve<SystemPage<RoleLookup>>({ records: [], total: 0 }),
        canListPosts
          ? props.client.listEntities<PostLookup>("/system/post", { pageNum: 1, pageSize: 100 })
          : Promise.resolve<SystemPage<PostLookup>>({ records: [], total: 0 }),
      ]),
    {
      onSuccess: ([roles, posts]) => {
        roleOptions.value = (roles?.records ?? []).map((role) => ({
          id: role.id,
          code: role.roleCode,
          label: role.roleName,
        }));
        postOptions.value = (posts?.records ?? []).map((post) => ({
          id: post.id,
          code: post.postCode,
          label: post.postName,
        }));
      },
      onError: (error) => ElMessage.warning(systemErrorMessage(error, "角色或岗位选项加载失败")),
    },
  );
}

async function load() {
  loadError.value = "";
  await listRequest.run(() => props.client.listUsers({ ...query }), {
    onSuccess: (result) => {
      page.records = result?.records ?? [];
      page.total = Number(result?.total ?? 0);
    },
    onError: (error) => {
      page.records = [];
      page.total = 0;
      loadError.value = systemErrorMessage(error, "账户列表加载失败");
    },
  });
}

function search() {
  Object.assign(query, {
    pageNum: 1,
    name: draft.name.trim() || undefined,
    email: draft.email.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    enabled: draft.enabled === "all" ? undefined : draft.enabled === "true",
  });
  void load();
}

function resetSearch() {
  Object.assign(draft, { name: "", email: "", phone: "", enabled: "all" });
  Object.assign(query, {
    pageNum: 1,
    name: undefined,
    email: undefined,
    phone: undefined,
    enabled: undefined,
  });
  void load();
}

function changePage(pageNum: number) {
  query.pageNum = pageNum;
  void load();
}

function resetForm() {
  detailRequest.invalidate();
  activeUser.value = undefined;
  Object.assign(form, {
    username: "",
    password: "",
    realName: "",
    nickname: "",
    email: "",
    phone: "",
    clearPhone: false,
    gender: 0,
    userType: "USER",
    roleCodes: [],
    postCodes: [],
    sortOrder: 0,
    remark: "",
  });
  formRef.value?.clearValidate();
}

function openCreate() {
  resetForm();
  formVisible.value = true;
}

async function openEdit(user: UserSummary) {
  resetForm();
  activeUser.value = user;
  formVisible.value = true;
  await detailRequest.run(() => props.client.getUser(user.id), {
    onSuccess: (detail) => {
      Object.assign(form, {
        username: detail.username || "",
        password: "",
        realName: detail.realName || "",
        nickname: detail.nickname || "",
        email: detail.email || "",
        phone: "",
        clearPhone: false,
        gender: Number(detail.gender ?? 0),
        userType: detail.userType === "ADMIN" ? "ADMIN" : "USER",
        roleCodes: [],
        postCodes: (detail.posts ?? [])
          .map((post) => post.postCode || post.roleCode)
          .filter((code): code is string => Boolean(code)),
        sortOrder: Number(detail.sortOrder ?? 0),
        remark: detail.remark || "",
      });
    },
    onError: (error) => {
      ElMessage.error(systemErrorMessage(error, "账户详情加载失败"));
      formVisible.value = false;
    },
  });
}

async function submit() {
  if (!formRef.value || !(await formRef.value.validate().catch(() => false))) {
    return;
  }

  const user = activeUser.value;
  const optionalText = (value: string) => (user ? value.trim() : value.trim() || undefined);
  const payload: UserSavePayload = {
    username: form.username.trim(),
    password: form.password || undefined,
    realName: optionalText(form.realName),
    nickname: optionalText(form.nickname),
    email: optionalText(form.email),
    ...(user && form.clearPhone
      ? { phone: "" }
      : form.phone.trim()
        ? { phone: form.phone.trim() }
        : {}),
    gender: form.gender,
    userType: form.userType,
    sortOrder: form.sortOrder,
    remark: optionalText(form.remark),
    ...(!user
      ? {
          roleCodes: canAssignInitialRole ? [...form.roleCodes] : [],
          postCodes: canListPosts ? [...form.postCodes] : [],
        }
      : {}),
  };

  submitting.value = true;
  try {
    if (user) {
      await props.client.updateUser(user.id, { ...payload, id: user.id });
    } else {
      await props.client.createUser(payload);
    }
    ElMessage.success("账户已保存");
    formVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "账户保存失败"));
  } finally {
    submitting.value = false;
  }
}

async function changeEnabled(user: UserSummary, enabled: boolean) {
  const previous = user.enabled !== false;
  user.enabled = enabled;
  statusLoadingId.value = user.id;
  try {
    await props.client.updateUserEnabled(user.id, enabled);
    ElMessage.success(enabled ? "账户已启用" : "账户已停用");
  } catch (error) {
    user.enabled = previous;
    ElMessage.error(systemErrorMessage(error, "账户状态更新失败"));
  } finally {
    statusLoadingId.value = "";
  }
}

async function openRoles(user: UserSummary) {
  roleTarget.value = user;
  rolesVisible.value = true;
  roleAssignment.roleIds = [];
  roleAssignment.userType = "USER";
  await rolesRequest.run(
    () => Promise.all([props.client.getUserRoleIds(user.id), props.client.getUser(user.id)]),
    {
      onSuccess: ([roleIds, detail]) => {
        roleAssignment.roleIds = roleIds ?? [];
        roleAssignment.userType = detail.userType === "ADMIN" ? "ADMIN" : "USER";
      },
      onError: (error) => {
        ElMessage.error(systemErrorMessage(error, "账户角色加载失败"));
        rolesVisible.value = false;
      },
    },
  );
}

function closeRoles() {
  rolesRequest.invalidate();
  roleTarget.value = undefined;
  roleAssignment.roleIds = [];
}

async function saveRoles() {
  if (!roleTarget.value) {
    return;
  }

  rolesSaving.value = true;
  try {
    await props.client.assignUserRoles(
      roleTarget.value.id,
      [...roleAssignment.roleIds],
      roleAssignment.userType,
    );
    ElMessage.success("账户角色已更新");
    rolesVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "账户角色保存失败"));
  } finally {
    rolesSaving.value = false;
  }
}

function handleMore(command: string, user: UserSummary) {
  if (command === "reset") {
    void resetPassword(user);
  } else if (command === "delete") {
    void remove(user);
  }
}

async function resetPassword(user: UserSummary) {
  let temporaryPassword: string | undefined;
  try {
    await ElMessageBox.confirm(`确认重置账户“${user.username}”的登录密码？`, "重置密码", {
      type: "warning",
      confirmButtonText: "确认重置",
      cancelButtonText: "取消",
    });
    temporaryPassword = generateTemporaryPassword();
    const reset = await props.client.resetUserPassword(user.id, temporaryPassword);
    if (!reset) {
      throw new Error("服务端未确认密码重置");
    }
    await ElMessageBox.alert(
      `新密码：${temporaryPassword}\n请通过安全渠道交给用户，并要求首次登录后立即修改。`,
      "密码已重置",
      {
        confirmButtonText: "我已记录",
      },
    );
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "密码重置失败"));
    }
  } finally {
    temporaryPassword = undefined;
  }
}

async function remove(user: UserSummary) {
  try {
    await ElMessageBox.confirm(
      `确认删除账户“${user.username}”？其角色和岗位关系将一并解除。`,
      "删除账户",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await props.client.deleteUser(user.id);
    ElMessage.success("账户已删除");
    if (page.records.length === 1 && Number(query.pageNum) > 1) {
      query.pageNum = Number(query.pageNum) - 1;
    }
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, "账户删除失败"));
    }
  }
}
</script>
