<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Personal Inbox</p>
        <h1>消息中心</h1>
        <span>集中展示当前用户的系统公告、工作提醒和审批通知，与产品业务解耦。</span>
      </div>
      <div class="system-stat-grid">
        <article>
          <small>消息总数</small><strong>{{ page.total }}</strong
          ><span>当前查询范围</span>
        </article>
        <article>
          <small>未读数</small><strong>{{ unreadCount }}</strong
          ><span>需要处理</span>
        </article>
        <article>
          <small>公告数</small><strong>{{ notices.length }}</strong
          ><span>当前展示</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <el-input v-model="draft.msgTitle" clearable placeholder="消息标题" @keyup.enter="search" />
        <select v-model="draft.msgType" class="system-native-select" aria-label="消息类型">
          <option value="">全部类型</option>
          <option value="1">系统公告</option>
          <option value="2">普通消息</option>
          <option value="3">工作提醒</option>
          <option value="4">审批通知</option>
        </select>
        <select v-model="draft.isRead" class="system-native-select" aria-label="已读状态">
          <option value="">全部状态</option>
          <option value="false">未读</option>
          <option value="true">已读</option>
        </select>
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="reset">重置</el-button>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button :disabled="!unreadIds.length || !canRead" @click="markPageRead"
          >本页全部已读</el-button
        >
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />
      <el-table
        v-loading="loading"
        :data="page.records"
        stripe
        @row-click="(row: unknown) => openDetail(asMessage(row))"
      >
        <el-table-column label="状态" width="75"
          ><template #default="{ row }"
            ><el-tag :type="row.isRead ? 'info' : 'danger'" size="small">{{
              row.isRead ? "已读" : "未读"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="msgTitle" label="消息标题" min-width="240" show-overflow-tooltip />
        <el-table-column label="类型" width="120"
          ><template #default="{ row }">{{
            row.msgTypeLabel || messageTypeLabel(row.msgType)
          }}</template></el-table-column
        >
        <el-table-column label="优先级" width="100"
          ><template #default="{ row }">{{
            row.priorityLabel || priorityLabel(row.priority)
          }}</template></el-table-column
        >
        <el-table-column prop="senderName" label="发送人" width="130" />
        <el-table-column prop="createTime" label="发送时间" width="180" />
        <el-table-column label="公告栏" width="90"
          ><template #default="{ row }"
            ><el-switch
              :model-value="asMessage(row).display === true"
              :disabled="!canDisplay"
              @click.stop
              @change="
                (value: boolean | string | number) => setDisplay(asMessage(row), Boolean(value))
              " /></template
        ></el-table-column>
        <el-table-column label="操作" width="90"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :disabled="asMessage(row).isRead || !canRead"
              @click.stop="markRead(asMessage(row))"
              >标记已读</el-button
            ></template
          ></el-table-column
        >
        <template #empty><el-empty description="暂无消息" /></template>
      </el-table>
      <PlatformPager
        :page="query.pageNum"
        :page-size="query.pageSize"
        :total="page.total"
        @change="changePage"
      />
    </section>
  </section>

  <el-drawer v-model="drawerVisible" title="消息详情" size="520px" append-to-body>
    <article v-if="activeMessage" class="system-message-detail">
      <header>
        <el-tag :type="activeMessage.isRead ? 'info' : 'danger'">{{
          activeMessage.isRead ? "已读" : "未读"
        }}</el-tag
        ><span>{{ activeMessage.msgTypeLabel || messageTypeLabel(activeMessage.msgType) }}</span>
      </header>
      <h2>{{ activeMessage.msgTitle }}</h2>
      <p class="system-message-meta">
        {{ activeMessage.senderName || "系统" }} · {{ activeMessage.createTime || "—" }}
      </p>
      <div class="system-message-content">{{ activeMessage.msgContent || "暂无消息内容" }}</div>
    </article>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElAlert,
  ElButton,
  ElDrawer,
  ElEmpty,
  ElInput,
  ElMessage,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import type { SystemMessage, SystemPage } from "@guanxiangkai/platform-client";
import PlatformPager from "./PlatformPager.vue";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const canRead = computed(
  () =>
    hasSystemPermission(props, "system:message:read") ||
    hasSystemPermission(props, "system:message:edit"),
);
const canDisplay = computed(
  () =>
    hasSystemPermission(props, "system:message:display") ||
    hasSystemPermission(props, "system:message:edit"),
);
const page = reactive<SystemPage<SystemMessage>>({ records: [], total: 0 });
const notices = ref<SystemMessage[]>([]);
const unreadCount = ref(0);
const loading = ref(false);
const loadError = ref("");
const query = reactive({ pageNum: 1, pageSize: 20, msgTitle: "", msgType: "", isRead: "" });
const draft = reactive({ msgTitle: "", msgType: "", isRead: "" });
const activeMessage = ref<SystemMessage>();
const drawerVisible = ref(false);
const unreadIds = computed(() =>
  page.records.filter((item) => !item.isRead).map((item) => item.id),
);
onMounted(() => void load());
function messageTypeLabel(type: string) {
  return (
    (
      { "1": "系统公告", "2": "普通消息", "3": "工作提醒", "4": "审批通知" } as Record<
        string,
        string
      >
    )[type] ?? type
  );
}
function priorityLabel(priority?: string) {
  return priority
    ? (({ "1": "高", "2": "中", "3": "低" } as Record<string, string>)[priority] ?? priority)
    : "—";
}
function asMessage(value: unknown): SystemMessage {
  return value as SystemMessage;
}
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [result, count, noticeList] = await Promise.all([
      props.client.listMessages({
        pageNum: query.pageNum,
        pageSize: query.pageSize,
        msgTitle: query.msgTitle,
        msgType: query.msgType,
        isRead: query.isRead === "" ? undefined : query.isRead === "true",
      }),
      props.client.getUnreadMessageCount(),
      props.client.listNotices(),
    ]);
    page.records = result.records ?? [];
    page.total = Number(result.total ?? 0);
    unreadCount.value = Number(count ?? 0);
    notices.value = noticeList ?? [];
  } catch (error) {
    page.records = [];
    page.total = 0;
    loadError.value = systemErrorMessage(error, "消息加载失败");
  } finally {
    loading.value = false;
  }
}
function search() {
  Object.assign(query, draft, { pageNum: 1 });
  void load();
}
function reset() {
  Object.assign(draft, { msgTitle: "", msgType: "", isRead: "" });
  Object.assign(query, { pageNum: 1, msgTitle: "", msgType: "", isRead: "" });
  void load();
}
function changePage(pageNum: number) {
  query.pageNum = pageNum;
  void load();
}
async function openDetail(message: SystemMessage) {
  try {
    activeMessage.value = await props.client.getMessage(message.id);
    drawerVisible.value = true;
    if (!message.isRead && canRead.value) await markRead(message, false);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "消息详情加载失败"));
  }
}
async function markRead(message: SystemMessage, reload = true) {
  try {
    await props.client.markMessageRead(message.id);
    message.isRead = true;
    if (activeMessage.value?.id === message.id) activeMessage.value.isRead = true;
    if (reload) await load();
    else unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "消息状态更新失败"));
  }
}
async function markPageRead() {
  try {
    await props.client.batchMarkMessagesRead(unreadIds.value);
    await load();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "批量标记失败"));
  }
}
async function setDisplay(message: SystemMessage, display: boolean) {
  try {
    await props.client.setMessageDisplay(message.id, display);
    message.display = display;
    notices.value = await props.client.listNotices();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "公告状态更新失败"));
    await load();
  }
}
</script>
