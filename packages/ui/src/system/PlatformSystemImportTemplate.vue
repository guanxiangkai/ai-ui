<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Shared Import Contract</p>
        <h1>导入模板</h1>
        <span>集中管理文件匹配、Sheet、写入策略和列字段映射，产品只实现导入处理器。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>模板数</small><strong>{{ templates.total }}</strong
          ><span>当前租户</span>
        </article>
        <article>
          <small>已启用</small><strong>{{ enabledCount }}</strong
          ><span>可用导入定义</span>
        </article>
        <article>
          <small>字段映射</small><strong>{{ mappings.total }}</strong
          ><span>当前模板</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input
          v-model="query.templateName"
          clearable
          placeholder="模板名称"
          @keyup.enter="search"
        />
        <el-input
          v-model="query.templateModule"
          clearable
          placeholder="所属模块"
          @keyup.enter="search"
        />
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="reset">重置</el-button>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button type="success" :icon="Plus" :disabled="!canTemplateAdd" @click="openTemplate()"
          >新增模板</el-button
        >
      </div>
    </section>

    <div class="system-split-grid">
      <section class="platform-panel system-table-panel">
        <header>
          <div>
            <p class="platform-eyebrow">Templates</p>
            <h2 class="platform-title">模板目录</h2>
          </div>
        </header>
        <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />
        <el-table
          v-loading="loading"
          :data="templates.records"
          stripe
          highlight-current-row
          @current-change="selectTemplate"
        >
          <el-table-column prop="templateName" label="模板名称" min-width="160" />
          <el-table-column prop="templateModule" label="模块" width="130"
            ><template #default="{ row }"
              ><code>{{ row.templateModule }}</code></template
            ></el-table-column
          >
          <el-table-column prop="fileType" label="文件" width="80" />
          <el-table-column label="状态" width="80"
            ><template #default="{ row }"
              ><el-switch
                :model-value="asTemplate(row).enabled !== false"
                :disabled="!canTemplateEdit"
                @change="
                  (value: boolean | string | number) =>
                    toggleTemplate(asTemplate(row), Boolean(value))
                " /></template
          ></el-table-column>
          <el-table-column label="操作" width="130"
            ><template #default="{ row }"
              ><el-button
                link
                type="primary"
                :disabled="!canTemplateEdit"
                @click.stop="openTemplate(asTemplate(row))"
                >编辑</el-button
              ><el-button
                link
                type="danger"
                :disabled="!canTemplateDelete"
                @click.stop="removeTemplate(asTemplate(row))"
                >删除</el-button
              ></template
            ></el-table-column
          >
          <template #empty><el-empty description="暂无导入模板" /></template>
        </el-table>
        <PlatformPager
          :page="pageNum"
          :page-size="pageSize"
          :total="templates.total"
          @change="changePage"
        />
      </section>

      <section class="platform-panel system-table-panel">
        <header>
          <div>
            <p class="platform-eyebrow">Field Mappings</p>
            <h2 class="platform-title">{{ selectedTemplate?.templateName ?? "请选择模板" }}</h2>
          </div>
          <el-button
            type="primary"
            :icon="Plus"
            :disabled="!selectedTemplate || !canMappingAdd"
            @click="openMapping()"
            >新增映射</el-button
          >
        </header>
        <el-table v-loading="mappingLoading" :data="mappings.records" stripe>
          <el-table-column label="Excel 列标题" min-width="180"
            ><template #default="{ row }">{{ row.title.join(" / ") }}</template></el-table-column
          >
          <el-table-column prop="field" label="目标字段" min-width="130"
            ><template #default="{ row }"
              ><code>{{ row.field }}</code></template
            ></el-table-column
          >
          <el-table-column prop="dataType" label="数据类型" width="130" />
          <el-table-column label="必填" width="70"
            ><template #default="{ row }">{{
              row.required ? "是" : "否"
            }}</template></el-table-column
          >
          <el-table-column label="操作" width="130"
            ><template #default="{ row }"
              ><el-button
                link
                type="primary"
                :disabled="!canMappingEdit"
                @click="openMapping(asMapping(row))"
                >编辑</el-button
              ><el-button
                link
                type="danger"
                :disabled="!canMappingDelete"
                @click="removeMapping(asMapping(row))"
                >删除</el-button
              ></template
            ></el-table-column
          >
          <template #empty
            ><el-empty :description="selectedTemplate ? '暂无字段映射' : '请先选择模板'"
          /></template>
        </el-table>
      </section>
    </div>
  </section>

  <el-dialog
    v-model="templateDialog"
    :title="templateId ? '编辑导入模板' : '新增导入模板'"
    width="760px"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form
      ref="templateFormRef"
      :model="templateForm"
      :rules="templateRules"
      label-width="110px"
      :disabled="submitting"
    >
      <div class="system-dialog-grid">
        <el-form-item label="模板名称" prop="templateName"
          ><el-input v-model="templateForm.templateName"
        /></el-form-item>
        <el-form-item label="模板编码" prop="templateCode"
          ><el-input v-model="templateForm.templateCode"
        /></el-form-item>
        <el-form-item label="所属模块" prop="templateModule"
          ><el-input v-model="templateForm.templateModule"
        /></el-form-item>
        <el-form-item label="文件类型" prop="fileType"
          ><select v-model="templateForm.fileType" class="system-native-select">
            <option value="xlsx">Excel 2007+</option>
            <option value="xls">Excel 97-2003</option>
            <option value="csv">CSV</option>
          </select></el-form-item
        >
        <el-form-item label="文件名模式"
          ><el-input v-model="templateForm.fileNamePatterns" placeholder="多个用逗号分隔"
        /></el-form-item>
        <el-form-item label="Sheet 名称"
          ><el-input v-model="templateForm.sheetNames" placeholder="多个用逗号分隔"
        /></el-form-item>
        <el-form-item label="目标 Schema"
          ><el-input v-model="templateForm.targetSchema"
        /></el-form-item>
        <el-form-item label="目标表"><el-input v-model="templateForm.targetTable" /></el-form-item>
        <el-form-item label="处理器键"><el-input v-model="templateForm.handlerKey" /></el-form-item>
        <el-form-item label="写入方式"
          ><select v-model="templateForm.writeMode" class="system-native-select">
            <option value="INSERT">新增</option>
            <option value="UPSERT">新增或更新</option>
          </select></el-form-item
        >
        <el-form-item label="表头行"
          ><el-input-number v-model="templateForm.headerRowIndex" :min="0" :max="100"
        /></el-form-item>
        <el-form-item label="批处理行数"
          ><el-input-number v-model="templateForm.batchSize" :min="1" :max="5000"
        /></el-form-item>
        <el-form-item label="自定义处理"
          ><el-switch v-model="templateForm.customImportEnabled"
        /></el-form-item>
        <el-form-item class="system-dialog-span" label="备注"
          ><el-input v-model="templateForm.remark" type="textarea" :rows="3"
        /></el-form-item>
      </div>
    </el-form>
    <template #footer
      ><el-button @click="templateDialog = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submitTemplate"
        >保存</el-button
      ></template
    >
  </el-dialog>

  <el-dialog
    v-model="mappingDialog"
    :title="mappingId ? '编辑字段映射' : '新增字段映射'"
    width="680px"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form
      ref="mappingFormRef"
      :model="mappingForm"
      :rules="mappingRules"
      label-width="110px"
      :disabled="submitting"
    >
      <div class="system-dialog-grid">
        <el-form-item class="system-dialog-span" label="Excel 列标题" prop="title"
          ><el-input v-model="mappingForm.title" placeholder="多个候选标题用逗号分隔"
        /></el-form-item>
        <el-form-item label="目标字段" prop="field"
          ><el-input v-model="mappingForm.field"
        /></el-form-item>
        <el-form-item label="数据库列"
          ><el-input v-model="mappingForm.targetColumn"
        /></el-form-item>
        <el-form-item label="数据类型"
          ><select v-model="mappingForm.dataType" class="system-native-select">
            <option v-for="item in dataTypes" :key="item" :value="item">{{ item }}</option>
          </select></el-form-item
        >
        <el-form-item label="格式"><el-input v-model="mappingForm.formatPattern" /></el-form-item>
        <el-form-item label="默认值"><el-input v-model="mappingForm.defaultValue" /></el-form-item>
        <el-form-item label="转换器键"
          ><el-input v-model="mappingForm.converterKey"
        /></el-form-item>
        <el-form-item label="映射选项" class="system-dialog-span"
          ><el-checkbox v-model="mappingForm.exactMatch">完全匹配</el-checkbox
          ><el-checkbox v-model="mappingForm.required">必填</el-checkbox
          ><el-checkbox v-model="mappingForm.multiple">多值</el-checkbox
          ><el-checkbox v-model="mappingForm.repeat">允许重复</el-checkbox></el-form-item
        >
      </div>
    </el-form>
    <template #footer
      ><el-button @click="mappingDialog = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submitMapping"
        >保存</el-button
      ></template
    >
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
import type {
  ImportDataType,
  ImportFileType,
  ImportMappingSavePayload,
  ImportTemplateSavePayload,
  ImportWriteMode,
  SystemImportMapping,
  SystemImportTemplate,
  SystemPage,
} from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const allowed = (permission: string) => computed(() => hasSystemPermission(props, permission));
const canTemplateAdd = allowed("system:importTemplate:add");
const canTemplateEdit = allowed("system:importTemplate:edit");
const canTemplateDelete = allowed("system:importTemplate:delete");
const canMappingAdd = allowed("system:importTemplateField:add");
const canMappingEdit = allowed("system:importTemplateField:edit");
const canMappingDelete = allowed("system:importTemplateField:delete");
const dataTypes: ImportDataType[] = [
  "STRING",
  "INTEGER",
  "LONG",
  "DECIMAL",
  "BOOLEAN",
  "LOCAL_DATE",
  "LOCAL_DATE_TIME",
  "UUID",
  "JSON",
];
const templates = reactive<SystemPage<SystemImportTemplate>>({ records: [], total: 0 });
const mappings = reactive<SystemPage<SystemImportMapping>>({ records: [], total: 0 });
const selectedTemplate = ref<SystemImportTemplate>();
const pageNum = ref(1);
const pageSize = 20;
const query = reactive({ templateName: "", templateModule: "" });
const loading = ref(false);
const mappingLoading = ref(false);
const submitting = ref(false);
const loadError = ref("");
const templateDialog = ref(false);
const mappingDialog = ref(false);
const templateId = ref("");
const mappingId = ref("");
const templateFormRef = ref<FormInstance>();
const mappingFormRef = ref<FormInstance>();
const templateForm = reactive({
  templateName: "",
  templateCode: "",
  templateModule: "",
  fileType: "xlsx" as ImportFileType,
  fileNamePatterns: "",
  sheetNames: "",
  targetSchema: "public",
  targetTable: "",
  handlerKey: "",
  writeMode: "INSERT" as ImportWriteMode,
  headerRowIndex: 0,
  batchSize: 500,
  customImportEnabled: true,
  remark: "",
});
const mappingForm = reactive({
  title: "",
  field: "",
  targetColumn: "",
  dataType: "STRING" as ImportDataType,
  formatPattern: "",
  defaultValue: "",
  converterKey: "",
  exactMatch: false,
  required: false,
  multiple: false,
  repeat: true,
});
const templateRules: FormRules = {
  templateName: [{ required: true, message: "请输入模板名称", trigger: "blur" }],
  templateCode: [{ required: true, message: "请输入模板编码", trigger: "blur" }],
  templateModule: [{ required: true, message: "请输入所属模块", trigger: "blur" }],
  fileType: [{ required: true, message: "请选择文件类型", trigger: "change" }],
};
const mappingRules: FormRules = {
  title: [{ required: true, message: "请输入 Excel 列标题", trigger: "blur" }],
  field: [{ required: true, message: "请输入目标字段", trigger: "blur" }],
};
const enabledCount = computed(
  () => templates.records.filter((item) => item.enabled !== false).length,
);
onMounted(() => void loadTemplates());
function split(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function asTemplate(value: unknown): SystemImportTemplate {
  return value as SystemImportTemplate;
}
function asMapping(value: unknown): SystemImportMapping {
  return value as SystemImportMapping;
}
function templatePayload(): ImportTemplateSavePayload {
  return {
    templateName: templateForm.templateName.trim(),
    templateCode: templateForm.templateCode.trim(),
    templateModule: templateForm.templateModule.trim(),
    fileType: templateForm.fileType,
    fileNamePatterns: split(templateForm.fileNamePatterns),
    sheetNames: split(templateForm.sheetNames),
    targetSchema: templateForm.targetSchema.trim() || "public",
    ...(templateForm.targetTable.trim() ? { targetTable: templateForm.targetTable.trim() } : {}),
    customImportEnabled: templateForm.customImportEnabled,
    ...(templateForm.handlerKey.trim() ? { handlerKey: templateForm.handlerKey.trim() } : {}),
    writeMode: templateForm.writeMode,
    headerRowIndex: templateForm.headerRowIndex,
    batchSize: templateForm.batchSize,
    ...(templateForm.remark.trim() ? { remark: templateForm.remark.trim() } : {}),
  };
}
function mappingPayload(): ImportMappingSavePayload {
  return {
    templateId: selectedTemplate.value?.id ?? "",
    title: split(mappingForm.title),
    field: mappingForm.field.trim(),
    ...(mappingForm.targetColumn.trim() ? { targetColumn: mappingForm.targetColumn.trim() } : {}),
    dataType: mappingForm.dataType,
    ...(mappingForm.formatPattern.trim()
      ? { formatPattern: mappingForm.formatPattern.trim() }
      : {}),
    ...(mappingForm.defaultValue.trim() ? { defaultValue: mappingForm.defaultValue.trim() } : {}),
    ...(mappingForm.converterKey.trim() ? { converterKey: mappingForm.converterKey.trim() } : {}),
    exactMatch: mappingForm.exactMatch,
    required: mappingForm.required,
    multiple: mappingForm.multiple,
    repeat: mappingForm.repeat,
  };
}
function reset() {
  query.templateName = "";
  query.templateModule = "";
  pageNum.value = 1;
  void loadTemplates();
}
function search() {
  pageNum.value = 1;
  void loadTemplates();
}
function changePage(page: number) {
  pageNum.value = page;
  void loadTemplates();
}
async function loadTemplates() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await props.client.listImportTemplates({
      pageNum: pageNum.value,
      pageSize,
      templateName: query.templateName,
      templateModule: query.templateModule,
    });
    templates.records = result.records ?? [];
    templates.total = Number(result.total ?? 0);
    const next =
      templates.records.find((item) => item.id === selectedTemplate.value?.id) ??
      templates.records[0];
    await selectTemplate(next);
  } catch (error) {
    templates.records = [];
    templates.total = 0;
    mappings.records = [];
    mappings.total = 0;
    loadError.value = systemErrorMessage(error, "导入模板加载失败");
  } finally {
    loading.value = false;
  }
}
async function selectTemplate(value?: SystemImportTemplate | null) {
  selectedTemplate.value = value ?? undefined;
  mappings.records = [];
  mappings.total = 0;
  if (!value) return;
  mappingLoading.value = true;
  try {
    const result = await props.client.listImportMappings({
      pageNum: 1,
      pageSize: 500,
      templateId: value.id,
    });
    mappings.records = result.records ?? [];
    mappings.total = Number(result.total ?? 0);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字段映射加载失败"));
  } finally {
    mappingLoading.value = false;
  }
}
async function openTemplate(item?: SystemImportTemplate) {
  templateId.value = item?.id ?? "";
  const defaults = {
    templateName: "",
    templateCode: "",
    templateModule: "",
    fileType: "xlsx" as ImportFileType,
    fileNamePatterns: "",
    sheetNames: "",
    targetSchema: "public",
    targetTable: "",
    handlerKey: "",
    writeMode: "INSERT" as ImportWriteMode,
    headerRowIndex: 0,
    batchSize: 500,
    customImportEnabled: true,
    remark: "",
  };
  Object.assign(templateForm, defaults);
  templateDialog.value = true;
  if (!item) return;
  try {
    const detail = await props.client.getImportTemplate(item.id);
    Object.assign(templateForm, {
      templateName: detail.templateName,
      templateCode: detail.templateCode,
      templateModule: detail.templateModule,
      fileType: detail.fileType,
      fileNamePatterns: detail.fileNamePatterns?.join(", ") ?? "",
      sheetNames: detail.sheetNames?.join(", ") ?? "",
      targetSchema: detail.targetSchema ?? "public",
      targetTable: detail.targetTable ?? "",
      handlerKey: detail.handlerKey ?? "",
      writeMode: detail.writeMode ?? "INSERT",
      headerRowIndex: detail.headerRowIndex ?? 0,
      batchSize: detail.batchSize ?? 500,
      customImportEnabled: detail.customImportEnabled !== false,
      remark: detail.remark ?? "",
    });
  } catch (error) {
    templateDialog.value = false;
    ElMessage.error(systemErrorMessage(error, "导入模板详情加载失败"));
  }
}
function openMapping(item?: SystemImportMapping) {
  mappingId.value = item?.id ?? "";
  Object.assign(mappingForm, {
    title: item?.title.join(", ") ?? "",
    field: item?.field ?? "",
    targetColumn: item?.targetColumn ?? "",
    dataType: item?.dataType ?? "STRING",
    formatPattern: item?.formatPattern ?? "",
    defaultValue: item?.defaultValue ?? "",
    converterKey: item?.converterKey ?? "",
    exactMatch: item?.exactMatch ?? false,
    required: item?.required ?? false,
    multiple: item?.multiple ?? false,
    repeat: item?.repeat ?? true,
  });
  mappingDialog.value = true;
}
async function submitTemplate() {
  if (!(await templateFormRef.value?.validate().catch(() => false))) return;
  submitting.value = true;
  try {
    if (templateId.value)
      await props.client.updateImportTemplate(templateId.value, templatePayload());
    else await props.client.createImportTemplate(templatePayload());
    ElMessage.success("导入模板已保存");
    templateDialog.value = false;
    await loadTemplates();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "导入模板保存失败"));
  } finally {
    submitting.value = false;
  }
}
async function submitMapping() {
  if (!(await mappingFormRef.value?.validate().catch(() => false)) || !selectedTemplate.value)
    return;
  submitting.value = true;
  try {
    if (mappingId.value) await props.client.updateImportMapping(mappingId.value, mappingPayload());
    else await props.client.createImportMapping(mappingPayload());
    ElMessage.success("字段映射已保存");
    mappingDialog.value = false;
    await selectTemplate(selectedTemplate.value);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "字段映射保存失败"));
  } finally {
    submitting.value = false;
  }
}
async function toggleTemplate(item: SystemImportTemplate, enabled: boolean) {
  try {
    await props.client.updateImportTemplateEnabled(item.id, enabled);
    item.enabled = enabled;
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "状态更新失败"));
    await loadTemplates();
  }
}
async function removeTemplate(item: SystemImportTemplate) {
  try {
    await ElMessageBox.confirm(`确认删除模板「${item.templateName}」？`, "删除确认", {
      type: "warning",
    });
    await props.client.deleteImportTemplate(item.id);
    await loadTemplates();
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(systemErrorMessage(error, "模板删除失败"));
  }
}
async function removeMapping(item: SystemImportMapping) {
  try {
    await ElMessageBox.confirm(`确认删除字段映射「${item.field}」？`, "删除确认", {
      type: "warning",
    });
    await props.client.deleteImportMapping(item.id);
    if (selectedTemplate.value) await selectTemplate(selectedTemplate.value);
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(systemErrorMessage(error, "映射删除失败"));
  }
}
</script>
