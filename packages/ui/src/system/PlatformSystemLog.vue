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
          <small>日志总量</small>
          <strong>{{ page.total }}</strong>
          <span>当前查询范围</span>
        </article>
        <article>
          <small>本页成功</small>
          <strong>{{ successCount }}</strong>
          <span>执行结果正常</span>
        </article>
        <article>
          <small>本页失败</small>
          <strong>{{ failureCount }}</strong>
          <span>需要关注处理</span>
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
        <select v-model="draft.status" class="system-native-select" aria-label="执行结果">
          <option value="all">全部结果</option>
          <option value="SUCCESS">成功</option>
          <option value="FAIL">失败</option>
        </select>
        <ElDatePicker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DD HH:mm:ss"
          class="system-log-date-range"
        />
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button type="danger" plain :icon="Delete" :disabled="!canClear" @click="clearLogs">
          清理历史
        </el-button>
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <header>
        <div>
          <p class="platform-eyebrow">Immutable Audit Trail</p>
          <h2 class="platform-title">{{ props.config.title }}记录</h2>
        </div>
        <span class="system-permission-hint">详情中的请求和响应数据按原始审计记录展示</span>
      </header>

      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false">
        <template #default>
          <el-button link type="primary" @click="load">重新加载</el-button>
        </template>
      </el-alert>

      <el-table v-loading="loading" :data="page.records" stripe>
        <el-table-column type="index" label="序号" width="66" align="center" />
        <el-table-column
          v-for="column in props.config.columns"
          :key="column.key"
          :label="column.label"
          :width="column.width ?? ''"
          :min-width="column.minWidth ?? 80"
        >
          <template #default="{ row }">
            <el-tag
              v-if="column.kind === 'status'"
              :type="isSuccessful(asLog(row)) ? 'success' : 'danger'"
              size="small"
            >
              {{ formatStatus(asLog(row)) }}
            </el-tag>
            <span v-else>{{ formatValue(asLog(row)[column.key], column.kind) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="!canQuery" @click="openDetail(asLog(row))">
              详情
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="`暂无${props.config.title}`" />
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

  <el-drawer
    v-model="detailVisible"
    :title="`${props.config.title}详情`"
    size="620px"
    append-to-body
  >
    <el-skeleton :loading="detailLoading" animated>
      <section v-if="detail" class="system-log-detail">
        <article v-for="entry in detailEntries" :key="entry.key">
          <small>{{ entry.label }}</small>
          <pre v-if="entry.long">{{ entry.value }}</pre>
          <strong v-else>{{ entry.value }}</strong>
        </article>
      </section>
    </el-skeleton>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElDrawer,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import { Delete, Refresh, Search } from "@element-plus/icons-vue";
import type { QueryValue, SystemLogRecord, SystemPage } from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemLogConfig, SystemViewProps } from "./system-types";

type LogRecord = SystemLogRecord;
const props = withDefaults(
  defineProps<
    SystemViewProps & {
      config: SystemLogConfig;
    }
  >(),
  {
    permissions: () => [],
    superAdmin: false,
  },
);

const canQuery = hasSystemPermission(props, "system:log:query");
const canClear = hasSystemPermission(props, "system:log:clear");
const loading = ref(false);
const detailLoading = ref(false);
const loadError = ref("");
const detailVisible = ref(false);
const detail = ref<LogRecord>();
const page = reactive<SystemPage<LogRecord>>({ records: [], total: 0 });
const query = reactive<{ pageNum: number; pageSize: number; [key: string]: QueryValue }>({
  pageNum: 1,
  pageSize: 10,
});
const draft = reactive<Record<string, string>>({ status: "all" });
const dateRange = ref<[string, string] | null>(null);

const successCount = computed(() => page.records.filter(isSuccessful).length);
const failureCount = computed(() => page.records.length - successCount.value);
const detailEntries = computed(() => {
  if (!detail.value) {
    return [];
  }

  const preferredLabels = Object.fromEntries(
    props.config.columns.map((column) => [column.key, column.label]),
  );
  const fallbackLabels: Record<string, string> = {
    id: "日志 ID",
    tenantId: "租户 ID",
    createdAt: "记录时间",
    requestMethod: "HTTP 方法",
    requestUrl: "请求地址",
    requestParams: "请求参数",
    responseData: "响应结果",
    message: "错误或提示信息",
    objectKey: "对象键",
    bucketName: "存储桶",
    contentType: "内容类型",
    fileUrl: "文件地址",
    fileMd5: "文件 MD5",
  };

  return Object.entries(detail.value).map(([key, value]) => ({
    key,
    label: preferredLabels[key] || fallbackLabels[key] || key,
    value: formatValue(value, key === "fileSize" ? "bytes" : "text"),
    long: ["requestParams", "responseData", "message", "fileUrl", "objectKey"].includes(key),
  }));
});

onMounted(() => {
  props.config.searchFields.forEach((field) => {
    draft[field.key] = "";
  });
  void load();
});

function asLog(value: unknown) {
  return value as LogRecord;
}

function isSuccessful(record: LogRecord) {
  return record.status === "SUCCESS";
}

function formatStatus(record: LogRecord) {
  return typeof record.statusLabel === "string" && record.statusLabel.length > 0
    ? record.statusLabel
    : isSuccessful(record)
      ? "成功"
      : "失败";
}

function formatValue(value: unknown, kind: string | undefined) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (kind === "bytes") {
    const bytes = Number(value);
    if (!Number.isFinite(bytes)) {
      return String(value);
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await props.client.listLogs<LogRecord>(props.config.kind, query);
    page.records = result?.records ?? [];
    page.total = Number(result?.total ?? 0);
  } catch (error) {
    page.records = [];
    page.total = 0;
    loadError.value = systemErrorMessage(error, `${props.config.title}加载失败`);
  } finally {
    loading.value = false;
  }
}

function search() {
  query.pageNum = 1;
  props.config.searchFields.forEach((field) => {
    query[field.key] = draft[field.key]?.trim() || undefined;
  });
  query[props.config.statusKey] =
    draft.status === "all"
      ? undefined
      : props.config.kind === "oss"
        ? String(draft.status === "SUCCESS")
        : draft.status;
  query.startTime = dateRange.value?.[0];
  query.endTime = dateRange.value?.[1];
  void load();
}

function resetSearch() {
  props.config.searchFields.forEach((field) => {
    draft[field.key] = "";
    query[field.key] = undefined;
  });
  draft.status = "all";
  query[props.config.statusKey] = undefined;
  query.startTime = undefined;
  query.endTime = undefined;
  query.pageNum = 1;
  dateRange.value = null;
  void load();
}

function changePage(pageNum: number) {
  query.pageNum = pageNum;
  void load();
}

async function openDetail(record: LogRecord) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = undefined;
  try {
    detail.value = await props.client.getLog<LogRecord>(props.config.kind, record.id);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, `${props.config.title}详情加载失败`));
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function clearLogs() {
  try {
    await ElMessageBox.confirm(
      `确认清理历史${props.config.title}？服务端会保留最近 30 天记录。`,
      `清理${props.config.title}`,
      {
        type: "warning",
        confirmButtonText: "确认清理",
        cancelButtonText: "取消",
      },
    );
    await props.client.clearLogs(props.config.kind);
    ElMessage.success(`历史${props.config.title}已清理`);
    query.pageNum = 1;
    await load();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(systemErrorMessage(error, `${props.config.title}清理失败`));
    }
  }
}
</script>
