<template>
  <el-dialog
    :model-value="modelValue"
    :title="roleId ? '编辑角色' : '新增角色'"
    width="620px"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @close="close"
  >
    <el-skeleton :loading="detailLoading" animated>
      <el-alert
        v-if="detailLoadError"
        :title="detailLoadError"
        type="error"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button type="primary" plain @click="initialize">重新加载</el-button>
        </template>
      </el-alert>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="!formReady || detailLoading || submitting"
        label-width="96px"
      >
        <div class="role-dialog-grid">
          <el-form-item label="角色名称" prop="roleName">
            <el-input v-model="form.roleName" maxlength="64" placeholder="例如：复核管理员" />
          </el-form-item>
          <el-form-item label="角色编码" prop="roleCode">
            <el-input
              v-model="form.roleCode"
              :disabled="Boolean(roleId)"
              maxlength="64"
              placeholder="例如：review_manager"
            />
          </el-form-item>
          <el-form-item label="数据范围" prop="dataScope">
            <select v-model.number="form.dataScope" class="role-native-select">
              <option v-for="option in dataScopes" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </el-form-item>
          <el-form-item label="排序" prop="sortOrder">
            <el-input-number
              v-model="form.sortOrder"
              :min="0"
              :max="9999"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="默认角色">
            <el-switch v-model="form.defaultRegistrationRole" active-text="是" inactive-text="否" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="说明角色职责与授权边界"
          />
        </el-form-item>
      </el-form>
    </el-skeleton>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="submitting" @click="submit">
        保存角色
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElSkeleton,
  ElSwitch,
} from "element-plus";
import type { RoleSavePayload, SystemClient } from "@guanxiangkai/platform-client";
import { systemErrorMessage } from "./system-context";

const props = defineProps<{
  client: SystemClient;
  modelValue: boolean;
  roleId?: string | undefined;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();

const dataScopes = [
  { label: "全部数据", value: 1 },
  { label: "自定义数据", value: 2 },
  { label: "本部门数据", value: 3 },
  { label: "本部门及以下", value: 4 },
  { label: "仅本人数据", value: 5 },
];

const formRef = ref<FormInstance>();
const detailLoading = ref(false);
const detailLoadError = ref("");
const formReady = ref(false);
const loadedRoleId = ref<string | null>();
const submitting = ref(false);
let detailGeneration = 0;
const form = reactive({
  roleName: "",
  roleCode: "",
  dataScope: 5,
  sortOrder: 0,
  enabled: true,
  defaultRegistrationRole: false,
  remark: "",
});

const rules: FormRules = {
  roleName: [{ required: true, message: "请输入角色名称", trigger: "blur" }],
  roleCode: [
    { required: true, message: "请输入角色编码", trigger: "blur" },
    {
      pattern: /^[A-Za-z][A-Za-z0-9_:-]*$/,
      message: "编码须以字母开头，仅可包含字母、数字、下划线、冒号和短横线",
      trigger: "blur",
    },
  ],
};

const canSubmit = computed(() =>
  Boolean(
    props.modelValue &&
    formReady.value &&
    !detailLoading.value &&
    !submitting.value &&
    (props.roleId ? loadedRoleId.value === props.roleId : loadedRoleId.value === null),
  ),
);

watch(
  () => [props.modelValue, props.roleId] as const,
  ([visible]) => {
    if (visible) {
      void initialize();
    }
  },
);

async function initialize() {
  const roleId = props.roleId;
  const generation = ++detailGeneration;

  reset();
  detailLoadError.value = "";
  formReady.value = false;
  loadedRoleId.value = undefined;

  if (!props.modelValue) {
    detailLoading.value = false;
    return;
  }

  if (!roleId) {
    detailLoading.value = false;
    loadedRoleId.value = null;
    formReady.value = true;
    return;
  }

  detailLoading.value = true;
  try {
    const detail = await props.client.getRole(roleId);

    if (!isCurrentTarget(generation, roleId)) {
      return;
    }

    Object.assign(form, {
      roleName: detail.roleName || "",
      roleCode: detail.roleCode || "",
      dataScope: Number(detail.dataScope || 5),
      sortOrder: detail.sortOrder ?? detail.sort ?? 0,
      enabled: detail.enabled !== false,
      defaultRegistrationRole: Boolean(detail.defaultRegistrationRole),
      remark: detail.remark || "",
    });
    loadedRoleId.value = roleId;
    formReady.value = true;
  } catch (error) {
    if (isCurrentTarget(generation, roleId)) {
      detailLoadError.value = systemErrorMessage(error, "角色详情加载失败");
      ElMessage.error(detailLoadError.value);
    }
  } finally {
    if (generation === detailGeneration) {
      detailLoading.value = false;
    }
  }
}

function isCurrentTarget(generation: number, roleId: string | undefined) {
  return generation === detailGeneration && props.modelValue && props.roleId === roleId;
}

function reset() {
  Object.assign(form, {
    roleName: "",
    roleCode: "",
    dataScope: 5,
    sortOrder: 0,
    enabled: true,
    defaultRegistrationRole: false,
    remark: "",
  });
  formRef.value?.clearValidate();
}

function close() {
  detailGeneration += 1;
  detailLoading.value = false;
  detailLoadError.value = "";
  formReady.value = false;
  loadedRoleId.value = undefined;
  emit("update:modelValue", false);
}

async function submit() {
  const roleId = props.roleId;
  const generation = detailGeneration;

  if (
    !canSubmit.value ||
    !formRef.value ||
    !(await formRef.value.validate().catch(() => false)) ||
    !isCurrentTarget(generation, roleId)
  ) {
    return;
  }

  const payload: RoleSavePayload = {
    ...(roleId ? { id: roleId } : {}),
    roleName: form.roleName.trim(),
    roleCode: form.roleCode.trim(),
    dataScope: form.dataScope,
    enabled: form.enabled,
    sortOrder: form.sortOrder,
    sort: form.sortOrder,
    defaultRegistrationRole: form.defaultRegistrationRole,
    ...(form.remark.trim() ? { remark: form.remark.trim() } : {}),
  };

  submitting.value = true;
  try {
    if (roleId) {
      await props.client.updateRole(roleId, payload);
    } else {
      await props.client.createRole(payload);
    }
    emit("saved");

    if (isCurrentTarget(generation, roleId)) {
      ElMessage.success(roleId ? "角色已更新" : "角色已创建");
      close();
    }
  } catch (error) {
    if (isCurrentTarget(generation, roleId)) {
      ElMessage.error(systemErrorMessage(error, "角色保存失败"));
    }
  } finally {
    submitting.value = false;
  }
}
</script>
