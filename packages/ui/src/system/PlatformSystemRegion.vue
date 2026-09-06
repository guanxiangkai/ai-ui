<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Shared System Capability</p>
        <h1>区域管理</h1>
        <span>统一维护行政区划树，所有产品共用同一份区域编码与层级数据。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>区域总数</small><strong>{{ flatRegions.length }}</strong
          ><span>当前查询范围</span>
        </article>
        <article>
          <small>已启用</small><strong>{{ enabledCount }}</strong
          ><span>可供业务选择</span>
        </article>
        <article>
          <small>根节点</small><strong>{{ regions.length }}</strong
          ><span>顶级行政区</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input v-model="keyword" clearable placeholder="区域名称或编码" @keyup.enter="load" />
        <select v-model="level" class="system-native-select" aria-label="区域层级">
          <option value="">全部层级</option>
          <option v-for="option in levelOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="reset">重置</el-button>
        <el-button type="primary" :icon="Search" @click="load">查询</el-button>
        <el-button type="success" :icon="Plus" :disabled="!canCreate" @click="openCreate('0')"
          >新增顶级区域</el-button
        >
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />
      <el-table v-loading="loading" :data="visibleRegions" row-key="id" default-expand-all stripe>
        <el-table-column prop="regionName" label="区域名称" min-width="220" />
        <el-table-column prop="regionCode" label="区域编码" width="150"
          ><template #default="{ row }"
            ><code>{{ row.regionCode }}</code></template
          ></el-table-column
        >
        <el-table-column label="层级" width="110"
          ><template #default="{ row }">{{
            levelLabel(row.regionLevel)
          }}</template></el-table-column
        >
        <el-table-column prop="fullName" label="完整名称" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-switch
              :model-value="asRegion(row).enabled !== false"
              :disabled="!canEdit"
              @change="
                (value: boolean | string | number) => toggle(asRegion(row), Boolean(value))
              " /></template
        ></el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="success"
              :disabled="!canCreate"
              @click="openCreate(asRegion(row).id)"
              >新增子级</el-button
            >
            <el-button link type="primary" :disabled="!canEdit" @click="openEdit(asRegion(row))"
              >编辑</el-button
            >
            <el-button link type="danger" :disabled="!canDelete" @click="remove(asRegion(row))"
              >删除</el-button
            >
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无区域数据" /></template>
      </el-table>
    </section>
  </section>

  <el-dialog
    v-model="dialogVisible"
    :title="activeId ? '编辑区域' : '新增区域'"
    width="680px"
    append-to-body
    :close-on-click-modal="false"
    @closed="closeDialog"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="92px" :disabled="submitting">
      <div class="system-dialog-grid">
        <el-form-item label="区域名称" prop="regionName"
          ><el-input v-model="form.regionName" maxlength="100"
        /></el-form-item>
        <el-form-item label="区域编码" prop="regionCode"
          ><el-input v-model="form.regionCode" maxlength="20"
        /></el-form-item>
        <el-form-item label="区域层级" prop="regionLevel"
          ><select v-model="form.regionLevel" class="system-native-select">
            <option v-for="option in levelOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select></el-form-item
        >
        <el-form-item label="父区域" prop="parentId"
          ><select v-model="form.parentId" class="system-native-select">
            <option v-for="option in parentOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select></el-form-item
        >
        <el-form-item label="区域简称"
          ><el-input v-model="form.shortName" maxlength="50"
        /></el-form-item>
        <el-form-item label="邮政编码"
          ><el-input v-model="form.zipCode" maxlength="10"
        /></el-form-item>
        <el-form-item label="经度"><el-input v-model="form.longitude" /></el-form-item>
        <el-form-item label="纬度"><el-input v-model="form.latitude" /></el-form-item>
        <el-form-item label="排序号"
          ><el-input-number v-model="form.sortOrder" :min="0"
        /></el-form-item>
        <el-form-item class="system-dialog-span" label="备注"
          ><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500"
        /></el-form-item>
      </div>
    </el-form>
    <template #footer
      ><el-button @click="dialogVisible = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submit">保存</el-button></template
    >
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
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import type { RegionLevel, RegionSavePayload, SystemRegion } from "@guanxiangkai/platform-client";
import { useLatestRequest } from "../composables/useLatestRequest.js";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const canCreate = computed(() => hasSystemPermission(props, "system:region:add"));
const canEdit = computed(() => hasSystemPermission(props, "system:region:edit"));
const canDelete = computed(() => hasSystemPermission(props, "system:region:delete"));
const levelOptions: Array<{ label: string; value: RegionLevel }> = [
  { label: "省级", value: "province" },
  { label: "市级", value: "city" },
  { label: "区/县", value: "district" },
  { label: "街道/乡镇", value: "street" },
];
const regions = ref<SystemRegion[]>([]);
const listRequest = useLatestRequest();
const detailRequest = useLatestRequest();
const loading = listRequest.loading;
const loadError = ref("");
const keyword = ref("");
const level = ref<"" | RegionLevel>("");
const dialogVisible = ref(false);
const submitting = ref(false);
const activeId = ref("");
const formRef = ref<FormInstance>();
const form = reactive({
  regionName: "",
  regionCode: "",
  parentId: "0",
  regionLevel: "province" as RegionLevel,
  shortName: "",
  zipCode: "",
  longitude: "",
  latitude: "",
  sortOrder: 0,
  remark: "",
});
const rules: FormRules = {
  regionName: [{ required: true, message: "请输入区域名称", trigger: "blur" }],
  regionCode: [{ required: true, message: "请输入区域编码", trigger: "blur" }],
  regionLevel: [{ required: true, message: "请选择区域层级", trigger: "change" }],
  parentId: [{ required: true, message: "请选择父区域", trigger: "change" }],
};
interface RegionOption {
  label: string;
  value: string;
}

const flatRegions = computed(() => flatten(regions.value));
const enabledCount = computed(
  () => flatRegions.value.filter((item) => item.enabled !== false).length,
);
const visibleRegions = computed(() =>
  filterTree(regions.value, keyword.value.trim().toLowerCase(), level.value),
);
const parentOptions = computed(() => [
  { label: "顶级区域", value: "0" },
  ...toOptions(regions.value),
]);

onMounted(() => void load());

function flatten(items: SystemRegion[]): SystemRegion[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}
function toOptions(items: SystemRegion[], depth = 0): RegionOption[] {
  return items.flatMap((item) =>
    item.id === activeId.value
      ? []
      : [
          { label: `${"　".repeat(depth)}${item.regionName}`, value: item.id },
          ...toOptions(item.children ?? [], depth + 1),
        ],
  );
}
function asRegion(value: unknown): SystemRegion {
  return value as SystemRegion;
}
function filterTree(
  items: SystemRegion[],
  text: string,
  selectedLevel: "" | RegionLevel,
): SystemRegion[] {
  return items.flatMap((item) => {
    const children = filterTree(item.children ?? [], text, selectedLevel);
    const matchesText =
      !text ||
      `${item.regionName} ${item.regionCode} ${item.fullName ?? ""}`.toLowerCase().includes(text);
    const matchesLevel = !selectedLevel || item.regionLevel === selectedLevel;
    return (matchesText && matchesLevel) || children.length ? [{ ...item, children }] : [];
  });
}
function levelLabel(value: RegionLevel) {
  return levelOptions.find((item) => item.value === value)?.label ?? value;
}
function resetForm(parentId = "0") {
  Object.assign(form, {
    regionName: "",
    regionCode: "",
    parentId,
    regionLevel: "province",
    shortName: "",
    zipCode: "",
    longitude: "",
    latitude: "",
    sortOrder: 0,
    remark: "",
  });
}
function reset() {
  keyword.value = "";
  level.value = "";
  void load();
}

async function load() {
  loadError.value = "";
  await listRequest.run(() => props.client.getRegionTree(), {
    onSuccess: (result) => {
      regions.value = result;
    },
    onError: (error) => {
      regions.value = [];
      loadError.value = systemErrorMessage(error, "区域数据加载失败");
    },
  });
}
function openCreate(parentId: string) {
  detailRequest.invalidate();
  activeId.value = "";
  resetForm(parentId);
  dialogVisible.value = true;
}
async function openEdit(region: SystemRegion) {
  detailRequest.invalidate();
  activeId.value = region.id;
  dialogVisible.value = true;
  await detailRequest.run(() => props.client.getRegion(region.id), {
    onSuccess: (detail) => {
      Object.assign(form, {
        regionName: detail.regionName,
        regionCode: detail.regionCode,
        parentId: detail.parentId || "0",
        regionLevel: detail.regionLevel,
        shortName: detail.shortName ?? "",
        zipCode: detail.zipCode ?? "",
        longitude: detail.longitude?.toString() ?? "",
        latitude: detail.latitude?.toString() ?? "",
        sortOrder: detail.sortOrder ?? 0,
        remark: detail.remark ?? "",
      });
    },
    onError: (error) => {
      ElMessage.error(systemErrorMessage(error, "区域详情加载失败"));
      dialogVisible.value = false;
    },
  });
}
function closeDialog() {
  detailRequest.invalidate();
}
function optionalNumber(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}
function payload(): RegionSavePayload {
  const longitude = optionalNumber(form.longitude);
  const latitude = optionalNumber(form.latitude);
  return {
    regionName: form.regionName.trim(),
    regionCode: form.regionCode.trim(),
    parentId: form.parentId || "0",
    regionLevel: form.regionLevel,
    sortOrder: form.sortOrder,
    ...(form.shortName.trim() ? { shortName: form.shortName.trim() } : {}),
    ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(form.remark.trim() ? { remark: form.remark.trim() } : {}),
  };
}
async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  submitting.value = true;
  try {
    if (activeId.value) await props.client.updateRegion(activeId.value, payload());
    else await props.client.createRegion(payload());
    ElMessage.success("区域已保存");
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "区域保存失败"));
  } finally {
    submitting.value = false;
  }
}
async function toggle(region: SystemRegion, enabled: boolean) {
  try {
    await props.client.updateRegionEnabled(region.id, enabled);
    region.enabled = enabled;
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "状态更新失败"));
    await load();
  }
}
async function remove(region: SystemRegion) {
  try {
    await ElMessageBox.confirm(`确认删除区域「${region.regionName}」？`, "删除确认", {
      type: "warning",
    });
    await props.client.deleteRegion(region.id);
    ElMessage.success("区域已删除");
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(systemErrorMessage(error, "区域删除失败"));
  }
}
</script>
